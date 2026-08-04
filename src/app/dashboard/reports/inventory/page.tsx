"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import {
  getInventoryValuation,
  type InventoryValuationRow,
} from "@/lib/api/reports";
import * as S from "../page.styles";

type StockHealth = "out" | "critical" | "low" | "ok";
type NavTab = "overview" | "reorder" | "valuation" | "insights";
type SortCol = "urgency" | "value" | "qty" | "coverage";

type Enriched = InventoryValuationRow & {
  urgency: number;
  coverage: number;
};

type DateRange = {
  from: Date | null;
  to: Date | null;
};

type CategoryData = {
  name: string;
  value: number;
  qty: number;
  count: number;
  atRisk: number;
};

const STATUS_CFG: Record<StockHealth, { label: string; cls: string; dot: string }> = {
  out: {
    label: "Out of Stock",
    cls: "border-red-200 bg-red-50 text-red-700",
    dot: "#ef4444",
  },
  critical: {
    label: "Critical",
    cls: "border-orange-200 bg-orange-50 text-orange-700",
    dot: "#f97316",
  },
  low: {
    label: "Low",
    cls: "border-amber-200 bg-amber-50 text-amber-700",
    dot: "#f59e0b",
  },
  ok: {
    label: "Healthy",
    cls: "border-green-200 bg-green-50 text-green-700",
    dot: "#22c55e",
  },
};

const fmtMoney = (v: number) =>
  `Ksh ${Number(v || 0).toLocaleString("en-KE", {
    maximumFractionDigits: 0,
  })}`;

const fmtDate = (date: Date | null) => {
  if (!date) return "";
  return date.toLocaleDateString("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const toISODate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;

function urgencyScore(r: InventoryValuationRow): number {
  if (r.status === "out") return 100;
  if (r.status === "critical") return 75;
  if (r.status === "low") return 45;

  const buffer = r.reorder_level > 0 ? r.qty_on_hand / r.reorder_level : 10;
  return Math.max(0, Math.min(20, Math.round(20 / buffer)));
}

function coverageRatio(r: InventoryValuationRow): number {
  if (!r.reorder_level) return r.qty_on_hand > 0 ? 99 : 0;
  return Number((r.qty_on_hand / r.reorder_level).toFixed(2));
}

function getRowDateMs(row: unknown): number | null {
  const r = row as Record<string, unknown>;

  const raw =
    r.created_at ??
    r.createdAt ??
    r.updated_at ??
    r.updatedAt ??
    r.date ??
    r.stock_date ??
    r.inventory_date;

  if (!raw) return null;

  const ms = new Date(String(raw)).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function isWithinRange(row: unknown, range: DateRange) {
  if (!range.from && !range.to) return true;

  const rowMs = getRowDateMs(row);
  if (!rowMs) return false;

  const fromMs = range.from
    ? new Date(toISODate(range.from) + "T00:00:00").getTime()
    : null;

  const toMs = range.to
    ? new Date(toISODate(range.to) + "T23:59:59").getTime()
    : null;

  if (fromMs && rowMs < fromMs) return false;
  if (toMs && rowMs > toMs) return false;

  return true;
}

function downloadCSV(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;

  const headers = Object.keys(rows[0]);

  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => esc(r[h])).join(",")),
  ].join("\n");

  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8;" })
  );

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}

