"use client";

import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from "react";
import Link from "next/link";
import { bootstrapOrg } from "../../../lib/org/bootstrapOrg";
import { supabase } from "@/lib/supabase/client";
import {
  getInventoryValuation, reportPnL, reportExpenses,
  type InventoryValuationRow,
} from "@/lib/api/reports";

/* ════════════════════════════════════════════════════════════════
   TYPES
════════════════════════════════════════════════════════════════ */
type RangePreset    = "today" | "7d" | "30d" | "month";
type NavSection     = "overview" | "revenue" | "expenses" | "inventory" | "activity";
type RecentSale     = { id: string; sale_no: string; customer_name: string | null; total: number; discount_total: number; created_at: string };
type RecentExpense  = { id: string; category: string; amount: number; expense_date: string; created_at: string };

/* ════════════════════════════════════════════════════════════════
   CONSTANTS
════════════════════════════════════════════════════════════════ */
const CAT_PALETTE = [
  "#f59e0b","#3b82f6","#8b5cf6","#10b981",
  "#ef4444","#06b6d4","#f97316","#ec4899","#6366f1","#14b8a6",
];

const NAV_ITEMS: { id: NavSection; label: string; icon: string; desc: string }[] = [
  { id: "overview",  label: "Overview",  icon: "◈", desc: "Full picture" },
  { id: "revenue",   label: "Revenue",   icon: "↗", desc: "Sales & P&L" },
  { id: "expenses",  label: "Expenses",  icon: "↙", desc: "Spend analysis" },
  { id: "inventory", label: "Inventory", icon: "◫", desc: "Stock health" },
  { id: "activity",  label: "Activity",  icon: "◷", desc: "Recent entries" },
];

