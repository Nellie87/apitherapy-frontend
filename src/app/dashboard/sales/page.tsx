"use client";

import React, { useEffect, useMemo, useState } from "react";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import { listSales, type SaleRow } from "@/lib/api/sales";
import * as S from "./page.styles";
import Link from "next/link";

/* ─── Helpers ────────────────────────────────────────────────── */
function fmtMoney(v: number) {
  return `Ksh ${Number(v || 0).toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtDate(d: string) {
  try {
    return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch { return d; }
}

function fmtTime(d: string) {
  try {
    return new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

function isToday(d: string) {
  const date = new Date(d);
  const now = new Date();
  return date.toDateString() === now.toDateString();
}

function isThisWeek(d: string) {
  const date = new Date(d);
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return date >= weekAgo;
}

function isThisMonth(d: string) {
  const date = new Date(d);
  const now = new Date();
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

/* ─── Stat Card ─────────────────────────────────────────────── */
function StatCard({ label, value, sub, icon, variant = "neutral" }: {
  label: string; value: string; sub: string; icon: string;
  variant?: "neutral" | "success" | "warning";
}) {
  const cfg = {
    neutral: { bg: "#fff",    border: "#e2e8f0", iconBg: "#f8fafc", iconColor: "#475569", valueColor: "#0f172a", subColor: "#64748b" },
    success: { bg: "#f0fdf4", border: "#bbf7d0", iconBg: "#dcfce7", iconColor: "#166534", valueColor: "#166534", subColor: "#16a34a" },
    warning: { bg: "#fffbeb", border: "#fde68a", iconBg: "#fef3c7", iconColor: "#92400e", valueColor: "#92400e", subColor: "#d97706" },
  }[variant];

  return (
    <div className="rounded-2xl p-5 transition-all duration-150 hover:shadow-md"
      style={{ background: cfg.bg, border: `1.5px solid ${cfg.border}` }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl text-xl"
          style={{ background: cfg.iconBg, color: cfg.iconColor }}>
          {icon}
        </div>
        <span className="text-xs font-semibold uppercase tracking-wider mt-1" style={{ color: cfg.subColor }}>
          {label}
        </span>
      </div>
      <div className="text-2xl font-bold leading-none" style={{ color: cfg.valueColor }}>{value}</div>
      <div className="mt-1.5 text-xs font-medium" style={{ color: cfg.subColor }}>{sub}</div>
    </div>
  );
}

/* ─── Payment Method Badge ───────────────────────────────────── */
function PayBadge({ method }: { method?: string | null }) {
  if (!method) return <span className="text-xs text-slate-400">—</span>;
  const cfg: Record<string, { bg: string; text: string; label: string }> = {
    cash:   { bg: "bg-green-100",  text: "text-green-700",  label: "Cash"   },
    mpesa:  { bg: "bg-blue-100",   text: "text-blue-700",   label: "M-Pesa" },
    card:   { bg: "bg-purple-100", text: "text-purple-700", label: "Card"   },
    credit: { bg: "bg-amber-100",  text: "text-amber-700",  label: "Credit" },
  };
  const c = cfg[method.toLowerCase()] ?? { bg: "bg-slate-100", text: "text-slate-600", label: method };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */
type DateFilter = "all" | "today" | "week" | "month";

export default function SalesPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [rows,  setRows]  = useState<SaleRow[]>([]);
  const [q,     setQ]     = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [err,   setErr]   = useState("");

  async function refresh(o: string) {
    const data = await listSales(o);
    setRows(data);
  }

  useEffect(() => {
    (async () => {
      try {
        const o = await bootstrapOrg();
        setOrgId(o);
        await refresh(o);
      } catch (e: any) {
        setErr(e.message ?? String(e));
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    let result = rows;

    // Date filter
    if (dateFilter === "today") result = result.filter((s) => isToday(s.created_at));
    else if (dateFilter === "week") result = result.filter((s) => isThisWeek(s.created_at));
    else if (dateFilter === "month") result = result.filter((s) => isThisMonth(s.created_at));

    // Text search
    const t = q.trim().toLowerCase();
    if (t) {
      result = result.filter((s) =>
        s.sale_no.toLowerCase().includes(t) ||
        (s.customer_name ?? "").toLowerCase().includes(t)
      );
    }

    return result;
  }, [rows, q, dateFilter]);

  const kpis = useMemo(() => ({
    totalSales:     rows.length,
    totalRevenue:   rows.reduce((sum, r) => sum + Number(r.total          ?? 0), 0),
    totalDiscounts: rows.reduce((sum, r) => sum + Number(r.discount_total ?? 0), 0),
    todaySales:     rows.filter((r) => isToday(r.created_at)).length,
    todayRevenue:   rows.filter((r) => isToday(r.created_at))
                        .reduce((sum, r) => sum + Number(r.total ?? 0), 0),
  }), [rows]);

  const avgSale = kpis.totalSales > 0 ? kpis.totalRevenue / kpis.totalSales : 0;

  const DATE_FILTERS: { key: DateFilter; label: string }[] = [
    { key: "all",   label: "All time" },
    { key: "today", label: "Today"    },
    { key: "week",  label: "This week" },
    { key: "month", label: "This month" },
  ];

  // Table columns: Sale No | Customer | Date | Payment | Items | Total
  const GRID = "1.2fr 1.4fr 1.1fr 0.9fr 0.6fr 0.9fr";

  if (!orgId && !err) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" strokeOpacity="0.2" />
            <path d="M12 2a10 10 0 0110 10" />
          </svg>
          <span className="text-sm font-medium">Loading sales…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">

      {/* ── Error ── */}
      {err && (
        <div className={S.alert}>
          <span className="shrink-0 mt-0.5">⚠️</span>
          <span>{err}</span>
          <button onClick={() => setErr("")} className="ml-auto shrink-0 text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* ── Page Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sales</h1>
          <p className="mt-1 text-sm text-slate-500">Track completed transactions and revenue</p>
        </div>
        <Link href="/dashboard/sales/new" className={S.btnPrimary}>
          + New Sale
        </Link>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Sales"    value={String(kpis.totalSales)}        sub="all transactions"     icon="📋" variant="neutral" />
        <StatCard label="Total Revenue"  value={fmtMoney(kpis.totalRevenue)}    sub="gross income"         icon="📈" variant="success" />
        <StatCard label="Average Sale"   value={fmtMoney(avgSale)}              sub="per transaction"      icon="💰" variant="neutral" />
        <StatCard label="Discounts Given" value={fmtMoney(kpis.totalDiscounts)} sub="total reductions"     icon="🏷️" variant="warning" />
      </div>

      {/* ── Today highlight (only if there are today's sales) ── */}
      {kpis.todaySales > 0 && (
        <div className="flex items-center gap-4 rounded-2xl border border-green-200 bg-green-50 px-5 py-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-green-100 text-xl shrink-0">🌟</div>
          <div>
            <div className="font-bold text-green-800">Today so far</div>
            <div className="text-sm text-green-700">
              <span className="font-semibold">{kpis.todaySales}</span> sale{kpis.todaySales !== 1 ? "s" : ""} · {" "}
              <span className="font-semibold">{fmtMoney(kpis.todayRevenue)}</span> revenue
            </div>
          </div>
          <button onClick={() => setDateFilter("today")}
            className="ml-auto text-xs font-semibold text-green-700 hover:text-green-800 underline underline-offset-2 whitespace-nowrap">
            View today →
          </button>
        </div>
      )}

      {/* ── Search + Date Filters ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <label className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 shadow-sm focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-100 transition flex-1 min-w-[180px] max-w-xs">
          <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="#94a3b8" strokeWidth="2.2">
            <circle cx="9" cy="9" r="5.5" /><line x1="13.5" y1="13.5" x2="18" y2="18" />
          </svg>
          <input
            className="flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 min-w-0"
            placeholder="Sale no or customer…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && <button onClick={() => setQ("")} className="text-slate-400 hover:text-slate-600 shrink-0 text-xs">✕</button>}
        </label>

        {/* Date filter pills */}
        <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-1">
          {DATE_FILTERS.map(({ key, label }) => (
            <button key={key} onClick={() => setDateFilter(key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                dateFilter === key
                  ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                  : "text-slate-500 hover:text-slate-700"
              }`}>
              {label}
            </button>
          ))}
        </div>

        <span className="ml-auto text-xs text-slate-400 whitespace-nowrap">
          {filtered.length} / {rows.length} sale{rows.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Table ── */}
      <div className={`${S.card} overflow-hidden`}>

        {/* Desktop header */}
        <div className="hidden lg:grid items-center gap-4 px-5 py-3"
          style={{ gridTemplateColumns: GRID, background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
          {["Sale No", "Customer", "Date", "Payment", "Items", "Total"].map((h) => (
            <div key={h} className="text-xs font-semibold uppercase tracking-wider text-slate-500">{h}</div>
          ))}
        </div>

        {/* Rows */}
        <div className="divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <div className="py-20 text-center">
              <div className="text-5xl mb-4">🍯</div>
              <p className="font-semibold text-slate-700">
                {rows.length === 0 ? "No sales yet" : dateFilter !== "all" ? `No sales for this period` : "No matching sales"}
              </p>
              <p className="text-sm text-slate-400 mt-1">
                {rows.length === 0
                  ? "Create your first sale to get started"
                  : dateFilter !== "all"
                  ? <button onClick={() => setDateFilter("all")} className="text-amber-600 hover:text-amber-700 font-medium">View all sales</button>
                  : "Try adjusting your search"}
              </p>
            </div>
          ) : (
            filtered.map((s) => {
              const itemCount = (s as any).items?.length ?? (s as any).item_count ?? null;

              return (
                <Link key={s.id} href={`/dashboard/sales/${s.id}`}
                  className="group transition-colors hover:bg-slate-50 focus:outline-none focus:bg-amber-50"
                  style={{ textDecoration: "none", color: "inherit" }}>

                  {/* Desktop row */}
                  <div className="hidden lg:grid items-center gap-4 px-5 py-3.5"
                    style={{ gridTemplateColumns: GRID }}>

                    {/* Sale No */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                      <span className="font-semibold text-slate-900 text-sm truncate group-hover:text-amber-700 transition-colors">
                        {s.sale_no}
                      </span>
                    </div>

                    {/* Customer */}
                    <div className="text-sm text-slate-600 truncate">
                      {s.customer_name ?? <span className="text-slate-400 italic">Walk-in</span>}
                    </div>

                    {/* Date */}
                    <div>
                      <div className="text-sm text-slate-700 font-medium">{fmtDate(s.created_at)}</div>
                      <div className="text-xs text-slate-400">{fmtTime(s.created_at)}</div>
                    </div>

                    {/* Payment */}
                    <div>
                      <PayBadge method={(s as any).payment_method} />
                    </div>

                    {/* Items */}
                    <div className="text-sm text-slate-600">
                      {itemCount !== null
                        ? <span className="font-medium">{itemCount}</span>
                        : <span className="text-slate-400">—</span>}
                    </div>

                    {/* Total */}
                    <div className="text-right">
                      <div className="font-bold text-slate-900 text-sm">{fmtMoney(Number(s.total ?? 0))}</div>
                      {Number(s.discount_total ?? 0) > 0 && (
                        <div className="text-xs text-amber-600 font-medium">
                          -{fmtMoney(Number(s.discount_total))} off
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Mobile card */}
                  <div className="lg:hidden px-5 py-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <div className="font-semibold text-slate-900 text-sm">{s.sale_no}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {s.customer_name ?? <span className="italic">Walk-in</span>} · {fmtDate(s.created_at)}
                        </div>
                      </div>
                      <div className="font-bold text-slate-900">{fmtMoney(Number(s.total ?? 0))}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <PayBadge method={(s as any).payment_method} />
                      {Number(s.discount_total ?? 0) > 0 && (
                        <span className="text-xs text-amber-600 font-medium">-{fmtMoney(Number(s.discount_total))} discount</span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>

        {/* Footer */}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
            <span className="text-xs text-slate-400">
              Showing {filtered.length} of {rows.length} sale{rows.length !== 1 ? "s" : ""}
            </span>
            <span className="text-xs font-semibold text-slate-600">
              Subtotal: <span className="text-slate-900">{fmtMoney(filtered.reduce((s, r) => s + Number(r.total ?? 0), 0))}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}