async function exportInventoryPdf(params: {
  rows: Enriched[];
  categoryData: CategoryData[];
  totals: {
    out: number;
    critical: number;
    low: number;
    ok: number;
    totalVal: number;
    atRiskVal: number;
    avgCoverage: number;
  };
  range: DateRange;
}) {
  const { rows, categoryData, totals, range } = params;
  const { jsPDF } = await import("jspdf");
  const {
    PDF_COMPANY_NAME,
    PDF_RGB,
    loadPdfLogoMarkDataUrl,
  } = await import("@/lib/pdfBrand");

  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  let y = 18;

  const line = (text: string, size = 10, bold = false) => {
    if (y > pageHeight - 18) {
      doc.addPage();
      y = 18;
    }

    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...PDF_RGB.dark);
    doc.text(text, 14, y);
    y += size > 12 ? 8 : 6;
  };

  const right = (text: string, x: number, yy: number, size = 9, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...PDF_RGB.dark);
    doc.text(text, x, yy, { align: "right" });
  };

  const period =
    range.from || range.to
      ? `${fmtDate(range.from) || "Start"} to ${fmtDate(range.to) || "Today"}`
      : "All available records";

  doc.setFillColor(...PDF_RGB.honey);
  doc.rect(0, 0, pageWidth, 5, "F");

  const logoData = await loadPdfLogoMarkDataUrl();
  if (logoData) {
    doc.addImage(logoData, "PNG", pageWidth - 28, 10, 14, 14);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_RGB.honeyDark);
  doc.text(PDF_COMPANY_NAME.toUpperCase(), 14, 12);

  line("Inventory Analytics Report", 18, true);
  line(`Generated: ${fmtDate(new Date())}`, 9);
  line(`Period: ${period}`, 9);
  line(`${rows.length} products analysed`, 9);

  y += 4;

  line("Summary", 13, true);

  const riskPct = ((totals.atRiskVal / (totals.totalVal || 1)) * 100).toFixed(1);

  line(`Total stock value: ${fmtMoney(totals.totalVal)}`);
  line(`At-risk stock value: ${fmtMoney(totals.atRiskVal)} (${riskPct}%)`);
  line(
    `Stock health: ${totals.out} out, ${totals.critical} critical, ${totals.low} low, ${totals.ok} healthy`
  );
  line(`Average coverage: ${totals.avgCoverage.toFixed(1)}x reorder level`);

  y += 4;

  line("Category Summary", 13, true);

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Category", 14, y);
  right("Products", 80, y, 8, true);
  right("At Risk", 110, y, 8, true);
  right("Quantity", 145, y, 8, true);
  right("Value", 195, y, 8, true);
  y += 4;

  doc.setDrawColor(...PDF_RGB.line);
  doc.line(14, y, 196, y);
  y += 5;

  categoryData.slice(0, 20).forEach((cat) => {
    if (y > pageHeight - 18) {
      doc.addPage();
      y = 18;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(String(cat.name).slice(0, 32), 14, y);
    right(String(cat.count), 80, y);
    right(String(cat.atRisk), 110, y);
    right(cat.qty.toLocaleString("en-KE"), 145, y);
    right(fmtMoney(cat.value), 195, y);
    y += 5;
  });

  y += 6;

  line("Reorder Priority", 13, true);

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Product", 14, y);
  right("Qty", 90, y, 8, true);
  right("Reorder", 118, y, 8, true);
  doc.text("Status", 128, y);
  right("Coverage", 170, y, 8, true);
  right("Urgency", 195, y, 8, true);
  y += 4;

  doc.line(14, y, 196, y);
  y += 5;

  rows
    .filter((r) => r.status !== "ok")
    .sort((a, b) => b.urgency - a.urgency)
    .slice(0, 45)
    .forEach((r) => {
      if (y > pageHeight - 18) {
        doc.addPage();
        y = 18;
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(String(r.name).slice(0, 34), 14, y);
      right(String(r.qty_on_hand), 90, y);
      right(String(r.reorder_level), 118, y);
      doc.text(STATUS_CFG[r.status as StockHealth]?.label ?? r.status, 128, y);
      right(r.coverage >= 99 ? "Infinity" : `${r.coverage}x`, 170, y);
      right(String(r.urgency), 195, y);
      y += 5;
    });

  doc.save(`inventory_analytics_${new Date().toISOString().slice(0, 10)}.pdf`);
}

function StatusBadge({ status }: { status: StockHealth }) {
  const c = STATUS_CFG[status] ?? STATUS_CFG.ok;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${c.cls}`}
    >
      {c.label}
    </span>
  );
}

function Spinner({ h = 120 }: { h?: number }) {
  return (
    <div
      className="flex items-center justify-center gap-3 text-slate-400"
      style={{ height: h }}
    >
      <svg
        className="h-4 w-4 animate-spin"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="10" strokeOpacity="0.2" />
        <path d="M12 2a10 10 0 0110 10" />
      </svg>
      <span className="text-sm">Loading…</span>
    </div>
  );
}

function UrgencyBar({ score }: { score: number }) {
  const color =
    score >= 75
      ? "#ef4444"
      : score >= 45
      ? "#f97316"
      : score >= 20
      ? "#f59e0b"
      : "#22c55e";

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
      <span className="w-7 text-right text-xs font-semibold text-slate-500">
        {score}
      </span>
    </div>
  );
}

function SegControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex w-full gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-sm sm:w-fit">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition ${
            value === o.value
              ? "bg-amber-500 text-white shadow-sm"
              : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  variant = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  variant?: "neutral" | "success" | "warning" | "danger";
}) {
  const cfg = {
    neutral: "border-slate-200 bg-white text-slate-900",
    success: "border-green-200 bg-green-50 text-green-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    danger: "border-red-200 bg-red-50 text-red-800",
  }[variant];

  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${cfg}`}>
      <div className="text-xs font-semibold uppercase tracking-wide opacity-70">
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold leading-tight">{value}</div>
      {sub && <div className="mt-1 text-xs opacity-70">{sub}</div>}
    </div>
  );
}

