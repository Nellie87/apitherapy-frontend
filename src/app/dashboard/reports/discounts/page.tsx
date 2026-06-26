"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/dist/style.css";

import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import { getDiscountReport, type DiscountReportRow } from "@/lib/api/reports";
import { listSales, type SaleRowWithItems } from "@/lib/api/sales";
import * as S from "../page.styles";
import { DiscountReportPdfTemplate } from "./DiscountReportPdfTemplate";
import { exportElementToPdf } from "@/lib/exportPdf";

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */
type RangePreset =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "month"
  | "lastMonth"
  | "custom";

type InfluenceRow = {
  label: string;
  sales: number;
  revenue: number;
  avgBasket: number;
  share: number;
};

type CategoryStat = {
  category: string;
  lines: number;
  qty: number;
  saved: number;
  sales: number;
};

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */
const dateToLocalIso = (date: Date) => {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const localIsoToDate = (value?: string) => {
  if (!value) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const toYMD = (value: string) => value.slice(0, 10);

const fmtMoney = (value: number) =>
  `Ksh ${Number(value || 0).toLocaleString("en-KE", {
    maximumFractionDigits: 0,
  })}`;

const fmtNumber = (value: number) =>
  Number(value || 0).toLocaleString("en-KE", {
    maximumFractionDigits: 0,
  });

const fmtPct = (value: number) => `${Number(value || 0).toFixed(1)}%`;

const fmtShortDate = (value: string) => {
  try {
    const [y, m, d] = value.slice(0, 10).split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-KE", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return value;
  }
};

const getPresetRange = (preset: Exclude<RangePreset, "custom">) => {
  const today = new Date();
  const from = new Date(today);
  const to = new Date(today);

  if (preset === "today") {
    return {
      from: dateToLocalIso(today),
      to: dateToLocalIso(today),
      label: "Today",
    };
  }

  if (preset === "yesterday") {
    from.setDate(today.getDate() - 1);
    to.setDate(today.getDate() - 1);

    return {
      from: dateToLocalIso(from),
      to: dateToLocalIso(to),
      label: "Yesterday",
    };
  }

  if (preset === "7d") {
    from.setDate(today.getDate() - 6);

    return {
      from: dateToLocalIso(from),
      to: dateToLocalIso(today),
      label: "Last 7 days",
    };
  }

  if (preset === "30d") {
    from.setDate(today.getDate() - 29);

    return {
      from: dateToLocalIso(from),
      to: dateToLocalIso(today),
      label: "Last 30 days",
    };
  }

  if (preset === "month") {
    return {
      from: dateToLocalIso(new Date(today.getFullYear(), today.getMonth(), 1)),
      to: dateToLocalIso(today),
      label: "This month",
    };
  }

  return {
    from: dateToLocalIso(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
    to: dateToLocalIso(new Date(today.getFullYear(), today.getMonth(), 0)),
    label: "Last month",
  };
};

function isSaleInRange(sale: SaleRowWithItems, from: string, to: string) {
  const day = toYMD(sale.created_at);
  return day >= from && day <= to;
}

function getSaleDiscount(sale: SaleRowWithItems) {
  return Number((sale as any).discount_total ?? 0);
}

function getSaleTotal(sale: SaleRowWithItems) {
  return Number((sale as any).total ?? 0);
}

/* ─────────────────────────────────────────────
   UI components
───────────────────────────────────────────── */
function CompactCalendar({
  valuePreset,
  valueFrom,
  valueTo,
  onApply,
  onClose,
  style,
}: {
  valuePreset: RangePreset;
  valueFrom: string;
  valueTo: string;
  onApply: (preset: RangePreset, from: string, to: string) => void;
  onClose: () => void;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [preset, setPreset] = useState<RangePreset>(valuePreset);
  const [range, setRange] = useState<DateRange | undefined>({
    from: localIsoToDate(valueFrom),
    to: localIsoToDate(valueTo),
  });

  const presets: { value: RangePreset; label: string }[] = [
    { value: "today", label: "Today" },
    { value: "yesterday", label: "Yesterday" },
    { value: "7d", label: "7 days" },
    { value: "30d", label: "30 days" },
    { value: "month", label: "This month" },
    { value: "lastMonth", label: "Last month" },
  ];

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  function applyPreset(nextPreset: RangePreset) {
    setPreset(nextPreset);

    if (nextPreset !== "custom") {
      const next = getPresetRange(nextPreset);
      setRange({
        from: localIsoToDate(next.from),
        to: localIsoToDate(next.to),
      });
    }
  }

  function applyRange() {
    if (!range?.from) return;

    onApply(
      preset,
      dateToLocalIso(range.from),
      dateToLocalIso(range.to ?? range.from),
    );

    onClose();
  }

  return (
    <div
      ref={ref}
      style={style}
      className="fixed z-[9999] max-h-[calc(100vh-24px)] overflow-y-auto rounded-[22px] border border-[#EADFC2] bg-white shadow-[0_24px_70px_rgba(47,39,24,0.22)]"
    >
      <div className="border-b border-[#F1E6C9] bg-[#FFFDF8] p-3">
        <div className="grid grid-cols-3 gap-1">
          {presets.map((item) => {
            const active = preset === item.value;

            return (
              <button
                key={item.value}
                type="button"
                onClick={() => applyPreset(item.value)}
                className={`rounded-xl px-2.5 py-2 text-xs font-bold transition ${
                  active
                    ? "bg-[#2F2718] text-white"
                    : "text-slate-600 hover:bg-[#FFF8E6]"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-3">
        <DayPicker
          mode="range"
          selected={range}
          onSelect={(next) => {
            setPreset("custom");
            setRange(next);
          }}
          numberOfMonths={1}
          showOutsideDays
          defaultMonth={range?.from ?? new Date()}
          disabled={{ after: new Date() }}
          classNames={{
            months: "flex",
            month: "w-full",
            caption: "relative flex items-center justify-center px-8 pb-2",
            caption_label: "text-sm font-black text-slate-900",
            nav: "absolute inset-x-0 top-0 flex items-center justify-between",
            nav_button:
              "h-7 w-7 rounded-full text-slate-500 hover:bg-[#FFF8E6] hover:text-slate-900",
            table: "w-full border-collapse",
            head_row: "grid grid-cols-7",
            head_cell:
              "h-7 text-center text-[10px] font-black uppercase text-slate-400",
            row: "grid grid-cols-7",
            cell: "relative h-8 p-0 text-center text-sm",
            day:
              "h-8 w-8 rounded-xl text-xs font-bold text-slate-700 hover:bg-[#FFF8E6]",
            day_selected:
              "bg-[#2F2718] text-white hover:bg-[#2F2718] hover:text-white",
            day_today: "border border-[#D6A324] bg-[#FFF8E6] text-[#8A6A00]",
            day_outside: "text-slate-300",
            day_disabled: "text-slate-300 opacity-40",
            day_range_middle:
              "rounded-none bg-[#FFF4CC] text-slate-900 hover:bg-[#FFF4CC]",
            day_range_start:
              "rounded-l-xl rounded-r-none bg-[#2F2718] text-white hover:bg-[#2F2718]",
            day_range_end:
              "rounded-l-none rounded-r-xl bg-[#2F2718] text-white hover:bg-[#2F2718]",
          }}
        />
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-[#F1E6C9] bg-[#FFFDF8] px-3 py-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-[#EADFC2] bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-[#FFF8E6]"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={applyRange}
          disabled={!range?.from}
          className="rounded-xl bg-[#2F2718] px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
        >
          Apply range
        </button>
      </div>
    </div>
  );
}

function DateRangeButton({
  label,
  from,
  to,
  preset,
  open,
  setOpen,
  onApply,
}: {
  label: string;
  from: string;
  to: string;
  preset: RangePreset;
  open: boolean;
  setOpen: (value: boolean) => void;
  onApply: (preset: RangePreset, from: string, to: string) => void;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [calendarStyle, setCalendarStyle] = useState<React.CSSProperties>({
    top: 0,
    left: 0,
    width: 360,
  });

  const updateCalendarPosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor || typeof window === "undefined") return;

    const rect = anchor.getBoundingClientRect();
    const margin = 12;
    const calendarWidth = Math.min(360, window.innerWidth - margin * 2);
    const estimatedCalendarHeight = 470;

    let left = rect.right - calendarWidth;
    left = Math.max(margin, Math.min(left, window.innerWidth - calendarWidth - margin));

    let top = rect.bottom + 8;
    const wouldOverflowBottom = top + estimatedCalendarHeight > window.innerHeight - margin;

    if (wouldOverflowBottom && rect.top > estimatedCalendarHeight) {
      top = rect.top - estimatedCalendarHeight - 8;
    }

    top = Math.max(margin, Math.min(top, window.innerHeight - margin));

    setCalendarStyle({
      top,
      left,
      width: calendarWidth,
    });
  }, []);

  useEffect(() => {
    if (!open) return;

    updateCalendarPosition();

    window.addEventListener("resize", updateCalendarPosition);
    window.addEventListener("scroll", updateCalendarPosition, true);

    return () => {
      window.removeEventListener("resize", updateCalendarPosition);
      window.removeEventListener("scroll", updateCalendarPosition, true);
    };
  }, [open, updateCalendarPosition]);

  return (
    <div ref={anchorRef} className="relative z-[50]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full min-w-[245px] items-center justify-between gap-4 rounded-2xl border border-[#EADFC2] bg-white px-4 py-3 text-left shadow-sm transition hover:bg-[#FFF8E6]"
      >
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8A6A00]">
            {label}
          </div>
          <div className="mt-1 text-sm font-black text-slate-950">
            {from} to {to}
          </div>
        </div>

        <span className="rounded-full bg-[#2F2718] px-3 py-1 text-xs font-bold text-white">
          Change
        </span>
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <CompactCalendar
            valuePreset={preset}
            valueFrom={from}
            valueTo={to}
            onApply={onApply}
            onClose={() => setOpen(false)}
            style={calendarStyle}
          />,
          document.body,
        )}
    </div>
  );
}

function Panel({
  title,
  sub,
  action,
  children,
  noPad = false,
}: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  noPad?: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-[#EADFC2] bg-white shadow-[0_12px_36px_rgba(92,64,16,0.06)]">
      <div className="flex flex-col gap-3 border-b border-[#F1E6C9] bg-[#FFFDF8] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-black text-slate-950">{title}</h2>
          {sub && <p className="mt-1 text-xs font-medium text-slate-500">{sub}</p>}
        </div>

        {action}
      </div>

      <div className={noPad ? "" : "p-5"}>{children}</div>
    </section>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "neutral" | "warning" | "danger" | "success";
}) {
  const cfg = {
    neutral: "border-[#EADFC2] bg-white text-slate-950",
    warning: "border-amber-200 bg-amber-50/70 text-[#8A5A00]",
    danger: "border-red-200 bg-red-50 text-red-700",
    success: "border-green-200 bg-green-50 text-green-700",
  }[tone];

  return (
    <div className={`rounded-[24px] border p-4 shadow-sm ${cfg}`}>
      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-2xl font-black tracking-tight">{value}</div>
      {sub && <div className="mt-1 text-xs font-medium text-slate-500">{sub}</div>}
    </div>
  );
}

function SegControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex flex-wrap items-center gap-1 rounded-2xl border border-[#EADFC2] bg-white p-1 shadow-sm">
      {options.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          className={`rounded-xl px-3.5 py-2 text-xs font-black transition ${
            value === item.value
              ? "bg-[#2F2718] text-white"
              : "text-slate-600 hover:bg-[#FFF8E6]"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function TableCell({
  children,
  right = false,
  strong = false,
}: {
  children: React.ReactNode;
  right?: boolean;
  strong?: boolean;
}) {
  return (
    <div
      className={`min-w-0 text-sm ${
        right ? "text-left sm:text-right sm:tabular-nums" : "text-left"
      } ${strong ? "font-black text-slate-950" : "font-medium text-slate-600"}`}
    >
      {children}
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-[28px] border border-[#EADFC2] bg-white px-6 py-16 text-center shadow-sm">
      <h3 className="text-base font-black text-slate-800">{title}</h3>
      <p className="mt-1 text-sm text-slate-400">{detail}</p>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex h-56 items-center justify-center text-sm font-semibold text-slate-400">
      Loading discount report...
    </div>
  );
}

/* ─────────────────────────────────────────────
   Page
───────────────────────────────────────────── */
export default function DiscountReportPage() {
  const initialRange = useMemo(() => getPresetRange("30d"), []);

  const [orgId, setOrgId] = useState<string | null>(null);
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [preset, setPreset] = useState<RangePreset>("30d");
  const [calendarOpen, setCalendarOpen] = useState(false);

  const [rows, setRows] = useState<DiscountReportRow[]>([]);
  const [sales, setSales] = useState<SaleRowWithItems[]>([]);
  const [category, setCategory] = useState("all");
  const [view, setView] = useState<"overview" | "categories" | "sales">(
    "overview",
  );
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const id = await bootstrapOrg();
        setOrgId(id);
      } catch (error: any) {
        setErr(error?.message ?? String(error));
        setLoading(false);
      }
    })();
  }, []);

  const loadReport = useCallback(async () => {
    if (!orgId) return;

    setLoading(true);
    setErr("");

    try {
      const [discounts, allSales] = await Promise.all([
        getDiscountReport(orgId, { from, to }),
        listSales(orgId),
      ]);

      setRows(discounts.rows);
      setSales(allSales.filter((sale) => isSaleInRange(sale, from, to)));
    } catch (error: any) {
      setErr(error?.message ?? String(error));
    } finally {
      setLoading(false);
    }
  }, [orgId, from, to]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const categories = useMemo(() => {
    return [
      "all",
      ...Array.from(
        new Set(rows.map((row) => row.category || "Uncategorized")),
      ).sort(),
    ];
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (category === "all") return rows;
    return rows.filter((row) => (row.category || "Uncategorized") === category);
  }, [rows, category]);

  const totals = useMemo(() => {
    const discountedSales = new Set(filteredRows.map((row) => row.sale_id));

    const totalSaved = filteredRows.reduce((sum, row) => sum + row.saved_total, 0);
    const discountedQty = filteredRows.reduce((sum, row) => sum + row.qty, 0);
    const baseSalesValue = filteredRows.reduce(
      (sum, row) => sum + row.base_price * row.qty,
      0,
    );

    return {
      lines: filteredRows.length,
      discountedQty,
      totalSaved,
      affectedSales: discountedSales.size,
      avgSavedPerSale: discountedSales.size ? totalSaved / discountedSales.size : 0,
      avgSavedPerLine: filteredRows.length ? totalSaved / filteredRows.length : 0,
      discountRate: baseSalesValue ? (totalSaved / baseSalesValue) * 100 : 0,
    };
  }, [filteredRows]);

  const categoryStats = useMemo<CategoryStat[]>(() => {
    const map = new Map<string, CategoryStat>();

    for (const row of rows) {
      const key = row.category || "Uncategorized";
      const current =
        map.get(key) ??
        ({
          category: key,
          lines: 0,
          qty: 0,
          saved: 0,
          sales: 0,
        } satisfies CategoryStat);

      current.lines += 1;
      current.qty += row.qty;
      current.saved += row.saved_total;
      current.sales += 0;

      map.set(key, current);
    }

    for (const stat of map.values()) {
      const salesIds = new Set(
        rows
          .filter((row) => (row.category || "Uncategorized") === stat.category)
          .map((row) => row.sale_id),
      );
      stat.sales = salesIds.size;
    }

    return Array.from(map.values()).sort((a, b) => b.saved - a.saved);
  }, [rows]);

  const influenceRows = useMemo<InfluenceRow[]>(() => {
    const discountedSaleIds = new Set(rows.map((row) => row.sale_id));

    const discounted = sales.filter((sale) => discountedSaleIds.has(sale.id));
    const fullPrice = sales.filter((sale) => !discountedSaleIds.has(sale.id));

    const totalRevenue = sales.reduce((sum, sale) => sum + getSaleTotal(sale), 0);

    function build(label: string, list: SaleRowWithItems[]): InfluenceRow {
      const revenue = list.reduce((sum, sale) => sum + getSaleTotal(sale), 0);

      return {
        label,
        sales: list.length,
        revenue,
        avgBasket: list.length ? revenue / list.length : 0,
        share: totalRevenue ? (revenue / totalRevenue) * 100 : 0,
      };
    }

    return [build("Discounted sales", discounted), build("Full-price sales", fullPrice)];
  }, [rows, sales]);

  const discountInfluence = useMemo(() => {
    const discounted = influenceRows[0];
    const fullPrice = influenceRows[1];

    const avgLift =
      fullPrice.avgBasket > 0
        ? ((discounted.avgBasket - fullPrice.avgBasket) / fullPrice.avgBasket) * 100
        : null;

    const revenueShare = discounted.share;
    const salesShare = sales.length ? (discounted.sales / sales.length) * 100 : 0;

    return {
      avgLift,
      revenueShare,
      salesShare,
      conclusion:
        avgLift === null
          ? "There is not enough full-price sales data to compare basket impact."
          : avgLift >= 0
            ? "Discounted sales are producing a higher average basket than full-price sales."
            : "Discounted sales are producing a lower average basket than full-price sales.",
    };
  }, [influenceRows, sales.length]);

  async function downloadPdf() {
    setExporting(true);

    try {
      await exportElementToPdf(
        "discount-report-pdf",
        `discount-report-${from}-to-${to}.pdf`,
      );
    } finally {
      setExporting(false);
    }
  }

  if (!orgId && !err) return <Spinner />;

  return (
    <div className="flex flex-col gap-6">
      <Panel
        title="Discount Report"
        sub="Analyze discount usage, category impact, and how discounts influence sales."
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={downloadPdf}
              disabled={loading || exporting}
              className={S.btnPrimary}
            >
              {exporting ? "Preparing PDF..." : "Download PDF"}
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <DateRangeButton
              label="Date range"
              from={from}
              to={to}
              preset={preset}
              open={calendarOpen}
              setOpen={setCalendarOpen}
              onApply={(nextPreset, nextFrom, nextTo) => {
                setPreset(nextPreset);
                setFrom(nextFrom);
                setTo(nextTo);
              }}
            />

            <label className="block min-w-[220px]">
              <div className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#8A6A00]">
                Category
              </div>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="w-full rounded-2xl border border-[#EADFC2] bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-[#D6A324] focus:ring-2 focus:ring-amber-100"
              >
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item === "all" ? "All categories" : item}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <SegControl
            value={view}
            onChange={setView}
            options={[
              { value: "overview", label: "Overview" },
              { value: "categories", label: "Categories" },
              { value: "sales", label: "Sales Influence" },
            ]}
          />
        </div>
      </Panel>

      {err && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {err}
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              label="Total discounts"
              value={fmtMoney(totals.totalSaved)}
              sub={`${fmtNumber(totals.discountedQty)} units discounted`}
              tone="warning"
            />
            <Kpi
              label="Affected sales"
              value={fmtNumber(totals.affectedSales)}
              sub={`${fmtNumber(totals.lines)} discounted line items`}
            />
            <Kpi
              label="Average saved"
              value={fmtMoney(totals.avgSavedPerSale)}
              sub="per discounted sale"
            />
            <Kpi
              label="Discount rate"
              value={fmtPct(totals.discountRate)}
              sub="of discounted item base value"
              tone={totals.discountRate > 12 ? "danger" : "neutral"}
            />
          </div>

          {filteredRows.length === 0 ? (
            <EmptyState
              title="No discounted sales found"
              detail="Try changing the date range or selecting all categories."
            />
          ) : (
            <>
              {view === "overview" && (
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
                  <div className="xl:col-span-7">
                    <Panel
                      title="Discounted Line Items"
                      sub="Aligned sales details for discounted products"
                      noPad
                    >
                      <div
                        className={`${S.tableHead} hidden border-b border-[#F1E6C9] bg-[#FFFDF8] px-5 py-3 sm:grid`}
                        style={{
                          gridTemplateColumns: "1.1fr 1.6fr 0.8fr 0.7fr 1fr 1fr",
                        }}
                      >
                        <div>Sale</div>
                        <div>Product</div>
                        <div>Category</div>
                        <div className="text-right">Qty</div>
                        <div className="text-right">Saved</div>
                        <div className="text-right">Final</div>
                      </div>

                      <div className="max-h-[520px] divide-y divide-slate-100 overflow-y-auto">
                        {filteredRows.map((row) => (
                          <div
                            key={`${row.sale_id}-${row.product_id}-${row.name}`}
                            className="grid gap-3 px-5 py-4 transition hover:bg-[#FFFDF8] sm:grid-cols-[1.1fr_1.6fr_0.8fr_0.7fr_1fr_1fr] sm:items-center"
                          >
                            <TableCell strong>
                              <div>{row.sale_no}</div>
                              <div className="mt-0.5 text-xs font-medium text-slate-400">
                                {fmtShortDate(row.sold_at)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="truncate font-bold text-slate-800">
                                {row.name}
                              </div>
                              <div className="mt-0.5 text-xs text-slate-400">
                                {row.sku || "No SKU"}
                              </div>
                            </TableCell>
                            <TableCell>{row.category || "Uncategorized"}</TableCell>
                            <TableCell right>{fmtNumber(row.qty)}</TableCell>
                            <TableCell right strong>
                              {fmtMoney(row.saved_total)}
                            </TableCell>
                            <TableCell right>{fmtMoney(row.final_price)}</TableCell>
                          </div>
                        ))}
                      </div>
                    </Panel>
                  </div>

                  <div className="flex flex-col gap-6 xl:col-span-5">
                    <Panel title="Discount Influence" sub="Discounted vs full-price sales">
                      <div className="space-y-4">
                        {influenceRows.map((row) => (
                          <div key={row.label}>
                            <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                              <span className="font-black text-slate-700">
                                {row.label}
                              </span>
                              <span className="font-black text-slate-950">
                                {fmtMoney(row.revenue)}
                              </span>
                            </div>

                            <div className="h-2.5 overflow-hidden rounded-full bg-[#F8F3E7]">
                              <div
                                className="h-full rounded-full bg-[#D6A324]"
                                style={{ width: `${Math.max(3, row.share)}%` }}
                              />
                            </div>

                            <div className="mt-1 text-xs font-medium text-slate-500">
                              {fmtNumber(row.sales)} sales · {fmtPct(row.share)} of revenue · avg basket{" "}
                              {fmtMoney(row.avgBasket)}
                            </div>
                          </div>
                        ))}

                        <div className="rounded-2xl border border-[#F1E6C9] bg-[#FFFDF8] px-4 py-3 text-sm font-semibold text-slate-700">
                          {discountInfluence.conclusion}
                        </div>
                      </div>
                    </Panel>

                    <Panel title="Category Savings" sub="Top categories by total discounts">
                      <div className="space-y-4">
                        {categoryStats.slice(0, 8).map((item) => {
                          const pct = totals.totalSaved
                            ? (item.saved / rows.reduce((s, row) => s + row.saved_total, 0)) * 100
                            : 0;

                          return (
                            <div key={item.category}>
                              <div className="mb-1 flex justify-between gap-3 text-xs">
                                <span className="truncate font-black text-slate-700">
                                  {item.category}
                                </span>
                                <span className="font-black text-slate-950">
                                  {fmtMoney(item.saved)}
                                </span>
                              </div>
                              <div className="h-2.5 overflow-hidden rounded-full bg-[#F8F3E7]">
                                <div
                                  className="h-full rounded-full bg-[#2F2718]"
                                  style={{ width: `${Math.max(3, pct)}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </Panel>
                  </div>
                </div>
              )}

              {view === "categories" && (
                <Panel
                  title="Category Breakdown"
                  sub="Discount value, discounted quantity, and affected sales by category"
                  noPad
                >
                  <div
                    className={`${S.tableHead} hidden border-b border-[#F1E6C9] bg-[#FFFDF8] px-5 py-3 sm:grid`}
                    style={{
                      gridTemplateColumns: "1.6fr 1fr 1fr 1fr 1fr",
                    }}
                  >
                    <div>Category</div>
                    <div className="text-right">Saved</div>
                    <div className="text-right">Qty</div>
                    <div className="text-right">Lines</div>
                    <div className="text-right">Sales</div>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {categoryStats.map((item) => (
                      <div
                        key={item.category}
                        className="grid gap-3 px-5 py-4 transition hover:bg-[#FFFDF8] sm:grid-cols-[1.6fr_1fr_1fr_1fr_1fr] sm:items-center"
                      >
                        <TableCell strong>{item.category}</TableCell>
                        <TableCell right strong>{fmtMoney(item.saved)}</TableCell>
                        <TableCell right>{fmtNumber(item.qty)}</TableCell>
                        <TableCell right>{fmtNumber(item.lines)}</TableCell>
                        <TableCell right>{fmtNumber(item.sales)}</TableCell>
                      </div>
                    ))}
                  </div>
                </Panel>
              )}

              {view === "sales" && (
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                  <Panel
                    title="Discount vs Sales Influence"
                    sub="Shows whether discounted sales are driving revenue and basket size"
                  >
                    <div className="space-y-5">
                      {influenceRows.map((row) => (
                        <div
                          key={row.label}
                          className="rounded-2xl border border-[#F1E6C9] bg-[#FFFDF8] p-4"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="text-sm font-black text-slate-950">
                                {row.label}
                              </div>
                              <div className="mt-1 text-xs font-medium text-slate-500">
                                {fmtNumber(row.sales)} sale{row.sales !== 1 ? "s" : ""}
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="text-sm font-black text-slate-950">
                                {fmtMoney(row.revenue)}
                              </div>
                              <div className="mt-1 text-xs font-bold text-[#8A6A00]">
                                {fmtPct(row.share)} revenue share
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="rounded-xl border border-[#EADFC2] bg-white p-3">
                              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                Average Basket
                              </div>
                              <div className="mt-1 text-lg font-black text-slate-950">
                                {fmtMoney(row.avgBasket)}
                              </div>
                            </div>

                            <div className="rounded-xl border border-[#EADFC2] bg-white p-3">
                              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                Revenue Share
                              </div>
                              <div className="mt-1 text-lg font-black text-slate-950">
                                {fmtPct(row.share)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Panel>

                  <Panel title="Interpretation" sub="What the numbers mean">
                    <div className="space-y-3 text-sm leading-relaxed text-slate-600">
                      <p>{discountInfluence.conclusion}</p>
                      <p>
                        Discounted sales represent{" "}
                        <strong className="text-slate-900">
                          {fmtPct(discountInfluence.salesShare)}
                        </strong>{" "}
                        of transactions and{" "}
                        <strong className="text-slate-900">
                          {fmtPct(discountInfluence.revenueShare)}
                        </strong>{" "}
                        of revenue in this period.
                      </p>
                      <p>
                        Average basket difference:{" "}
                        <strong
                          className={
                            discountInfluence.avgLift !== null &&
                            discountInfluence.avgLift >= 0
                              ? "text-green-700"
                              : "text-red-700"
                          }
                        >
                          {discountInfluence.avgLift === null
                            ? "Not enough data"
                            : fmtPct(discountInfluence.avgLift)}
                        </strong>
                        .
                      </p>
                    </div>
                  </Panel>
                </div>
              )}
            </>
          )}
        </>
      )}

      <div className="fixed -left-[9999px] top-0">
        <DiscountReportPdfTemplate
          from={from}
          to={to}
          category={category}
          totals={totals}
          rows={filteredRows}
          categoryStats={categoryStats}
          influenceRows={influenceRows}
          discountInfluence={discountInfluence}
        />
      </div>
    </div>
  );
}
