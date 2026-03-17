"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import { supabase } from "@/lib/supabase/client";
import {
  getInventoryValuation,
  reportPnL,
  reportExpenses,
  type InventoryValuationRow,
} from "@/lib/api/reports";

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */
type RangePreset = "today" | "7d" | "30d" | "month" | "custom";

type RecentSale = {
  id: string;
  sale_no: string;
  customer_name: string | null;
  total: number;
  created_at: string;
};

type RecentExpense = {
  id: string;
  category: string;
  amount: number;
  expense_date: string;
  created_at: string;
};

type ActivityItem = {
  id: string;
  type: "sale" | "expense";
  title: string;
  sub: string;
  amount: number;
  at: string;
  href: string;
};

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */
const iso = (d: Date) => d.toISOString().slice(0, 10);

const startOfMonth = (d = new Date()) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));

const fmtMoney = (v: number) =>
  `Ksh ${Number(v || 0).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;

const fmtK = (v: number) => {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return String(Math.round(v));
};

const fmtDateTime = (v: string) => {
  try {
    return new Date(v).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return v;
  }
};

const fmtDateOnly = (v: string) => {
  try {
    return new Date(v).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return v;
  }
};

const fmtRangeLabel = (from: string, to: string) => {
  try {
    const f = new Date(`${from}T00:00:00`);
    const t = new Date(`${to}T00:00:00`);
    const fs = f.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    const ts = t.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    return `${fs} — ${ts}`;
  } catch {
    return `${from} — ${to}`;
  }
};

/* ─────────────────────────────────────────────
   Animated counter
───────────────────────────────────────────── */
function Counter({ to, duration = 600 }: { to: number; duration?: number }) {
  const [v, setV] = useState(0);
  const raf = useRef<number>(0);
  const prevTo = useRef(0);

  useEffect(() => {
    const t0 = performance.now();
    const from = prevTo.current;
    prevTo.current = to;
    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setV(Math.round(from + (to - from) * ease));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [to, duration]);

  return <>{v.toLocaleString("en-KE")}</>;
}

/* ─────────────────────────────────────────────
   Sparkline
───────────────────────────────────────────── */
function Sparkline({ data, color = "#f59e0b", w = 72, h = 32 }: {
  data: number[]; color?: string; w?: number; h?: number;
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const lastPt = pts.split(" ").pop()!.split(",").map(Number);
  return (
    <svg width={w} height={h} style={{ overflow: "visible", flexShrink: 0 }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2"
        strokeLinejoin="round" strokeLinecap="round" opacity="0.7" />
      <circle cx={lastPt[0]} cy={lastPt[1]} r="3" fill={color} />
    </svg>
  );
}

/* ─────────────────────────────────────────────
   Skeleton loader
───────────────────────────────────────────── */
function Skeleton({ w = "100%", h = 20, radius = 8 }: {
  w?: string | number; h?: number; radius?: number;
}) {
  return (
    <div
      style={{
        width: w, height: h, borderRadius: radius,
        background: "linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.4s infinite",
      }}
    />
  );
}

/* ─────────────────────────────────────────────
   KPI Card
───────────────────────────────────────────── */
function KpiCard({
  label, rawValue, sub, icon, variant = "neutral",
  loading, spark, sparkColor, isCurrency = true,
}: {
  label: string; rawValue: number; sub?: string; icon: string;
  variant?: "neutral" | "success" | "warning" | "danger";
  loading?: boolean; spark?: number[]; sparkColor?: string; isCurrency?: boolean;
}) {
  const cfg = {
    neutral: {
      border: "#e2e8f0", bg: "#ffffff",
      val: "#0f172a", sub: "#64748b",
      iconBg: "#f8fafc", iconText: "#475569",
      accent: "#64748b",
    },
    success: {
      border: "#a7f3d0", bg: "#f0fdf4",
      val: "#064e3b", sub: "#059669",
      iconBg: "#d1fae5", iconText: "#047857",
      accent: "#10b981",
    },
    warning: {
      border: "#fcd34d", bg: "#fffbeb",
      val: "#78350f", sub: "#b45309",
      iconBg: "#fef3c7", iconText: "#d97706",
      accent: "#f59e0b",
    },
    danger: {
      border: "#fca5a5", bg: "#fff5f5",
      val: "#7f1d1d", sub: "#dc2626",
      iconBg: "#fee2e2", iconText: "#ef4444",
      accent: "#ef4444",
    },
  }[variant];

  return (
    <div
      className="rounded-2xl p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
      style={{ background: cfg.bg, border: `1.5px solid ${cfg.border}` }}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div
          className="grid h-10 w-10 place-items-center rounded-xl text-lg shrink-0"
          style={{ background: cfg.iconBg }}
        >
          {icon}
        </div>
        {spark && spark.length > 1 && !loading && (
          <Sparkline data={spark} color={sparkColor ?? cfg.accent} />
        )}
      </div>

      <div
        className="text-xs font-bold uppercase tracking-widest mb-1.5"
        style={{ color: cfg.sub }}
      >
        {label}
      </div>

      <div className="text-2xl font-extrabold leading-tight" style={{ color: cfg.val }}>
        {loading ? (
          <Skeleton w="80%" h={28} />
        ) : isCurrency ? (
          <span>Ksh <Counter to={rawValue} /></span>
        ) : (
          <Counter to={rawValue} />
        )}
      </div>

      {sub && (
        <div className="mt-1.5 text-xs font-medium" style={{ color: cfg.sub }}>
          {loading ? <Skeleton w="60%" h={14} /> : sub}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Spinner
───────────────────────────────────────────── */
function Spin({ h = 120 }: { h?: number }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3" style={{ height: h }}>
      <svg className="h-6 w-6 animate-spin text-amber-400" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="12" cy="12" r="10" strokeOpacity="0.2" />
        <path d="M12 2a10 10 0 0110 10" />
      </svg>
      <span className="text-xs text-slate-400 font-medium">Loading…</span>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Card shell
───────────────────────────────────────────── */
function Card({ title, sub, action, children, className = "" }: {
  title: string; sub?: string; action?: React.ReactNode;
  children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden transition-shadow duration-200 hover:shadow-md ${className}`}>
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <div>
          <div className="font-bold text-slate-900 text-base">{title}</div>
          {sub && <div className="text-xs text-slate-400 mt-0.5 font-medium">{sub}</div>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Date Picker Popover
───────────────────────────────────────────── */
function DateRangePicker({
  from, to, onChange, onClose,
}: {
  from: string; to: string;
  onChange: (from: string, to: string) => void;
  onClose: () => void;
}) {
  const [localFrom, setLocalFrom] = useState(from);
  const [localTo, setLocalTo] = useState(to);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const apply = () => {
    if (localFrom && localTo && localFrom <= localTo) {
      onChange(localFrom, localTo);
      onClose();
    }
  };

  const quickPick = (days: number) => {
    const t = new Date();
    const f = new Date(t);
    f.setDate(t.getDate() - days + 1);
    setLocalFrom(iso(f));
    setLocalTo(iso(t));
  };

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-2 z-50 rounded-2xl border border-slate-200 bg-white shadow-2xl p-5 w-80"
      style={{ boxShadow: "0 20px 60px -10px rgba(0,0,0,0.18)" }}
    >
      <div className="font-bold text-slate-800 text-sm mb-4">Custom date range</div>

      {/* Quick picks */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        {[
          { label: "Last 7 days", days: 7 },
          { label: "Last 14 days", days: 14 },
          { label: "Last 30 days", days: 30 },
          { label: "Last 60 days", days: 60 },
          { label: "Last 90 days", days: 90 },
          { label: "Last 6 months", days: 180 },
        ].map(({ label, days }) => (
          <button
            key={days}
            onClick={() => quickPick(days)}
            className="rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700 transition-all"
          >
            {label}
          </button>
        ))}
      </div>

      {/* Date inputs */}
      <div className="flex flex-col gap-3 mb-5">
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">From</label>
          <input
            type="date"
            value={localFrom}
            max={localTo || iso(new Date())}
            onChange={(e) => setLocalFrom(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">To</label>
          <input
            type="date"
            value={localTo}
            min={localFrom}
            max={iso(new Date())}
            onChange={(e) => setLocalTo(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition"
          />
        </div>
      </div>

      {localFrom && localTo && localFrom > localTo && (
        <p className="text-xs text-red-500 font-medium mb-3">Start date must be before end date</p>
      )}

      <div className="flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-50 transition"
        >
          Cancel
        </button>
        <button
          onClick={apply}
          disabled={!localFrom || !localTo || localFrom > localTo}
          className="flex-1 rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          Apply
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Revenue vs Expenses area chart — redesigned
───────────────────────────────────────────── */
function AreaChart({
  points, height = 220, loading,
}: {
  points: { period: string; revenue: number; expenses: number }[];
  height?: number; loading?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const W = 600; const H = height;
  const P = { t: 16, r: 16, b: 36, l: 56 };
  const iW = W - P.l - P.r;
  const iH = H - P.t - P.b;

  const maxV = useMemo(
    () => Math.max(...points.map((p) => Math.max(p.revenue, p.expenses)), 1),
    [points]
  );

  // Round up to nice number for grid
  const niceMax = useMemo(() => {
    const mag = Math.pow(10, Math.floor(Math.log10(maxV)));
    return Math.ceil(maxV / mag) * mag;
  }, [maxV]);

  const xs = useCallback(
    (i: number) => P.l + (points.length < 2 ? iW / 2 : (i / (points.length - 1)) * iW),
    [points.length, iW]
  );
  const ys = useCallback((v: number) => P.t + iH - (v / niceMax) * iH, [niceMax, iH]);

  const linePath = (key: "revenue" | "expenses") =>
    points.map((p, i) => `${i === 0 ? "M" : "L"}${xs(i).toFixed(1)},${ys(p[key]).toFixed(1)}`).join(" ");

  const areaPath = (key: "revenue" | "expenses") =>
    points.length === 0 ? "" :
      `${linePath(key)} L${xs(points.length - 1).toFixed(1)},${(P.t + iH).toFixed(1)} L${xs(0).toFixed(1)},${(P.t + iH).toFixed(1)} Z`;

  const onMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || points.length < 2) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0; let bd = Infinity;
    points.forEach((_, i) => { const d = Math.abs(xs(i) - mx); if (d < bd) { bd = d; best = i; } });
    setHover(best);
  }, [points, xs]);

  const gridCount = 5;
  const gridVals = Array.from({ length: gridCount + 1 }, (_, i) => (niceMax / gridCount) * i);

  const xLabels = useMemo(() => {
    if (!points.length) return [];
    const step = Math.max(1, Math.floor(points.length / 6));
    return points.map((p, i) => ({ p, i })).filter(({ i }) => i % step === 0 || i === points.length - 1);
  }, [points]);

  if (loading) return (
    <div className="px-6 py-4 flex flex-col gap-3">
      {[100, 70, 85, 55, 90].map((w, i) => (
        <Skeleton key={i} w={`${w}%`} h={16} />
      ))}
    </div>
  );

  if (!points.length) {
    return (
      <div className="flex flex-col items-center justify-center text-slate-400 gap-2" style={{ height }}>
        <span className="text-3xl">📭</span>
        <span className="text-sm font-semibold">No data for this period</span>
      </div>
    );
  }

  const hp = hover !== null ? points[hover] : null;
  const net = hp ? hp.revenue - hp.expenses : 0;

  return (
    <div className="relative select-none">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full cursor-crosshair"
        style={{ height }}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="gr-rev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="gr-exp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.02" />
          </linearGradient>
          <filter id="shadow-dot">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.3" />
          </filter>
        </defs>

        {/* Grid lines */}
        {gridVals.map((v, i) => (
          <g key={i}>
            <line
              x1={P.l} y1={ys(v)} x2={W - P.r} y2={ys(v)}
              stroke={i === 0 ? "#e2e8f0" : "#f1f5f9"}
              strokeWidth={i === 0 ? "1.5" : "1"}
            />
            <text x={P.l - 8} y={ys(v) + 4} textAnchor="end" fontSize="10" fill="#94a3b8" fontWeight="600">
              {fmtK(v)}
            </text>
          </g>
        ))}

        {/* Hover crosshair */}
        {hover !== null && (
          <line
            x1={xs(hover)} y1={P.t - 4}
            x2={xs(hover)} y2={P.t + iH}
            stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="4 3"
          />
        )}

        {/* Area fills */}
        <path d={areaPath("expenses")} fill="url(#gr-exp)" />
        <path d={areaPath("revenue")} fill="url(#gr-rev)" />

        {/* Lines */}
        <path d={linePath("expenses")} fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="6 3" strokeLinejoin="round" />
        <path d={linePath("revenue")} fill="none" stroke="#f59e0b" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />

        {/* Revenue dots on hover */}
        {points.map((p, i) => (
          hover === i ? (
            <circle key={i} cx={xs(i)} cy={ys(p.revenue)} r="6"
              fill="#fff" stroke="#f59e0b" strokeWidth="2.5" filter="url(#shadow-dot)" />
          ) : null
        ))}
        {hover !== null && hp && (
          <circle cx={xs(hover)} cy={ys(hp.expenses)} r="5"
            fill="#fff" stroke="#ef4444" strokeWidth="2.5" filter="url(#shadow-dot)" />
        )}

        {/* X-axis labels */}
        {xLabels.map(({ p, i }) => (
          <text
            key={i} x={xs(i)} y={H - 8}
            textAnchor="middle" fontSize="10"
            fill={hover === i ? "#475569" : "#94a3b8"}
            fontWeight={hover === i ? "700" : "500"}
          >
            {p.period.length > 5 ? p.period.slice(5) : p.period}
          </text>
        ))}

        {/* X-axis baseline */}
        <line x1={P.l} y1={P.t + iH} x2={W - P.r} y2={P.t + iH} stroke="#e2e8f0" strokeWidth="1.5" />
      </svg>

      {/* Hover tooltip */}
      {hover !== null && hp && (
        <div
          className="pointer-events-none absolute top-3 left-14 z-10 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl text-sm"
          style={{ width: 176, boxShadow: "0 12px 40px -8px rgba(0,0,0,0.18)" }}
        >
          <div className="font-bold text-slate-700 text-xs mb-3 pb-2 border-b border-slate-100 uppercase tracking-wider">
            {hp.period}
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="flex items-center gap-1.5 text-slate-500 text-xs font-semibold">
              <span className="h-2 w-2 rounded-full bg-amber-400" />Revenue
            </span>
            <span className="font-bold text-slate-900 text-sm">{fmtMoney(hp.revenue)}</span>
          </div>
          <div className="flex justify-between items-center mb-3">
            <span className="flex items-center gap-1.5 text-slate-500 text-xs font-semibold">
              <span className="h-2 w-2 rounded-full bg-red-400" />Expenses
            </span>
            <span className="font-bold text-slate-900 text-sm">{fmtMoney(hp.expenses)}</span>
          </div>
          <div className={`pt-2.5 border-t border-slate-100 flex justify-between items-center font-extrabold ${
            net >= 0 ? "text-emerald-600" : "text-red-500"
          }`}>
            <span className="text-xs uppercase tracking-wider">Net</span>
            <span className="text-sm">{fmtMoney(net)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Stock badge
───────────────────────────────────────────── */
function StockBadge({ status }: { status: InventoryValuationRow["status"] }) {
  if (status === "out")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold bg-red-100 text-red-700 shrink-0">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />Out of stock
      </span>
    );
  if (status === "critical")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold bg-orange-100 text-orange-700 shrink-0">
        <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />Critical
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold bg-amber-100 text-amber-700 shrink-0">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />Low stock
    </span>
  );
}

/* ─────────────────────────────────────────────
   Main Page
───────────────────────────────────────────── */
export default function DashboardPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [preset, setPreset] = useState<RangePreset>("7d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState("");
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const [pnl, setPnl] = useState<Awaited<ReturnType<typeof reportPnL>> | null>(null);
  const [expData, setExpData] = useState<Awaited<ReturnType<typeof reportExpenses>> | null>(null);
  const [inventory, setInventory] = useState<Awaited<ReturnType<typeof getInventoryValuation>> | null>(null);
  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<RecentExpense[]>([]);

  /* ── Date range ── */
  const range = useMemo(() => {
    const to = new Date();
    const from = new Date(to);

    if (preset === "custom" && customFrom && customTo) {
      return {
        from: customFrom,
        to: customTo,
        label: "Custom range",
      };
    }
    if (preset === "today") return { from: iso(to), to: iso(to), label: "Today" };
    if (preset === "7d") {
      from.setDate(to.getDate() - 6);
      return { from: iso(from), to: iso(to), label: "Last 7 days" };
    }
    if (preset === "30d") {
      from.setDate(to.getDate() - 29);
      return { from: iso(from), to: iso(to), label: "Last 30 days" };
    }
    return { from: iso(startOfMonth(to)), to: iso(to), label: "This month" };
  }, [preset, customFrom, customTo]);

  /* ── Bootstrap org ── */
  useEffect(() => {
    (async () => {
      try { const o = await bootstrapOrg(); setOrgId(o); }
      catch (e: any) { setErr(e.message ?? String(e)); }
    })();
  }, []);

  /* ── Load all data ── */
  const loadAll = useCallback(async (isRefresh = false) => {
    if (!orgId) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setErr("");

    try {
      const [pl, inv, ex] = await Promise.all([
        reportPnL(orgId, { from: range.from, to: range.to, granularity: "day" }),
        getInventoryValuation(orgId),
        reportExpenses(orgId, { from: range.from, to: range.to, granularity: "day" }),
      ]);

      const [{ data: sData, error: sErr }, { data: eData, error: eErr }] = await Promise.all([
        supabase
          .from("sales")
          .select("id,sale_no,customer_name,total,created_at")
          .eq("org_id", orgId)
          .order("created_at", { ascending: false })
          .limit(6),
        supabase
          .from("expenses")
          .select("id,category,amount,expense_date,created_at")
          .eq("org_id", orgId)
          .order("created_at", { ascending: false })
          .limit(6),
      ]);

      if (sErr) throw new Error(sErr.message);
      if (eErr) throw new Error(eErr.message);

      setPnl(pl); setInventory(inv); setExpData(ex);
      setRecentSales((sData ?? []) as any);
      setRecentExpenses((eData ?? []) as any);
      setLastRefreshed(new Date());
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orgId, range.from, range.to]);

  useEffect(() => {
    if (orgId) loadAll();
  }, [orgId, range.from, range.to]);

  /* ── Derived values ── */
  const kpis = useMemo(() => ({
    revenue:  Number(pnl?.totals?.revenue ?? 0),
    expenses: Number(pnl?.totals?.expenses ?? 0),
    net:      Number(pnl?.totals?.net_profit ?? 0),
    invValue: Number(inventory?.totals?.total_value ?? 0),
    lowCount: Number(inventory?.totals?.low_count ?? 0),
    outCount: Number(inventory?.totals?.out_count ?? 0),
  }), [pnl, inventory]);

  const areaPoints = useMemo(() => {
    const rM = new Map((pnl?.points ?? []).map((p: any) => [p.period, Number(p.revenue ?? 0)]));
    const eM = new Map((expData?.trend ?? []).map((t: any) => [t.period, Number(t.total ?? 0)]));
    return Array.from(new Set([...rM.keys(), ...eM.keys()]))
      .sort()
      .map((period) => ({ period, revenue: rM.get(period) ?? 0, expenses: eM.get(period) ?? 0 }));
  }, [pnl, expData]);

  const revSpark = useMemo(
    () => (pnl?.points ?? []).slice(-10).map((p: any) => Number(p.revenue ?? 0)),
    [pnl]
  );
  const expSpark = useMemo(
    () => (expData?.trend ?? []).slice(-10).map((t: any) => Number(t.total ?? 0)),
    [expData]
  );

  const alertRows = useMemo(() => {
    const rank = (r: InventoryValuationRow) =>
      r.status === "out" ? 0 : r.status === "critical" ? 1 : 2;
    return (inventory?.rows ?? [])
      .filter((r) => r.status !== "ok")
      .sort((a, b) => rank(a) - rank(b))
      .slice(0, 5);
  }, [inventory]);

  const activity = useMemo<ActivityItem[]>(() => {
    const sales: ActivityItem[] = recentSales.map((s) => ({
      id: `sale-${s.id}`,
      type: "sale",
      title: s.sale_no,
      sub: s.customer_name ?? "Walk-in customer",
      amount: Number(s.total ?? 0),
      at: s.created_at,
      href: `/sales/${s.id}`,
    }));
    const expenses: ActivityItem[] = recentExpenses.map((e) => ({
      id: `expense-${e.id}`,
      type: "expense",
      title: e.category,
      sub: `Expense · ${fmtDateOnly(e.expense_date)}`,
      amount: Number(e.amount ?? 0),
      at: e.created_at,
      href: "/expenses",
    }));
    return [...sales, ...expenses]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 8);
  }, [recentSales, recentExpenses]);

  /* ── Loading state ── */
  if (!orgId && !err) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <svg className="h-6 w-6 animate-spin text-amber-400" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" strokeOpacity="0.2" />
            <path d="M12 2a10 10 0 0110 10" />
          </svg>
          <span className="text-sm font-bold">Starting up…</span>
        </div>
      </div>
    );
  }

  /* ── Render ── */
  return (
    <>
      {/* Shimmer animation keyframes */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-in { animation: fadeIn 0.3s ease forwards; }
      `}</style>

      <div className="flex flex-col gap-5">

        {/* Error banner */}
        {err && (
          <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 fade-in">
            <span className="text-base">⚠️</span>
            <span className="flex-1 font-semibold">{err}</span>
            <button onClick={() => setErr("")} className="text-red-400 hover:text-red-600 text-lg leading-none font-bold">×</button>
          </div>
        )}

        {/* ── Header ── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Dashboard</h1>
            <p className="mt-1 text-sm font-medium text-slate-400">
              {range.label} · {fmtRangeLabel(range.from, range.to)}
              {lastRefreshed && (
                <span className="ml-2 text-slate-300">
                  · Updated {lastRefreshed.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Range selector */}
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1 gap-0.5">
              {(["today", "7d", "30d", "month"] as RangePreset[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPreset(p)}
                  className={`rounded-lg px-3.5 py-2 text-xs font-bold transition-all duration-150 ${
                    preset === p
                      ? "bg-white border border-slate-200 shadow-sm text-slate-900"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {p === "today" ? "Today" : p === "7d" ? "7D" : p === "30d" ? "30D" : "Month"}
                </button>
              ))}
            </div>

            {/* Custom date range button */}
            <div className="relative">
              <button
                onClick={() => setShowDatePicker((v) => !v)}
                className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition-all duration-150 ${
                  preset === "custom"
                    ? "border-amber-400 bg-amber-50 text-amber-700 shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span>📅</span>
                {preset === "custom" ? fmtRangeLabel(customFrom, customTo) : "Custom range"}
              </button>

              {showDatePicker && (
                <DateRangePicker
                  from={customFrom || range.from}
                  to={customTo || range.to}
                  onChange={(f, t) => {
                    setCustomFrom(f);
                    setCustomTo(t);
                    setPreset("custom");
                  }}
                  onClose={() => setShowDatePicker(false)}
                />
              )}
            </div>

            {/* Refresh */}
            {/* <button
              onClick={() => loadAll(true)}
              disabled={loading || refreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-all duration-150"
            >
              <svg
                className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              >
                {refreshing ? (
                  <>
                    <circle cx="12" cy="12" r="10" strokeOpacity="0.2" />
                    <path d="M12 2a10 10 0 0110 10" />
                  </>
                ) : (
                  <path d="M4 4v6h6M20 20v-6h-6M4 10A9 9 0 0114 4.5M20 14a9 9 0 01-10 5.5" strokeLinecap="round" />
                )}
              </svg>
              {refreshing ? "Refreshing…" : "Refresh"}
            </button> */}
          </div>
        </div>

        {/* ── 6 KPI cards ── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <KpiCard
            label="Revenue" rawValue={kpis.revenue} icon="📈"
            loading={loading} spark={revSpark} sparkColor="#f59e0b"
            sub="Sales collected"
          />
          <KpiCard
            label="Net profit" rawValue={kpis.net} icon="💰"
            variant={kpis.net < 0 ? "danger" : "success"}
            loading={loading}
            sub={kpis.net < 0 ? "Loss this period" : "Profit this period"}
          />
          <KpiCard
            label="Expenses" rawValue={kpis.expenses} icon="💸"
            variant="warning" loading={loading}
            spark={expSpark} sparkColor="#f97316"
            sub="Operating spend"
          />
          <KpiCard
            label="Inventory value" rawValue={kpis.invValue} icon="📦"
            loading={loading} sub="Qty × cost price"
          />
          <KpiCard
            label="Low / critical" rawValue={kpis.lowCount} icon="📉"
            variant={kpis.lowCount > 0 ? "warning" : "neutral"}
            loading={loading} isCurrency={false} sub="Need monitoring"
          />
          <KpiCard
            label="Out of stock" rawValue={kpis.outCount} icon="🚫"
            variant={kpis.outCount > 0 ? "danger" : "neutral"}
            loading={loading} isCurrency={false} sub="Need action now"
          />
        </div>

        {/* ── Main row: chart + alerts ── */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_340px]">

          {/* Revenue vs Expenses chart */}
          <Card
            title="Revenue vs Expenses"
            sub={`${range.label} · hover the chart for daily breakdown`}
            action={
              <Link href="/reports" className="text-xs font-bold text-amber-500 hover:text-amber-600 transition-colors">
                Full P&L →
              </Link>
            }
          >
            {/* Legend */}
            <div className="flex items-center gap-6 px-6 pt-5 pb-2">
              <span className="flex items-center gap-2 text-xs font-bold text-slate-600">
                <span className="h-3 w-3 rounded-sm bg-amber-400" />
                Revenue
              </span>
              <span className="flex items-center gap-2 text-xs font-bold text-slate-600">
                <span className="h-3 w-3 rounded-sm bg-red-400 opacity-70" style={{
                  backgroundImage: "repeating-linear-gradient(90deg, #f87171 0, #f87171 4px, transparent 4px, transparent 7px)"
                }} />
                Expenses
              </span>
              {!loading && areaPoints.length > 0 && (
                <span className={`flex items-center gap-2 text-xs font-bold ${kpis.net >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  <span className={`h-3 w-3 rounded-sm ${kpis.net >= 0 ? "bg-emerald-400" : "bg-red-400"}`} />
                  Net: {fmtMoney(kpis.net)}
                </span>
              )}
            </div>

            <div className="px-4 pb-2">
              <AreaChart points={areaPoints} loading={loading} height={220} />
            </div>

            {/* Summary footer */}
            {!loading && areaPoints.length > 0 && (
              <div className="border-t border-slate-100 grid grid-cols-3 divide-x divide-slate-100">
                {[
                  { label: "Total Revenue", value: fmtMoney(kpis.revenue), color: "#0f172a" },
                  { label: "Total Expenses", value: fmtMoney(kpis.expenses), color: "#0f172a" },
                  {
                    label: "Net Profit / Loss",
                    value: fmtMoney(kpis.net),
                    color: kpis.net >= 0 ? "#059669" : "#dc2626",
                  },
                ].map(({ label, value, color }) => (
                  <div key={label} className="px-6 py-4">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</div>
                    <div className="font-extrabold text-base mt-1" style={{ color }}>{value}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Stock alerts */}
          <Card
            title="Needs Attention"
            sub="Low, critical & out-of-stock items"
            action={
              <Link href="/inventory" className="text-xs font-bold text-amber-500 hover:text-amber-600 transition-colors">
                Manage →
              </Link>
            }
          >
            {loading ? (
              <div className="p-5 flex flex-col gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex flex-col gap-2">
                    <Skeleton w="65%" h={16} />
                    <Skeleton w="40%" h={12} />
                  </div>
                ))}
              </div>
            ) : alertRows.length === 0 ? (
              <div className="py-16 text-center">
                <div className="text-4xl mb-3">✅</div>
                <p className="text-sm font-bold text-slate-600">All stocked up</p>
                <p className="text-xs text-slate-400 mt-1">No urgent stock alerts</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {alertRows.map((r) => (
                  <div
                    key={r.product_id}
                    className="flex items-start justify-between gap-3 px-5 py-4 hover:bg-slate-50 transition-colors duration-150"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900 truncate">{r.name}</div>
                      <div className="text-xs text-slate-400 mt-1 font-medium">
                        On hand: <span className="font-extrabold text-slate-700">{r.qty_on_hand}</span>
                        <span className="mx-1.5 text-slate-200">·</span>
                        Reorder at: <span className="font-extrabold text-slate-700">{r.reorder_level}</span>
                      </div>
                      {r.category && (
                        <div className="text-xs text-slate-400 mt-0.5">{r.category}{r.sku ? ` · SKU ${r.sku}` : ""}</div>
                      )}
                    </div>
                    <StockBadge status={r.status} />
                  </div>
                ))}
                <div className="px-5 py-3.5 text-center bg-slate-50">
                  <Link href="/inventory?filter=low" className="text-xs font-bold text-amber-500 hover:text-amber-600 transition-colors">
                    View all alerts →
                  </Link>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* ── Activity feed ── */}
        <Card
          title="Recent Activity"
          sub="Sales and expenses — newest first"
          action={
            <div className="flex items-center gap-4">
              <Link href="/sales" className="text-xs font-bold text-amber-500 hover:text-amber-600 transition-colors">Sales →</Link>
              <Link href="/expenses" className="text-xs font-bold text-amber-500 hover:text-amber-600 transition-colors">Expenses →</Link>
            </div>
          }
        >
          {loading ? (
            <div className="p-5 flex flex-col gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton w={36} h={36} radius={10} />
                  <div className="flex-1 flex flex-col gap-2">
                    <Skeleton w="55%" h={14} />
                    <Skeleton w="35%" h={11} />
                  </div>
                  <Skeleton w={80} h={20} />
                </div>
              ))}
            </div>
          ) : activity.length === 0 ? (
            <div className="py-14 text-center text-sm font-semibold text-slate-400">
              No recent activity.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {activity.map((a) => (
                <Link
                  key={a.id}
                  href={a.href}
                  className={`grid items-center gap-4 px-6 py-4 transition-colors duration-150 ${
                    a.type === "sale" ? "hover:bg-amber-50" : "hover:bg-slate-50"
                  }`}
                  style={{ gridTemplateColumns: "40px 1fr auto" }}
                >
                  <div className={`grid h-10 w-10 place-items-center rounded-xl text-base shrink-0 ${
                    a.type === "sale" ? "bg-amber-100" : "bg-slate-100"
                  }`}>
                    {a.type === "sale" ? "🧾" : "💸"}
                  </div>

                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900 truncate">{a.title}</div>
                    <div className="text-xs font-medium text-slate-400 truncate mt-0.5">{a.sub}</div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className={`text-sm font-extrabold ${
                      a.type === "sale" ? "text-slate-900" : "text-red-500"
                    }`}>
                      {a.type === "expense" ? "−" : "+"}{fmtMoney(a.amount)}
                    </div>
                    <div className="text-xs font-medium text-slate-400 mt-0.5">{fmtDateTime(a.at)}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

      </div>
    </>
  );
}