function Card({
  title,
  sub,
  action,
  children,
  noPad,
}: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  noPad?: boolean;
}) {
  return (
    <div className={`${S.card} overflow-hidden`}>
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-bold text-slate-900">{title}</div>
          {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
        </div>
        {action}
      </div>
      {noPad ? children : <div className="px-5 py-4">{children}</div>}
    </div>
  );
}

function SortTh({
  col,
  active,
  dir,
  onSort,
  align = "left",
  children,
}: {
  col: SortCol;
  active: SortCol;
  dir: "asc" | "desc";
  onSort: (c: SortCol) => void;
  align?: "left" | "right";
  children: React.ReactNode;
}) {
  const isActive = active === col;

  return (
    <button
      type="button"
      onClick={() => onSort(col)}
      className={`flex w-full items-center gap-1 text-xs font-semibold uppercase tracking-wide ${
        align === "right" ? "justify-end" : ""
      } ${isActive ? "text-amber-600" : "text-slate-500 hover:text-slate-700"}`}
    >
      {children}
      <span className="opacity-60">{isActive ? (dir === "desc" ? "↓" : "↑") : "↕"}</span>
    </button>
  );
}

function DateRangePicker({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => {
    const base = value.from ?? new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const label =
    value.from && value.to
      ? `${fmtDate(value.from)} - ${fmtDate(value.to)}`
      : value.from
      ? `${fmtDate(value.from)} - Select end`
      : "Select date range";

  const days = useMemo(() => {
    const start = new Date(month.getFullYear(), month.getMonth(), 1);
    const firstDay = start.getDay();
    const total = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();

    const cells: (Date | null)[] = [];

    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= total; d++) {
      cells.push(new Date(month.getFullYear(), month.getMonth(), d));
    }

    return cells;
  }, [month]);

  const inRange = (day: Date) => {
    if (!value.from || !value.to) return false;
    const ms = day.getTime();
    return ms >= value.from.getTime() && ms <= value.to.getTime();
  };

  const isSameDate = (a: Date | null, b: Date | null) =>
    !!a && !!b && toISODate(a) === toISODate(b);

  const pick = (day: Date) => {
    if (!value.from || value.to) {
      onChange({ from: day, to: null });
      return;
    }

    if (day.getTime() < value.from.getTime()) {
      onChange({ from: day, to: value.from });
      setOpen(false);
      return;
    }

    onChange({ from: value.from, to: day });
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        className={`${S.input} flex items-center justify-between text-left`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={value.from ? "text-slate-900" : "text-slate-400"}>
          {label}
        </span>
        <span className="text-xs text-slate-400">Range</span>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[320px] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              onClick={() =>
                setMonth(
                  new Date(month.getFullYear(), month.getMonth() - 1, 1)
                )
              }
            >
              Prev
            </button>

            <div className="text-sm font-bold text-slate-900">
              {month.toLocaleDateString("en-KE", {
                month: "long",
                year: "numeric",
              })}
            </div>

            <button
              type="button"
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              onClick={() =>
                setMonth(
                  new Date(month.getFullYear(), month.getMonth() + 1, 1)
                )
              }
            >
              Next
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold uppercase text-slate-400">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1">
            {days.map((day, i) => {
              if (!day) return <div key={i} />;

              const selected =
                isSameDate(day, value.from) || isSameDate(day, value.to);
              const ranged = inRange(day);

              return (
                <button
                  key={toISODate(day)}
                  type="button"
                  onClick={() => pick(day)}
                  className={`h-9 rounded-xl text-sm font-semibold transition ${
                    selected
                      ? "bg-amber-500 text-white shadow-sm"
                      : ranged
                      ? "bg-amber-50 text-amber-700"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
            <button
              type="button"
              className="text-sm font-semibold text-slate-500 hover:text-slate-900"
              onClick={() => {
                onChange({ from: null, to: null });
                setOpen(false);
              }}
            >
              Clear
            </button>

            <button
              type="button"
              className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white hover:bg-amber-600"
              onClick={() => setOpen(false)}
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusDonut({
  segs,
}: {
  segs: { label: string; value: number; color: string }[];
}) {
  const total = segs.reduce((s, x) => s + x.value, 0);
  if (!total) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-slate-400">
        No data
      </div>
    );
  }

  let angle = -Math.PI / 2;
  const cx = 90;
  const cy = 90;
  const outer = 70;
  const inner = 42;

  const arcs = segs.map((seg) => {
    const sweep = (seg.value / total) * 2 * Math.PI;
    const start = angle;
    const end = angle + sweep;
    angle += sweep;

    const large = sweep > Math.PI ? 1 : 0;

    const d = [
      `M ${cx + outer * Math.cos(start)} ${cy + outer * Math.sin(start)}`,
      `A ${outer} ${outer} 0 ${large} 1 ${cx + outer * Math.cos(end)} ${
        cy + outer * Math.sin(end)
      }`,
      `L ${cx + inner * Math.cos(end)} ${cy + inner * Math.sin(end)}`,
      `A ${inner} ${inner} 0 ${large} 0 ${cx + inner * Math.cos(start)} ${
        cy + inner * Math.sin(start)
      }`,
      "Z",
    ].join(" ");

    return { ...seg, d, pct: ((seg.value / total) * 100).toFixed(0) };
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr] lg:items-center">
      <svg viewBox="0 0 180 180" className="mx-auto h-44 w-44">
        {arcs.map((arc) => (
          <path key={arc.label} d={arc.d} fill={arc.color} opacity="0.9" />
        ))}
        <circle cx={cx} cy={cy} r={inner - 2} fill="white" />
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          fontSize="11"
          fill="#64748b"
          fontWeight="700"
        >
          Products
        </text>
        <text
          x={cx}
          y={cy + 15}
          textAnchor="middle"
          fontSize="18"
          fill="#0f172a"
          fontWeight="800"
        >
          {total}
        </text>
      </svg>

      <div className="space-y-2">
        {arcs.map((arc) => (
          <div
            key={arc.label}
            className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: arc.color }}
              />
              <span className="text-sm font-semibold text-slate-700">
                {arc.label}
              </span>
            </div>
            <span className="text-sm font-bold text-slate-900">
              {arc.value} ({arc.pct}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SimpleBars({
  data,
}: {
  data: { name: string; value: number; sub?: string; color?: string }[];
}) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="space-y-3">
      {data.map((d, index) => {
        const width = Math.max(2, (d.value / max) * 100);

        return (
          <div key={`${d.name}-${index}`}>
            <div className="mb-1 flex items-center justify-between gap-3">
              <span className="truncate text-sm font-semibold text-slate-700">
                {d.name}
              </span>
              <span className="shrink-0 text-sm font-bold text-slate-900">
                {d.sub ?? d.value}
              </span>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${width}%`,
                  background: d.color ?? "#f59e0b",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function InsightCard({
  title,
  detail,
  type,
}: {
  title: string;
  detail: string;
  type: "critical" | "warning" | "ok" | "neutral";
}) {
  const cls = {
    critical: "border-red-200 bg-red-50",
    warning: "border-amber-200 bg-amber-50",
    ok: "border-green-200 bg-green-50",
    neutral: "border-slate-200 bg-white",
  }[type];

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${cls}`}>
      <div className="text-sm font-bold text-slate-900">{title}</div>
      <div className="mt-1 text-xs leading-relaxed text-slate-600">{detail}</div>
    </div>
  );
}

export default function InventoryAnalyticsPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [rows, setRows] = useState<InventoryValuationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [tab, setTab] = useState<NavTab>("overview");
  const [q, setQ] = useState("");
  const [range, setRange] = useState<DateRange>({ from: null, to: null });
  const [filterStatus, setFilterStatus] = useState<StockHealth | "all">("all");
  const [sortCol, setSortCol] = useState<SortCol>("urgency");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    (async () => {
      try {
        setOrgId(await bootstrapOrg());
      } catch (e: any) {
        setErr(e.message ?? String(e));
        setLoading(false);
      }
    })();
  }, []);

  const fetchData = useCallback(async () => {
    if (!orgId) return;

    setLoading(true);
    setErr("");

    try {
      const res = await getInventoryValuation(orgId);
      setRows(res.rows);
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const enriched = useMemo<Enriched[]>(
    () =>
      rows.map((r) => ({
        ...r,
        urgency: urgencyScore(r),
        coverage: coverageRatio(r),
      })),
    [rows]
  );

  const baseRows = useMemo(
    () => enriched.filter((r) => isWithinRange(r, range)),
    [enriched, range]
  );

  const totals = useMemo(() => {
    const out = baseRows.filter((r) => r.status === "out").length;
    const critical = baseRows.filter((r) => r.status === "critical").length;
    const low = baseRows.filter((r) => r.status === "low").length;
    const ok = baseRows.filter((r) => r.status === "ok").length;

    const totalVal = baseRows.reduce((s, r) => s + r.total_value, 0);
    const atRiskVal = baseRows
      .filter((r) => r.status !== "ok")
      .reduce((s, r) => s + r.total_value, 0);

    const avgCoverage = baseRows.length
      ? baseRows.reduce((s, r) => s + r.coverage, 0) / baseRows.length
      : 0;

    return {
      out,
      critical,
      low,
      ok,
      totalVal,
      atRiskVal,
      avgCoverage,
      totalQty: baseRows.reduce((s, r) => s + r.qty_on_hand, 0),
    };
  }, [baseRows]);

  const categoryData = useMemo<CategoryData[]>(() => {
    const map: Record<string, CategoryData> = {};

    baseRows.forEach((r) => {
      const cat = r.category ?? "Uncategorised";

      if (!map[cat]) {
        map[cat] = {
          name: cat,
          value: 0,
          qty: 0,
          count: 0,
          atRisk: 0,
        };
      }

      map[cat].value += r.total_value;
      map[cat].qty += r.qty_on_hand;
      map[cat].count += 1;
      if (r.status !== "ok") map[cat].atRisk += 1;
    });

    return Object.values(map).sort((a, b) => b.value - a.value);
  }, [baseRows]);

  const tableRows = useMemo(() => {
    const term = q.trim().toLowerCase();

    return baseRows
      .filter((r) => {
        const matchesText =
          !term ||
          r.name.toLowerCase().includes(term) ||
          (r.sku ?? "").toLowerCase().includes(term) ||
          (r.category ?? "").toLowerCase().includes(term);

        const matchesStatus =
          filterStatus === "all" || r.status === filterStatus;

        return matchesText && matchesStatus;
      })
      .sort((a, b) => {
        const mul = sortDir === "desc" ? -1 : 1;

        if (sortCol === "urgency") return mul * (a.urgency - b.urgency);
        if (sortCol === "value") return mul * (a.total_value - b.total_value);
        if (sortCol === "qty") return mul * (a.qty_on_hand - b.qty_on_hand);
        if (sortCol === "coverage") return mul * (a.coverage - b.coverage);

        return 0;
      });
  }, [baseRows, q, filterStatus, sortCol, sortDir]);

  const top10ByValue = useMemo(
    () => [...baseRows].sort((a, b) => b.total_value - a.total_value).slice(0, 10),
    [baseRows]
  );

  const insights = useMemo(() => {
    if (!baseRows.length) return [];

    const totalVal = totals.totalVal || 1;
    const urgent = baseRows.filter((r) => r.urgency >= 75);
    const deadStock = baseRows.filter(
      (r) => r.qty_on_hand > 0 && r.reorder_level === 0
    );

    return [
      {
        type: totals.out > 0 ? "critical" : "ok",
        title:
          totals.out > 0
            ? `${totals.out} products are out of stock`
            : "No products are out of stock",
        detail:
          totals.out > 0
            ? "Prioritise these products first because they cannot currently support sales."
            : "Stock availability is stable. Continue monitoring low and critical products.",
      },
      {
        type: urgent.length > 0 ? "warning" : "ok",
        title: `${urgent.length} urgent reorder items`,
        detail:
          urgent.length > 0
            ? `${urgent
                .slice(0, 3)
                .map((r) => r.name)
                .join(", ")}${urgent.length > 3 ? " and more need attention." : " need attention."}`
            : "No urgent reorder action is required from the current data.",
      },
      {
        type: totals.atRiskVal > totalVal * 0.3 ? "warning" : "ok",
        title: `${fmtMoney(totals.atRiskVal)} at risk`,
        detail: `${((totals.atRiskVal / totalVal) * 100).toFixed(
          1
        )}% of stock value is in low, critical, or out-of-stock products.`,
      },
      {
        type: deadStock.length > 0 ? "warning" : "ok",
        title: `${deadStock.length} products with no reorder level`,
        detail:
          deadStock.length > 0
            ? "Review whether these products should be restocked, discontinued, or configured properly."
            : "All stocked products have reorder levels configured.",
      },
    ] as const;
  }, [baseRows, totals]);

  const statusDist = useMemo(
    () =>
      [
        { label: "Healthy", value: totals.ok, color: "#22c55e" },
        { label: "Low", value: totals.low, color: "#f59e0b" },
        { label: "Critical", value: totals.critical, color: "#f97316" },
        { label: "Out", value: totals.out, color: "#ef4444" },
      ].filter((d) => d.value > 0),
    [totals]
  );

  const coverageData = useMemo(() => {
    const buckets = {
      "0x": 0,
      "< 1x": 0,
      "1-2x": 0,
      "2-5x": 0,
      "5x+": 0,
    };

    baseRows.forEach((r) => {
      if (r.qty_on_hand === 0) buckets["0x"]++;
      else if (r.coverage < 1) buckets["< 1x"]++;
      else if (r.coverage < 2) buckets["1-2x"]++;
      else if (r.coverage < 5) buckets["2-5x"]++;
      else buckets["5x+"]++;
    });

    return Object.entries(buckets).map(([name, value]) => ({
      name,
      value,
      sub: String(value),
      color: "#f59e0b",
    }));
  }, [baseRows]);

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
      return;
    }

    setSortCol(col);
    setSortDir("desc");
  };

  const exportRows = tableRows.map((r) => ({
    name: r.name,
    sku: r.sku ?? "",
    category: r.category ?? "",
    qty_on_hand: r.qty_on_hand,
    reorder_level: r.reorder_level,
    status: r.status,
    unit_price: r.unit_price,
    total_value: r.total_value,
    coverage: r.coverage,
    urgency: r.urgency,
  }));

  if (!orgId && !err) return <Spinner h={200} />;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Inventory Analytics
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {baseRows.length} products · {fmtMoney(totals.totalVal)} stock value
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
         

          <button
            className={S.btnGhost}
            disabled={!tableRows.length}
            onClick={() =>
              exportInventoryPdf({
                rows: tableRows,
                categoryData,
                totals,
                range,
              })
            }
          >
            Export PDF
          </button>

          <button
            className={S.btnGhost}
            disabled={!tableRows.length}
            onClick={() =>
              downloadCSV(
                `inventory_${new Date().toISOString().slice(0, 10)}.csv`,
                exportRows
              )
            }
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className={`${S.card} p-4`}>
        <div className="grid gap-3 lg:grid-cols-[1fr_320px_auto] lg:items-end">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">
              Search
            </label>
            <input
              className={S.input}
              placeholder="Search product, SKU, or category"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">
              Date range
            </label>
            <DateRangePicker value={range} onChange={setRange} />
          </div>

          <button
            className={S.btnGhost}
            onClick={() => {
              setQ("");
              setRange({ from: null, to: null });
              setFilterStatus("all");
            }}
          >
            Clear filters
          </button>
        </div>
      </div>

      <SegControl
        value={tab}
        onChange={setTab}
        options={[
          { value: "overview", label: "Overview" },
          { value: "reorder", label: "Reorder" },
          { value: "valuation", label: "Valuation" },
          { value: "insights", label: "Insights" },
        ]}
      />

      {err && (
        <div className={S.alert}>
          <span className="flex-1">{err}</span>
          <button
            onClick={() => setErr("")}
            className="ml-auto text-red-400 hover:text-red-600"
          >
            ×
          </button>
        </div>
      )}

      {loading && <Spinner h={200} />}

      {!loading && !err && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <KpiCard label="Total SKUs" value={String(baseRows.length)} sub="tracked products" />
            <KpiCard label="Stock Value" value={fmtMoney(totals.totalVal)} sub="at cost price" variant="success" />
            <KpiCard
              label="At-Risk Value"
              value={fmtMoney(totals.atRiskVal)}
              sub={`${((totals.atRiskVal / (totals.totalVal || 1)) * 100).toFixed(0)}% of total`}
              variant="warning"
            />
            <KpiCard
              label="Out of Stock"
              value={String(totals.out)}
              sub="needs action"
              variant={totals.out > 0 ? "danger" : "neutral"}
            />
            <KpiCard
              label="Low / Critical"
              value={String(totals.low + totals.critical)}
              sub="below healthy level"
              variant={totals.low + totals.critical > 0 ? "warning" : "neutral"}
            />
            <KpiCard
              label="Avg Coverage"
              value={`${totals.avgCoverage.toFixed(1)}x`}
              sub="vs reorder level"
              variant={totals.avgCoverage < 2 ? "warning" : "success"}
            />
          </div>

          {baseRows.length === 0 ? (
            <div className={`${S.card} py-16 text-center`}>
              <div className="font-semibold text-slate-600">
                No inventory data found for the selected filters.
              </div>
            </div>
          ) : (
            <>
              {tab === "overview" && (
                <div className="flex flex-col gap-5">
                  <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                    <Card title="Stock Health" sub="Current product status distribution">
                      <StatusDonut segs={statusDist} />
                    </Card>

                    <Card title="Coverage Buckets" sub="Products grouped by reorder coverage">
                      <SimpleBars data={coverageData} />
                    </Card>
                  </div>

                  <Card title="Inventory Value by Category" sub="Top categories by stock value">
                    <SimpleBars
                      data={categoryData.slice(0, 8).map((cat) => ({
                        name: cat.name,
                        value: cat.value,
                        sub: fmtMoney(cat.value),
                      }))}
                    />
                  </Card>

                  <Card title="Category Risk" sub="At-risk products by category">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {categoryData.map((cat) => {
                        const riskPct = cat.count ? (cat.atRisk / cat.count) * 100 : 0;

                        return (
                          <div
                            key={cat.name}
                            className="rounded-2xl border border-slate-200 bg-white p-4"
                          >
                            <div className="truncate text-sm font-bold text-slate-900">
                              {cat.name}
                            </div>
                            <div className="mt-2 text-2xl font-bold text-slate-900">
                              {riskPct.toFixed(0)}%
                            </div>
                            <div className="text-xs text-slate-500">
                              {cat.atRisk} of {cat.count} products at risk
                            </div>
                            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-amber-500"
                                style={{ width: `${riskPct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                </div>
              )}

              {tab === "reorder" && (
                <div className={`${S.card} overflow-hidden`}>
                  <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                      <div className="font-bold text-slate-900">Reorder Priority</div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {tableRows.length} of {baseRows.length} products
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {(["all", "out", "critical", "low", "ok"] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => setFilterStatus(s)}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                            filterStatus === s
                              ? "border-amber-500 bg-amber-50 text-amber-700"
                              : "border-slate-200 bg-white text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          {s === "all" ? "All" : STATUS_CFG[s].label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <div className="min-w-[900px]">
                      <div
                        className="grid gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3"
                        style={{
                          gridTemplateColumns:
                            "2fr 1fr .7fr .7fr .8fr 1fr 1.4fr",
                        }}
                      >
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Product
                        </div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Category
                        </div>
                        <SortTh col="qty" active={sortCol} dir={sortDir} onSort={toggleSort} align="right">
                          On Hand
                        </SortTh>
                        <div className="text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Reorder
                        </div>
                        <SortTh col="coverage" active={sortCol} dir={sortDir} onSort={toggleSort} align="right">
                          Coverage
                        </SortTh>
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Status
                        </div>
                        <SortTh col="urgency" active={sortCol} dir={sortDir} onSort={toggleSort}>
                          Urgency
                        </SortTh>
                      </div>

                      <div className="max-h-[560px] divide-y divide-slate-100 overflow-y-auto">
                        {tableRows.map((r) => (
                          <div
                            key={r.product_id}
                            className="grid items-center gap-4 px-5 py-3.5 hover:bg-slate-50"
                            style={{
                              gridTemplateColumns:
                                "2fr 1fr .7fr .7fr .8fr 1fr 1.4fr",
                            }}
                          >
                            <div>
                              <div className="truncate text-sm font-semibold text-slate-900">
                                {r.name}
                              </div>
                              {r.sku && (
                                <div className="text-xs text-slate-400">{r.sku}</div>
                              )}
                            </div>
                            <div className="truncate text-sm text-slate-500">
                              {r.category ?? "—"}
                            </div>
                            <div className="text-right text-sm font-bold text-slate-900">
                              {r.qty_on_hand}
                            </div>
                            <div className="text-right text-sm text-slate-500">
                              {r.reorder_level}
                            </div>
                            <div className="text-right text-sm font-bold text-slate-900">
                              {r.coverage >= 99 ? "∞" : `${r.coverage}x`}
                            </div>
                            <StatusBadge status={r.status as StockHealth} />
                            <UrgencyBar score={r.urgency} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {tab === "valuation" && (
                <div className="flex flex-col gap-5">
                  <Card title="Top Products by Stock Value" sub="Highest-value products in the selected period">
                    <SimpleBars
                      data={top10ByValue.map((r) => ({
                        name: r.name,
                        value: r.total_value,
                        sub: fmtMoney(r.total_value),
                        color: STATUS_CFG[r.status as StockHealth]?.dot,
                      }))}
                    />
                  </Card>

                  <div className={`${S.card} overflow-hidden`}>
                    <div className="border-b border-slate-100 px-5 py-4">
                      <div className="font-bold text-slate-900">Product Valuation</div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        Sorted by stock value
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <div className="min-w-[820px]">
                        <div
                          className="grid gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3"
                          style={{
                            gridTemplateColumns: "2fr .8fr 1fr .7fr 1fr 1fr",
                          }}
                        >
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Product
                          </div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            SKU
                          </div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Category
                          </div>
                          <div className="text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Qty
                          </div>
                          <div className="text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Unit Price
                          </div>
                          <SortTh col="value" active={sortCol} dir={sortDir} onSort={toggleSort} align="right">
                            Total Value
                          </SortTh>
                        </div>

                        <div className="max-h-[560px] divide-y divide-slate-100 overflow-y-auto">
                          {[...tableRows]
                            .sort((a, b) => b.total_value - a.total_value)
                            .map((r) => (
                              <div
                                key={r.product_id}
                                className="grid items-center gap-4 px-5 py-3.5 hover:bg-slate-50"
                                style={{
                                  gridTemplateColumns:
                                    "2fr .8fr 1fr .7fr 1fr 1fr",
                                }}
                              >
                                <div>
                                  <div className="truncate text-sm font-semibold text-slate-900">
                                    {r.name}
                                  </div>
                                  <div className="mt-1">
                                    <StatusBadge status={r.status as StockHealth} />
                                  </div>
                                </div>
                                <div className="text-xs text-slate-400">
                                  {r.sku ?? "—"}
                                </div>
                                <div className="truncate text-sm text-slate-500">
                                  {r.category ?? "—"}
                                </div>
                                <div className="text-right text-sm font-bold text-slate-900">
                                  {r.qty_on_hand}
                                </div>
                                <div className="text-right text-sm text-slate-600">
                                  {fmtMoney(r.unit_price)}
                                </div>
                                <div className="text-right text-sm font-bold text-slate-900">
                                  {fmtMoney(r.total_value)}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between border-t border-slate-100 bg-slate-50 px-5 py-3">
                      <span className="text-xs text-slate-500">
                        {tableRows.length} products
                      </span>
                      <span className="text-sm font-bold text-slate-900">
                        {fmtMoney(totals.totalVal)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {tab === "insights" && (
                <div className="flex flex-col gap-5">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {insights.map((ins) => (
                      <InsightCard key={ins.title} {...ins} />
                    ))}
                  </div>

                  <Card title="Action Plan" sub="Recommended next steps based on the selected inventory data">
                    <div className="divide-y divide-slate-100">
                      {[
                        {
                          step: "01",
                          title: "Restock out-of-stock products",
                          detail:
                            totals.out > 0
                              ? `${totals.out} product(s) cannot currently support sales.`
                              : "No out-of-stock products currently.",
                        },
                        {
                          step: "02",
                          title: "Review critical and low-stock products",
                          detail: `${totals.critical + totals.low} product(s) are below healthy stock levels.`,
                        },
                        {
                          step: "03",
                          title: "Protect high-value products",
                          detail:
                            "Products with high stock value should have reliable supplier coverage.",
                        },
                        {
                          step: "04",
                          title: "Check missing reorder levels",
                          detail:
                            "Products with stock but no reorder level should be reviewed and configured.",
                        },
                      ].map((item) => (
                        <div key={item.step} className="flex gap-4 py-4">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-700">
                            {item.step}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-900">
                              {item.title}
                            </div>
                            <div className="mt-1 text-xs leading-relaxed text-slate-500">
                              {item.detail}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}