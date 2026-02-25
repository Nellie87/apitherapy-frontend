"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import { supabase } from "@/lib/supabase/client";
import { getInventoryValuation, reportPnL, reportExpenses, type InventoryValuationRow } from "@/lib/api/reports";

/* ─── Types ──────────────────────────────────────────────────── */
type RangePreset = "today" | "7d" | "30d" | "month";
type RecentSale    = { id: string; sale_no: string; customer_name: string | null; total: number; discount_total: number; created_at: string };
type RecentExpense = { id: string; category: string; amount: number; expense_date: string; created_at: string };

/* ─── Helpers ────────────────────────────────────────────────── */
function iso(d: Date) { return d.toISOString().slice(0, 10); }
function startOfMonth(d = new Date()) { return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)); }
function fmtMoney(v: number) { return `Ksh ${Number(v || 0).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`; }
function fmtK(v: number) { return v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(Math.round(v)); }
function fmtTime(v: string) {
  try { return new Date(v).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
  catch { return v; }
}
function stockBadgeCfg(status: InventoryValuationRow["status"]) {
  if (status === "out")      return { cls: "bg-red-100 text-red-700",     label: "Out" };
  if (status === "critical") return { cls: "bg-orange-100 text-orange-700", label: "Critical" };
  return                            { cls: "bg-amber-100 text-amber-700",  label: "Low" };
}

/* ─── Spinner ────────────────────────────────────────────────── */
function Spinner() {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-slate-400">
      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" strokeOpacity="0.2"/><path d="M12 2a10 10 0 0110 10"/>
      </svg>
      <span className="text-sm">Loading…</span>
    </div>
  );
}

/* ─── KPI card ───────────────────────────────────────────────── */
function KpiCard({ label, value, sub, icon, variant = "neutral", loading = false }: {
  label: string; value: string; sub?: string; icon: string;
  variant?: "neutral"|"success"|"warning"|"danger"; loading?: boolean;
}) {
  const cfg = {
    neutral: { bg:"#fff",    border:"#e2e8f0", iconBg:"#f8fafc", valColor:"#0f172a", subColor:"#64748b" },
    success: { bg:"#f0fdf4", border:"#bbf7d0", iconBg:"#dcfce7", valColor:"#166534", subColor:"#16a34a" },
    warning: { bg:"#fffbeb", border:"#fde68a", iconBg:"#fef3c7", valColor:"#92400e", subColor:"#d97706" },
    danger:  { bg:"#fef2f2", border:"#fecaca", iconBg:"#fee2e2", valColor:"#991b1b", subColor:"#ef4444" },
  }[variant];
  return (
    <div className="rounded-2xl p-5 flex items-start gap-4 transition-all hover:shadow-md"
      style={{ background: cfg.bg, border: `1.5px solid ${cfg.border}` }}>
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xl" style={{ background: cfg.iconBg }}>{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: cfg.subColor }}>{label}</div>
        <div className="text-2xl font-bold leading-none truncate" style={{ color: cfg.valColor }}>
          {loading ? <span className="text-slate-300 text-xl">—</span> : value}
        </div>
        {sub && <div className="mt-1 text-xs" style={{ color: cfg.subColor }}>{sub}</div>}
      </div>
    </div>
  );
}

/* ─── Segmented control ──────────────────────────────────────── */
function SegmentedControl<T extends string>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string }[];
}) {
  return (
    <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1 gap-0.5">
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            value === o.value ? "bg-white border border-slate-200 shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"
          }`}>{o.label}</button>
      ))}
    </div>
  );
}

/* ─── Quick action ───────────────────────────────────────────── */
function QuickAction({ href, icon, label, primary = false }: { href: string; icon: string; label: string; primary?: boolean }) {
  return (
    <Link href={href} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
      primary ? "bg-amber-500 text-white hover:bg-amber-600 shadow-sm" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
    }`}>
      <span className="text-base">{icon}</span>{label}
    </Link>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CHART 1 — Revenue vs Expenses area chart (SVG, no deps)
