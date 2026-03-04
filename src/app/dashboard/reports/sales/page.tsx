"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import { getSalesSummary, type SalesSummaryRow } from "@/lib/api/reports";
import * as S from "../page.styles";

function fmtMoney(v: number) {
  return `Ksh ${Number(v || 0).toLocaleString("en-KE", { minimumFractionDigits: 0 })}`;
}

function todayYYYYMMDD() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function daysAgoYYYYMMDD(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Format a YYYY-MM-DD string into a human-friendly label, e.g. "Mar 4, 2026" */
function fmtDate(ymd: string) {
  if (!ymd) return "—";
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function downloadCSV(filename: string, rows: Record<string, any>[]) {
  const headers = Object.keys(rows[0] ?? {});
  const escape = (v: any) => {
    const s = String(v ?? "");
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Quick-range presets: label + days-ago value (null = custom)
const QUICK_RANGES = [
  { label: "Last 7 days", days: 6 },
  { label: "Last 30 days", days: 29 },
] as const;

export default function SalesSummaryReportPage() {
  const [orgId, setOrgId] = useState<string | null>(null);

  // Default: Last 7 days
  const [from, setFrom] = useState<string>(() => daysAgoYYYYMMDD(6));
  const [to, setTo] = useState<string>(() => todayYYYYMMDD());

  // Track which quick-range button is active. "custom" = user manually picked dates
  const [activeRange, setActiveRange] = useState<number | "custom">(6);

  // Whether the custom date inputs panel is visible
  const [showCustom, setShowCustom] = useState(false);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState<SalesSummaryRow[]>([]);
  const [totals, setTotals] = useState({
    sales_count: 0,
    subtotal: 0,
    discount_total: 0,
    total: 0,
  });

  // Load organization once
  useEffect(() => {
    (async () => {
      try {
        const o = await bootstrapOrg();
        setOrgId(o);
      } catch (e: any) {
        setErr(e.message ?? String(e));
      }
    })();
  }, []);

  // Auto-run report when orgId, from, or to changes
  useEffect(() => {
    if (!orgId) return;
    if (!from || !to) {
      setErr("Select a start and end date.");
      setRows([]);
      setTotals({ sales_count: 0, subtotal: 0, discount_total: 0, total: 0 });
      return;
    }
    if (from > to) {
      setErr("Start date cannot be after end date.");
      setRows([]);
      setTotals({ sales_count: 0, subtotal: 0, discount_total: 0, total: 0 });
      return;
    }

    let isCurrent = true;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const res = await getSalesSummary(orgId, { from, to });
        if (isCurrent) {
          setRows(res.rows);
          setTotals(res.totals);
        }
      } catch (e: any) {
        if (isCurrent) {
          setErr(e.message ?? String(e));
          setRows([]);
          setTotals({ sales_count: 0, subtotal: 0, discount_total: 0, total: 0 });
        }
      } finally {
        if (isCurrent) setLoading(false);
      }
    })();

    return () => { isCurrent = false; };
  }, [orgId, from, to]);

  const hasData = rows.length > 0;

  const csvRows = useMemo(
    () =>
      rows.map((r) => ({
        day: r.day,
        sales_count: r.sales_count,
        subtotal: r.subtotal,
        discount_total: r.discount_total,
        total: r.total,
      })),
    [rows]
  );

  const handleQuickRange = (days: number) => {
    setFrom(daysAgoYYYYMMDD(days));
    setTo(todayYYYYMMDD());
    setActiveRange(days);
    setShowCustom(false);
  };

  const handleCustomFromChange = (val: string) => {
    setFrom(val);
    setActiveRange("custom");
  };

  const handleCustomToChange = (val: string) => {
    setTo(val);
    setActiveRange("custom");
  };

  // Active label for the date badge
  const activeDateLabel =
    activeRange === "custom"
      ? `${fmtDate(from)} → ${fmtDate(to)}`
      : `${fmtDate(from)} → ${fmtDate(to)}`;

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className={`${S.card} p-6`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          {/* Title */}
          <div>
            <div className="text-3xl font-black text-slate-900">Sales Summary</div>
            <div className="mt-1 text-sm text-slate-500">
              Totals by day · downloadable CSV · date-range filter
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/dashboard/reports" className={S.btnGhost}>
              ← Reports
            </Link>
            <button
              className={S.btnGhost}
              disabled={!hasData || loading}
              onClick={() => {
                if (hasData) downloadCSV(`sales-summary_${from}_to_${to}.csv`, csvRows);
              }}
            >
              ⬇ CSV
            </button>
            <button
              className={S.btnPrimary}
              onClick={() => {
                if (orgId && from && to && from <= to) setFrom(from);
              }}
              disabled={loading || !orgId || !from || !to || from > to}
            >
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>
        </div>

        {/* ── Filter row ── */}
        <div className="mt-5 flex flex-wrap items-center gap-2">

          {/* Quick-range pills */}
          {QUICK_RANGES.map(({ label, days }) => {
            const isActive = activeRange === days;
            return (
              <button
                key={days}
                onClick={() => handleQuickRange(days)}
                className={[
                  "rounded-full px-4 py-1.5 text-sm font-semibold transition-all",
                  isActive
                    ? "bg-slate-900 text-white shadow-sm"          // active
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200", // inactive
                ].join(" ")}
              >
                {label}
              </button>
            );
          })}

          {/* Custom date toggle pill */}
          <button
            onClick={() => {
              setShowCustom((v) => !v);
              if (!showCustom && activeRange !== "custom") {
                // entering custom mode: keep current range but flag as custom
                setActiveRange("custom");
              }
            }}
            className={[
              "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition-all",
              activeRange === "custom"
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200",
            ].join(" ")}
          >
            {/* Calendar icon */}
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={2}>
              <rect x="2" y="3" width="12" height="11" rx="1.5" />
              <path d="M5 1v3M11 1v3M2 7h12" strokeLinecap="round" />
            </svg>
            {activeRange === "custom" ? activeDateLabel : "Custom range"}
          </button>

          {/* Active date badge (shown when a quick range is selected) */}
          {activeRange !== "custom" && (
            <span className="rounded-full bg-slate-50 px-3 py-1.5 text-xs text-slate-500 border border-slate-200">
              {activeDateLabel}
            </span>
          )}
        </div>

        {/* ── Custom date inputs (collapsible) ── */}
        {showCustom && (
          <div className="mt-4 flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">From</label>
              <input
                className={S.input}
                type="date"
                value={from}
                onChange={(e) => handleCustomFromChange(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">To</label>
              <input
                className={S.input}
                type="date"
                value={to}
                onChange={(e) => handleCustomToChange(e.target.value)}
              />
            </div>
            <button
              className="rounded-lg bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-300"
              onClick={() => setShowCustom(false)}
            >
              Done
            </button>
          </div>
        )}
      </div>

      {err ? <div className={S.alert}>{err}</div> : null}

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className={`${S.card} p-6`}>
          <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">Total Sales</div>
          <div className="mt-3 text-4xl font-black text-slate-900">{totals.sales_count}</div>
          <div className="mt-2 text-sm text-slate-500">in selected range</div>
        </div>
        <div className={`${S.card} p-6`}>
          <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">Revenue</div>
          <div className="mt-3 text-4xl font-black text-slate-900">{fmtMoney(totals.total)}</div>
          <div className="mt-2 text-sm text-slate-500">after discounts</div>
        </div>
        <div className={`${S.card} p-6`}>
          <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">Discounts</div>
          <div className="mt-3 text-4xl font-black text-slate-900">{fmtMoney(totals.discount_total)}</div>
          <div className="mt-2 text-sm text-slate-500">total saved</div>
        </div>
      </div>

      {/* Table */}
      <div className={`${S.card} overflow-hidden`}>
        <div className="px-6 py-4">
          <div className={S.tableHead} style={{ gridTemplateColumns: "1.2fr .8fr 1fr 1fr 1fr" }}>
            <div>Day</div>
            <div># Sales</div>
            <div>Subtotal</div>
            <div>Discounts</div>
            <div className="text-right">Total</div>
          </div>
        </div>

        <div className="divide-y divide-slate-200">
          {loading ? (
            <div className="px-6 py-10 text-sm text-slate-500">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="px-6 py-10 text-sm text-slate-500">
              {err ? "Check the error above." : "No sales in this range."}
            </div>
          ) : (
            rows.map((r) => (
              <div
                key={r.day}
                className="grid items-center px-6 py-4 text-sm text-slate-800"
                style={{ gridTemplateColumns: "1.2fr .8fr 1fr 1fr 1fr" }}
              >
                <div className="font-black">{r.day}</div>
                <div className="font-bold text-slate-700">{r.sales_count}</div>
                <div>{fmtMoney(r.subtotal)}</div>
                <div className="font-bold text-amber-700">-{fmtMoney(r.discount_total)}</div>
                <div className="text-right font-black">{fmtMoney(r.total)}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}