"use client";

import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from "react";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import { reportExpenses, reportPnL, type Granularity, type DateRange } from "@/lib/api/reports";
import * as S from "../page.styles";

/* ════════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════════ */
const fmtMoney   = (v: number) => `Ksh ${Number(v || 0).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
const fmtK       = (v: number) => v >= 1_000_000 ? `${(v/1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v/1_000).toFixed(0)}k` : String(Math.round(v));
const iso        = (d: Date)   =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fmtDate    = (ymd: string) => { try { const [y,m,d] = ymd.split("-").map(Number); return new Date(y,m-1,d).toLocaleDateString("en-KE",{day:"numeric",month:"short"}); } catch { return ymd; } };

function defaultRange(): DateRange {
  const to = new Date(), from = new Date();
  from.setDate(to.getDate() - 29);
  return { from: iso(from), to: iso(to) };
}

function downloadCSV(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
  const csv = [headers.join(","), ...rows.map(r => headers.map(h => esc(r[h])).join(","))].join("\n");
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" })),
    download: filename,
  });
  a.click(); URL.revokeObjectURL(a.href);
}

const CAT_PALETTE = ["#f59e0b","#3b82f6","#8b5cf6","#10b981","#ef4444","#06b6d4","#f97316","#ec4899","#84cc16","#a78bfa"];

/* ════════════════════════════════════════════════════════════════
   TYPES
════════════════════════════════════════════════════════════════ */
type TrendRow  = { period: string; total: number };
type TopCatRow = { category: string; amount: number };
type PnlRow    = {
  period: string;
  revenue: number;
  product_revenue: number;
  service_income: number;
  discounts: number;
  cogs: number;
  gross_profit: number;
  expenses: number;
  net_profit: number;
};
type NavTab    = "overview" | "expenses" | "pnl" | "revenue";

const TABLE_ROW = "grid items-center gap-3 px-5 py-3";
const TABLE_FOOT = "grid items-center gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3";
const TABLE_HEAD = `${S.tableHead} border-b border-slate-100 bg-slate-50 px-5 py-3`;

function revenueComparison(sales: number, services: number) {
  const total = sales + services;
  const salesShare = total > 0 ? (sales / total) * 100 : 0;
  const servicesShare = total > 0 ? (services / total) * 100 : 0;

  if (total === 0) {
    return { total, salesShare, servicesShare, winner: null as "sales" | "services" | null, leadPct: 0, leadLabel: "No revenue yet" };
  }
  if (sales === services) {
    return { total, salesShare, servicesShare, winner: null as "sales" | "services" | null, leadPct: 0, leadLabel: "Sales and services are equal" };
  }
  if (sales > services) {
    const leadPct = services > 0 ? ((sales - services) / services) * 100 : 100;
    return { total, salesShare, servicesShare, winner: "sales" as const, leadPct, leadLabel: `Product sales lead by ${leadPct.toFixed(1)}%` };
  }
  const leadPct = sales > 0 ? ((services - sales) / sales) * 100 : 100;
  return { total, salesShare, servicesShare, winner: "services" as const, leadPct, leadLabel: `Services lead by ${leadPct.toFixed(1)}%` };
}

/* ════════════════════════════════════════════════════════════════
   SPINNER
════════════════════════════════════════════════════════════════ */
function Spinner({ h = 120 }: { h?: number }) {
  return (
    <div className="flex items-center justify-center text-sm text-slate-400" style={{ height: h }}>
      Loading...
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   DATE RANGE CONTROL
════════════════════════════════════════════════════════════════ */
function DateRangeControl({
  from,
  to,
  onFromChange,
  onToChange,
}: {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
}) {
  return (
    <div className="flex w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm sm:w-auto sm:flex-row">
      <label className="flex flex-1 flex-col gap-1 px-3 py-2 sm:min-w-[145px]">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">From</span>
        <input
          type="date"
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
          className="w-full bg-transparent text-sm font-semibold text-slate-700 outline-none"
        />
      </label>
      <div className="hidden w-px bg-slate-200 sm:block" />
      <label className="flex flex-1 flex-col gap-1 border-t border-slate-200 px-3 py-2 sm:min-w-[145px] sm:border-t-0">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">To</span>
        <input
          type="date"
          value={to}
          onChange={(e) => onToChange(e.target.value)}
          className="w-full bg-transparent text-sm font-semibold text-slate-700 outline-none"
        />
      </label>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   SVG AREA CHART — Expense trend over time
════════════════════════════════════════════════════════════════ */
function ExpenseTrendChart({ trend, height = 220 }: { trend: TrendRow[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const W = 600, H = height, P = { t: 16, r: 16, b: 34, l: 60 };
  const iW = W - P.l - P.r, iH = H - P.t - P.b;

  const maxV = useMemo(() => Math.max(...trend.map(d => d.total), 1), [trend]);
  const xs   = useCallback((i: number) => P.l + (trend.length < 2 ? iW/2 : (i/(trend.length-1))*iW), [trend.length, iW]);
  const ys   = useCallback((v: number) => P.t + iH - (v/maxV)*iH*0.92, [maxV, iH]);

  const pathStr = trend.map((d,i) => `${i===0?"M":"L"}${xs(i).toFixed(1)},${ys(Number(d.total)).toFixed(1)}`).join(" ");
  const areaStr = trend.length
    ? `${pathStr} L${xs(trend.length-1).toFixed(1)},${(P.t+iH).toFixed(1)} L${xs(0).toFixed(1)},${(P.t+iH).toFixed(1)} Z`
    : "";

  const onMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || trend.length < 2) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0, bd = Infinity;
    trend.forEach((_,i) => { const d = Math.abs(xs(i)-mx); if (d < bd) { bd=d; best=i; } });
    setHover(best);
  }, [trend, xs]);

  const grids = [0, 0.25, 0.5, 0.75, 1].map(f => maxV * f);
  const xLabels = useMemo(() => {
    if (!trend.length) return [];
    const step = Math.max(1, Math.floor(trend.length / 7));
    return trend.map((d,i) => ({d,i})).filter(({i}) => i % step === 0 || i === trend.length-1);
  }, [trend]);

  if (!trend.length) return <div className="flex items-center justify-center text-sm text-slate-400" style={{height}}>No data for this period</div>;
  const hp = hover !== null ? trend[hover] : null;

  return (
    <div className="relative select-none">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full cursor-crosshair" style={{height}}
        onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="ep-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.2"/>
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.02"/>
          </linearGradient>
          <filter id="ep-glow"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>

        {grids.map((v,i) => (
          <g key={i}>
            <line x1={P.l} y1={ys(v)} x2={W-P.r} y2={ys(v)} stroke="#f1f5f9" strokeWidth="1"/>
            <text x={P.l-8} y={ys(v)+4} textAnchor="end" fontSize="9.5" fill="#94a3b8">{fmtK(v)}</text>
          </g>
        ))}

        {hover !== null && (
          <line x1={xs(hover)} y1={P.t} x2={xs(hover)} y2={P.t+iH} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 3"/>
        )}

        <path d={areaStr} fill="url(#ep-area)"/>
        <path d={pathStr} fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinejoin="round" filter="url(#ep-glow)"/>

        {trend.map((_,i) => (
          <circle key={i} cx={xs(i)} cy={ys(trend[i].total)}
            fill={hover===i?"#fff":"#ef4444"} stroke="#ef4444" strokeWidth={hover===i?2:0}
            r={hover===i?5:2.5} style={{transition:"r 0.1s"}}/>
        ))}

        {xLabels.map(({d,i}) => (
          <text key={i} x={xs(i)} y={H-6} textAnchor="middle" fontSize="9.5"
            fill={hover===i?"#475569":"#94a3b8"} fontWeight={hover===i?"600":"400"}>
            {fmtDate(d.period)}
          </text>
        ))}
      </svg>

      {hover !== null && hp && (
        <div className="pointer-events-none absolute top-2 left-14 z-10 rounded-xl border border-slate-200 bg-white/96 backdrop-blur-sm p-3 shadow-xl text-xs w-44">
          <div className="font-bold text-slate-800 mb-2 pb-1.5 border-b border-slate-100">{fmtDate(hp.period)}</div>
          <div className="flex justify-between">
            <span className="flex items-center gap-1.5 text-slate-500"><span className="h-2 w-2 rounded-full bg-red-400"/>Expenses</span>
            <span className="font-bold text-slate-900">{fmtMoney(Number(hp.total))}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   SVG DONUT — Category breakdown
════════════════════════════════════════════════════════════════ */
function CategoryDonut({ cats, total }: { cats: TopCatRow[]; total: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const cx = 100, cy = 100, r = 72, ri = 46;
  let angle = -90;
  const slices = cats.slice(0,8).map((c, i) => {
    const pct  = total > 0 ? (c.amount / total) * 100 : 0;
    const deg  = (pct / 100) * 360;
    const a1   = (angle * Math.PI) / 180;
    const a2   = ((angle + deg) * Math.PI) / 180;
    const lx1  = cx + r * Math.cos(a1), ly1 = cy + r * Math.sin(a1);
    const lx2  = cx + r * Math.cos(a2), ly2 = cy + r * Math.sin(a2);
    const sx1  = cx + ri * Math.cos(a1), sy1 = cy + ri * Math.sin(a1);
    const sx2  = cx + ri * Math.cos(a2), sy2 = cy + ri * Math.sin(a2);
    const large = deg > 180 ? 1 : 0;
    const path = `M${lx1.toFixed(2)},${ly1.toFixed(2)} A${r},${r} 0 ${large},1 ${lx2.toFixed(2)},${ly2.toFixed(2)} L${sx2.toFixed(2)},${sy2.toFixed(2)} A${ri},${ri} 0 ${large},0 ${sx1.toFixed(2)},${sy1.toFixed(2)} Z`;
    angle += deg;
    return { path, pct, color: CAT_PALETTE[i % CAT_PALETTE.length], ...c };
  });

  const hov = hover !== null ? slices[hover] : null;
  return (
    <svg viewBox="0 0 200 200" className="w-full max-w-[200px] mx-auto" style={{height:200}}>
      {slices.map((s, i) => (
        <path key={i} d={s.path} fill={s.color}
          opacity={hover === null || hover === i ? (hover === i ? 1 : 0.85) : 0.3}
          style={{transition:"opacity 0.15s, transform 0.15s", transformOrigin:`${cx}px ${cy}px`, transform: hover===i ? "scale(1.04)" : "scale(1)", cursor:"pointer"}}
          onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
        />
      ))}
      {hov ? (
        <>
          <text x={cx} y={cy-6} textAnchor="middle" fontSize="8" fill="#64748b" fontWeight="600">{hov.category}</text>
          <text x={cx} y={cy+8} textAnchor="middle" fontSize="10" fill="#0f172a" fontWeight="700">{hov.pct.toFixed(1)}%</text>
        </>
      ) : (
        <text x={cx} y={cy+5} textAnchor="middle" fontSize="9" fill="#94a3b8">Breakdown</text>
      )}
    </svg>
  );
}

/* ════════════════════════════════════════════════════════════════
   SVG P&L WATERFALL
════════════════════════════════════════════════════════════════ */
function PnLWaterfall({ totals }: { totals: { revenue: number; discounts: number; cogs: number; gross_profit: number; expenses: number; net_profit: number } }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 560, H = 220, P = { t: 20, r: 16, b: 44, l: 64 };
  const iW = W - P.l - P.r, iH = H - P.t - P.b;

  const bars = [
    { label: "Revenue",     value: totals.revenue,     type: "pos",      running: totals.revenue },
    { label: "Discounts",   value: -totals.discounts,  type: "neg",      running: totals.revenue - totals.discounts },
    { label: "COGS",        value: -totals.cogs,       type: "neg",      running: totals.revenue - totals.discounts - totals.cogs },
    { label: "Gross Profit",value: totals.gross_profit,type: "subtotal", running: totals.gross_profit },
    { label: "Expenses",    value: -totals.expenses,   type: "neg",      running: totals.gross_profit - totals.expenses },
    { label: "Net Profit",  value: totals.net_profit,  type: totals.net_profit >= 0 ? "final-pos" : "final-neg", running: totals.net_profit },
  ];

  const allVals = bars.map(b => b.running);
  const maxV = Math.max(...allVals, 1);
  const ys = (v: number) => P.t + iH - Math.max(0, (v / maxV) * iH * 0.9);
  const bW  = (iW / bars.length) * 0.6;
  const gap = (iW / bars.length);

  const grids = [0, 0.25, 0.5, 0.75, 1].map(f => maxV * f);
  const colorMap: Record<string, string> = { pos: "#10b981", neg: "#ef4444", subtotal: "#3b82f6", "final-pos": "#10b981", "final-neg": "#ef4444" };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{height: H}}>
      {grids.map((v,i) => (
        <g key={i}>
          <line x1={P.l} y1={ys(v)} x2={W-P.r} y2={ys(v)} stroke="#f1f5f9" strokeWidth="1"/>
          <text x={P.l-6} y={ys(v)+4} textAnchor="end" fontSize="9" fill="#94a3b8">{fmtK(v)}</text>
        </g>
      ))}
      {bars.map((b, i) => {
        const x = P.l + i * gap + (gap - bW) / 2;
        const h = Math.max(3, (Math.abs(b.value) / maxV) * iH * 0.9);
        const y = b.type === "neg" ? ys(b.running + Math.abs(b.value)) : ys(b.running);
        const color = colorMap[b.type];
        const isH = hover === i;
        return (
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} style={{cursor:"default"}}>
            <rect x={x} y={y} width={bW} height={h} rx="4" fill={color}
              opacity={hover === null || isH ? (isH ? 1 : 0.8) : 0.35}
              style={{transition:"opacity 0.15s"}}/>
            {i < bars.length - 1 && (
              <line x1={x+bW} y1={ys(b.running)} x2={x+gap} y2={ys(b.running)}
                stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 2"/>
            )}
            {isH && (
              <text x={x+bW/2} y={y-6} textAnchor="middle" fontSize="8.5" fill={color} fontWeight="700">{fmtK(Math.abs(b.value))}</text>
            )}
            <text x={x+bW/2} y={H-6} textAnchor="middle" fontSize="8.5"
              fill={isH ? "#475569" : "#94a3b8"} fontWeight={isH ? "700" : "400"}>{b.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ════════════════════════════════════════════════════════════════
   SVG P&L LINE CHART — Revenue vs Net Profit over periods
════════════════════════════════════════════════════════════════ */
function PnLLineChart({ rows, height = 200 }: { rows: PnlRow[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const W = 600, H = height, P = { t: 16, r: 16, b: 34, l: 60 };
  const iW = W - P.l - P.r, iH = H - P.t - P.b;

  const maxV = useMemo(() => Math.max(...rows.map(r => r.revenue), 1), [rows]);
  const minV = useMemo(() => Math.min(...rows.map(r => r.net_profit), 0), [rows]);
  const range = maxV - minV || 1;
  const xs = useCallback((i: number) => P.l + (rows.length < 2 ? iW/2 : (i/(rows.length-1))*iW), [rows.length, iW]);
  const ys = useCallback((v: number) => P.t + iH - ((v - minV)/range)*iH*0.9, [minV, range, iH]);

  const revPath = rows.map((r,i) => `${i===0?"M":"L"}${xs(i).toFixed(1)},${ys(r.revenue).toFixed(1)}`).join(" ");
  const netPath = rows.map((r,i) => `${i===0?"M":"L"}${xs(i).toFixed(1)},${ys(r.net_profit).toFixed(1)}`).join(" ");

  const onMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || rows.length < 2) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0, bd = Infinity;
    rows.forEach((_,i) => { const d = Math.abs(xs(i)-mx); if (d < bd) { bd=d; best=i; } });
    setHover(best);
  }, [rows, xs]);

  const xLabels = useMemo(() => {
    if (!rows.length) return [];
    const step = Math.max(1, Math.floor(rows.length / 7));
    return rows.map((r,i) => ({r,i})).filter(({i}) => i % step === 0 || i === rows.length-1);
  }, [rows]);

  const grids = [0, 0.25, 0.5, 0.75, 1].map(f => minV + range*f);

  if (!rows.length) return <div className="flex items-center justify-center text-sm text-slate-400" style={{height}}>No data</div>;
  const hp = hover !== null ? rows[hover] : null;

  return (
    <div className="relative select-none">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full cursor-crosshair" style={{height}}
        onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>
          <filter id="pl-glow"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>

        {grids.map((v,i) => (
          <g key={i}>
            <line x1={P.l} y1={ys(v)} x2={W-P.r} y2={ys(v)} stroke="#f1f5f9" strokeWidth="1"/>
            <text x={P.l-8} y={ys(v)+4} textAnchor="end" fontSize="9.5" fill="#94a3b8">{fmtK(v)}</text>
          </g>
        ))}

        {minV < 0 && (
          <line x1={P.l} y1={ys(0)} x2={W-P.r} y2={ys(0)} stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="4 3"/>
        )}

        {hover !== null && (
          <line x1={xs(hover)} y1={P.t} x2={xs(hover)} y2={P.t+iH} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 3"/>
        )}

        <path d={revPath} fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinejoin="round"/>
        <path d={netPath} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinejoin="round" filter="url(#pl-glow)"/>

        {rows.map((_,i) => (
          <React.Fragment key={i}>
            <circle cx={xs(i)} cy={ys(rows[i].revenue)} fill={hover===i?"#fff":"#f59e0b"} stroke="#f59e0b" strokeWidth={hover===i?2:0} r={hover===i?4.5:2}/>
            <circle cx={xs(i)} cy={ys(rows[i].net_profit)} fill={hover===i?"#fff":"#3b82f6"} stroke="#3b82f6" strokeWidth={hover===i?2:0} r={hover===i?4.5:2}/>
          </React.Fragment>
        ))}

        {xLabels.map(({r,i}) => (
          <text key={i} x={xs(i)} y={H-6} textAnchor="middle" fontSize="9.5"
            fill={hover===i?"#475569":"#94a3b8"} fontWeight={hover===i?"600":"400"}>
            {fmtDate(r.period)}
          </text>
        ))}
      </svg>

      {hover !== null && hp && (
        <div className="pointer-events-none absolute top-2 left-14 z-10 rounded-xl border border-slate-200 bg-white/96 backdrop-blur-sm p-3 shadow-xl text-xs w-48">
          <div className="font-bold text-slate-800 mb-2 pb-1.5 border-b border-slate-100">{fmtDate(hp.period)}</div>
          <div className="flex justify-between mb-1">
            <span className="flex items-center gap-1.5 text-slate-500"><span className="h-2 w-2 rounded-full bg-amber-400"/>Revenue</span>
            <span className="font-bold text-slate-900">{fmtMoney(hp.revenue)}</span>
          </div>
          <div className="flex justify-between mb-1">
            <span className="flex items-center gap-1.5 text-slate-500"><span className="h-2 w-2 rounded-full bg-green-400"/>Gross Profit</span>
            <span className="font-bold text-green-700">{fmtMoney(hp.gross_profit)}</span>
          </div>
          <div className="flex justify-between mb-1">
            <span className="flex items-center gap-1.5 text-slate-500"><span className="h-2 w-2 rounded-full bg-red-400"/>Expenses</span>
            <span className="font-bold text-red-600">{fmtMoney(hp.expenses)}</span>
          </div>
          <div className="flex justify-between pt-1.5 border-t border-slate-100">
            <span className="flex items-center gap-1.5 text-slate-500"><span className="h-2 w-2 rounded-full bg-blue-400"/>Net Profit</span>
            <span className={`font-bold ${hp.net_profit >= 0 ? "text-green-700" : "text-red-600"}`}>{fmtMoney(hp.net_profit)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   SVG REVENUE SPLIT CHART — Sales vs Services over time
════════════════════════════════════════════════════════════════ */
function RevenueSplitChart({ rows, height = 220 }: { rows: PnlRow[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const W = 600, H = height, P = { t: 16, r: 16, b: 34, l: 60 };
  const iW = W - P.l - P.r, iH = H - P.t - P.b;

  const maxV = useMemo(() => Math.max(...rows.map(r => r.product_revenue + r.service_income), 1), [rows]);
  const xs = useCallback((i: number) => P.l + (rows.length < 2 ? iW/2 : (i/(rows.length-1))*iW), [rows.length, iW]);
  const ys = useCallback((v: number) => P.t + iH - (v/maxV)*iH*0.92, [maxV, iH]);

  const salesPath = rows.map((r,i) => `${i===0?"M":"L"}${xs(i).toFixed(1)},${ys(r.product_revenue).toFixed(1)}`).join(" ");
  const svcPath   = rows.map((r,i) => `${i===0?"M":"L"}${xs(i).toFixed(1)},${ys(r.service_income).toFixed(1)}`).join(" ");

  const onMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || rows.length < 2) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0, bd = Infinity;
    rows.forEach((_,i) => { const d = Math.abs(xs(i)-mx); if (d < bd) { bd=d; best=i; } });
    setHover(best);
  }, [rows, xs]);

  const xLabels = useMemo(() => {
    if (!rows.length) return [];
    const step = Math.max(1, Math.floor(rows.length / 7));
    return rows.map((r,i) => ({r,i})).filter(({i}) => i % step === 0 || i === rows.length-1);
  }, [rows]);

  const grids = [0, 0.25, 0.5, 0.75, 1].map(f => maxV * f);

  if (!rows.length) return <div className="flex items-center justify-center text-sm text-slate-400" style={{height}}>No revenue data</div>;
  const hp = hover !== null ? rows[hover] : null;
  const hpTotal = hp ? hp.product_revenue + hp.service_income : 0;

  return (
    <div className="relative select-none">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full cursor-crosshair" style={{height}}
        onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {grids.map((v,i) => (
          <g key={i}>
            <line x1={P.l} y1={ys(v)} x2={W-P.r} y2={ys(v)} stroke="#f1f5f9" strokeWidth="1"/>
            <text x={P.l-8} y={ys(v)+4} textAnchor="end" fontSize="9.5" fill="#94a3b8">{fmtK(v)}</text>
          </g>
        ))}

        {hover !== null && (
          <line x1={xs(hover)} y1={P.t} x2={xs(hover)} y2={P.t+iH} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 3"/>
        )}

        <path d={salesPath} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinejoin="round"/>
        <path d={svcPath}   fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeLinejoin="round"/>

        {rows.map((_,i) => (
          <React.Fragment key={i}>
            <circle cx={xs(i)} cy={ys(rows[i].product_revenue)} fill={hover===i?"#fff":"#f59e0b"} stroke="#f59e0b" strokeWidth={hover===i?2:0} r={hover===i?5:2.5}/>
            <circle cx={xs(i)} cy={ys(rows[i].service_income)}   fill={hover===i?"#fff":"#8b5cf6"} stroke="#8b5cf6" strokeWidth={hover===i?2:0} r={hover===i?5:2.5}/>
          </React.Fragment>
        ))}

        {xLabels.map(({r,i}) => (
          <text key={i} x={xs(i)} y={H-6} textAnchor="middle" fontSize="9.5"
            fill={hover===i?"#475569":"#94a3b8"} fontWeight={hover===i?"600":"400"}>
            {fmtDate(r.period)}
          </text>
        ))}
      </svg>

      {hover !== null && hp && (
        <div className="pointer-events-none absolute top-2 left-14 z-10 rounded-xl border border-slate-200 bg-white/96 backdrop-blur-sm p-3 shadow-xl text-xs w-52">
          <div className="font-bold text-slate-800 mb-2 pb-1.5 border-b border-slate-100">{fmtDate(hp.period)}</div>
          <div className="flex justify-between mb-1">
            <span className="flex items-center gap-1.5 text-slate-500"><span className="h-2 w-2 rounded-full bg-amber-400"/>Sales</span>
            <span className="font-bold tabular-nums text-slate-900">{fmtMoney(hp.product_revenue)}</span>
          </div>
          <div className="flex justify-between mb-1">
            <span className="flex items-center gap-1.5 text-slate-500"><span className="h-2 w-2 rounded-full bg-violet-500"/>Services</span>
            <span className="font-bold tabular-nums text-slate-900">{fmtMoney(hp.service_income)}</span>
          </div>
          <div className="flex justify-between pt-1.5 border-t border-slate-100">
            <span className="text-slate-500">Total</span>
            <span className="font-bold tabular-nums text-slate-900">{fmtMoney(hpTotal)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════════════════════════ */
export default function ExpensesPnLReportPage() {
  const [orgId,    setOrgId]    = useState<string | null>(null);
  const [range,    setRange]    = useState<DateRange>(() => defaultRange());
  const [g,        setG]        = useState<Granularity>("day");
  const [loading,  setLoading]  = useState(true);
  const [err,      setErr]      = useState("");
  const [tab,      setTab]      = useState<NavTab>("overview");
  const [expenses, setExpenses] = useState<Awaited<ReturnType<typeof reportExpenses>> | null>(null);
  const [pnl,      setPnl]      = useState<Awaited<ReturnType<typeof reportPnL>> | null>(null);

  useEffect(() => {
    (async () => {
      try { setOrgId(await bootstrapOrg()); }
      catch (e: any) { setErr(e.message ?? String(e)); }
    })();
  }, []);

  async function load() {
    if (!orgId) return;
    setLoading(true); setErr("");
    try {
      const [ex, pl] = await Promise.all([
        reportExpenses(orgId, { from: range.from, to: range.to, granularity: g }),
        reportPnL(orgId,      { from: range.from, to: range.to, granularity: g }),
      ]);
      setExpenses(ex); setPnl(pl);
    } catch (e: any) { setErr(e.message ?? String(e)); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (orgId) load(); }, [orgId, range.from, range.to, g]);

  /* ── Derived data ── */
  const topCats: TopCatRow[] = useMemo(
    () => ((expenses?.top_categories ?? []) as TopCatRow[]).slice(0, 8),
    [expenses]
  );
  const trend: TrendRow[]    = (expenses?.trend ?? []) as TrendRow[];
  const pnlRows: PnlRow[]    = ((pnl as any)?.points ?? (pnl as any)?.trend ?? []) as PnlRow[];
  const totals = pnl?.totals ?? { revenue: 0, product_revenue: 0, service_income: 0, discounts: 0, cogs: 0, expenses: 0, gross_profit: 0, net_profit: 0 };
  const totalExpenses  = trend.reduce((s, t) => s + Number(t.total ?? 0), 0);
  const netProfit      = Number(totals.net_profit ?? 0);
  const salesRevenue   = Number(totals.product_revenue ?? 0);
  const servicesRevenue = Number(totals.service_income ?? 0);
  const incomeCompare  = useMemo(() => revenueComparison(salesRevenue, servicesRevenue), [salesRevenue, servicesRevenue]);
  const grossMarginPct = Number(totals.revenue) > 0 ? (Number(totals.gross_profit) / Number(totals.revenue)) * 100 : 0;
  const netMarginPct   = Number(totals.revenue) > 0 ? (netProfit / Number(totals.revenue)) * 100 : 0;
  const expRatioPct    = Number(totals.revenue) > 0 ? (Number(totals.expenses) / Number(totals.revenue)) * 100 : 0;

  const REV_COLS = "1.1fr 1fr 1fr 1fr 0.75fr 0.75fr 1fr";
  const EXP_COLS = "1.4fr 1fr 1fr";
  const PNL_COLS = "1.1fr 1fr 1fr 1fr 0.9fr 0.9fr 1fr 1fr 1fr";

  const QUICK = [
    { label: "7D",  days: 7 },
    { label: "30D", days: 29 },
    { label: "90D", days: 89 },
  ];
  function applyQuick(days: number) {
    const to = new Date(), from = new Date();
    from.setDate(to.getDate() - days);
    setRange({ from: iso(from), to: iso(to) });
  }

  if (!orgId && !err) return (
    <div className="flex h-64 items-center justify-center"><Spinner h={80}/></div>
  );

  const TABS: { id: NavTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "revenue",  label: "Sales vs Services" },
    { id: "expenses", label: "Expenses" },
    { id: "pnl",      label: "Profit & Loss" },
  ];

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-[2rem] leading-tight tracking-tight text-[#1f1b14]">Revenue health</h1>
            <p className="mt-1.5 text-sm text-[#766b59]">
              Sales, services, expenses, and profit.
            </p>
          </div>

          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[auto_auto_auto_auto] xl:w-auto">
            <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-1">
              {QUICK.map((q) => (
                <button
                  key={q.label}
                  onClick={() => applyQuick(q.days)}
                  className="flex-1 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-white hover:text-slate-900"
                >
                  {q.label}
                </button>
              ))}
            </div>

            <DateRangeControl
              from={range.from}
              to={range.to}
              onFromChange={(value) => setRange((r) => ({ ...r, from: value }))}
              onToChange={(value) => setRange((r) => ({ ...r, to: value }))}
            />

            <select
              className="h-full min-h-[48px] rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm outline-none"
              value={g}
              onChange={(e) => setG(e.target.value as Granularity)}
            >
              <option value="day">Daily</option>
              <option value="month">Monthly</option>
            </select>

            <button
              className="min-h-[48px] rounded-xl bg-slate-900 px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={load}
              disabled={loading}
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
      </div>

      {err && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="flex-1">{err}</span>
          <button onClick={() => setErr("")} className="font-bold text-red-400 hover:text-red-600">
            Close
          </button>
        </div>
      )}

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-8">
        {[
          { label: "Total Revenue", value: fmtMoney(Number(totals.revenue ?? 0)), sub: "Sales + services", bg: "bg-slate-50 border-slate-200", color: "text-slate-900" },
          { label: "Product Sales", value: fmtMoney(salesRevenue), sub: `${incomeCompare.salesShare.toFixed(1)}% of revenue`, bg: "bg-amber-50 border-amber-200", color: "text-amber-700" },
          { label: "Service Income", value: fmtMoney(servicesRevenue), sub: `${incomeCompare.servicesShare.toFixed(1)}% of revenue`, bg: "bg-violet-50 border-violet-200", color: "text-violet-700" },
          {
            label: "Income Leader",
            value: incomeCompare.winner === "sales" ? "Sales" : incomeCompare.winner === "services" ? "Services" : incomeCompare.total === 0 ? "—" : "Tied",
            sub: incomeCompare.total > 0 && incomeCompare.winner ? `+${incomeCompare.leadPct.toFixed(1)}% vs other` : incomeCompare.leadLabel,
            bg: incomeCompare.winner === "sales" ? "bg-amber-50 border-amber-200" : incomeCompare.winner === "services" ? "bg-violet-50 border-violet-200" : "bg-slate-50 border-slate-200",
            color: incomeCompare.winner === "sales" ? "text-amber-700" : incomeCompare.winner === "services" ? "text-violet-700" : "text-slate-700",
          },
          { label: "Discounts",    value: fmtMoney(Number(totals.discounts ?? 0)),     sub: "", bg: "bg-amber-50/50 border-amber-100", color: "text-amber-600" },
          { label: "COGS",         value: fmtMoney(Number(totals.cogs ?? 0)),          sub: "", bg: "bg-slate-50 border-slate-200", color: "text-slate-700" },
          { label: "Gross Profit", value: fmtMoney(Number(totals.gross_profit ?? 0)), sub: `${grossMarginPct.toFixed(1)}% margin`, bg: "bg-green-50 border-green-200", color: "text-green-700" },
          {
            label: "Net Profit", value: fmtMoney(netProfit), sub: `${netMarginPct.toFixed(1)}% margin`,
            bg: netProfit >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200",
            color: netProfit >= 0 ? "text-green-700" : "text-red-700",
          },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="relative overflow-hidden rounded-2xl border border-[rgba(80,61,25,0.1)] bg-white p-5">
            <div className="absolute inset-x-0 top-0 h-[3px] bg-[#d7a820]" />
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a7b5e]">{label}</div>
            <div className={`text-lg font-semibold tracking-tight ${color}`}>
              {loading ? <span className="text-slate-300">—</span> : value}
            </div>
            {sub && !loading && <div className="mt-1 text-xs text-[#766b59]">{sub}</div>}
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? "border-amber-500 text-amber-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════ OVERVIEW TAB ══════════ */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

          {/* Sales vs Services comparison */}
          <div className={`${S.card} overflow-hidden lg:col-span-2`}>
            <div className="border-b border-slate-100 px-5 py-4">
              <div className="font-bold text-slate-900">Sales vs Service Income</div>
              <div className="text-xs text-slate-500 mt-0.5">
                {loading ? "Loading…" : incomeCompare.total > 0 ? incomeCompare.leadLabel : "No revenue in this period"}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-6 p-5 lg:grid-cols-[1fr_1.4fr]">
              <div className="space-y-4">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-amber-500"/>
                      <span className="text-sm font-semibold text-slate-700">Product Sales</span>
                    </div>
                    <span className="text-lg font-bold tabular-nums text-amber-700">
                      {loading ? "—" : fmtMoney(salesRevenue)}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">{incomeCompare.salesShare.toFixed(1)}% of total revenue</div>
                </div>
                <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-violet-500"/>
                      <span className="text-sm font-semibold text-slate-700">Service Income</span>
                    </div>
                    <span className="text-lg font-bold tabular-nums text-violet-700">
                      {loading ? "—" : fmtMoney(servicesRevenue)}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">{incomeCompare.servicesShare.toFixed(1)}% of total revenue</div>
                </div>
                {!loading && incomeCompare.total > 0 && (
                  <div className={`rounded-xl px-4 py-3 text-sm font-semibold ${
                    incomeCompare.winner === "sales"
                      ? "bg-amber-100 text-amber-800"
                      : incomeCompare.winner === "services"
                        ? "bg-violet-100 text-violet-800"
                        : "bg-slate-100 text-slate-700"
                  }`}>
                    {incomeCompare.winner === "sales" && `Sales outperform services by ${incomeCompare.leadPct.toFixed(1)}%`}
                    {incomeCompare.winner === "services" && `Services outperform sales by ${incomeCompare.leadPct.toFixed(1)}%`}
                    {!incomeCompare.winner && incomeCompare.leadLabel}
                  </div>
                )}
              </div>
              <div>
                <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
                  <span>Revenue mix</span>
                  <span className="tabular-nums">{loading ? "—" : fmtMoney(incomeCompare.total)}</span>
                </div>
                <div className="mb-4 flex h-4 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full bg-amber-500 transition-all duration-500" style={{ width: `${incomeCompare.salesShare}%` }}/>
                  <div className="h-full bg-violet-500 transition-all duration-500" style={{ width: `${incomeCompare.servicesShare}%` }}/>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-semibold text-amber-700">
                    <span className="h-2 w-2 rounded-full bg-amber-500"/>Sales {incomeCompare.salesShare.toFixed(1)}%
                  </span>
                  <span className="flex items-center gap-1.5 font-semibold text-violet-700">
                    Services {incomeCompare.servicesShare.toFixed(1)}%<span className="h-2 w-2 rounded-full bg-violet-500"/>
                  </span>
                </div>
                <div className="mt-5">
                  {loading ? <Spinner h={180}/> : <RevenueSplitChart rows={pnlRows} height={180}/>}
                </div>
                <div className="mt-2 flex items-center justify-center gap-5 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-amber-400"/>Sales</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-violet-500"/>Services</span>
                </div>
              </div>
            </div>
          </div>

          <div className={`${S.card} overflow-hidden`}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <div className="font-bold text-slate-900">Expense Trend</div>
                <div className="text-xs text-slate-500 mt-0.5">{g === "day" ? "Daily" : "Monthly"} totals</div>
              </div>
              <button onClick={() => downloadCSV("expense-trend.csv", trend.map(t => ({ period: t.period, total: t.total })))}
                className={S.btnGhost + " !py-1.5 !text-xs"}>Export CSV</button>
            </div>
            <div className="p-4">
              {loading ? <Spinner h={220}/> : <ExpenseTrendChart trend={trend} height={220}/>}
            </div>
          </div>

          <div className={`${S.card} overflow-hidden`}>
            <div className="border-b border-slate-100 px-5 py-4">
              <div className="font-bold text-slate-900">Top Categories</div>
              <div className="text-xs text-slate-500 mt-0.5">Where money went</div>
            </div>
            {loading ? <Spinner h={220}/> : topCats.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-400">No categories yet.</div>
            ) : (
              <div className="flex flex-col sm:flex-row items-start gap-2 p-4">
                <div className="shrink-0 w-full sm:w-[200px]">
                  <CategoryDonut cats={topCats} total={totalExpenses}/>
                </div>
                <div className="flex-1 w-full space-y-2 pt-1">
                  {topCats.map((c, i) => {
                    const pct = totalExpenses > 0 ? (c.amount / totalExpenses) * 100 : 0;
                    return (
                      <div key={c.category}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="flex items-center gap-2 text-xs font-semibold text-slate-700 truncate max-w-[140px]">
                            <span className="h-2 w-2 rounded-full shrink-0" style={{backgroundColor: CAT_PALETTE[i % CAT_PALETTE.length]}}/>
                            {c.category}
                          </span>
                          <span className="text-xs font-bold text-slate-900 ml-2">{pct.toFixed(0)}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(2, pct)}%`, backgroundColor: CAT_PALETTE[i % CAT_PALETTE.length] }}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {topCats.length > 0 && (
              <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-between">
                <span className="text-xs text-slate-500">Total</span>
                <span className="text-sm font-bold text-slate-900">{fmtMoney(totalExpenses)}</span>
              </div>
            )}
          </div>

          <div className={`${S.card} overflow-hidden lg:col-span-2`}>
            <div className="border-b border-slate-100 px-5 py-4">
              <div className="font-bold text-slate-900">P&L Waterfall</div>
              <div className="text-xs text-slate-500 mt-0.5">Revenue flow to net profit</div>
            </div>
            <div className="p-4">
              {loading ? <Spinner h={220}/> : <PnLWaterfall totals={{
                revenue: Number(totals.revenue ?? 0),
                discounts: Number(totals.discounts ?? 0),
                cogs: Number(totals.cogs ?? 0),
                gross_profit: Number(totals.gross_profit ?? 0),
                expenses: Number(totals.expenses ?? 0),
                net_profit: netProfit,
              }}/>}
            </div>
          </div>
        </div>
      )}

      {/* ══════════ SALES VS SERVICES TAB ══════════ */}
      {tab === "revenue" && (
        <div className="flex flex-col gap-6">

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { label: "Product Sales", value: fmtMoney(salesRevenue), pct: incomeCompare.salesShare, color: "text-amber-700", bg: "bg-amber-50 border-amber-200", dot: "bg-amber-500" },
              { label: "Service Income", value: fmtMoney(servicesRevenue), pct: incomeCompare.servicesShare, color: "text-violet-700", bg: "bg-violet-50 border-violet-200", dot: "bg-violet-500" },
              {
                label: "Comparison",
                value: incomeCompare.winner === "sales" ? "Sales win" : incomeCompare.winner === "services" ? "Services win" : incomeCompare.total === 0 ? "—" : "Tied",
                pct: incomeCompare.leadPct,
                color: incomeCompare.winner === "sales" ? "text-amber-700" : incomeCompare.winner === "services" ? "text-violet-700" : "text-slate-700",
                bg: "bg-slate-50 border-slate-200",
                dot: "bg-slate-400",
                isCompare: true,
              },
            ].map(({ label, value, pct, color, dot, isCompare }) => (
              <div key={label} className="relative overflow-hidden rounded-2xl border border-[rgba(80,61,25,0.1)] bg-white p-5">
                <div className="absolute inset-x-0 top-0 h-[3px] bg-[#d7a820]" />
                <div className="mb-2 flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${dot}`}/>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a7b5e]">{label}</span>
                </div>
                <div className={`text-2xl font-semibold tabular-nums tracking-tight ${color}`}>{loading ? "—" : value}</div>
                <div className="mt-1 text-xs text-[#766b59]">
                  {loading ? "" : isCompare
                    ? (incomeCompare.winner ? `${incomeCompare.leadPct.toFixed(1)}% ahead of the other stream` : incomeCompare.leadLabel)
                    : `${pct.toFixed(1)}% of total revenue`}
                </div>
              </div>
            ))}
          </div>

          <div className={`${S.card} overflow-hidden`}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <div className="font-bold text-slate-900">Income Trend — Sales vs Services</div>
                <div className="text-xs text-slate-500 mt-0.5">{g === "day" ? "Daily" : "Monthly"} breakdown</div>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-amber-400"/>Sales</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-violet-500"/>Services</span>
              </div>
            </div>
            <div className="p-4">
              {loading ? <Spinner h={240}/> : <RevenueSplitChart rows={pnlRows} height={240}/>}
            </div>
          </div>

          <div className={`${S.card} overflow-hidden`}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <div className="font-bold text-slate-900">Income by Period</div>
                <div className="text-xs text-slate-500 mt-0.5">{pnlRows.length} period{pnlRows.length !== 1 ? "s" : ""}</div>
              </div>
              <button
                onClick={() => downloadCSV("revenue-sources.csv", pnlRows.map(r => {
                  const rowTotal = r.product_revenue + r.service_income;
                  const cmp = revenueComparison(r.product_revenue, r.service_income);
                  return {
                    period: r.period,
                    sales: r.product_revenue,
                    services: r.service_income,
                    total: rowTotal,
                    sales_pct: rowTotal > 0 ? ((r.product_revenue / rowTotal) * 100).toFixed(1) : "0",
                    services_pct: rowTotal > 0 ? ((r.service_income / rowTotal) * 100).toFixed(1) : "0",
                    leader: cmp.winner ?? "tie",
                    lead_pct: cmp.leadPct.toFixed(1),
                  };
                }))}
                className={S.btnGhost + " !py-1.5 !text-xs"}
              >
                Export CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <div className={`${TABLE_HEAD} min-w-[820px]`} style={{ gridTemplateColumns: REV_COLS }}>
                <div>Period</div>
                <div className="text-right">Sales</div>
                <div className="text-right">Services</div>
                <div className="text-right">Total</div>
                <div className="text-right">Sales %</div>
                <div className="text-right">Services %</div>
                <div className="text-right">Leader</div>
              </div>
              <div className="max-h-[440px] divide-y divide-slate-100 overflow-y-auto min-w-[820px]">
                {loading ? <Spinner/> : pnlRows.length === 0 ? (
                  <div className="py-12 text-center text-sm text-slate-400">No revenue in this period.</div>
                ) : pnlRows.map(r => {
                  const rowTotal = r.product_revenue + r.service_income;
                  const rowCmp = revenueComparison(r.product_revenue, r.service_income);
                  const salesPct = rowTotal > 0 ? (r.product_revenue / rowTotal) * 100 : 0;
                  const svcPct = rowTotal > 0 ? (r.service_income / rowTotal) * 100 : 0;
                  return (
                    <div key={r.period} className={`${TABLE_ROW} text-sm hover:bg-slate-50 transition-colors min-w-[820px]`}
                      style={{ gridTemplateColumns: REV_COLS }}>
                      <div className="font-medium text-slate-700">{fmtDate(r.period)}</div>
                      <div className="text-right font-semibold tabular-nums text-amber-700">{fmtMoney(r.product_revenue)}</div>
                      <div className="text-right font-semibold tabular-nums text-violet-700">{fmtMoney(r.service_income)}</div>
                      <div className="text-right font-bold tabular-nums text-slate-900">{fmtMoney(rowTotal)}</div>
                      <div className="text-right tabular-nums text-slate-600">{salesPct.toFixed(1)}%</div>
                      <div className="text-right tabular-nums text-slate-600">{svcPct.toFixed(1)}%</div>
                      <div className="text-right">
                        {rowTotal === 0 ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : rowCmp.winner === "sales" ? (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                            Sales +{rowCmp.leadPct.toFixed(0)}%
                          </span>
                        ) : rowCmp.winner === "services" ? (
                          <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-800">
                            Services +{rowCmp.leadPct.toFixed(0)}%
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-slate-500">Tied</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {pnlRows.length > 0 && (
                <div className={`${TABLE_FOOT} text-sm font-bold min-w-[820px]`} style={{ gridTemplateColumns: REV_COLS }}>
                  <span>Total</span>
                  <span className="text-right tabular-nums text-amber-700">{fmtMoney(salesRevenue)}</span>
                  <span className="text-right tabular-nums text-violet-700">{fmtMoney(servicesRevenue)}</span>
                  <span className="text-right tabular-nums text-slate-900">{fmtMoney(incomeCompare.total)}</span>
                  <span className="text-right tabular-nums text-slate-600">{incomeCompare.salesShare.toFixed(1)}%</span>
                  <span className="text-right tabular-nums text-slate-600">{incomeCompare.servicesShare.toFixed(1)}%</span>
                  <span className="text-right">
                    {!loading && incomeCompare.winner && (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                        incomeCompare.winner === "sales" ? "bg-amber-100 text-amber-800" : "bg-violet-100 text-violet-800"
                      }`}>
                        {incomeCompare.winner === "sales" ? "Sales" : "Services"} +{incomeCompare.leadPct.toFixed(0)}%
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════ EXPENSES TAB ══════════ */}
      {tab === "expenses" && (
        <div className="flex flex-col gap-6">

          <div className={`${S.card} overflow-hidden`}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <div className="font-bold text-slate-900">Expense by Period</div>
                <div className="text-xs text-slate-500 mt-0.5">{trend.length} period{trend.length !== 1 ? "s" : ""}</div>
              </div>
              <button onClick={() => downloadCSV("expenses.csv", trend.map(t => ({ period: t.period, total: t.total })))}
                className={S.btnGhost + " !py-1.5 !text-xs"}>Export CSV</button>
            </div>
            <div className={TABLE_HEAD} style={{ gridTemplateColumns: EXP_COLS }}>
              <div>Period</div><div className="text-right">Total Expenses</div><div className="text-right">Share</div>
            </div>
            <div className="divide-y divide-slate-100 max-h-[440px] overflow-y-auto">
              {loading ? <Spinner/> : trend.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-400">No expenses in this period.</div>
              ) : trend.map(t => {
                const pct = totalExpenses > 0 ? (t.total / totalExpenses) * 100 : 0;
                return (
                  <div key={t.period} className={`${TABLE_ROW} hover:bg-slate-50 transition-colors`}
                    style={{ gridTemplateColumns: EXP_COLS }}>
                    <div className="text-sm font-medium text-slate-700">{fmtDate(t.period)}</div>
                    <div className="text-right text-sm font-bold tabular-nums text-slate-900">{fmtMoney(Number(t.total ?? 0))}</div>
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-20 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full rounded-full bg-red-400" style={{width:`${Math.max(2,pct)}%`}}/>
                        </div>
                        <span className="w-12 text-right text-xs tabular-nums text-slate-500">{pct.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {trend.length > 0 && (
              <div className={TABLE_FOOT} style={{ gridTemplateColumns: EXP_COLS }}>
                <span className="text-xs font-bold text-slate-700">Total</span>
                <span className="text-right text-sm font-bold tabular-nums text-slate-900">{fmtMoney(totalExpenses)}</span>
                <span className="text-right text-xs tabular-nums text-slate-500">100%</span>
              </div>
            )}
          </div>

          <div className={`${S.card} overflow-hidden`}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <div className="font-bold text-slate-900">Category Breakdown</div>
                <div className="text-xs text-slate-500 mt-0.5">{topCats.length} categories</div>
              </div>
              <button onClick={() => downloadCSV("categories.csv", topCats.map(c => ({ category: c.category, amount: c.amount })))}
                className={S.btnGhost + " !py-1.5 !text-xs"}>Export CSV</button>
            </div>
            <div className={TABLE_HEAD} style={{ gridTemplateColumns: EXP_COLS }}>
              <div>Category</div><div className="text-right">Amount</div><div className="text-right">Share</div>
            </div>
            <div className="divide-y divide-slate-100">
              {loading ? <Spinner/> : topCats.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-400">No categories.</div>
              ) : topCats.map((c, i) => {
                const pct = totalExpenses > 0 ? (c.amount / totalExpenses) * 100 : 0;
                return (
                  <div key={c.category} className={`${TABLE_ROW} hover:bg-slate-50 transition-colors`}
                    style={{ gridTemplateColumns: EXP_COLS }}>
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{backgroundColor: CAT_PALETTE[i % CAT_PALETTE.length]}}/>
                      <span className="truncate text-sm font-semibold text-slate-800">{c.category}</span>
                    </div>
                    <div className="text-right text-sm font-bold tabular-nums text-slate-900">{fmtMoney(Number(c.amount))}</div>
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-20 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{width:`${Math.max(2,pct)}%`, backgroundColor: CAT_PALETTE[i % CAT_PALETTE.length]}}/>
                        </div>
                        <span className="w-12 text-right text-xs tabular-nums text-slate-500">{pct.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {topCats.length > 0 && (
              <div className={TABLE_FOOT} style={{ gridTemplateColumns: EXP_COLS }}>
                <span className="text-xs font-bold text-slate-700">Total</span>
                <span className="text-right text-sm font-bold tabular-nums text-slate-900">{fmtMoney(totalExpenses)}</span>
                <span className="text-right text-xs tabular-nums text-slate-500">100%</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════ P&L TAB ══════════ */}
      {tab === "pnl" && (
        <div className="flex flex-col gap-6">

          <div className={`${S.card} overflow-hidden`}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <div className="font-bold text-slate-900">Revenue vs Net Profit</div>
                <div className="text-xs text-slate-500 mt-0.5">Period by period comparison</div>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-amber-400 inline-block"/>Revenue</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-blue-500 inline-block"/>Net Profit</span>
              </div>
            </div>
            <div className="p-4">
              {loading ? <Spinner h={220}/> : <PnLLineChart rows={pnlRows} height={220}/>}
            </div>
          </div>

          <div className={`${S.card} overflow-hidden`}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <div className="font-bold text-slate-900">P&L by Period</div>
                <div className="text-xs text-slate-500 mt-0.5">{pnlRows.length} period{pnlRows.length !== 1 ? "s" : ""}</div>
              </div>
              <button onClick={() => downloadCSV("pnl.csv", pnlRows)}
                className={S.btnGhost + " !py-1.5 !text-xs"}>Export CSV</button>
            </div>
            <div className="overflow-x-auto">
              <div className={`${TABLE_HEAD} min-w-[960px]`} style={{ gridTemplateColumns: PNL_COLS }}>
                <div>Period</div>
                <div className="text-right">Sales</div>
                <div className="text-right">Services</div>
                <div className="text-right">Revenue</div>
                <div className="text-right">Discounts</div>
                <div className="text-right">COGS</div>
                <div className="text-right">Gross Profit</div>
                <div className="text-right">Expenses</div>
                <div className="text-right">Net Profit</div>
              </div>
              <div className="max-h-[440px] divide-y divide-slate-100 overflow-y-auto min-w-[960px]">
                {loading ? <Spinner/> : pnlRows.length === 0 ? (
                  <div className="py-12 text-center text-sm text-slate-400">No P&L data in this period.</div>
                ) : pnlRows.map(r => (
                  <div key={r.period} className={`${TABLE_ROW} text-sm hover:bg-slate-50 transition-colors min-w-[960px]`}
                    style={{ gridTemplateColumns: PNL_COLS }}>
                    <div className="font-medium text-slate-700">{fmtDate(r.period)}</div>
                    <div className="text-right tabular-nums text-amber-700">{fmtMoney(r.product_revenue ?? 0)}</div>
                    <div className="text-right tabular-nums text-violet-700">{fmtMoney(r.service_income ?? 0)}</div>
                    <div className="text-right font-semibold tabular-nums text-slate-900">{fmtMoney(r.revenue)}</div>
                    <div className="text-right tabular-nums text-amber-600">{fmtMoney(r.discounts)}</div>
                    <div className="text-right tabular-nums text-slate-600">{fmtMoney(r.cogs)}</div>
                    <div className="text-right font-semibold tabular-nums text-green-700">{fmtMoney(r.gross_profit)}</div>
                    <div className="text-right tabular-nums text-red-600">{fmtMoney(r.expenses)}</div>
                    <div className={`text-right font-bold tabular-nums ${r.net_profit >= 0 ? "text-green-700" : "text-red-600"}`}>
                      {fmtMoney(r.net_profit)}
                    </div>
                  </div>
                ))}
              </div>
              {pnlRows.length > 0 && (
                <div className={`${TABLE_FOOT} text-sm font-bold text-slate-900 min-w-[960px]`}
                  style={{ gridTemplateColumns: PNL_COLS }}>
                  <span>Total</span>
                  <span className="text-right tabular-nums text-amber-700">{fmtMoney(salesRevenue)}</span>
                  <span className="text-right tabular-nums text-violet-700">{fmtMoney(servicesRevenue)}</span>
                  <span className="text-right tabular-nums">{fmtMoney(Number(totals.revenue))}</span>
                  <span className="text-right tabular-nums text-amber-600">{fmtMoney(Number(totals.discounts))}</span>
                  <span className="text-right tabular-nums">{fmtMoney(Number(totals.cogs))}</span>
                  <span className="text-right tabular-nums text-green-700">{fmtMoney(Number(totals.gross_profit))}</span>
                  <span className="text-right tabular-nums text-red-600">{fmtMoney(Number(totals.expenses))}</span>
                  <span className={`text-right tabular-nums ${netProfit >= 0 ? "text-green-700" : "text-red-600"}`}>{fmtMoney(netProfit)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { label: "Gross Margin",  value: `${grossMarginPct.toFixed(1)}%`, sub: `Ksh ${fmtK(Number(totals.gross_profit))} gross profit`, color: grossMarginPct >= 30 ? "text-green-700" : "text-amber-600", bg: grossMarginPct >= 30 ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200" },
              { label: "Net Margin",    value: `${netMarginPct.toFixed(1)}%`,   sub: `Ksh ${fmtK(netProfit)} net profit`,                      color: netMarginPct >= 0 ? "text-green-700" : "text-red-700",    bg: netMarginPct >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200" },
              { label: "Expense Ratio", value: `${expRatioPct.toFixed(1)}%`,    sub: "Expenses as % of revenue",                                color: expRatioPct <= 40 ? "text-green-700" : "text-red-700",    bg: expRatioPct <= 40 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200" },
            ].map(({ label, value, sub, color }) => (
              <div key={label} className="relative overflow-hidden rounded-2xl border border-[rgba(80,61,25,0.1)] bg-white p-5">
                <div className="absolute inset-x-0 top-0 h-[3px] bg-[#d7a820]" />
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a7b5e]">{label}</div>
                <div className={`text-2xl font-semibold tracking-tight ${color}`}>{loading ? "—" : value}</div>
                <div className="mt-1 text-xs text-[#766b59]">{sub}</div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}