═══════════════════════════════════════════════════════════════ */
function AreaChart({ points, loading }: {
  points: { period: string; revenue: number; expenses: number }[];
  loading: boolean;
}) {
  const W = 600, H = 180, PAD = { t: 12, r: 16, b: 32, l: 52 };
  const iW = W - PAD.l - PAD.r;
  const iH = H - PAD.t - PAD.b;

  const maxVal = useMemo(() => Math.max(...points.map((p) => Math.max(p.revenue, p.expenses)), 1), [points]);
  const xScale = (i: number) => PAD.l + (points.length < 2 ? iW / 2 : (i / (points.length - 1)) * iW);
  const yScale = (v: number) => PAD.t + iH - (v / maxVal) * iH;

  const polyline = (key: "revenue" | "expenses") =>
    points.map((p, i) => `${xScale(i)},${yScale(p[key])}`).join(" ");

  const area = (key: "revenue" | "expenses") => {
    if (points.length === 0) return "";
    const pts = points.map((p, i) => `${xScale(i)},${yScale(p[key])}`).join(" ");
    const first = `${xScale(0)},${PAD.t + iH}`;
    const last  = `${xScale(points.length - 1)},${PAD.t + iH}`;
    return `M${first} L${pts} L${last} Z`;
  };

  // Y-axis grid lines (4 levels)
  const gridVals = [0, 0.25, 0.5, 0.75, 1].map((f) => maxVal * f);

  // X-axis labels: show ~5 evenly spaced
  const xLabels = useMemo(() => {
    if (points.length === 0) return [];
    const step = Math.max(1, Math.floor(points.length / 5));
    return points.filter((_, i) => i % step === 0 || i === points.length - 1);
  }, [points]);

  if (loading) return <div className="h-[180px] flex items-center justify-center"><Spinner /></div>;
  if (points.length === 0) return (
    <div className="h-[180px] flex items-center justify-center text-sm text-slate-400">No data for this period</div>
  );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      <defs>
        <linearGradient id="grad-rev" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25"/>
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02"/>
        </linearGradient>
        <linearGradient id="grad-exp" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.18"/>
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0.02"/>
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {gridVals.map((v, i) => (
        <g key={i}>
          <line x1={PAD.l} y1={yScale(v)} x2={W - PAD.r} y2={yScale(v)} stroke="#e2e8f0" strokeWidth="1" />
          <text x={PAD.l - 6} y={yScale(v) + 4} textAnchor="end" fontSize="9" fill="#94a3b8">{fmtK(v)}</text>
        </g>
      ))}

      {/* Areas */}
      <path d={area("revenue")} fill="url(#grad-rev)" />
      <path d={area("expenses")} fill="url(#grad-exp)" />

      {/* Lines */}
      <polyline points={polyline("revenue")} fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={polyline("expenses")} fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" strokeDasharray="4 3" />

      {/* Dots on revenue */}
      {points.map((p, i) => (
        <circle key={i} cx={xScale(i)} cy={yScale(p.revenue)} r="2.5" fill="#f59e0b" />
      ))}

      {/* X labels */}
      {xLabels.map((p, i) => {
        const idx = points.indexOf(p);
        const label = p.period.length > 5 ? p.period.slice(5) : p.period; // show MM-DD
        return <text key={i} x={xScale(idx)} y={H - 6} textAnchor="middle" fontSize="9" fill="#94a3b8">{label}</text>;
      })}
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CHART 2 — P&L Waterfall bar chart
═══════════════════════════════════════════════════════════════ */
function WaterfallChart({ totals, loading }: {
  totals: { revenue: number; cogs: number; discounts: number; expenses: number; gross_profit: number; net_profit: number };
  loading: boolean;
}) {
  const W = 480, H = 160, PAD = { t: 12, r: 16, b: 36, l: 56 };
  const iW = W - PAD.l - PAD.r;
  const iH = H - PAD.t - PAD.b;

  const bars = useMemo(() => [
    { label: "Revenue",   value: totals.revenue,    color: "#22c55e", type: "full" as const },
    { label: "COGS",      value: -totals.cogs,       color: "#ef4444", type: "sub"  as const },
    { label: "Discounts", value: -totals.discounts,  color: "#f97316", type: "sub"  as const },
    { label: "Expenses",  value: -totals.expenses,   color: "#ef4444", type: "sub"  as const },
    { label: "Net",       value: totals.net_profit,  color: totals.net_profit >= 0 ? "#22c55e" : "#ef4444", type: "result" as const },
  ], [totals]);

  const maxVal = useMemo(() => Math.max(...bars.map((b) => Math.abs(b.value)), 1), [bars]);
  const barW = iW / bars.length - 10;

  if (loading) return <div className="h-[160px] flex items-center justify-center"><Spinner /></div>;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      {/* Baseline */}
      <line x1={PAD.l} y1={PAD.t + iH} x2={W - PAD.r} y2={PAD.t + iH} stroke="#e2e8f0" strokeWidth="1" />

      {bars.map((b, i) => {
        const x    = PAD.l + i * (barW + 10) + 4;
        const bH   = Math.max(2, (Math.abs(b.value) / maxVal) * iH * 0.9);
        const y    = PAD.t + iH - bH;
        const mid  = x + barW / 2;

        return (
          <g key={b.label}>
            <rect x={x} y={y} width={barW} height={bH} rx="3" fill={b.color} opacity={b.type === "result" ? 1 : 0.75} />
            <text x={mid} y={PAD.t + iH + 14} textAnchor="middle" fontSize="8.5" fill="#64748b">{b.label}</text>
            <text x={mid} y={y - 4} textAnchor="middle" fontSize="8" fill={b.color} fontWeight="600">{fmtK(Math.abs(b.value))}</text>
          </g>
        );
      })}

      {/* Y axis labels */}
      {[0, 0.5, 1].map((f, i) => {
        const v = maxVal * f;
        const y = PAD.t + iH - (v / maxVal) * iH * 0.9;
        return <text key={i} x={PAD.l - 5} y={y + 3} textAnchor="end" fontSize="8.5" fill="#94a3b8">{fmtK(v)}</text>;
      })}
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CHART 3 — Donut chart (expense categories / inventory status)
═══════════════════════════════════════════════════════════════ */
function DonutChart({ segments, label, total, cx = 70, cy = 70, r = 52, thickness = 18 }: {
  segments: { label: string; value: number; color: string }[];
  label: string; total: string;
  cx?: number; cy?: number; r?: number; thickness?: number;
}) {
  const W = 220, H = 140;
  const nonZero = segments.filter((s) => s.value > 0);
  const sum = nonZero.reduce((s, x) => s + x.value, 0);
  if (sum === 0) return <div className="h-[140px] flex items-center justify-center text-sm text-slate-400">No data</div>;

  let angle = -Math.PI / 2; // start at top
  const arcs = nonZero.map((seg) => {
    const sweep = (seg.value / sum) * 2 * Math.PI;
    const startA = angle;
    const endA = angle + sweep;
    angle = endA;

    const gap = 0.02; // small gap between segments
    const sA = startA + gap, eA = endA - gap;
    const x1 = cx + r * Math.cos(sA), y1 = cy + r * Math.sin(sA);
    const x2 = cx + r * Math.cos(eA), y2 = cy + r * Math.sin(eA);
    const ri = r - thickness;
    const x3 = cx + ri * Math.cos(eA), y3 = cy + ri * Math.sin(eA);
    const x4 = cx + ri * Math.cos(sA), y4 = cy + ri * Math.sin(sA);
    const large = sweep > Math.PI ? 1 : 0;

    return {
      ...seg,
      d: `M${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} L${x3},${y3} A${ri},${ri} 0 ${large} 0 ${x4},${y4} Z`,
      pct: ((seg.value / sum) * 100).toFixed(0),
    };
  });

  const legendX = cx * 2 + 10;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      {arcs.map((a, i) => (
        <path key={i} d={a.d} fill={a.color} opacity="0.9" />
      ))}
      {/* Center label */}
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="9" fill="#94a3b8" fontWeight="600">{label}</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize="13" fill="#0f172a" fontWeight="700">{total}</text>

      {/* Legend */}
      {arcs.slice(0, 6).map((a, i) => {
        const ly = 14 + i * 19;
        return (
          <g key={i}>
            <rect x={legendX} y={ly - 7} width="8" height="8" rx="2" fill={a.color} opacity="0.9" />
            <text x={legendX + 12} y={ly} fontSize="9" fill="#475569">
              {a.label.length > 12 ? a.label.slice(0, 12) + "…" : a.label}
            </text>
            <text x={W - 4} y={ly} textAnchor="end" fontSize="9" fill="#0f172a" fontWeight="600">{a.pct}%</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ─── Category colors ────────────────────────────────────────── */
const CAT_PALETTE = ["#f59e0b","#3b82f6","#8b5cf6","#10b981","#ef4444","#06b6d4","#f97316","#ec4899","#6366f1","#14b8a6"];

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const [orgId, setOrgId]     = useState<string | null>(null);
  const [preset, setPreset]   = useState<RangePreset>("7d");
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");

  const [pnl, setPnl]             = useState<Awaited<ReturnType<typeof reportPnL>> | null>(null);
  const [expData, setExpData]     = useState<Awaited<ReturnType<typeof reportExpenses>> | null>(null);
  const [inventory, setInventory] = useState<Awaited<ReturnType<typeof getInventoryValuation>> | null>(null);
  const [recentSales, setRecentSales]       = useState<RecentSale[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<RecentExpense[]>([]);
  const [activityTab, setActivityTab] = useState<"sales" | "expenses">("sales");

  const range = useMemo(() => {
    const to = new Date(), from = new Date(to);
    if (preset === "today") return { from: iso(to), to: iso(to), label: "Today" };
    if (preset === "7d")  { from.setDate(to.getDate() - 6);  return { from: iso(from), to: iso(to), label: "Last 7 days" }; }
    if (preset === "30d") { from.setDate(to.getDate() - 29); return { from: iso(from), to: iso(to), label: "Last 30 days" }; }
    return { from: iso(startOfMonth(to)), to: iso(to), label: "This month" };
  }, [preset]);

  useEffect(() => {
    (async () => {
      try { const o = await bootstrapOrg(); setOrgId(o); }
      catch (e: any) { setErr(e.message ?? String(e)); }
    })();
  }, []);

  async function loadAll() {
    if (!orgId) return;
    setLoading(true); setErr("");
    try {
      const [pl, inv, ex] = await Promise.all([
        reportPnL(orgId, { from: range.from, to: range.to, granularity: "day" }),
        getInventoryValuation(orgId),
        reportExpenses(orgId, { from: range.from, to: range.to, granularity: "day" }),
      ]);
      const [{ data: sData, error: sErr }, { data: eData, error: eErr }] = await Promise.all([
        supabase.from("sales").select("id,sale_no,customer_name,total,discount_total,created_at")
          .eq("org_id", orgId).order("created_at", { ascending: false }).limit(10),
        supabase.from("expenses").select("id,category,amount,expense_date,created_at")
          .eq("org_id", orgId).order("created_at", { ascending: false }).limit(10),
      ]);
      if (sErr) throw new Error(sErr.message);
      if (eErr) throw new Error(eErr.message);
      setPnl(pl); setInventory(inv); setExpData(ex);
      setRecentSales((sData ?? []) as any);
      setRecentExpenses((eData ?? []) as any);
    } catch (e: any) { setErr(e.message ?? String(e)); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (orgId) loadAll(); }, [orgId, range.from, range.to]);

  const kpis = useMemo(() => ({
    revenue:   Number(pnl?.totals?.revenue ?? 0),
    discounts: Number(pnl?.totals?.discounts ?? 0),
    expenses:  Number(pnl?.totals?.expenses ?? 0),
    net:       Number(pnl?.totals?.net_profit ?? 0),
    invValue:  Number(inventory?.totals?.total_value ?? 0),
    lowCount:  Number(inventory?.totals?.low_count ?? 0),
    outCount:  Number(inventory?.totals?.out_count ?? 0),
  }), [pnl, inventory]);

  const pnlTotals = useMemo(() => ({
    revenue:    Number(pnl?.totals?.revenue ?? 0),
    cogs:       Number(pnl?.totals?.cogs ?? 0),
    discounts:  Number(pnl?.totals?.discounts ?? 0),
    expenses:   Number(pnl?.totals?.expenses ?? 0),
    gross_profit: Number(pnl?.totals?.gross_profit ?? 0),
    net_profit: Number(pnl?.totals?.net_profit ?? 0),
  }), [pnl]);

  // Area chart data: merge pnl daily points with expense trend
  const areaPoints = useMemo(() => {
    const revMap = new Map((pnl?.points ?? []).map((p: any) => [p.period, Number(p.revenue ?? 0)]));
    const expMap = new Map((expData?.trend ?? []).map((t: any) => [t.period, Number(t.total ?? 0)]));
    const allPeriods = Array.from(new Set([...revMap.keys(), ...expMap.keys()])).sort();
    return allPeriods.map((period) => ({
      period,
      revenue:  revMap.get(period) ?? 0,
      expenses: expMap.get(period) ?? 0,
    }));
  }, [pnl, expData]);

  // Expense category donut
  const expCatSegments = useMemo(() => {
    const cats = (expData?.top_categories ?? []) as { category: string; amount: number }[];
    return cats.slice(0, 8).map((c, i) => ({
      label: c.category,
      value: Number(c.amount),
      color: CAT_PALETTE[i % CAT_PALETTE.length],
    }));
  }, [expData]);

  // Inventory status donut
  const invStatusSegments = useMemo(() => {
    const rows = inventory?.rows ?? [];
    const counts = { ok: 0, low: 0, critical: 0, out: 0 };
    for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;
    return [
      { label: "OK",       value: counts.ok,       color: "#22c55e" },
      { label: "Low",      value: counts.low,       color: "#f59e0b" },
      { label: "Critical", value: counts.critical,  color: "#f97316" },
      { label: "Out",      value: counts.out,       color: "#ef4444" },
    ].filter((s) => s.value > 0);
  }, [inventory]);

  const lowStockRows = useMemo(() => {
    const rows = inventory?.rows ?? [];
    const rank = (r: InventoryValuationRow) => r.status === "out" ? 0 : r.status === "critical" ? 1 : 2;
    return rows.filter((r) => r.status !== "ok").sort((a, b) => rank(a) - rank(b)).slice(0, 6);
  }, [inventory]);

  const totalAlerts = kpis.lowCount + kpis.outCount;

  if (!orgId && !err) return (
    <div className="flex h-64 items-center justify-center">
      <div className="flex items-center gap-3 text-slate-500">
        <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" strokeOpacity="0.2"/><path d="M12 2a10 10 0 0110 10"/>
        </svg>
        <span className="text-sm font-medium">Loading dashboard…</span>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">

      {/* ── Error ── */}
      {err && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          <span className="shrink-0">⚠️</span><span className="flex-1">{err}</span>
          <button onClick={() => setErr("")} className="ml-auto text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">{range.label} · Pollinators Apitherapy</p>
        </div>
        <div className="flex items-center gap-3">
          <SegmentedControl value={preset} onChange={setPreset} options={[
            { value: "today", label: "Today" },
            { value: "7d",    label: "7D" },
            { value: "30d",   label: "30D" },
            { value: "month", label: "Month" },
          ]} />
          <button onClick={loadAll} disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition">
            {loading
              ? <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity="0.2"/><path d="M12 2a10 10 0 0110 10"/></svg>
              : "↻"}
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <QuickAction href="/dashboard/sales/new" icon="🧾" label="New Sale"    primary />
        <QuickAction href="/dashboard/expenses"  icon="💸" label="Add Expense" />
        <QuickAction href="/dashboard/inventory" icon="📦" label="Inventory" />
        <QuickAction href="/dashboard/reports"   icon="📊" label="Reports" />
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Revenue"    value={fmtMoney(kpis.revenue)}   icon="📈" variant="neutral" loading={loading} />
        <KpiCard label="Net Profit" value={fmtMoney(kpis.net)}        icon="💰"
          variant={kpis.net < 0 ? "danger" : "success"} loading={loading}
          sub={kpis.net < 0 ? "Loss this period" : "Profit this period"} />
        <KpiCard label="Expenses"   value={fmtMoney(kpis.expenses)}  icon="💸" variant="warning" loading={loading} />
        <KpiCard label="Discounts"  value={fmtMoney(kpis.discounts)} icon="🏷️" variant="neutral" loading={loading} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="col-span-2">
          <KpiCard label="Inventory Value" value={fmtMoney(kpis.invValue)} icon="📦"
            sub="Unit price × qty on hand" loading={loading} />
        </div>
        <KpiCard label="Low / Critical" value={String(kpis.lowCount)} icon="📉" variant="warning" loading={loading} />
        <KpiCard label="Out of Stock"   value={String(kpis.outCount)} icon="🚫"
          variant={kpis.outCount > 0 ? "danger" : "neutral"} loading={loading} />
      </div>

      {/* ═══════════════════════════════════════════════════════
          CHART ROW 1 — Revenue vs Expenses area + P&L waterfall
      ═══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">

        {/* Area chart */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <div className="font-bold text-slate-900">Revenue vs Expenses</div>
              <div className="text-xs text-slate-500 mt-0.5">{range.label} · daily</div>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400 inline-block" />Revenue
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-px w-4 border-t-2 border-dashed border-red-400 inline-block" />Expenses
              </span>
            </div>
          </div>
          <div className="px-4 py-4">
            <AreaChart points={areaPoints} loading={loading} />
          </div>
          {!loading && areaPoints.length > 0 && (
            <div className="border-t border-slate-100 px-5 py-3 grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-500">Total Revenue</span>
                <span className="ml-2 font-bold text-slate-900">{fmtMoney(kpis.revenue)}</span>
              </div>
              <div>
                <span className="text-slate-500">Total Expenses</span>
                <span className="ml-2 font-bold text-slate-900">{fmtMoney(kpis.expenses)}</span>
              </div>
            </div>
          )}
        </div>

        {/* P&L waterfall */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="font-bold text-slate-900">P&L Breakdown</div>
            <div className="text-xs text-slate-500 mt-0.5">Revenue → deductions → net</div>
          </div>
          <div className="px-4 py-4">
            <WaterfallChart totals={pnlTotals} loading={loading} />
          </div>
          {!loading && (
            <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-between">
              <span className="text-xs text-slate-500">Net Profit</span>
              <span className={`text-sm font-bold ${pnlTotals.net_profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                {fmtMoney(pnlTotals.net_profit)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          CHART ROW 2 — Expense categories donut + Inventory status donut
      ═══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">

        {/* Expense category donut */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="font-bold text-slate-900">Expense Breakdown</div>
            <div className="text-xs text-slate-500 mt-0.5">By category · {range.label}</div>
          </div>
          <div className="px-4 py-4">
            {loading
              ? <Spinner />
              : <DonutChart
                  segments={expCatSegments}
                  label="Expenses"
                  total={fmtK(kpis.expenses)}
                />
            }
          </div>
          {!loading && expCatSegments.length > 0 && (
            <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-between">
              <span className="text-xs text-slate-500">{expCatSegments.length} categories</span>
              <Link href="/dashboard/reports/expenses-pnl" className="text-xs font-semibold text-amber-600 hover:text-amber-700">Full report →</Link>
            </div>
          )}
        </div>

        {/* Inventory status donut */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900">Inventory Health</span>
                {totalAlerts > 0 && (
                  <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                    {totalAlerts} alert{totalAlerts !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">Stock status distribution</div>
            </div>
            <Link href="/dashboard/inventory" className="text-xs font-semibold text-amber-600 hover:text-amber-700">Manage →</Link>
          </div>
          <div className="px-4 py-4">
            {loading
              ? <Spinner />
              : <DonutChart
                  segments={invStatusSegments}
                  label="Products"
                  total={String(inventory?.rows?.length ?? 0)}
                />
            }
          </div>

          {/* Low stock list */}
          {!loading && lowStockRows.length > 0 && (
            <div className="border-t border-slate-100 divide-y divide-slate-100">
              {lowStockRows.slice(0, 3).map((r) => {
                const badge = stockBadgeCfg(r.status);
                return (
                  <div key={r.product_id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50 transition-colors">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold shrink-0 ${badge.cls}`}>{badge.label}</span>
                    <span className="text-sm font-medium text-slate-800 flex-1 truncate">{r.name}</span>
                    <span className="text-xs text-slate-500 shrink-0">{r.qty_on_hand} left</span>
                  </div>
                );
              })}
              {lowStockRows.length > 3 && (
                <div className="px-5 py-2 text-xs text-slate-400">
                  +{lowStockRows.length - 3} more · <Link href="/dashboard/inventory" className="font-semibold text-amber-600 hover:text-amber-700">view all</Link>
                </div>
              )}
            </div>
          )}
          {!loading && lowStockRows.length === 0 && (
            <div className="border-t border-slate-100 px-5 py-3 text-xs text-green-600 font-semibold">
              ✓ All products adequately stocked
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          Recent Activity
      ═══════════════════════════════════════════════════════ */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <div className="font-bold text-slate-900">Recent Activity</div>
            <div className="text-xs text-slate-500 mt-0.5">Latest 10 entries</div>
          </div>
          <SegmentedControl value={activityTab} onChange={setActivityTab} options={[
            { value: "sales",    label: "Sales" },
            { value: "expenses", label: "Expenses" },
          ]} />
        </div>

        {activityTab === "sales" && (
          <>
            <div className="hidden sm:grid items-center gap-4 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 bg-slate-50 border-b border-slate-200"
              style={{ gridTemplateColumns: "1fr 1.5fr 1.2fr 1fr" }}>
              <div>Sale #</div><div>Customer</div><div>Date</div><div className="text-right">Total</div>
            </div>
            <div className="divide-y divide-slate-100">
              {loading ? <Spinner />
              : recentSales.length === 0
                ? <div className="py-12 text-center text-sm text-slate-400">No recent sales.</div>
                : recentSales.map((s) => (
                  <Link key={s.id} href={`/dashboard/sales/${s.id}`}
                    className="grid items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors"
                    style={{ gridTemplateColumns: "1fr 1.5fr 1.2fr 1fr" }}>
                    <div className="text-sm font-bold text-slate-900">{s.sale_no}</div>
                    <div className="text-sm text-slate-600 truncate">{s.customer_name ?? <span className="italic text-slate-400">Walk-in</span>}</div>
                    <div className="text-sm text-slate-500">{fmtTime(s.created_at)}</div>
                    <div className="text-right text-sm font-bold text-slate-900">{fmtMoney(Number(s.total ?? 0))}</div>
                  </Link>
                ))
              }
            </div>
            {recentSales.length > 0 && !loading && (
              <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-between">
                <Link href="/dashboard/sales" className="text-xs font-semibold text-amber-600 hover:text-amber-700">View all sales →</Link>
                <span className="text-xs font-bold text-slate-900">{fmtMoney(recentSales.reduce((s, r) => s + Number(r.total ?? 0), 0))}</span>
              </div>
            )}
          </>
        )}

        {activityTab === "expenses" && (
          <>
            <div className="hidden sm:grid items-center gap-4 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 bg-slate-50 border-b border-slate-200"
              style={{ gridTemplateColumns: "1.5fr 1fr 1fr" }}>
              <div>Category</div><div>Date</div><div className="text-right">Amount</div>
            </div>
            <div className="divide-y divide-slate-100">
              {loading ? <Spinner />
              : recentExpenses.length === 0
                ? <div className="py-12 text-center text-sm text-slate-400">No recent expenses.</div>
                : recentExpenses.map((e) => (
                  <div key={e.id}
                    className="grid items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors"
                    style={{ gridTemplateColumns: "1.5fr 1fr 1fr" }}>
                    <div className="text-sm font-semibold text-slate-900">{e.category}</div>
                    <div className="text-sm text-slate-500">{e.expense_date}</div>
                    <div className="text-right text-sm font-bold text-slate-900">{fmtMoney(Number(e.amount ?? 0))}</div>
                  </div>
                ))
              }
            </div>
            {recentExpenses.length > 0 && !loading && (
              <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-between">
                <Link href="/dashboard/expenses" className="text-xs font-semibold text-amber-600 hover:text-amber-700">View all expenses →</Link>
                <span className="text-xs font-bold text-slate-900">{fmtMoney(recentExpenses.reduce((s, r) => s + Number(r.amount ?? 0), 0))}</span>
              </div>
            )}
          </>
        )}
      </div>

    </div>
  );
}