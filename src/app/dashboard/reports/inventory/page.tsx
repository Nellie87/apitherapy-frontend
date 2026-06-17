"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import { getInventoryValuation, type InventoryValuationRow } from "@/lib/api/reports";
import * as S from "../page.styles";

/* ════════════════════════════════════════════════════════════════
   TYPES
════════════════════════════════════════════════════════════════ */
type StockHealth = "out" | "critical" | "low" | "ok";
type NavTab      = "overview" | "reorder" | "valuation" | "insights";
type SortCol     = "urgency" | "value" | "qty" | "coverage";

type Enriched = InventoryValuationRow & { urgency: number; coverage: number };

/* ════════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════════ */
const fmtMoney = (v: number) =>
  `Ksh ${Number(v || 0).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
const fmtK = (v: number) =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M`
  : v >= 1_000   ? `${(v / 1_000).toFixed(0)}k`
  : String(Math.round(v));

function urgencyScore(r: InventoryValuationRow): number {
  if (r.status === "out")      return 100;
  if (r.status === "critical") return 75;
  if (r.status === "low")      return 45;
  const buffer = r.reorder_level > 0 ? r.qty_on_hand / r.reorder_level : 10;
  return Math.max(0, Math.min(20, Math.round(20 / buffer)));
}
function coverageRatio(r: InventoryValuationRow): number {
  if (!r.reorder_level) return r.qty_on_hand > 0 ? 99 : 0;
  return parseFloat((r.qty_on_hand / r.reorder_level).toFixed(2));
}

function downloadCSV(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = [headers.join(","), ...rows.map(r => headers.map(h => esc(r[h])).join(","))].join("\n");
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" })),
    download: filename,
  });
  a.click(); URL.revokeObjectURL(a.href);
}

/* ════════════════════════════════════════════════════════════════
   STATUS CONFIG
════════════════════════════════════════════════════════════════ */
const STATUS_CFG: Record<StockHealth, { label: string; dot: string; cls: string; icon: string }> = {
  out:      { label: "Out of Stock", dot: "#ef4444", cls: "bg-red-100 text-red-700",     icon: "🚫" },
  critical: { label: "Critical",     dot: "#f97316", cls: "bg-orange-100 text-orange-700", icon: "🔥" },
  low:      { label: "Low",          dot: "#f59e0b", cls: "bg-amber-100 text-amber-700",  icon: "📉" },
  ok:       { label: "Healthy",      dot: "#22c55e", cls: "bg-green-100 text-green-700",  icon: "✅" },
};

function StatusBadge({ status }: { status: StockHealth }) {
  const c = STATUS_CFG[status] ?? STATUS_CFG.ok;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${c.cls}`}>
      {c.icon} {c.label}
    </span>
  );
}

/* ════════════════════════════════════════════════════════════════
   SPINNER
════════════════════════════════════════════════════════════════ */
function Spinner({ h = 120 }: { h?: number }) {
  return (
    <div className="flex items-center justify-center gap-3 text-slate-400" style={{ height: h }}>
      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" strokeOpacity="0.2"/><path d="M12 2a10 10 0 0110 10"/>
      </svg>
      <span className="text-sm">Loading…</span>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   URGENCY BAR
════════════════════════════════════════════════════════════════ */
function UrgencyBar({ score }: { score: number }) {
  const color = score >= 75 ? "#ef4444" : score >= 45 ? "#f97316" : score >= 20 ? "#f59e0b" : "#22c55e";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden" style={{ minWidth: 56 }}>
        <div className="h-full rounded-full transition-all duration-400"
          style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="text-xs font-bold text-slate-400 w-6 text-right">{score}</span>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   SEGMENTED CONTROL
════════════════════════════════════════════════════════════════ */
function SegControl<T extends string>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1 gap-0.5">
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition whitespace-nowrap ${
            value === o.value
              ? "bg-white border border-slate-200 shadow-sm text-slate-900"
              : "text-slate-500 hover:text-slate-700"
          }`}>{o.label}</button>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   KPI CARD