/* ════════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════════ */
const iso = (d: Date) => d.toISOString().slice(0, 10);
const startOfMonth = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
const fmtMoney = (v: number) =>
  `Ksh ${Number(v || 0).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
const fmtK = (v: number) => {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}k`;
  return String(Math.round(v));
};
const fmtTime = (v: string) => {
  try { return new Date(v).toLocaleString("en-GB", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" }); }
  catch { return v; }
};
const stockBadge = (s: InventoryValuationRow["status"]) =>
  s === "out"      ? { cls: "bg-red-100 text-red-700",     dot: "#ef4444", label: "Out"      } :
  s === "critical" ? { cls: "bg-orange-100 text-orange-700", dot: "#f97316", label: "Critical" } :
                     { cls: "bg-amber-100 text-amber-700",  dot: "#f59e0b", label: "Low"      };

/* ════════════════════════════════════════════════════════════════
   ANIMATED COUNTER
════════════════════════════════════════════════════════════════ */
function Counter({ to, duration = 800 }: { to: number; duration?: number }) {
  const [v, setV] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    const t0 = performance.now();
    const from = v;
    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setV(Math.round(from + (to - from) * ease));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [to]);
  return <>{v.toLocaleString("en-KE")}</>;
}

/* ════════════════════════════════════════════════════════════════
   SPARKLINE
════════════════════════════════════════════════════════════════ */
function Sparkline({ data, color = "#f59e0b", w = 96, h = 32 }: {
  data: number[]; color?: string; w?: number; h?: number;
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1), min = Math.min(...data, 0);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const [lx, ly] = pts.split(" ").pop()!.split(",").map(Number);
  return (
    <svg width={w} height={h} style={{ overflow: "visible" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinejoin="round" strokeLinecap="round" opacity="0.7" />
      <circle cx={lx} cy={ly} r="2.5" fill={color} />
    </svg>
  );
}

/* ════════════════════════════════════════════════════════════════
   KPI CARD
════════════════════════════════════════════════════════════════ */
function KpiCard({ label, value, rawValue, sub, icon, variant = "neutral", loading, spark, sparkColor }: {
  label: string; value: string; rawValue: number; sub?: string; icon: string;
  variant?: "neutral"|"success"|"warning"|"danger";
  loading?: boolean; spark?: number[]; sparkColor?: string;
}) {
  const cfg = {
    neutral: { bg:"#fff",    border:"#e2e8f0", iconBg:"#f8fafc", val:"#0f172a", sub:"#64748b", sc:"#94a3b8" },
    success: { bg:"#f0fdf4", border:"#bbf7d0", iconBg:"#dcfce7", val:"#166534", sub:"#16a34a", sc:"#22c55e" },
    warning: { bg:"#fffbeb", border:"#fde68a", iconBg:"#fef3c7", val:"#92400e", sub:"#d97706", sc:"#f59e0b" },
    danger:  { bg:"#fef2f2", border:"#fecaca", iconBg:"#fee2e2", val:"#991b1b", sub:"#ef4444", sc:"#ef4444" },
  }[variant];
  return (
    <div className="rounded-2xl p-5 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
      style={{ background: cfg.bg, border: `1.5px solid ${cfg.border}` }}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl text-lg"
          style={{ background: cfg.iconBg }}>{icon}</div>
        {spark && spark.length > 1 && !loading && (
          <div className="opacity-70"><Sparkline data={spark} color={sparkColor ?? cfg.sc} /></div>
        )}
      </div>
      <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: cfg.sub }}>{label}</div>
      <div className="text-2xl font-bold leading-tight" style={{ color: cfg.val }}>
        {loading
          ? <span className="text-slate-200">—</span>
          : <span>Ksh <Counter to={rawValue} /></span>
        }
      </div>
      {sub && <div className="mt-1 text-xs" style={{ color: cfg.sub }}>{sub}</div>}
    </div>
  );
}

function CountCard({ label, value, icon, variant = "neutral", loading }: {
  label: string; value: number; icon: string;
  variant?: "neutral"|"success"|"warning"|"danger"; loading?: boolean;
}) {
  const cfg = {
    neutral: { bg:"#fff",    border:"#e2e8f0", iconBg:"#f8fafc", val:"#0f172a", sub:"#64748b" },
    success: { bg:"#f0fdf4", border:"#bbf7d0", iconBg:"#dcfce7", val:"#166534", sub:"#16a34a" },
    warning: { bg:"#fffbeb", border:"#fde68a", iconBg:"#fef3c7", val:"#92400e", sub:"#d97706" },
    danger:  { bg:"#fef2f2", border:"#fecaca", iconBg:"#fee2e2", val:"#991b1b", sub:"#ef4444" },
  }[variant];
  return (
    <div className="rounded-2xl p-5 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
      style={{ background: cfg.bg, border: `1.5px solid ${cfg.border}` }}>
      <div className="grid h-10 w-10 place-items-center rounded-xl text-lg mb-3" style={{ background: cfg.iconBg }}>{icon}</div>
      <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: cfg.sub }}>{label}</div>
      <div className="text-3xl font-bold" style={{ color: cfg.val }}>
        {loading ? "—" : <Counter to={value} />}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   SPINNER
════════════════════════════════════════════════════════════════ */
function Spin({ h = 120 }: { h?: number }) {
  return (
    <div className="flex items-center justify-center gap-3 text-slate-300" style={{ height: h }}>
      <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" strokeOpacity="0.2" /><path d="M12 2a10 10 0 0110 10" />
      </svg>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   INTERACTIVE AREA CHART — with crosshair tooltip
════════════════════════════════════════════════════════════════ */
function AreaChart({ points, height = 200, loading }: {
  points: { period: string; revenue: number; expenses: number }[];
  height?: number; loading?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const W = 580, H = height;
  const P = { t: 16, r: 16, b: 34, l: 52 };
  const iW = W - P.l - P.r, iH = H - P.t - P.b;

  const maxV = useMemo(() => Math.max(...points.map(p => Math.max(p.revenue, p.expenses)), 1), [points]);
  const xs = useCallback((i: number) =>
    P.l + (points.length < 2 ? iW / 2 : (i / (points.length - 1)) * iW), [points.length, iW]);
  const ys = useCallback((v: number) => P.t + iH - (v / maxV) * iH, [maxV, iH]);

  const path = (key: "revenue" | "expenses") =>
    points.map((p, i) => `${i === 0 ? "M" : "L"}${xs(i).toFixed(1)},${ys(p[key]).toFixed(1)}`).join(" ");
  const area = (key: "revenue" | "expenses") => points.length === 0 ? "" :
    `${path(key)} L${xs(points.length-1).toFixed(1)},${(P.t+iH).toFixed(1)} L${xs(0).toFixed(1)},${(P.t+iH).toFixed(1)} Z`;

  const onMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || points.length < 2) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0, bd = Infinity;
    points.forEach((_, i) => { const d = Math.abs(xs(i) - mx); if (d < bd) { bd = d; best = i; } });
    setHover(best);
  }, [points, xs]);

  const grids = [0, 0.25, 0.5, 0.75, 1].map(f => maxV * f);
  const xLabels = useMemo(() => {
    if (!points.length) return [];
    const step = Math.max(1, Math.floor(points.length / 6));
    return points.map((p, i) => ({ p, i })).filter(({ i }) => i % step === 0 || i === points.length - 1);
  }, [points]);

  if (loading) return <Spin h={height} />;
  if (!points.length) return (
    <div className="flex items-center justify-center text-sm text-slate-400" style={{ height }}>
      No data for this period
    </div>
  );

  const hp = hover !== null ? points[hover] : null;

  return (
    <div className="relative select-none">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full cursor-crosshair"
        style={{ height }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="ac-rev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="ac-exp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.02" />
          </linearGradient>
          <filter id="ac-glow"><feGaussianBlur stdDeviation="2.5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>

        {/* Grid */}
        {grids.map((v, i) => (
          <g key={i}>
            <line x1={P.l} y1={ys(v)} x2={W - P.r} y2={ys(v)} stroke="#f1f5f9" strokeWidth="1" />
            <text x={P.l - 8} y={ys(v) + 4} textAnchor="end" fontSize="9.5" fill="#94a3b8">{fmtK(v)}</text>
          </g>
        ))}

        {/* Crosshair */}
        {hover !== null && (
          <line x1={xs(hover)} y1={P.t} x2={xs(hover)} y2={P.t + iH}
            stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 3" />
        )}

        {/* Areas */}
        <path d={area("expenses")} fill="url(#ac-exp)" />
        <path d={area("revenue")} fill="url(#ac-rev)" />

        {/* Lines */}
        <path d={path("expenses")} fill="none" stroke="#ef4444" strokeWidth="1.5"
          strokeLinejoin="round" strokeDasharray="5 3" />
        <path d={path("revenue")} fill="none" stroke="#f59e0b" strokeWidth="2.5"
          strokeLinejoin="round" filter="url(#ac-glow)" />

        {/* Revenue dots */}
        {points.map((p, i) => (
          <circle key={i} cx={xs(i)} cy={ys(p.revenue)} fill={hover === i ? "#fff" : "#f59e0b"}
            stroke="#f59e0b" strokeWidth={hover === i ? 2 : 0} r={hover === i ? 5 : 2.5}
            style={{ transition: "r 0.1s" }} />
        ))}
        {/* Expense dot on hover */}
        {hover !== null && hp && (
          <circle cx={xs(hover)} cy={ys(hp.expenses)} r="4.5" fill="#fff" stroke="#ef4444" strokeWidth="2" />
        )}

        {/* X labels */}
        {xLabels.map(({ p, i }) => (
          <text key={i} x={xs(i)} y={H - 6} textAnchor="middle" fontSize="9.5"
            fill={hover === i ? "#475569" : "#94a3b8"} fontWeight={hover === i ? "600" : "400"}>
            {p.period.length > 5 ? p.period.slice(5) : p.period}
          </text>
        ))}
      </svg>

      {/* Tooltip */}
      {hover !== null && hp && (
        <div className="pointer-events-none absolute top-2 left-14 z-10 rounded-xl border border-slate-200 bg-white/96 backdrop-blur-sm p-3 shadow-xl text-xs w-44">
          <div className="font-bold text-slate-800 mb-2 pb-1.5 border-b border-slate-100">{hp.period}</div>
          <div className="flex justify-between mb-1">
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="h-2 w-2 rounded-full bg-amber-400" />Revenue
            </span>
            <span className="font-bold text-slate-900">{fmtMoney(hp.revenue)}</span>
          </div>
          <div className="flex justify-between mb-2">
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="h-2 w-2 rounded-full bg-red-400" />Expenses
            </span>
            <span className="font-bold text-slate-900">{fmtMoney(hp.expenses)}</span>
          </div>
          <div className={`pt-1.5 border-t border-slate-100 font-bold flex justify-between
            ${hp.revenue - hp.expenses >= 0 ? "text-green-600" : "text-red-500"}`}>
            <span>Net</span>
            <span>{fmtMoney(hp.revenue - hp.expenses)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   INTERACTIVE PIE / DONUT
════════════════════════════════════════════════════════════════ */
function PieChart({ segments, centerLabel, centerValue, size = 200 }: {
  segments: { label: string; value: number; color: string }[];
  centerLabel: string; centerValue: string; size?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const R = size * 0.38, r = size * 0.22, cx = size * 0.48, cy = size * 0.48;
  const nonZero = segments.filter(s => s.value > 0);
  const total = nonZero.reduce((s, x) => s + x.value, 0);

  if (!total) return <div className="flex items-center justify-center text-sm text-slate-400" style={{ height: size }}>No data</div>;

  let angle = -Math.PI / 2;
  const arcs = nonZero.map((seg, idx) => {
    const sweep = (seg.value / total) * 2 * Math.PI;
    const sA = angle + 0.025, eA = angle + sweep - 0.025;
    angle += sweep;
    const eR = hover === idx ? R + 9 : R;
    const cos = (a: number) => Math.cos(a), sin = (a: number) => Math.sin(a);
    const d = [
      `M${(cx + eR * cos(sA)).toFixed(2)},${(cy + eR * sin(sA)).toFixed(2)}`,
      `A${eR},${eR} 0 ${sweep > Math.PI ? 1 : 0} 1 ${(cx + eR * cos(eA)).toFixed(2)},${(cy + eR * sin(eA)).toFixed(2)}`,
      `L${(cx + r * cos(eA)).toFixed(2)},${(cy + r * sin(eA)).toFixed(2)}`,
      `A${r},${r} 0 ${sweep > Math.PI ? 1 : 0} 0 ${(cx + r * cos(sA)).toFixed(2)},${(cy + r * sin(sA)).toFixed(2)}Z`,
    ].join(" ");
    return { ...seg, idx, d, pct: ((seg.value / total) * 100).toFixed(1) };
  });

  const LX = size * 1.01, LW = size * 1.22;

  return (
    <svg viewBox={`0 0 ${size * 2.3} ${size}`} className="w-full" style={{ height: size }}>
      {arcs.map(a => (
        <path key={a.idx} d={a.d} fill={a.color}
          opacity={hover === null || hover === a.idx ? 1 : 0.4}
          style={{ transition: "opacity 0.15s, d 0.15s", cursor: "pointer" }}
          onMouseEnter={() => setHover(a.idx)} onMouseLeave={() => setHover(null)} />
      ))}
      {/* Center ring */}
      <circle cx={cx} cy={cy} r={r - 2} fill="white" />
      <text x={cx} y={cy - 9} textAnchor="middle" fontSize="9.5" fill="#94a3b8" fontWeight="600">{centerLabel}</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize="14" fill="#0f172a" fontWeight="700">{centerValue}</text>
      {hover !== null && (
        <text x={cx} y={cy + 26} textAnchor="middle" fontSize="9.5" fill={arcs[hover]?.color} fontWeight="700">
          {arcs[hover]?.pct}%
        </text>
      )}
      {/* Legend */}
      {arcs.slice(0, 8).map((a, i) => {
        const ly = 18 + i * 22, isH = hover === a.idx;
        return (
          <g key={i} style={{ cursor: "pointer" }}
            onMouseEnter={() => setHover(a.idx)} onMouseLeave={() => setHover(null)}>
            <rect x={LX} y={ly - 8} width="10" height="10" rx="3" fill={a.color} opacity={isH ? 1 : 0.8} />
            <text x={LX + 15} y={ly + 1} fontSize="10.5" fill={isH ? "#0f172a" : "#64748b"} fontWeight={isH ? "700" : "400"}>
              {a.label.length > 14 ? a.label.slice(0, 14) + "…" : a.label}
            </text>
            <text x={LX + LW - 8} y={ly + 1} textAnchor="end" fontSize="10.5"
              fill={isH ? a.color : "#94a3b8"} fontWeight={isH ? "700" : "400"}>
              {a.pct}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ════════════════════════════════════════════════════════════════
   WATERFALL CHART
════════════════════════════════════════════════════════════════ */
function Waterfall({ totals, loading }: {
  totals: { revenue: number; cogs: number; discounts: number; expenses: number; net_profit: number };
  loading: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 500, H = 190, P = { t: 20, r: 16, b: 42, l: 58 };
  const iW = W - P.l - P.r, iH = H - P.t - P.b;

  const bars = useMemo(() => [
    { label: "Revenue",   value: totals.revenue,   color: "#22c55e" },
    { label: "COGS",      value: totals.cogs,       color: "#ef4444" },
    { label: "Discounts", value: totals.discounts,  color: "#f97316" },
    { label: "Expenses",  value: totals.expenses,   color: "#ef4444" },
    { label: "Net",       value: Math.abs(totals.net_profit), color: totals.net_profit >= 0 ? "#22c55e" : "#ef4444" },
  ], [totals]);

  const maxV = Math.max(...bars.map(b => b.value), 1);
  const bW = iW / bars.length - 14;

  if (loading) return <Spin h={H} />;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      <line x1={P.l} y1={P.t + iH} x2={W - P.r} y2={P.t + iH} stroke="#e2e8f0" strokeWidth="1" />
      {[0, 0.33, 0.66, 1].map((f, i) => {
        const v = maxV * f, y = P.t + iH - (v / maxV) * iH * 0.92;
        return <g key={i}>
          <line x1={P.l} y1={y} x2={W - P.r} y2={y} stroke="#f8fafc" strokeWidth="1" />
          <text x={P.l - 6} y={y + 4} textAnchor="end" fontSize="9" fill="#94a3b8">{fmtK(v)}</text>
        </g>;
      })}
      {bars.map((b, i) => {
        const x = P.l + i * (bW + 14) + 6;
        const bH = Math.max(4, (b.value / maxV) * iH * 0.92);
        const y = P.t + iH - bH;
        const mid = x + bW / 2;
        const isH = hover === i;
        return (
          <g key={b.label} style={{ cursor: "pointer" }}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            {/* Shadow */}
            {isH && <rect x={x - 2} y={y + 3} width={bW + 4} height={bH} rx="5" fill={b.color} opacity="0.15" />}
            <rect x={x} y={y} width={bW} height={bH} rx="4"
              fill={b.color} opacity={hover === null || isH ? (i === 4 ? 1 : 0.78) : 0.35}
              style={{ transition: "opacity 0.15s" }} />
            {isH && <rect x={x - 1} y={y - 1} width={bW + 2} height={bH + 2} rx="5"
              fill="none" stroke={b.color} strokeWidth="1.5" />}
            <text x={mid} y={P.t + iH + 16} textAnchor="middle" fontSize="9.5"
              fill={isH ? "#374151" : "#94a3b8"} fontWeight={isH ? "700" : "400"}>{b.label}</text>
            <text x={mid} y={y - 6} textAnchor="middle" fontSize="9"
              fill={b.color} fontWeight="700" opacity={isH ? 1 : 0.8}>{fmtK(b.value)}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ════════════════════════════════════════════════════════════════
   HORIZONTAL BAR CHART
════════════════════════════════════════════════════════════════ */
function HBar({ data, color = "#f59e0b", loading }: {
  data: { label: string; value: number }[]; color?: string; loading?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (loading) return <Spin h={120} />;
  if (!data.length) return <div className="py-8 text-center text-sm text-slate-400">No data</div>;
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="space-y-3">
      {data.slice(0, 8).map((d, i) => {
        const pct = (d.value / max) * 100;
        const isH = hover === i;
        return (
          <div key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            className="cursor-default group">
            <div className="flex justify-between items-center mb-1">
              <span className={`text-xs font-medium truncate max-w-[160px] transition-colors ${isH ? "text-slate-900" : "text-slate-600"}`}>
                {d.label}
              </span>
              <span className={`text-xs font-bold ml-2 transition-colors ${isH ? "text-slate-900" : "text-slate-600"}`}>
                {fmtMoney(d.value)}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.max(1.5, pct)}%`, background: color, opacity: isH ? 1 : 0.65 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   SECTION NAV
════════════════════════════════════════════════════════════════ */
function SectionNav({ active, onChange }: { active: NavSection; onChange: (s: NavSection) => void }) {
  return (
    <div className="flex items-stretch gap-1.5 rounded-2xl border border-slate-200 bg-slate-50/80 p-1.5 overflow-x-auto">
      {NAV_ITEMS.map(item => {
        const isA = active === item.id;
        return (
          <button key={item.id} onClick={() => onChange(item.id)}
            className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-semibold transition-all duration-150 ${
              isA
                ? "bg-white border border-slate-200 shadow-sm text-slate-900"
                : "text-slate-500 hover:text-slate-800 hover:bg-white/70"
            }`}>
            <span className={`text-sm font-mono leading-none ${isA ? "text-amber-500" : "opacity-60"}`}>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   QUICK ACTIONS BAR
════════════════════════════════════════════════════════════════ */
function QuickActions() {
  const actions = [
    { href: "/dashboard/sales/new",         icon: "🧾", label: "New Sale",        primary: true  },
    { href: "/dashboard/expenses",           icon: "💸", label: "Add Expense",     primary: false },
    { href: "/dashboard/inventory",          icon: "📦", label: "Inventory",       primary: false },
    { href: "/dashboard/reports",            icon: "📊", label: "Reports",         primary: false },
    { href: "/dashboard/reports/sales",      icon: "📈", label: "Sales Report",    primary: false },
    { href: "/dashboard/reports/expenses-pnl", icon: "📉", label: "Expenses P&L", primary: false },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map(a => (
        <Link key={a.href} href={a.href}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md ${
            a.primary
              ? "bg-amber-500 text-white hover:bg-amber-600 shadow-sm"
              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300"
          }`}>
          <span className="text-sm">{a.icon}</span>{a.label}
        </Link>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   CARD WRAPPER
════════════════════════════════════════════════════════════════ */
function Card({ title, sub, action, children, className = "" }: {
  title: string; sub?: string; action?: React.ReactNode;
  children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden ${className}`}>
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <div className="font-bold text-slate-900">{title}</div>
          {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   TREND TABLE (daily breakdown)
════════════════════════════════════════════════════════════════ */
function TrendTable({ points, loading }: {
  points: { period: string; revenue: number; expenses: number }[];
  loading: boolean;
}) {
  if (loading) return <Spin h={120} />;
  if (!points.length) return <div className="py-10 text-center text-sm text-slate-400">No data</div>;
  return (
    <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
      <div className="grid gap-4 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 bg-slate-50"
        style={{ gridTemplateColumns: "1.2fr 1fr 1fr 0.9fr" }}>
        <div>Period</div><div className="text-right">Revenue</div>
        <div className="text-right">Expenses</div><div className="text-right">Net</div>
      </div>
      {[...points].reverse().map((p, i) => {
        const net = p.revenue - p.expenses;
        return (
          <div key={i} className="grid items-center gap-4 px-5 py-3 hover:bg-slate-50 transition-colors"
            style={{ gridTemplateColumns: "1.2fr 1fr 1fr 0.9fr" }}>
            <div className="text-sm font-medium text-slate-700">{p.period}</div>
            <div className="text-right text-sm font-bold text-slate-900">{fmtMoney(p.revenue)}</div>
            <div className="text-right text-sm text-slate-500">{fmtMoney(p.expenses)}</div>
            <div className={`text-right text-sm font-bold ${net >= 0 ? "text-green-600" : "text-red-500"}`}>
              {fmtMoney(net)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const [orgId, setOrgId]   = useState<string | null>(null);
  const [preset, setPreset] = useState<RangePreset>("7d");
  const [section, setSection] = useState<NavSection>("overview");
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");

  const [pnl, setPnl]             = useState<Awaited<ReturnType<typeof reportPnL>> | null>(null);
  const [expData, setExpData]     = useState<Awaited<ReturnType<typeof reportExpenses>> | null>(null);
  const [inventory, setInventory] = useState<Awaited<ReturnType<typeof getInventoryValuation>> | null>(null);
  const [recentSales, setRecentSales]       = useState<RecentSale[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<RecentExpense[]>([]);

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

  const loadAll = useCallback(async () => {
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
          .eq("org_id", orgId).order("created_at", { ascending: false }).limit(12),
        supabase.from("expenses").select("id,category,amount,expense_date,created_at")
          .eq("org_id", orgId).order("created_at", { ascending: false }).limit(12),
      ]);
      if (sErr) throw new Error(sErr.message);
      if (eErr) throw new Error(eErr.message);
      setPnl(pl); setInventory(inv); setExpData(ex);
      setRecentSales((sData ?? []) as any);
      setRecentExpenses((eData ?? []) as any);
    } catch (e: any) { setErr(e.message ?? String(e)); }
    finally { setLoading(false); }
  }, [orgId, range.from, range.to]);

  useEffect(() => { if (orgId) loadAll(); }, [orgId, range.from, range.to]);

  /* ── Derived ── */
  const kpis = useMemo(() => ({
    revenue:   Number(pnl?.totals?.revenue    ?? 0),
    discounts: Number(pnl?.totals?.discounts  ?? 0),
    expenses:  Number(pnl?.totals?.expenses   ?? 0),
    cogs:      Number(pnl?.totals?.cogs       ?? 0),
    net:       Number(pnl?.totals?.net_profit ?? 0),
    invValue:  Number(inventory?.totals?.total_value ?? 0),
    lowCount:  Number(inventory?.totals?.low_count   ?? 0),
    outCount:  Number(inventory?.totals?.out_count   ?? 0),
    gross:     Number(pnl?.totals?.gross_profit ?? 0),
  }), [pnl, inventory]);

  const pnlTotals = useMemo(() => ({
    revenue: kpis.revenue, cogs: kpis.cogs,
    discounts: kpis.discounts, expenses: kpis.expenses, net_profit: kpis.net,
  }), [kpis]);

  const areaPoints = useMemo(() => {
    const rM = new Map((pnl?.points ?? []).map((p: any) => [p.period, Number(p.revenue ?? 0)]));
    const eM = new Map((expData?.trend ?? []).map((t: any) => [t.period, Number(t.total ?? 0)]));
    return Array.from(new Set([...rM.keys(), ...eM.keys()])).sort()
      .map(period => ({ period, revenue: rM.get(period) ?? 0, expenses: eM.get(period) ?? 0 }));
  }, [pnl, expData]);

  const revSpark = useMemo(() => (pnl?.points ?? []).slice(-10).map((p: any) => Number(p.revenue ?? 0)), [pnl]);
  const expSpark = useMemo(() => (expData?.trend ?? []).slice(-10).map((t: any) => Number(t.total ?? 0)), [expData]);

  const expCatSegs = useMemo(() => {
    const cats = (expData?.top_categories ?? []) as { category: string; amount: number }[];
    return cats.slice(0, 8).map((c, i) => ({ label: c.category, value: Number(c.amount), color: CAT_PALETTE[i % CAT_PALETTE.length] }));
  }, [expData]);

  const expCatBars = useMemo(() => {
    const cats = (expData?.top_categories ?? []) as { category: string; amount: number }[];
    return cats.slice(0, 8).map(c => ({ label: c.category, value: Number(c.amount) }));
  }, [expData]);

  const invSegs = useMemo(() => {
    const rows = inventory?.rows ?? [];
    const c = { ok: 0, low: 0, critical: 0, out: 0 };
    for (const r of rows) (c as any)[r.status]++;
    return [
      { label: "OK",       value: c.ok,       color: "#22c55e" },
      { label: "Low",      value: c.low,       color: "#f59e0b" },
      { label: "Critical", value: c.critical,  color: "#f97316" },
      { label: "Out",      value: c.out,       color: "#ef4444" },
    ].filter(s => s.value > 0);
  }, [inventory]);

  const lowStockRows = useMemo(() => {
    const rank = (r: InventoryValuationRow) => r.status === "out" ? 0 : r.status === "critical" ? 1 : 2;
    return (inventory?.rows ?? []).filter(r => r.status !== "ok")
      .sort((a, b) => rank(a) - rank(b)).slice(0, 8);
  }, [inventory]);

  const topByValue = useMemo(() =>
    [...(inventory?.rows ?? [])].sort((a, b) => b.total_value - a.total_value).slice(0, 8)
      .map(r => ({ label: r.name, value: r.total_value }))
  , [inventory]);

  const totalAlerts = kpis.lowCount + kpis.outCount;

  /* ── Loading gate ── */
  if (!orgId && !err) return (
    <div className="flex h-64 items-center justify-center">
      <div className="flex items-center gap-3 text-slate-400">
        <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" strokeOpacity="0.2" /><path d="M12 2a10 10 0 0110 10" />
        </svg>
        <span className="text-sm font-medium">Starting up…</span>
      </div>
    </div>
  );

  /* ════════════════════════════════ RENDER ══════════════════════ */
  return (
    <div className="flex flex-col gap-5">

      {/* Error banner */}
      {err && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>⚠️</span><span className="flex-1 font-medium">{err}</span>
          <button onClick={() => setErr("")} className="text-red-400 hover:text-red-600 text-base leading-none">×</button>
        </div>
      )}

      {/* ── Top bar ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="mt-0.5 text-sm text-slate-500">{range.label} · Pollinators Apitherapy</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Range picker */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1 gap-0.5">
            {(["today","7d","30d","month"] as RangePreset[]).map(p => (
              <button key={p} onClick={() => setPreset(p)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  preset === p ? "bg-white border border-slate-200 shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"
                }`}>
                {p === "today" ? "Today" : p === "7d" ? "7D" : p === "30d" ? "30D" : "Month"}
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* ── Quick actions ────────────────────────────────────── */}
      <QuickActions />

      {/* ── Section navigator ────────────────────────────────── */}
      <SectionNav active={section} onChange={setSection} />

      {/* ══════════════════════════ OVERVIEW ═══════════════════ */}
      {section === "overview" && (<>
        {/* KPI rows */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="Revenue"     value={fmtMoney(kpis.revenue)}   rawValue={kpis.revenue}   icon="📈" loading={loading} spark={revSpark} sparkColor="#f59e0b" />
          <KpiCard label="Net Profit"  value={fmtMoney(kpis.net)}       rawValue={kpis.net}        icon="💰"
            variant={kpis.net < 0 ? "danger" : "success"} loading={loading}
            sub={kpis.net < 0 ? "Loss this period" : "Profit this period"} spark={revSpark} />
          <KpiCard label="Expenses"    value={fmtMoney(kpis.expenses)}  rawValue={kpis.expenses}  icon="💸" variant="warning" loading={loading} spark={expSpark} sparkColor="#f97316" />
          <KpiCard label="Discounts"   value={fmtMoney(kpis.discounts)} rawValue={kpis.discounts} icon="🏷️" loading={loading} />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="col-span-2">
            <KpiCard label="Inventory Value" value={fmtMoney(kpis.invValue)} rawValue={kpis.invValue} icon="📦" sub="Unit price × qty on hand" loading={loading} />
          </div>
          <CountCard label="Low / Critical" value={kpis.lowCount} icon="📉" variant="warning" loading={loading} />
          <CountCard label="Out of Stock"   value={kpis.outCount} icon="🚫" variant={kpis.outCount > 0 ? "danger" : "neutral"} loading={loading} />
        </div>

        {/* Area + Waterfall */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_400px]">
          <Card title="Revenue vs Expenses" sub={`${range.label} · hover for details`}
            action={
              <div className="flex items-center gap-3 text-xs font-semibold">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" />Revenue</span>
                <span className="flex items-center gap-1.5"><span className="inline-block w-5 border-t-2 border-dashed border-red-400" />Expenses</span>
              </div>
            }>
            <div className="px-4 py-4">
              <AreaChart points={areaPoints} loading={loading} height={200} />
            </div>
            {!loading && areaPoints.length > 0 && (
              <div className="border-t border-slate-100 px-5 py-3 grid grid-cols-3 gap-3 text-xs">
                <div><span className="text-slate-500">Revenue</span> <span className="ml-1 font-bold text-slate-900">{fmtMoney(kpis.revenue)}</span></div>
                <div><span className="text-slate-500">Expenses</span> <span className="ml-1 font-bold text-slate-900">{fmtMoney(kpis.expenses)}</span></div>
                <div><span className="text-slate-500">Net</span> <span className={`ml-1 font-bold ${kpis.net >= 0 ? "text-green-600" : "text-red-600"}`}>{fmtMoney(kpis.net)}</span></div>
              </div>
            )}
          </Card>

          <Card title="P&L Breakdown" sub="Hover bars to inspect"
            action={<Link href="/dashboard/reports/expenses-pnl" className="text-xs font-semibold text-amber-600 hover:text-amber-700">Full report →</Link>}>
            <div className="px-4 py-4"><Waterfall totals={pnlTotals} loading={loading} /></div>
            {!loading && (
              <div className="border-t border-slate-100 px-5 py-3 flex justify-between items-center">
                <span className="text-xs text-slate-500">Net Profit</span>
                <span className={`text-sm font-bold ${kpis.net >= 0 ? "text-green-600" : "text-red-600"}`}>{fmtMoney(kpis.net)}</span>
              </div>
            )}
          </Card>
        </div>

        {/* Pie row */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Card title="Expense Breakdown" sub="By category · hover to highlight"
            action={<button onClick={() => setSection("expenses")} className="text-xs font-semibold text-amber-600 hover:text-amber-700">Details →</button>}>
            <div className="px-4 py-4">
              {loading ? <Spin h={200} /> : <PieChart segments={expCatSegs} centerLabel="Total" centerValue={fmtK(kpis.expenses)} size={200} />}
            </div>
          </Card>

          <Card title="Inventory Health"
            sub="Stock status · hover segments"
            action={
              <div className="flex items-center gap-2">
                {totalAlerts > 0 && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">{totalAlerts} alert{totalAlerts !== 1 ? "s" : ""}</span>}
                <button onClick={() => setSection("inventory")} className="text-xs font-semibold text-amber-600 hover:text-amber-700">Details →</button>
              </div>
            }>
            <div className="px-4 py-4">
              {loading ? <Spin h={200} /> : <PieChart segments={invSegs} centerLabel="Products" centerValue={String(inventory?.rows?.length ?? 0)} size={200} />}
            </div>
          </Card>
        </div>
      </>)}

      {/* ══════════════════════════ REVENUE ════════════════════ */}
      {section === "revenue" && (<>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="Revenue"      value={fmtMoney(kpis.revenue)} rawValue={kpis.revenue} icon="📈" loading={loading} spark={revSpark} sparkColor="#f59e0b" />
          <KpiCard label="COGS"         value={fmtMoney(kpis.cogs)}    rawValue={kpis.cogs}    icon="🏭" variant="warning" loading={loading} />
          <KpiCard label="Gross Profit" value={fmtMoney(kpis.gross)}   rawValue={kpis.gross}   icon="📊"
            variant={kpis.gross >= 0 ? "success" : "danger"} loading={loading} />
          <KpiCard label="Net Profit"   value={fmtMoney(kpis.net)}     rawValue={kpis.net}     icon="💰"
            variant={kpis.net < 0 ? "danger" : "success"} loading={loading} />
        </div>

        <Card title="Revenue vs Expenses — Daily" sub={`${range.label} · hover data points for tooltip`}
          action={
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400"/>Revenue</span>
              <span className="flex items-center gap-1.5"><span className="inline-block w-5 border-t-2 border-dashed border-red-400"/>Expenses</span>
            </div>
          }>
          <div className="px-4 py-5"><AreaChart points={areaPoints} loading={loading} height={240} /></div>
        </Card>

        <Card title="P&L Waterfall" sub="Revenue → deductions → net · hover bars">
          <div className="px-4 py-5"><Waterfall totals={pnlTotals} loading={loading} /></div>
        </Card>

        <Card title="Daily Breakdown" sub={`${areaPoints.length} periods · most recent first`}>
          <TrendTable points={areaPoints} loading={loading} />
        </Card>
      </>)}

      {/* ══════════════════════════ EXPENSES ═══════════════════ */}
      {section === "expenses" && (<>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <KpiCard label="Total Expenses"  value={fmtMoney(kpis.expenses)}  rawValue={kpis.expenses}  icon="💸" variant="warning" loading={loading} spark={expSpark} sparkColor="#f97316" />
          <KpiCard label="Discounts Given" value={fmtMoney(kpis.discounts)} rawValue={kpis.discounts} icon="🏷️" loading={loading} />
          <KpiCard label="COGS"            value={fmtMoney(kpis.cogs)}      rawValue={kpis.cogs}      icon="🏭" variant="warning" loading={loading} />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card title="Category Split" sub="Hover segments to highlight">
            <div className="px-4 py-4">
              {loading ? <Spin h={210} /> : <PieChart segments={expCatSegs} centerLabel="Total" centerValue={fmtK(kpis.expenses)} size={210} />}
            </div>
            {!loading && expCatSegs.length > 0 && (
              <div className="border-t border-slate-100 px-5 py-3 flex justify-between">
                <span className="text-xs text-slate-500">{expCatSegs.length} categories</span>
                <Link href="/dashboard/reports/expenses-pnl" className="text-xs font-semibold text-amber-600 hover:text-amber-700">Full P&L →</Link>
              </div>
            )}
          </Card>

          <Card title="Top Categories" sub="Hover rows for highlight">
            <div className="px-5 py-5">
              <HBar data={expCatBars} color="#f59e0b" loading={loading} />
            </div>
          </Card>
        </div>

        <Card title="Expense vs Revenue Trend" sub={`${range.label} · daily · hover for tooltip`}
          action={<Link href="/dashboard/expenses" className="text-xs font-semibold text-amber-600 hover:text-amber-700">Manage →</Link>}>
          <div className="px-4 py-5"><AreaChart points={areaPoints} loading={loading} height={190} /></div>
        </Card>

        {/* Recent expenses table */}
        <Card title="Recent Expenses" sub="Latest entries"
          action={<Link href="/dashboard/expenses" className="text-xs font-semibold text-amber-600 hover:text-amber-700">All expenses →</Link>}>
          <div className="hidden sm:grid gap-4 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 bg-slate-50 border-b border-slate-200"
            style={{ gridTemplateColumns: "1.5fr 1fr 1fr" }}>
            <div>Category</div><div>Date</div><div className="text-right">Amount</div>
          </div>
          <div className="divide-y divide-slate-100">
            {loading ? <Spin h={100} />
            : recentExpenses.length === 0
              ? <div className="py-10 text-center text-sm text-slate-400">No recent expenses.</div>
              : recentExpenses.map(e => (
                <div key={e.id} className="grid items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors"
                  style={{ gridTemplateColumns: "1.5fr 1fr 1fr" }}>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full shrink-0"
                      style={{ background: CAT_PALETTE[Math.abs(e.category.charCodeAt(0)) % CAT_PALETTE.length] }} />
                    <span className="text-sm font-semibold text-slate-900 truncate">{e.category}</span>
                  </div>
                  <div className="text-sm text-slate-500">{e.expense_date}</div>
                  <div className="text-right text-sm font-bold text-slate-900">{fmtMoney(Number(e.amount ?? 0))}</div>
                </div>
              ))
            }
          </div>
        </Card>
      </>)}

      {/* ═══════════════════════ INVENTORY ═════════════════════ */}
      {section === "inventory" && (<>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <CountCard label="Total Products" value={inventory?.rows?.length ?? 0} icon="📦" loading={loading} />
          <KpiCard label="Inventory Value" value={fmtMoney(kpis.invValue)} rawValue={kpis.invValue} icon="💰" loading={loading} />
          <CountCard label="Low / Critical" value={kpis.lowCount} icon="📉" variant="warning" loading={loading} />
          <CountCard label="Out of Stock"   value={kpis.outCount} icon="🚫" variant={kpis.outCount > 0 ? "danger" : "neutral"} loading={loading} />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card title="Stock Health" sub="Hover segments · product count by status">
            <div className="px-4 py-4">
              {loading ? <Spin h={210} /> : <PieChart segments={invSegs} centerLabel="Products" centerValue={String(inventory?.rows?.length ?? 0)} size={210} />}
            </div>
          </Card>

          <Card title="Top Products by Value" sub="Inventory worth (qty × price) · hover rows">
            <div className="px-5 py-5">
              <HBar data={topByValue} color="#3b82f6" loading={loading} />
            </div>
          </Card>
        </div>

        <Card title="Needs Attention"
          sub="Low, critical & out-of-stock products"
          action={
            <div className="flex items-center gap-2">
              {totalAlerts > 0 && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">{totalAlerts}</span>}
              <Link href="/dashboard/inventory" className="text-xs font-semibold text-amber-600 hover:text-amber-700">Manage all →</Link>
            </div>
          }>
          {loading ? <Spin h={100} />
          : lowStockRows.length === 0
            ? <div className="py-12 text-center"><div className="text-3xl mb-2">✅</div><p className="text-sm font-semibold text-slate-600">All stocked up</p></div>
            : (
              <>
                <div className="hidden sm:grid gap-4 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 bg-slate-50 border-b border-slate-200"
                  style={{ gridTemplateColumns: "1fr 1fr 0.7fr 0.8fr 1fr" }}>
                  <div>Product</div><div>Category</div><div>Status</div><div className="text-right">On Hand</div><div className="text-right">Reorder At</div>
                </div>
                <div className="divide-y divide-slate-100">
                  {lowStockRows.map(r => {
                    const badge = stockBadge(r.status);
                    return (
                      <div key={r.product_id} className="grid items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors"
                        style={{ gridTemplateColumns: "1fr 1fr 0.7fr 0.8fr 1fr" }}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: badge.dot }} />
                          <span className="text-sm font-semibold text-slate-900 truncate">{r.name}</span>
                        </div>
                        <div className="text-sm text-slate-500 truncate">{r.category ?? "—"}</div>
                        <div><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${badge.cls}`}>{badge.label}</span></div>
                        <div className="text-right text-sm font-bold text-slate-900">{r.qty_on_hand}</div>
                        <div className="text-right text-sm text-slate-500">{r.reorder_level}</div>
                      </div>
                    );
                  })}
                </div>
              </>
            )
          }
        </Card>
      </>)}

      {/* ══════════════════════════ ACTIVITY ═══════════════════ */}
      {section === "activity" && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

          <Card title="Recent Sales" sub={`Latest ${recentSales.length} transactions`}
            action={<Link href="/dashboard/sales" className="text-xs font-semibold text-amber-600 hover:text-amber-700">All sales →</Link>}>
            <div className="hidden sm:grid gap-3 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 bg-slate-50 border-b border-slate-200"
              style={{ gridTemplateColumns: "1fr 1.4fr 1fr 1fr" }}>
              <div>Sale #</div><div>Customer</div><div>Date</div><div className="text-right">Total</div>
            </div>
            <div className="divide-y divide-slate-100">
              {loading ? <Spin h={120} />
              : recentSales.length === 0
                ? <div className="py-12 text-center text-sm text-slate-400">No recent sales.</div>
                : recentSales.map(s => (
                  <Link key={s.id} href={`/dashboard/sales/${s.id}`}
                    className="grid items-center gap-3 px-5 py-3.5 hover:bg-amber-50 transition-colors group"
                    style={{ gridTemplateColumns: "1fr 1.4fr 1fr 1fr" }}>
                    <div className="text-sm font-bold text-slate-900 group-hover:text-amber-700 transition-colors">{s.sale_no}</div>
                    <div className="text-sm text-slate-600 truncate">{s.customer_name ?? <span className="italic text-slate-400">Walk-in</span>}</div>
                    <div className="text-xs text-slate-400">{fmtTime(s.created_at)}</div>
                    <div className="text-right text-sm font-bold text-slate-900">{fmtMoney(Number(s.total ?? 0))}</div>
                  </Link>
                ))
              }
            </div>
            {recentSales.length > 0 && !loading && (
              <div className="border-t border-slate-100 px-5 py-3 flex justify-between items-center">
                <span className="text-xs text-slate-400">{recentSales.length} shown</span>
                <span className="text-xs font-bold text-slate-900">{fmtMoney(recentSales.reduce((s, r) => s + Number(r.total ?? 0), 0))}</span>
              </div>
            )}
          </Card>

          <Card title="Recent Expenses" sub={`Latest ${recentExpenses.length} entries`}
            action={<Link href="/dashboard/expenses" className="text-xs font-semibold text-amber-600 hover:text-amber-700">All expenses →</Link>}>
            <div className="hidden sm:grid gap-3 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 bg-slate-50 border-b border-slate-200"
              style={{ gridTemplateColumns: "1.5fr 1fr 1fr" }}>
              <div>Category</div><div>Date</div><div className="text-right">Amount</div>
            </div>
            <div className="divide-y divide-slate-100">
              {loading ? <Spin h={120} />
              : recentExpenses.length === 0
                ? <div className="py-12 text-center text-sm text-slate-400">No recent expenses.</div>
                : recentExpenses.map(e => (
                  <div key={e.id} className="grid items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors"
                    style={{ gridTemplateColumns: "1.5fr 1fr 1fr" }}>
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ background: CAT_PALETTE[Math.abs(e.category.charCodeAt(0)) % CAT_PALETTE.length] }} />
                      <span className="text-sm font-semibold text-slate-900 truncate">{e.category}</span>
                    </div>
                    <div className="text-xs text-slate-400">{e.expense_date}</div>
                    <div className="text-right text-sm font-bold text-slate-900">{fmtMoney(Number(e.amount ?? 0))}</div>
                  </div>
                ))
              }
            </div>
            {recentExpenses.length > 0 && !loading && (
              <div className="border-t border-slate-100 px-5 py-3 flex justify-between items-center">
                <span className="text-xs text-slate-400">{recentExpenses.length} shown</span>
                <span className="text-xs font-bold text-slate-900">{fmtMoney(recentExpenses.reduce((s, r) => s + Number(r.amount ?? 0), 0))}</span>
              </div>
            )}
          </Card>
        </div>
      )}

    </div>
  );
}