════════════════════════════════════════════════════════════════ */
function KpiCard({ label, value, sub, icon, variant = "neutral" }: {
  label: string; value: string; sub?: string; icon: string;
  variant?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  const cfg = {
    neutral: { bg:"bg-white",    border:"border-slate-200",  iconBg:"bg-slate-50",   val:"text-slate-900", sub:"text-slate-500"  },
    success: { bg:"bg-green-50", border:"border-green-200",  iconBg:"bg-green-100",  val:"text-green-800", sub:"text-green-600"  },
    warning: { bg:"bg-amber-50", border:"border-amber-200",  iconBg:"bg-amber-100",  val:"text-amber-800", sub:"text-amber-600"  },
    danger:  { bg:"bg-red-50",   border:"border-red-200",    iconBg:"bg-red-100",    val:"text-red-800",   sub:"text-red-500"    },
    info:    { bg:"bg-blue-50",  border:"border-blue-200",   iconBg:"bg-blue-100",   val:"text-blue-800",  sub:"text-blue-600"   },
  }[variant];
  return (
    <div className={`rounded-2xl border p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 ${cfg.bg} ${cfg.border}`}>
      <div className={`grid h-10 w-10 place-items-center rounded-xl text-lg mb-3 ${cfg.iconBg}`}>{icon}</div>
      <div className={`text-xs font-semibold uppercase tracking-wider mb-1.5 ${cfg.sub}`}>{label}</div>
      <div className={`text-2xl font-bold leading-tight ${cfg.val}`}>{value}</div>
      {sub && <div className={`mt-1 text-xs ${cfg.sub}`}>{sub}</div>}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   CARD WRAPPER
════════════════════════════════════════════════════════════════ */
function Card({ title, sub, action, children, noPad }: {
  title: string; sub?: string; action?: React.ReactNode;
  children: React.ReactNode; noPad?: boolean;
}) {
  return (
    <div className={`${S.card} overflow-hidden`}>
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <div className="font-bold text-slate-900">{title}</div>
          {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
        </div>
        {action}
      </div>
      {noPad ? children : <div className="px-5 py-4">{children}</div>}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   SVG DONUT — Stock Health
════════════════════════════════════════════════════════════════ */
function StatusDonut({ segs }: {
  segs: { label: string; value: number; color: string }[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const R = 70, r = 42, cx = 90, cy = 90, W = 280, H = 180;
  const total = segs.reduce((s, x) => s + x.value, 0);
  if (!total) return <div className="flex items-center justify-center text-sm text-slate-400 h-40">No data</div>;

  let angle = -Math.PI / 2;
  const arcs = segs.map((seg, idx) => {
    const sweep = (seg.value / total) * 2 * Math.PI;
    const sA = angle + 0.025, eA = angle + sweep - 0.025;
    angle += sweep;
    const eR = hover === idx ? R + 8 : R;
    const cos = Math.cos, sin = Math.sin;
    const d = [
      `M${(cx + eR * cos(sA)).toFixed(2)},${(cy + eR * sin(sA)).toFixed(2)}`,
      `A${eR},${eR} 0 ${sweep > Math.PI ? 1 : 0} 1 ${(cx + eR * cos(eA)).toFixed(2)},${(cy + eR * sin(eA)).toFixed(2)}`,
      `L${(cx + r * cos(eA)).toFixed(2)},${(cy + r * sin(eA)).toFixed(2)}`,
      `A${r},${r} 0 ${sweep > Math.PI ? 1 : 0} 0 ${(cx + r * cos(sA)).toFixed(2)},${(cy + r * sin(sA)).toFixed(2)}Z`,
    ].join(" ");
    return { ...seg, idx, d, pct: ((seg.value / total) * 100).toFixed(0) };
  });

  const LX = cx * 2 + 12;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      {arcs.map(a => (
        <path key={a.idx} d={a.d} fill={a.color}
          opacity={hover === null || hover === a.idx ? 1 : 0.4}
          style={{ transition: "opacity 0.15s, d 0.15s", cursor: "pointer" }}
          onMouseEnter={() => setHover(a.idx)} onMouseLeave={() => setHover(null)} />
      ))}
      <circle cx={cx} cy={cy} r={r - 2} fill="white" />
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="9" fill="#94a3b8" fontWeight="600">Products</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize="15" fill="#0f172a" fontWeight="700">{total}</text>
      {hover !== null && (
        <text x={cx} y={cy + 26} textAnchor="middle" fontSize="9.5" fill={arcs[hover]?.color} fontWeight="700">{arcs[hover]?.pct}%</text>
      )}
      {arcs.map((a, i) => {
        const ly = 16 + i * 36, isH = hover === a.idx;
        return (
          <g key={i} style={{ cursor: "pointer" }}
            onMouseEnter={() => setHover(a.idx)} onMouseLeave={() => setHover(null)}>
            <rect x={LX} y={ly - 8} width="10" height="10" rx="3" fill={a.color} opacity={isH ? 1 : 0.8} />
            <text x={LX + 15} y={ly + 1} fontSize="11" fill={isH ? "#0f172a" : "#64748b"} fontWeight={isH ? "700" : "400"}>{a.label}</text>
            <text x={W - 4} y={ly + 1} textAnchor="end" fontSize="11" fill={isH ? a.color : "#94a3b8"} fontWeight={isH ? "700" : "400"}>
              {a.value} ({a.pct}%)
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ════════════════════════════════════════════════════════════════
   SVG BAR — Coverage buckets
════════════════════════════════════════════════════════════════ */
function CoverageBar({ data }: { data: { name: string; count: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 400, H = 160, P = { t: 14, r: 12, b: 32, l: 40 };
  const iW = W - P.l - P.r, iH = H - P.t - P.b;
  const maxV = Math.max(...data.map(d => d.count), 1);
  const bW   = iW / data.length - 10;
  const colors = ["#ef4444", "#f97316", "#f59e0b", "#3b82f6", "#22c55e"];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      <line x1={P.l} y1={P.t + iH} x2={W - P.r} y2={P.t + iH} stroke="#e2e8f0" strokeWidth="1" />
      {data.map((d, i) => {
        const x   = P.l + i * (bW + 10) + 4;
        const bH  = Math.max(3, (d.count / maxV) * iH * 0.92);
        const y   = P.t + iH - bH;
        const mid = x + bW / 2;
        const isH = hover === i;
        const c   = colors[i] ?? "#3b82f6";
        return (
          <g key={d.name} style={{ cursor: "default" }}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <rect x={x} y={y} width={bW} height={bH} rx="4" fill={c}
              opacity={hover === null || isH ? 0.85 : 0.35} style={{ transition: "opacity 0.15s" }} />
            {isH && <rect x={x-1} y={y-1} width={bW+2} height={bH+2} rx="5" fill="none" stroke={c} strokeWidth="1.5" />}
            <text x={mid} y={P.t+iH+16} textAnchor="middle" fontSize="9" fill={isH?"#475569":"#94a3b8"} fontWeight={isH?"700":"400"}>{d.name}</text>
            {d.count > 0 && <text x={mid} y={y-5} textAnchor="middle" fontSize="9" fill={c} fontWeight="700">{d.count}</text>}
          </g>
        );
      })}
      {[0, Math.round(maxV/2), maxV].map((v, i) => {
        const y = P.t + iH - (v/maxV)*iH*0.92;
        return <text key={i} x={P.l-5} y={y+4} textAnchor="end" fontSize="8.5" fill="#94a3b8">{v}</text>;
      })}
    </svg>
  );
}
/* ════════════════════════════════════════════════════════════════
   SVG HORIZONTAL BAR — Category value
════════════════════════════════════════════════════════════════ */
function CategoryValueBars({ data }: {
  data: { name: string; value: number; atRisk: number; count: number }[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...data.map(d => d.value), 1);
  const CAT_COLORS = ["#f59e0b","#3b82f6","#8b5cf6","#10b981","#ef4444","#06b6d4","#f97316","#ec4899"];
  return (
    <div className="space-y-3">
      {data.slice(0, 8).map((d, i) => {
        const pct   = (d.value / max) * 100;
        const riskP = d.count > 0 ? (d.atRisk / d.count) * 100 : 0;
        const isH   = hover === i;
        return (
          <div key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className="cursor-default">
            <div className="flex items-center justify-between mb-1">
              <span className={`text-xs font-medium truncate max-w-[180px] transition-colors ${isH ? "text-slate-900" : "text-slate-600"}`}>{d.name}</span>
              <span className={`text-xs font-bold ml-2 transition-colors ${isH ? "text-slate-900" : "text-slate-700"}`}>{fmtMoney(d.value)}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.max(1.5, pct)}%`, background: CAT_COLORS[i % CAT_COLORS.length], opacity: isH ? 1 : 0.7 }} />
            </div>
            {isH && (
              <div className="mt-1 text-xs text-slate-400">
                {d.count} products · {riskP > 0 ? <span className="text-red-500 font-semibold">{riskP.toFixed(0)}% at risk</span> : <span className="text-green-600">all healthy</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   SVG HORIZONTAL BAR — Top 10 by value
════════════════════════════════════════════════════════════════ */
function ValueBars({ data }: { data: { name: string; value: number; status: StockHealth }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...data.map(d => d.value), 1);
  const statusColor = (s: StockHealth) =>
    s === "out" ? "#ef4444" : s === "critical" ? "#f97316" : s === "low" ? "#f59e0b" : "#22c55e";
  return (
    <div className="space-y-2.5">
      {data.map((d, i) => {
        const pct = (d.value / max) * 100;
        const isH = hover === i;
        const col = statusColor(d.status);
        return (
          <div key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className="cursor-default">
            <div className="flex items-center justify-between mb-1">
              <span className={`text-xs font-medium truncate max-w-[200px] flex items-center gap-1.5 transition-colors ${isH ? "text-slate-900" : "text-slate-600"}`}>
                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: col }} />
                {d.name}
              </span>
              <span className={`text-xs font-bold ml-2 transition-colors ${isH ? "text-slate-900" : "text-slate-700"}`}>{fmtMoney(d.value)}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.max(1.5, pct)}%`, background: col, opacity: isH ? 1 : 0.72 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   SVG PARETO — Cumulative value %
════════════════════════════════════════════════════════════════ */
function ParetoChart({ data }: { data: { rank: number; cumPct: number; name: string }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 500, H = 150, P = { t: 14, r: 16, b: 30, l: 44 };
  const iW = W - P.l - P.r, iH = H - P.t - P.b;
  const bW = data.length > 0 ? iW / data.length - 3 : 0;

  const ys = (v: number) => P.t + iH - (v / 100) * iH * 0.92;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      <line x1={P.l} y1={P.t + iH} x2={W - P.r} y2={P.t + iH} stroke="#e2e8f0" strokeWidth="1" />
      {[0, 25, 50, 80, 100].map((v, i) => {
        const y = ys(v);
        return (
          <g key={i}>
            <line x1={P.l} y1={y} x2={W - P.r} y2={y} stroke={v === 80 ? "#fde68a" : "#f8fafc"} strokeWidth={v === 80 ? 1 : 1} strokeDasharray={v === 80 ? "4 3" : "none"} />
            <text x={P.l - 5} y={y + 4} textAnchor="end" fontSize="8.5" fill="#94a3b8">{v}%</text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const x   = P.l + i * (bW + 3) + 1;
        const bH  = Math.max(3, (d.cumPct / 100) * iH * 0.92);
        const y   = P.t + iH - bH;
        const mid = x + bW / 2;
        const isH = hover === i;
        const isA = d.cumPct <= 80;
        return (
          <g key={i} style={{ cursor: "default" }}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <rect x={x} y={y} width={bW} height={bH} rx="2"
              fill={isA ? "#3b82f6" : "#cbd5e1"} opacity={hover === null || isH ? (isA ? 0.85 : 0.6) : 0.3} />
            {isH && (
              <text x={mid} y={y - 5} textAnchor="middle" fontSize="8.5" fill={isA ? "#3b82f6" : "#94a3b8"} fontWeight="700">{d.cumPct}%</text>
            )}
          </g>
        );
      })}
      {[1, Math.round(data.length / 2), data.length].filter(Boolean).map((rank, i) => {
        const idx = rank - 1;
        if (idx < 0 || idx >= data.length) return null;
        const x = P.l + idx * (bW + 3) + (bW + 3) / 2;
        return <text key={i} x={x} y={H - 6} textAnchor="middle" fontSize="8.5" fill="#94a3b8">#{rank}</text>;
      })}
    </svg>
  );
}

/* ════════════════════════════════════════════════════════════════
   INSIGHT CARD
════════════════════════════════════════════════════════════════ */
function InsightCard({ type, icon, title, detail }: { type: string; icon: string; title: string; detail: string }) {
  const cfg: Record<string, { border: string; iconBg: string; titleColor: string }> = {
    critical: { border: "border-red-200",    iconBg: "bg-red-50",    titleColor: "text-red-800"    },
    warning:  { border: "border-amber-200",  iconBg: "bg-amber-50",  titleColor: "text-amber-800"  },
    ok:       { border: "border-green-200",  iconBg: "bg-green-50",  titleColor: "text-green-800"  },
    neutral:  { border: "border-slate-200",  iconBg: "bg-slate-50",  titleColor: "text-slate-900"  },
  };
  const c = cfg[type] ?? cfg.neutral;
  return (
    <div className={`rounded-2xl border bg-white p-4 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 ${c.border}`}>
      <div className="flex gap-3 items-start">
        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-base ${c.iconBg}`}>{icon}</div>
        <div>
          <div className={`text-sm font-bold mb-1 ${c.titleColor}`}>{title}</div>
          <div className="text-xs text-slate-500 leading-relaxed">{detail}</div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   SORT HEADER
════════════════════════════════════════════════════════════════ */
function SortTh({ col, active, dir, onSort, align = "left", children }: {
  col: SortCol; active: SortCol; dir: "asc" | "desc";
  onSort: (c: SortCol) => void; align?: "left" | "right"; children: React.ReactNode;
}) {
  const isA = active === col;
  return (
    <div className={`text-xs font-semibold uppercase tracking-wider cursor-pointer select-none flex items-center gap-1 ${align === "right" ? "justify-end" : ""} ${isA ? "text-amber-600" : "text-slate-500 hover:text-slate-700"}`}
      onClick={() => onSort(col)}>
      {children}
      <span className="text-xs opacity-60">{isA ? (dir === "desc" ? "↓" : "↑") : "↕"}</span>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════════════════════════ */
export default function InventoryAnalyticsPage() {
  const [orgId,   setOrgId]   = useState<string | null>(null);
  const [rows,    setRows]    = useState<InventoryValuationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState("");
  const [tab,     setTab]     = useState<NavTab>("overview");
  const [q,       setQ]       = useState("");
  const [filterStatus, setFilterStatus] = useState<StockHealth | "all">("all");
  const [sortCol, setSortCol] = useState<SortCol>("urgency");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    (async () => {
      try { setOrgId(await bootstrapOrg()); }
      catch (e: any) { setErr(e.message ?? String(e)); setLoading(false); }
    })();
  }, []);

  const fetchData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true); setErr("");
    try {
      const res = await getInventoryValuation(orgId);
      setRows(res.rows);
    } catch (e: any) { setErr(e.message ?? String(e)); }
    finally { setLoading(false); }
  }, [orgId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const enriched = useMemo<Enriched[]>(() =>
    rows.map(r => ({ ...r, urgency: urgencyScore(r), coverage: coverageRatio(r) }))
  , [rows]);

  const totals = useMemo(() => {
    const out      = enriched.filter(r => r.status === "out").length;
    const critical = enriched.filter(r => r.status === "critical").length;
    const low      = enriched.filter(r => r.status === "low").length;
    const ok       = enriched.filter(r => r.status === "ok").length;
    const totalVal = enriched.reduce((s, r) => s + r.total_value, 0);
    const atRiskVal = enriched.filter(r => r.status !== "ok").reduce((s, r) => s + r.total_value, 0);
    const avgCoverage = enriched.length ? enriched.reduce((s, r) => s + r.coverage, 0) / enriched.length : 0;
    return { out, critical, low, ok, totalVal, atRiskVal, avgCoverage, totalQty: enriched.reduce((s, r) => s + r.qty_on_hand, 0) };
  }, [enriched]);

  const categoryData = useMemo(() => {
    const map: Record<string, { name: string; value: number; qty: number; count: number; atRisk: number }> = {};
    enriched.forEach(r => {
      const cat = r.category ?? "Uncategorised";
      if (!map[cat]) map[cat] = { name: cat, value: 0, qty: 0, count: 0, atRisk: 0 };
      map[cat].value += r.total_value;
      map[cat].qty   += r.qty_on_hand;
      map[cat].count++;
      if (r.status !== "ok") map[cat].atRisk++;
    });
    return Object.values(map).sort((a, b) => b.value - a.value);
  }, [enriched]);

  const statusDist = useMemo(() => [
    { label: "Healthy",  value: totals.ok,       color: "#22c55e" },
    { label: "Low",      value: totals.low,       color: "#f59e0b" },
    { label: "Critical", value: totals.critical,  color: "#f97316" },
    { label: "Out",      value: totals.out,       color: "#ef4444" },
  ].filter(d => d.value > 0), [totals]);

  const coverageBuckets = useMemo(() => {
    const b = { "0× (Out)": 0, "< 1×": 0, "1–2×": 0, "2–5×": 0, "5×+": 0 };
    enriched.forEach(r => {
      if (r.qty_on_hand === 0)     b["0× (Out)"]++;
      else if (r.coverage < 1)     b["< 1×"]++;
      else if (r.coverage < 2)     b["1–2×"]++;
      else if (r.coverage < 5)     b["2–5×"]++;
      else                          b["5×+"]++;
    });
    return Object.entries(b).map(([name, count]) => ({ name, count }));
  }, [enriched]);

  const top10ByValue = useMemo(() =>
    [...enriched].sort((a, b) => b.total_value - a.total_value).slice(0, 10)
  , [enriched]);

  const paretoData = useMemo(() => {
    const sorted = [...enriched].sort((a, b) => b.total_value - a.total_value);
    const total  = sorted.reduce((s, r) => s + r.total_value, 0) || 1;
    let cum = 0;
    return sorted.slice(0, 20).map((r, i) => {
      cum += r.total_value;
      return { name: r.name, cumPct: parseFloat(((cum / total) * 100).toFixed(1)), rank: i + 1 };
    });
  }, [enriched]);

  const tableRows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return enriched
      .filter(r => {
        const matchText   = !term || r.name.toLowerCase().includes(term) || (r.sku ?? "").toLowerCase().includes(term) || (r.category ?? "").toLowerCase().includes(term);
        const matchStatus = filterStatus === "all" || r.status === filterStatus;
        return matchText && matchStatus;
      })
      .sort((a, b) => {
        const mul = sortDir === "desc" ? -1 : 1;
        if (sortCol === "urgency")  return mul * (a.urgency - b.urgency);
        if (sortCol === "value")    return mul * (a.total_value - b.total_value);
        if (sortCol === "qty")      return mul * (a.qty_on_hand - b.qty_on_hand);
        if (sortCol === "coverage") return mul * (a.coverage - b.coverage);
        return 0;
      });
  }, [enriched, q, filterStatus, sortCol, sortDir]);

  const insights = useMemo(() => {
    if (!enriched.length) return [];
    const totalVal    = totals.totalVal || 1;
    const top3Val     = top10ByValue.slice(0, 3).reduce((s, r) => s + r.total_value, 0);
    const concPct     = (top3Val / totalVal) * 100;
    const deadStock   = enriched.filter(r => r.qty_on_hand > 0 && r.reorder_level === 0);
    const urgentItems = enriched.filter(r => r.urgency >= 75);
    const highCapLow  = enriched.filter(r => r.unit_price > 500 && r.status !== "ok");
    const bestCat     = [...categoryData].sort((a, b) => b.value - a.value)[0];
    type IType = "critical" | "warning" | "ok" | "neutral";
    return [
      {
        type: totals.out > 0 ? "critical" : "ok" as IType,
        icon: totals.out > 0 ? "🚫" : "✅",
        title: totals.out > 0 ? `${totals.out} product${totals.out > 1 ? "s" : ""} completely out of stock` : "No products are out of stock",
        detail: totals.out > 0 ? "Immediate restocking required. Out-of-stock items are active lost-revenue events." : "All products have stock. Monitor critical and low items proactively.",
      },
      {
        type: urgentItems.length > 0 ? "warning" : "ok" as IType,
        icon: "⏰",
        title: `${urgentItems.length} item${urgentItems.length !== 1 ? "s" : ""} need urgent reorder action`,
        detail: urgentItems.length > 0
          ? `${urgentItems.map(r => r.name).slice(0, 3).join(", ")}${urgentItems.length > 3 ? ` +${urgentItems.length - 3} more` : ""} are at critical or out status.`
          : "All reorder levels are comfortably covered.",
      },
      {
        type: concPct > 60 ? "warning" : "ok" as IType,
        icon: "⚖️",
        title: `Top 3 products hold ${concPct.toFixed(0)}% of inventory value`,
        detail: concPct > 60 ? "High concentration risk — a supply disruption on these items would severely impact operations." : "Inventory value is reasonably spread across the range.",
      },
      {
        type: totals.atRiskVal > totalVal * 0.3 ? "warning" : "ok" as IType,
        icon: "💸",
        title: `${fmtMoney(totals.atRiskVal)} tied up in at-risk stock`,
        detail: `${((totals.atRiskVal / totalVal) * 100).toFixed(1)}% of total inventory value is in products that are low, critical, or out.`,
      },
      {
        type: deadStock.length > 0 ? "warning" : "ok" as IType,
        icon: "💀",
        title: `${deadStock.length} product${deadStock.length !== 1 ? "s" : ""} may be dead stock`,
        detail: deadStock.length > 0
          ? `${deadStock.map(r => r.name).slice(0, 3).join(", ")} have stock but no reorder level set — may be discontinued or forgotten.`
          : "All stocked products have reorder levels configured.",
      },
      {
        type: highCapLow.length > 0 ? "critical" : "ok" as IType,
        icon: "💎",
        title: `${highCapLow.length} high-value item${highCapLow.length !== 1 ? "s" : ""} below healthy stock`,
        detail: highCapLow.length > 0
          ? `${highCapLow.map(r => r.name).slice(0, 2).join(", ")} cost over Ksh 500/unit and are low or critical — high restock cost risk.`
          : "All high-value items are well stocked.",
      },
      {
        type: "neutral" as IType, icon: "📦",
        title: `Highest-value category: ${bestCat?.name ?? "—"}`,
        detail: `${fmtMoney(bestCat?.value ?? 0)} total value across ${bestCat?.count ?? 0} products. Ensure priority restocking agreements.`,
      },
      {
        type: totals.avgCoverage < 2 ? "warning" : "ok" as IType,
        icon: "📊",
        title: `Average stock coverage: ${totals.avgCoverage.toFixed(1)}× reorder level`,
        detail: totals.avgCoverage < 2
          ? "Low average buffer. Most products are close to reorder points — build up safety stock."
          : "Coverage is adequate. Maintain current procurement cadence.",
      },
    ];
  }, [enriched, totals, top10ByValue, categoryData]);

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortCol(col); setSortDir("desc"); }
  };

  if (!orgId && !err) return <Spinner h={200} />;

  return (
    <div className="flex flex-col gap-5">

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Inventory Analytics</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {rows.length} products · {fmtMoney(totals.totalVal)} total value
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Link href="/dashboard/reports" className={S.btnGhost}>← Reports</Link>
          <button className={S.btnGhost} onClick={fetchData} disabled={loading || !orgId}>↻ Refresh</button>
          <button className={S.btnGhost} disabled={!tableRows.length}
            onClick={() => downloadCSV(`inventory_${new Date().toISOString().slice(0,10)}.csv`,
              tableRows.map(r => ({ name: r.name, sku: r.sku ?? "", category: r.category ?? "", qty: r.qty_on_hand, reorder: r.reorder_level, status: r.status, unit_price: r.unit_price, total_value: r.total_value, coverage: r.coverage, urgency: r.urgency })))}>
            ⬇ CSV
          </button>
        </div>
      </div>

      {/* ── Nav ── */}
      <SegControl
        value={tab} onChange={setTab}
        options={[
          { value: "overview",   label: "📊 Overview"   },
          { value: "reorder",    label: "⏰ Reorder"     },
          { value: "valuation",  label: "💰 Valuation"  },
          { value: "insights",   label: "💡 Insights"   },
        ]}
      />

      {/* ── Error ── */}
      {err && (
        <div className={S.alert}>
          <span>⚠️</span><span className="flex-1">{err}</span>
          <button onClick={() => setErr("")} className="ml-auto text-red-400 hover:text-red-600">×</button>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && <Spinner h={200} />}

      {!loading && !err && (
        <>
          {/* ── KPIs ── */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
            <KpiCard label="Total SKUs"     value={String(rows.length)}               sub="tracked products"                    icon="📦" />
            <KpiCard label="Stock Value"    value={fmtMoney(totals.totalVal)}          sub="at cost price"                       icon="💰" variant="success" />
            <KpiCard label="At-Risk Value"  value={fmtMoney(totals.atRiskVal)}         sub={`${((totals.atRiskVal/(totals.totalVal||1))*100).toFixed(0)}% of total`}  icon="⚠️" variant="warning" />
            <KpiCard label="Out of Stock"   value={String(totals.out)}                 sub="needs immediate action"              icon="🚫" variant={totals.out > 0 ? "danger" : "neutral"} />
            <KpiCard label="Low / Critical" value={String(totals.low + totals.critical)} sub="approaching reorder"              icon="📉" variant={totals.low + totals.critical > 0 ? "warning" : "neutral"} />
            <KpiCard label="Avg Coverage"   value={`${totals.avgCoverage.toFixed(1)}×`} sub="vs reorder level"                  icon="🛡️" variant={totals.avgCoverage < 2 ? "warning" : "success"} />
          </div>

          {rows.length === 0 && (
            <div className={`${S.card} py-16 text-center`}>
              <div className="text-4xl mb-3">📭</div>
              <div className="font-semibold text-slate-600">No inventory data found</div>
            </div>
          )}

          {rows.length > 0 && (
            <>
              {/* ═════════════ OVERVIEW ═════════════ */}
              {tab === "overview" && (
                <div className="flex flex-col gap-5">
                  <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                    {/* Status donut */}
                    <Card title="Stock Health Distribution" sub="Hover segments to highlight">
                      <StatusDonut segs={statusDist} />
                    </Card>

                    {/* Coverage buckets */}
                    <Card title="Coverage Buckets" sub="How many × reorder level each product holds">
                      <CoverageBar data={coverageBuckets} />
                    </Card>
                  </div>

                  {/* Category value */}
                  <Card title="Inventory Value by Category" sub="Hover rows for detail">
                    <CategoryValueBars data={categoryData} />
                  </Card>

                  {/* Category risk grid */}
                  <Card title="Category Risk Profile" sub="Percentage of at-risk products per category">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      {categoryData.map((cat, i) => {
                        const riskPct = cat.count > 0 ? (cat.atRisk / cat.count) * 100 : 0;
                        const riskColor = riskPct > 60 ? "border-red-200 bg-red-50" : riskPct > 30 ? "border-orange-200 bg-orange-50" : riskPct > 10 ? "border-amber-200 bg-amber-50" : "border-green-200 bg-green-50";
                        const valColor  = riskPct > 60 ? "text-red-600" : riskPct > 30 ? "text-orange-600" : riskPct > 10 ? "text-amber-600" : "text-green-600";
                        const barColor  = riskPct > 60 ? "#ef4444" : riskPct > 30 ? "#f97316" : riskPct > 10 ? "#f59e0b" : "#22c55e";
                        return (
                          <div key={i} className={`rounded-2xl border p-4 ${riskColor}`}>
                            <div className="text-sm font-bold text-slate-900 mb-1 truncate">{cat.name}</div>
                            <div className={`text-2xl font-bold ${valColor}`}>{riskPct.toFixed(0)}%</div>
                            <div className="text-xs text-slate-500 mb-2">at-risk products</div>
                            <div className="h-1.5 w-full rounded-full bg-white/60 overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${riskPct}%`, background: barColor }} />
                            </div>
                            <div className="text-xs text-slate-400 mt-1.5">{cat.atRisk}/{cat.count} · {fmtMoney(cat.value)}</div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                </div>
              )}

              {/* ═════════════ REORDER ═════════════ */}
              {tab === "reorder" && (
                <div className="flex flex-col gap-5">
                  {/* Filters */}
                  <div className={`${S.card} p-4`}>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="relative flex-1 min-w-[200px]">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
                        <input className={`${S.input} pl-8`} placeholder="Search product / SKU / category…"
                          value={q} onChange={e => setQ(e.target.value)} />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(["all","out","critical","low","ok"] as const).map(s => {
                          const isA = filterStatus === s;
                          const cfg = s !== "all" ? STATUS_CFG[s as StockHealth] : null;
                          return (
                            <button key={s} onClick={() => setFilterStatus(s)}
                              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                                isA ? "bg-white border border-slate-200 shadow-sm text-slate-900" : "border border-slate-200 text-slate-500 hover:text-slate-700 bg-white"
                              }`}>
                              {s === "all" ? "All" : `${cfg?.icon} ${s.charAt(0).toUpperCase()+s.slice(1)}`}
                            </button>
                          );
                        })}
                      </div>
                      <span className="text-xs text-slate-400 whitespace-nowrap">{tableRows.length} of {enriched.length}</span>
                    </div>

                    {/* Active filter pills */}
                    {(q || filterStatus !== "all") && (
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        {q && <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-semibold text-amber-700">
                          "{q}" <button onClick={() => setQ("")} className="hover:text-amber-900">×</button>
                        </span>}
                        {filterStatus !== "all" && <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                          {STATUS_CFG[filterStatus as StockHealth]?.label} <button onClick={() => setFilterStatus("all")} className="hover:text-slate-900">×</button>
                        </span>}
                      </div>
                    )}
                  </div>

                  {/* Reorder table */}
                  <div className={`${S.card} overflow-hidden`}>
                    <div className="grid gap-4 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 bg-slate-50 border-b border-slate-200 hidden sm:grid"
                      style={{ gridTemplateColumns: "2fr 1fr 0.7fr 0.7fr 0.7fr 1fr 1.4fr" }}>
                      <div>Product</div>
                      <div>Category</div>
                      <SortTh col="qty"      active={sortCol} dir={sortDir} onSort={toggleSort} align="right">On Hand</SortTh>
                      <div className="text-right">Reorder At</div>
                      <SortTh col="coverage" active={sortCol} dir={sortDir} onSort={toggleSort} align="right">Coverage</SortTh>
                      <div>Status</div>
                      <SortTh col="urgency"  active={sortCol} dir={sortDir} onSort={toggleSort}>Urgency</SortTh>
                    </div>

                    <div className="divide-y divide-slate-100 max-h-[520px] overflow-y-auto">
                      {tableRows.length === 0
                        ? <div className="py-14 text-center text-sm text-slate-400">No products match this filter.</div>
                        : tableRows.map(r => (
                          <div key={r.product_id}
                            className="grid items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors"
                            style={{ gridTemplateColumns: "2fr 1fr 0.7fr 0.7fr 0.7fr 1fr 1.4fr" }}>
                            <div>
                              <div className="text-sm font-semibold text-slate-900 truncate">{r.name}</div>
                              {r.sku && <div className="text-xs text-slate-400">{r.sku}</div>}
                            </div>
                            <div className="text-sm text-slate-500 truncate">{r.category ?? "—"}</div>
                            <div className={`text-right text-sm font-bold ${r.qty_on_hand === 0 ? "text-red-600" : "text-slate-900"}`}>{r.qty_on_hand}</div>
                            <div className="text-right text-sm text-slate-400">{r.reorder_level}</div>
                            <div className="text-right text-sm font-bold">
                              <span className={r.coverage < 1 ? "text-red-600" : r.coverage < 2 ? "text-amber-600" : "text-green-600"}>
                                {r.coverage >= 99 ? "∞" : `${r.coverage}×`}
                              </span>
                            </div>
                            <div><StatusBadge status={r.status as StockHealth} /></div>
                            <div><UrgencyBar score={r.urgency} /></div>
                          </div>
                        ))
                      }
                    </div>

                    <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 flex justify-between items-center">
                      <span className="text-xs text-slate-400">{tableRows.length} of {enriched.length} products</span>
                      <span className="text-xs text-slate-400">Click column headers to sort</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ═════════════ VALUATION ═════════════ */}
              {tab === "valuation" && (
                <div className="flex flex-col gap-5">
                  <Card title="Top 10 Products by Stock Value" sub="Capital locked in these items · colour = status">
                    <ValueBars data={top10ByValue.map(r => ({ name: r.name, value: r.total_value, status: r.status as StockHealth }))} />
                    <div className="flex flex-wrap gap-4 mt-4 text-xs">
                      {Object.entries(STATUS_CFG).map(([k, v]) => (
                        <span key={k} className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: v.dot }} />{v.label}
                        </span>
                      ))}
                    </div>
                  </Card>

                  <Card title="Pareto — Cumulative Value %" sub="Blue bars = A-items (first 80% of value) · hover for %">
                    <ParetoChart data={paretoData} />
                    <p className="mt-2 text-xs text-slate-400">
                      🔵 Blue bars are the products that make up the first 80% of inventory value (your A-items that need priority attention).
                    </p>
                  </Card>

                  {/* Full valuation table */}
                  <div className={`${S.card} overflow-hidden`}>
                    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                      <div>
                        <div className="font-bold text-slate-900">Full Product Valuation</div>
                        <div className="text-xs text-slate-500 mt-0.5">Sorted by value descending</div>
                      </div>
                      <span className="text-xs text-slate-400">{enriched.length} products</span>
                    </div>
                    <div className="grid gap-4 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 bg-slate-50 border-b border-slate-200 hidden sm:grid"
                      style={{ gridTemplateColumns: "2fr 0.8fr 1fr 1fr 1fr 1fr" }}>
                      <div>Product</div>
                      <div>SKU</div>
                      <div>Category</div>
                      <div className="text-right">Qty</div>
                      <div className="text-right">Unit Price</div>
                      <div className="text-right">Total Value</div>
                    </div>
                    <div className="divide-y divide-slate-100 max-h-[520px] overflow-y-auto">
                      {[...enriched].sort((a, b) => b.total_value - a.total_value).map(r => (
                        <div key={r.product_id}
                          className="grid items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors"
                          style={{ gridTemplateColumns: "2fr 0.8fr 1fr 1fr 1fr 1fr" }}>
                          <div>
                            <div className="text-sm font-semibold text-slate-900 truncate">{r.name}</div>
                            <StatusBadge status={r.status as StockHealth} />
                          </div>
                          <div className="text-xs text-slate-400">{r.sku ?? "—"}</div>
                          <div className="text-sm text-slate-500 truncate">{r.category ?? "—"}</div>
                          <div className="text-right text-sm font-bold text-slate-900">{r.qty_on_hand}</div>
                          <div className="text-right text-sm text-slate-600">{fmtMoney(r.unit_price)}</div>
                          <div className="text-right">
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-900">
                              {fmtMoney(r.total_value)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 flex justify-between">
                      <span className="text-xs text-slate-500">{enriched.length} products</span>
                      <span className="text-sm font-bold text-slate-900">{fmtMoney(totals.totalVal)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ═════════════ INSIGHTS ═════════════ */}
              {tab === "insights" && (
                <div className="flex flex-col gap-5">
                  <p className="text-sm text-slate-500">
                    Automated analysis of <span className="font-semibold text-slate-700">{rows.length} products</span> · {fmtMoney(totals.totalVal)} total inventory value
                  </p>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {insights.map((ins, i) => <InsightCard key={i} {...ins} />)}
                  </div>

                  {/* Action plan */}
                  <Card title="🗂️ Inventory Action Plan" sub="Priority-ordered steps based on your data">
                    <div className="divide-y divide-slate-100">
                      {[
                        {
                          step: "01", priority: "URGENT", color: "bg-red-500",
                          action: "Restock out-of-stock items immediately",
                          detail: totals.out > 0
                            ? `${totals.out} product(s) are generating zero revenue right now. Contact suppliers today.`
                            : "No out-of-stock items currently. Monitor critical items before they hit zero.",
                        },
                        {
                          step: "02", priority: "HIGH", color: "bg-orange-500",
                          action: "Place reorder for critical-level items",
                          detail: totals.critical > 0
                            ? `${totals.critical} item(s) are at critical levels. Place orders now to account for supplier lead times.`
                            : "No critical items. Schedule a weekly reorder review to stay ahead.",
                        },
                        {
                          step: "03", priority: "MEDIUM", color: "bg-amber-500",
                          action: "ABC analysis — protect your top 20% value SKUs",
                          detail: `Your top 3 products hold ${((top10ByValue.slice(0,3).reduce((s,r)=>s+r.total_value,0)/(totals.totalVal||1))*100).toFixed(0)}% of inventory value. These A-items need dedicated safety stock and supplier SLAs.`,
                        },
                        {
                          step: "04", priority: "MEDIUM", color: "bg-amber-500",
                          action: "Investigate dead stock and zero-reorder-level items",
                          detail: "Products with stock but no reorder level may be discontinued or forgotten. Review each — liquidate, bundle-sell, or reactivate.",
                        },
                        {
                          step: "05", priority: "LOW", color: "bg-blue-500",
                          action: "Renegotiate terms for high-value, low-coverage items",
                          detail: "High unit-price items that frequently drop to low/critical represent cash-flow risk. Negotiate consignment or JIT delivery with suppliers.",
                        },
                      ].map((rec, i) => (
                        <div key={i} className="flex gap-4 items-start py-4">
                          <div className="flex flex-col items-center gap-1.5 shrink-0">
                            <div className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold text-white ${rec.color}`}>{rec.step}</div>
                            <span className={`text-[9px] font-bold uppercase tracking-wide ${rec.color.replace("bg-","text-")}`}>{rec.priority}</span>
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-900 mb-0.5">{rec.action}</div>
                            <div className="text-xs text-slate-500 leading-relaxed">{rec.detail}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>

                  {/* Category summary table */}
                  <div className={`${S.card} overflow-hidden`}>
                    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                      <div className="font-bold text-slate-900">Category Summary</div>
                      <span className="text-xs text-slate-400">{categoryData.length} categories</span>
                    </div>
                    <div className="grid gap-4 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 bg-slate-50 border-b border-slate-200 hidden sm:grid"
                      style={{ gridTemplateColumns: "1.5fr 0.6fr 0.6fr 1.2fr 0.8fr 1fr" }}>
                      <div>Category</div>
                      <div className="text-right">Products</div>
                      <div className="text-right">At Risk</div>
                      <div>Risk %</div>
                      <div className="text-right">Total Qty</div>
                      <div className="text-right">Stock Value</div>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {categoryData.map((cat, i) => {
                        const riskPct = cat.count > 0 ? (cat.atRisk / cat.count) * 100 : 0;
                        const barColor = riskPct > 60 ? "#ef4444" : riskPct > 30 ? "#f97316" : riskPct > 0 ? "#f59e0b" : "#22c55e";
                        return (
                          <div key={i} className="grid items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors"
                            style={{ gridTemplateColumns: "1.5fr 0.6fr 0.6fr 1.2fr 0.8fr 1fr" }}>
                            <div className="text-sm font-semibold text-slate-900">{cat.name}</div>
                            <div className="text-right text-sm text-slate-600">{cat.count}</div>
                            <div className="text-right text-sm font-bold" style={{ color: barColor }}>{cat.atRisk}</div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${riskPct}%`, background: barColor }} />
                              </div>
                              <span className="text-xs font-bold w-8 text-right" style={{ color: barColor }}>{riskPct.toFixed(0)}%</span>
                            </div>
                            <div className="text-right text-sm text-slate-600">{cat.qty.toLocaleString()}</div>
                            <div className="text-right">
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-900">{fmtMoney(cat.value)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 flex justify-between">
                      <span className="text-xs text-slate-500">{categoryData.length} categories · {rows.length} products</span>
                      <span className="text-sm font-bold text-slate-900">{fmtMoney(totals.totalVal)}</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

    </div>
  );
}
