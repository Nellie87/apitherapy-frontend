"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import {
  reportExpenses,
  reportPnL,
  type Granularity,
  type DateRange,
} from "@/lib/api/reports";
import * as S from "../page.styles";
import {
  Card,
  EmptyState,
  ErrorBanner,
  InsightCard,
  KpiCard,
  ReportHeader,
  ReportsBackButton,
  SegControl,
  Spinner,
  downloadCSV,
  fmtDate,
  fmtK,
  fmtMoney,
  iso,
} from "../_components/report-ui";

/* ════════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════════ */
function defaultRange(): DateRange {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 29);
  return { from: iso(from), to: iso(to) };
}

const CAT_PALETTE = [
  "#f59e0b",
  "#3b82f6",
  "#8b5cf6",
  "#10b981",
  "#ef4444",
  "#06b6d4",
  "#f97316",
  "#ec4899",
  "#84cc16",
  "#a78bfa",
];

/* ════════════════════════════════════════════════════════════════
   TYPES
════════════════════════════════════════════════════════════════ */
type TrendRow = { period: string; total: number };
type TopCatRow = { category: string; amount: number };
type PnlRow = {
  period: string;
  revenue: number;
  discounts: number;
  cogs: number;
  gross_profit: number;
  expenses: number;
  net_profit: number;
};
type NavTab = "overview" | "expenses" | "pnl";

/* ════════════════════════════════════════════════════════════════
   SVG AREA CHART — Expense trend over time
════════════════════════════════════════════════════════════════ */
function ExpenseTrendChart({
  trend,
  height = 220,
}: {
  trend: TrendRow[];
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const W = 600;
  const H = height;
  const P = { t: 16, r: 16, b: 34, l: 60 };
  const iW = W - P.l - P.r;
  const iH = H - P.t - P.b;

  const maxV = useMemo(() => Math.max(...trend.map((d) => d.total), 1), [trend]);
  const xs = useCallback(
    (i: number) =>
      P.l + (trend.length < 2 ? iW / 2 : (i / (trend.length - 1)) * iW),
    [trend.length, iW]
  );
  const ys = useCallback(
    (v: number) => P.t + iH - (v / maxV) * iH * 0.92,
    [maxV, iH]
  );

  const pathStr = trend
    .map(
      (d, i) => `${i === 0 ? "M" : "L"}${xs(i).toFixed(1)},${ys(Number(d.total)).toFixed(1)}`
    )
    .join(" ");

  const areaStr = trend.length
    ? `${pathStr} L${xs(trend.length - 1).toFixed(1)},${(P.t + iH).toFixed(
        1
      )} L${xs(0).toFixed(1)},${(P.t + iH).toFixed(1)} Z`
    : "";

  const onMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current || trend.length < 2) return;
      const rect = svgRef.current.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width) * W;

      let best = 0;
      let bd = Infinity;

      trend.forEach((_, i) => {
        const d = Math.abs(xs(i) - mx);
        if (d < bd) {
          bd = d;
          best = i;
        }
      });

      setHover(best);
    },
    [trend, xs]
  );

  const grids = [0, 0.25, 0.5, 0.75, 1].map((f) => maxV * f);

  const xLabels = useMemo(() => {
    if (!trend.length) return [];
    const step = Math.max(1, Math.floor(trend.length / 7));
    return trend
      .map((d, i) => ({ d, i }))
      .filter(({ i }) => i % step === 0 || i === trend.length - 1);
  }, [trend]);

  if (!trend.length) {
    return (
      <div
        className="flex items-center justify-center text-sm text-slate-400"
        style={{ height }}
      >
        No data for this period
      </div>
    );
  }

  const hp = hover !== null ? trend[hover] : null;

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
          <linearGradient id="ep-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.03" />
          </linearGradient>
          <filter id="ep-glow">
            <feGaussianBlur stdDeviation="2.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {grids.map((v, i) => (
          <g key={i}>
            <line
              x1={P.l}
              y1={ys(v)}
              x2={W - P.r}
              y2={ys(v)}
              stroke="#f1f5f9"
              strokeWidth="1"
            />
            <text
              x={P.l - 8}
              y={ys(v) + 4}
              textAnchor="end"
              fontSize="9.5"
              fill="#94a3b8"
            >
              {fmtK(v)}
            </text>
          </g>
        ))}

        {hover !== null && (
          <line
            x1={xs(hover)}
            y1={P.t}
            x2={xs(hover)}
            y2={P.t + iH}
            stroke="#cbd5e1"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        )}

        <path d={areaStr} fill="url(#ep-area)" />
        <path
          d={pathStr}
          fill="none"
          stroke="#f59e0b"
          strokeWidth="2.5"
          strokeLinejoin="round"
          filter="url(#ep-glow)"
        />

        {trend.map((_, i) => (
          <circle
            key={i}
            cx={xs(i)}
            cy={ys(trend[i].total)}
            fill={hover === i ? "#fff" : "#f59e0b"}
            stroke="#f59e0b"
            strokeWidth={hover === i ? 2 : 0}
            r={hover === i ? 5 : 2.5}
            style={{ transition: "r 0.1s" }}
          />
        ))}

        {xLabels.map(({ d, i }) => (
          <text
            key={i}
            x={xs(i)}
            y={H - 6}
            textAnchor="middle"
            fontSize="9.5"
            fill={hover === i ? "#475569" : "#94a3b8"}
            fontWeight={hover === i ? "600" : "400"}
          >
            {fmtDate(d.period)}
          </text>
        ))}
      </svg>

      {hover !== null && hp && (
        <div className="pointer-events-none absolute top-2 left-14 z-10 rounded-xl border border-slate-200 bg-white/96 backdrop-blur-sm p-3 shadow-xl text-xs w-44">
          <div className="font-bold text-slate-800 mb-2 pb-1.5 border-b border-slate-100">
            {fmtDate(hp.period)}
          </div>
          <div className="flex justify-between">
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              Expenses
            </span>
            <span className="font-bold text-slate-900">
              {fmtMoney(Number(hp.total))}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   SVG DONUT — Category breakdown
════════════════════════════════════════════════════════════════ */
function CategoryDonut({
  cats,
  total,
}: {
  cats: TopCatRow[];
  total: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const cx = 100;
  const cy = 100;
  const r = 72;
  const ri = 46;

  let angle = -90;

  const slices = cats.slice(0, 8).map((c, i) => {
    const pct = total > 0 ? (c.amount / total) * 100 : 0;
    const deg = (pct / 100) * 360;
    const a1 = (angle * Math.PI) / 180;
    const a2 = ((angle + deg) * Math.PI) / 180;

    const lx1 = cx + r * Math.cos(a1);
    const ly1 = cy + r * Math.sin(a1);
    const lx2 = cx + r * Math.cos(a2);
    const ly2 = cy + r * Math.sin(a2);
    const sx1 = cx + ri * Math.cos(a1);
    const sy1 = cy + ri * Math.sin(a1);
    const sx2 = cx + ri * Math.cos(a2);
    const sy2 = cy + ri * Math.sin(a2);

    const large = deg > 180 ? 1 : 0;

    const path = `M${lx1.toFixed(2)},${ly1.toFixed(2)} A${r},${r} 0 ${large},1 ${lx2.toFixed(
      2
    )},${ly2.toFixed(2)} L${sx2.toFixed(2)},${sy2.toFixed(
      2
    )} A${ri},${ri} 0 ${large},0 ${sx1.toFixed(2)},${sy1.toFixed(2)} Z`;

    angle += deg;

    return {
      path,
      pct,
      color: CAT_PALETTE[i % CAT_PALETTE.length],
      ...c,
    };
  });

  const hov = hover !== null ? slices[hover] : null;

  return (
    <svg
      viewBox="0 0 200 200"
      className="w-full max-w-[200px] mx-auto"
      style={{ height: 200 }}
    >
      {slices.map((s, i) => (
        <path
          key={i}
          d={s.path}
          fill={s.color}
          opacity={hover === null || hover === i ? (hover === i ? 1 : 0.85) : 0.3}
          style={{
            transition: "opacity 0.15s, transform 0.15s",
            transformOrigin: `${cx}px ${cy}px`,
            transform: hover === i ? "scale(1.04)" : "scale(1)",
            cursor: "pointer",
          }}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(null)}
        />
      ))}
      {hov ? (
        <>
          <text
            x={cx}
            y={cy - 6}
            textAnchor="middle"
            fontSize="8"
            fill="#64748b"
            fontWeight="600"
          >
            {hov.category}
          </text>
          <text
            x={cx}
            y={cy + 8}
            textAnchor="middle"
            fontSize="10"
            fill="#0f172a"
            fontWeight="700"
          >
            {hov.pct.toFixed(1)}%
          </text>
        </>
      ) : (
        <text
          x={cx}
          y={cy + 5}
          textAnchor="middle"
          fontSize="9"
          fill="#94a3b8"
        >
          Breakdown
        </text>
      )}
    </svg>
  );
}

/* ════════════════════════════════════════════════════════════════
   SVG P&L WATERFALL
════════════════════════════════════════════════════════════════ */
function PnLWaterfall({
  totals,
}: {
  totals: {
    revenue: number;
    discounts: number;
    cogs: number;
    gross_profit: number;
    expenses: number;
    net_profit: number;
  };
}) {
  const [hover, setHover] = useState<number | null>(null);

  const W = 560;
  const H = 220;
  const P = { t: 20, r: 16, b: 44, l: 64 };
  const iW = W - P.l - P.r;
  const iH = H - P.t - P.b;

  const bars = [
    {
      label: "Revenue",
      value: totals.revenue,
      type: "pos",
      running: totals.revenue,
    },
    {
      label: "Discounts",
      value: -totals.discounts,
      type: "neg",
      running: totals.revenue - totals.discounts,
    },
    {
      label: "COGS",
      value: -totals.cogs,
      type: "neg",
      running: totals.revenue - totals.discounts - totals.cogs,
    },
    {
      label: "Gross Profit",
      value: totals.gross_profit,
      type: "subtotal",
      running: totals.gross_profit,
    },
    {
      label: "Expenses",
      value: -totals.expenses,
      type: "neg",
      running: totals.gross_profit - totals.expenses,
    },
    {
      label: "Net Profit",
      value: totals.net_profit,
      type: totals.net_profit >= 0 ? "final-pos" : "final-neg",
      running: totals.net_profit,
    },
  ];

  const allVals = bars.map((b) => b.running);
  const maxV = Math.max(...allVals, 1);

  const ys = (v: number) => P.t + iH - Math.max(0, (v / maxV) * iH * 0.9);
  const bW = (iW / bars.length) * 0.6;
  const gap = iW / bars.length;

  const grids = [0, 0.25, 0.5, 0.75, 1].map((f) => maxV * f);

  const colorMap: Record<string, string> = {
    pos: "#10b981",
    neg: "#ef4444",
    subtotal: "#3b82f6",
    "final-pos": "#10b981",
    "final-neg": "#ef4444",
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      {grids.map((v, i) => (
        <g key={i}>
          <line
            x1={P.l}
            y1={ys(v)}
            x2={W - P.r}
            y2={ys(v)}
            stroke="#f1f5f9"
            strokeWidth="1"
          />
          <text
            x={P.l - 6}
            y={ys(v) + 4}
            textAnchor="end"
            fontSize="9"
            fill="#94a3b8"
          >
            {fmtK(v)}
          </text>
        </g>
      ))}

      {bars.map((b, i) => {
        const x = P.l + i * gap + (gap - bW) / 2;
        const h = Math.max(3, (Math.abs(b.value) / maxV) * iH * 0.9);
        const y = b.type === "neg" ? ys(b.running + Math.abs(b.value)) : ys(b.running);
        const color = colorMap[b.type];
        const isH = hover === i;

        return (
          <g
            key={i}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            style={{ cursor: "default" }}
          >
            <rect
              x={x}
              y={y}
              width={bW}
              height={h}
              rx="4"
              fill={color}
              opacity={hover === null || isH ? (isH ? 1 : 0.8) : 0.35}
              style={{ transition: "opacity 0.15s" }}
            />
            {i < bars.length - 1 && (
              <line
                x1={x + bW}
                y1={ys(b.running)}
                x2={x + gap}
                y2={ys(b.running)}
                stroke="#cbd5e1"
                strokeWidth="1"
                strokeDasharray="3 2"
              />
            )}
            {isH && (
              <text
                x={x + bW / 2}
                y={y - 6}
                textAnchor="middle"
                fontSize="8.5"
                fill={color}
                fontWeight="700"
              >
                {fmtK(Math.abs(b.value))}
              </text>
            )}
            <text
              x={x + bW / 2}
              y={H - 6}
              textAnchor="middle"
              fontSize="8.5"
              fill={isH ? "#475569" : "#94a3b8"}
              fontWeight={isH ? "700" : "400"}
            >
              {b.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ════════════════════════════════════════════════════════════════
   SVG P&L LINE CHART — Revenue vs Net Profit
════════════════════════════════════════════════════════════════ */
function PnLLineChart({
  rows,
  height = 200,
}: {
  rows: PnlRow[];
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const W = 600;
  const H = height;
  const P = { t: 16, r: 16, b: 34, l: 60 };
  const iW = W - P.l - P.r;
  const iH = H - P.t - P.b;

  const maxV = useMemo(() => Math.max(...rows.map((r) => r.revenue), 1), [rows]);
  const minV = useMemo(() => Math.min(...rows.map((r) => r.net_profit), 0), [rows]);
  const range = maxV - minV || 1;

  const xs = useCallback(
    (i: number) => P.l + (rows.length < 2 ? iW / 2 : (i / (rows.length - 1)) * iW),
    [rows.length, iW]
  );
  const ys = useCallback(
    (v: number) => P.t + iH - ((v - minV) / range) * iH * 0.9,
    [minV, range, iH]
  );

  const revPath = rows
    .map((r, i) => `${i === 0 ? "M" : "L"}${xs(i).toFixed(1)},${ys(r.revenue).toFixed(1)}`)
    .join(" ");
  const netPath = rows
    .map((r, i) => `${i === 0 ? "M" : "L"}${xs(i).toFixed(1)},${ys(r.net_profit).toFixed(1)}`)
    .join(" ");

  const onMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current || rows.length < 2) return;
      const rect = svgRef.current.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width) * W;

      let best = 0;
      let bd = Infinity;

      rows.forEach((_, i) => {
        const d = Math.abs(xs(i) - mx);
        if (d < bd) {
          bd = d;
          best = i;
        }
      });

      setHover(best);
    },
    [rows, xs]
  );

  const xLabels = useMemo(() => {
    if (!rows.length) return [];
    const step = Math.max(1, Math.floor(rows.length / 7));
    return rows
      .map((r, i) => ({ r, i }))
      .filter(({ i }) => i % step === 0 || i === rows.length - 1);
  }, [rows]);

  const grids = [0, 0.25, 0.5, 0.75, 1].map((f) => minV + range * f);

  if (!rows.length) {
    return (
      <div
        className="flex items-center justify-center text-sm text-slate-400"
        style={{ height }}
      >
        No data
      </div>
    );
  }

  const hp = hover !== null ? rows[hover] : null;

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
          <filter id="pl-glow">
            <feGaussianBlur stdDeviation="2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {grids.map((v, i) => (
          <g key={i}>
            <line
              x1={P.l}
              y1={ys(v)}
              x2={W - P.r}
              y2={ys(v)}
              stroke="#f1f5f9"
              strokeWidth="1"
            />
            <text
              x={P.l - 8}
              y={ys(v) + 4}
              textAnchor="end"
              fontSize="9.5"
              fill="#94a3b8"
            >
              {fmtK(v)}
            </text>
          </g>
        ))}

        {minV < 0 && (
          <line
            x1={P.l}
            y1={ys(0)}
            x2={W - P.r}
            y2={ys(0)}
            stroke="#cbd5e1"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
        )}

        {hover !== null && (
          <line
            x1={xs(hover)}
            y1={P.t}
            x2={xs(hover)}
            y2={P.t + iH}
            stroke="#cbd5e1"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        )}

        <path
          d={revPath}
          fill="none"
          stroke="#f59e0b"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d={netPath}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2.5"
          strokeLinejoin="round"
          filter="url(#pl-glow)"
        />

        {rows.map((_, i) => (
          <React.Fragment key={i}>
            <circle
              cx={xs(i)}
              cy={ys(rows[i].revenue)}
              fill={hover === i ? "#fff" : "#f59e0b"}
              stroke="#f59e0b"
              strokeWidth={hover === i ? 2 : 0}
              r={hover === i ? 4.5 : 2}
            />
            <circle
              cx={xs(i)}
              cy={ys(rows[i].net_profit)}
              fill={hover === i ? "#fff" : "#3b82f6"}
              stroke="#3b82f6"
              strokeWidth={hover === i ? 2 : 0}
              r={hover === i ? 4.5 : 2}
            />
          </React.Fragment>
        ))}

        {xLabels.map(({ r, i }) => (
          <text
            key={i}
            x={xs(i)}
            y={H - 6}
            textAnchor="middle"
            fontSize="9.5"
            fill={hover === i ? "#475569" : "#94a3b8"}
            fontWeight={hover === i ? "600" : "400"}
          >
            {fmtDate(r.period)}
          </text>
        ))}
      </svg>

      {hover !== null && hp && (
        <div className="pointer-events-none absolute top-2 left-14 z-10 rounded-xl border border-slate-200 bg-white/96 backdrop-blur-sm p-3 shadow-xl text-xs w-48">
          <div className="font-bold text-slate-800 mb-2 pb-1.5 border-b border-slate-100">
            {fmtDate(hp.period)}
          </div>
          <div className="flex justify-between mb-1">
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              Revenue
            </span>
            <span className="font-bold text-slate-900">{fmtMoney(hp.revenue)}</span>
          </div>
          <div className="flex justify-between mb-1">
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="h-2 w-2 rounded-full bg-green-400" />
              Gross Profit
            </span>
            <span className="font-bold text-green-700">
              {fmtMoney(hp.gross_profit)}
            </span>
          </div>
          <div className="flex justify-between mb-1">
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="h-2 w-2 rounded-full bg-red-400" />
              Expenses
            </span>
            <span className="font-bold text-red-600">{fmtMoney(hp.expenses)}</span>
          </div>
          <div className="flex justify-between pt-1.5 border-t border-slate-100">
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="h-2 w-2 rounded-full bg-blue-400" />
              Net Profit
            </span>
            <span
              className={`font-bold ${hp.net_profit >= 0 ? "text-green-700" : "text-red-600"}`}
            >
              {fmtMoney(hp.net_profit)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   INSIGHT ENGINE
════════════════════════════════════════════════════════════════ */
function buildInsights({
  totalExpenses,
  topCats,
  totals,
  netProfit,
  grossMarginPct,
  netMarginPct,
  expRatioPct,
}: {
  totalExpenses: number;
  topCats: TopCatRow[];
  totals: {
    revenue: number;
    discounts: number;
    cogs: number;
    gross_profit: number;
    expenses: number;
    net_profit: number;
  };
  netProfit: number;
  grossMarginPct: number;
  netMarginPct: number;
  expRatioPct: number;
}) {
  const topCat = topCats[0];
  const catShare =
    totalExpenses > 0 && topCat ? (topCat.amount / totalExpenses) * 100 : 0;

  return [
    {
      type: netProfit >= 0 ? "positive" : "negative",
      icon: netProfit >= 0 ? "✅" : "⚠️",
      title:
        netProfit >= 0
          ? "Business is operating at a net profit"
          : "Business is currently running at a net loss",
      detail:
        netProfit >= 0
          ? `${fmtMoney(netProfit)} net profit recorded in this period.`
          : `${fmtMoney(Math.abs(netProfit))} loss recorded. Review expense pressure and gross margin first.`,
    },
    {
      type: expRatioPct > 40 ? "warning" : "ok",
      icon: "💸",
      title: `Expense ratio is ${expRatioPct.toFixed(1)}% of revenue`,
      detail:
        expRatioPct > 40
          ? "Expenses are taking a heavy share of revenue. Tighten controllable costs."
          : "Expense load is within a healthier range relative to revenue.",
    },
    {
      type: grossMarginPct >= 30 ? "positive" : "warning",
      icon: "📈",
      title: `Gross margin sits at ${grossMarginPct.toFixed(1)}%`,
      detail:
        grossMarginPct >= 30
          ? "Gross profit base looks healthy enough to support operations."
          : "Gross margin is thin. Review pricing, discounts, and cost of goods sold.",
    },
    {
      type: catShare > 50 ? "warning" : "neutral",
      icon: "🧾",
      title: topCat
        ? `${topCat.category} is the largest expense category`
        : "No dominant expense category yet",
      detail: topCat
        ? `${fmtMoney(topCat.amount)} spent there, representing ${catShare.toFixed(
            1
          )}% of tracked expenses.`
        : "Add more expense activity to see category concentration.",
    },
    {
      type: Number(totals.discounts) > 0 ? "neutral" : "ok",
      icon: "🏷️",
      title: `Discounts total ${fmtMoney(Number(totals.discounts))}`,
      detail:
        Number(totals.discounts) > 0
          ? "Discounts are already impacting top-line revenue. Keep them targeted."
          : "No discounts recorded in this period.",
    },
    {
      type: netMarginPct >= 0 ? "positive" : "negative",
      icon: "📊",
      title: `Net margin is ${netMarginPct.toFixed(1)}%`,
      detail:
        netMarginPct >= 0
          ? "You are converting some revenue into retained earnings."
          : "The business is not yet converting revenue into bottom-line profit.",
    },
  ];
}

/* ════════════════════════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════════════════════════ */
export default function ExpensesPnLReportPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [range, setRange] = useState<DateRange>(() => defaultRange());
  const [g, setG] = useState<Granularity>("day");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState<NavTab>("overview");
  const [expenses, setExpenses] =
    useState<Awaited<ReturnType<typeof reportExpenses>> | null>(null);
  const [pnl, setPnl] =
    useState<Awaited<ReturnType<typeof reportPnL>> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setOrgId(await bootstrapOrg());
      } catch (e: any) {
        setErr(e.message ?? String(e));
      }
    })();
  }, []);

  async function load() {
    if (!orgId) return;
    setLoading(true);
    setErr("");

    try {
      const [ex, pl] = await Promise.all([
        reportExpenses(orgId, {
          from: range.from,
          to: range.to,
          granularity: g,
        }),
        reportPnL(orgId, {
          from: range.from,
          to: range.to,
          granularity: g,
        }),
      ]);

      setExpenses(ex);
      setPnl(pl);
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (orgId) load();
  }, [orgId, range.from, range.to, g]);

  const topCats: TopCatRow[] = useMemo(
    () => ((expenses?.top_categories ?? []) as TopCatRow[]).slice(0, 8),
    [expenses]
  );

  const trend: TrendRow[] = (expenses?.trend ?? []) as TrendRow[];
  const pnlRows: PnlRow[] = (
    ((pnl as any)?.points ?? (pnl as any)?.trend ?? []) as PnlRow[]
  );

  const totals = pnl?.totals ?? {
    revenue: 0,
    discounts: 0,
    cogs: 0,
    expenses: 0,
    gross_profit: 0,
    net_profit: 0,
  };

  const totalExpenses = trend.reduce((s, t) => s + Number(t.total ?? 0), 0);
  const netProfit = Number(totals.net_profit ?? 0);
  const grossMarginPct =
    Number(totals.revenue) > 0
      ? (Number(totals.gross_profit) / Number(totals.revenue)) * 100
      : 0;
  const netMarginPct =
    Number(totals.revenue) > 0
      ? (netProfit / Number(totals.revenue)) * 100
      : 0;
  const expRatioPct =
    Number(totals.revenue) > 0
      ? (Number(totals.expenses) / Number(totals.revenue)) * 100
      : 0;

  const QUICK = [
    { label: "7D", days: 7 },
    { label: "30D", days: 29 },
    { label: "90D", days: 89 },
  ];

  function applyQuick(days: number) {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - days);
    setRange({ from: iso(from), to: iso(to) });
  }

  const insights = useMemo(
    () =>
      buildInsights({
        totalExpenses,
        topCats,
        totals: {
          revenue: Number(totals.revenue ?? 0),
          discounts: Number(totals.discounts ?? 0),
          cogs: Number(totals.cogs ?? 0),
          gross_profit: Number(totals.gross_profit ?? 0),
          expenses: Number(totals.expenses ?? 0),
          net_profit: netProfit,
        },
        netProfit,
        grossMarginPct,
        netMarginPct,
        expRatioPct,
      }),
    [totalExpenses, topCats, totals, netProfit, grossMarginPct, netMarginPct, expRatioPct]
  );

  if (!orgId && !err) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner h={80} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ReportHeader
        title="Expenses + P&L"
        subtitle="Expense trends, category breakdown, and profitability snapshot"
        actions={
          <>
            <ReportsBackButton />

            <div className="flex rounded-xl border border-slate-200 bg-white overflow-hidden">
              {QUICK.map((q) => (
                <button
                  key={q.label}
                  onClick={() => applyQuick(q.days)}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors border-r border-slate-200 last:border-r-0"
                >
                  {q.label}
                </button>
              ))}
            </div>

            <input
              className={S.input}
              type="date"
              value={range.from}
              style={{ width: 150 }}
              onChange={(e) =>
                setRange((r) => ({ ...r, from: e.target.value }))
              }
            />

            <input
              className={S.input}
              type="date"
              value={range.to}
              style={{ width: 150 }}
              onChange={(e) =>
                setRange((r) => ({ ...r, to: e.target.value }))
              }
            />

            <select
              className={S.input}
              style={{ width: 120 }}
              value={g}
              onChange={(e) => setG(e.target.value as Granularity)}
            >
              <option value="day">Daily</option>
              <option value="month">Monthly</option>
            </select>

            <button className={S.btnPrimary} onClick={load} disabled={loading}>
              {loading ? "Loading…" : "Refresh"}
            </button>
          </>
        }
      />

      {err && <ErrorBanner message={err} onClose={() => setErr("")} />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Revenue"
          value={loading ? "—" : fmtMoney(Number(totals.revenue ?? 0))}
          sub=""
          icon="💰"
          variant="neutral"
        />
        <KpiCard
          label="Discounts"
          value={loading ? "—" : fmtMoney(Number(totals.discounts ?? 0))}
          sub=""
          icon="🏷️"
          variant="warning"
        />
        <KpiCard
          label="COGS"
          value={loading ? "—" : fmtMoney(Number(totals.cogs ?? 0))}
          sub=""
          icon="📦"
          variant="neutral"
        />
        <KpiCard
          label="Gross Profit"
          value={loading ? "—" : fmtMoney(Number(totals.gross_profit ?? 0))}
          sub={!loading ? `${grossMarginPct.toFixed(1)}% margin` : ""}
          icon="📈"
          variant="success"
        />
        <KpiCard
          label="Expenses"
          value={loading ? "—" : fmtMoney(Number(totals.expenses ?? 0))}
          sub={!loading ? `${expRatioPct.toFixed(1)}% of revenue` : ""}
          icon="💸"
          variant="danger"
        />
        <KpiCard
          label="Net Profit"
          value={loading ? "—" : fmtMoney(netProfit)}
          sub={!loading ? `${netMarginPct.toFixed(1)}% margin` : ""}
          icon={netProfit >= 0 ? "✅" : "⚠️"}
          variant={netProfit >= 0 ? "success" : "danger"}
        />
      </div>

      <SegControl
        value={tab}
        onChange={setTab}
        options={[
          { value: "overview", label: "📊 Overview" },
          { value: "expenses", label: "💸 Expenses" },
          { value: "pnl", label: "📈 P&L" },
        ]}
      />

      {loading && <Spinner h={220} />}

      {!loading && !err && !trend.length && !pnlRows.length && (
        <EmptyState
          icon="📭"
          title="No report data found"
          detail="Try changing the date range or add more transactions first."
        />
      )}

      {!loading && !err && (trend.length > 0 || pnlRows.length > 0) && (
        <>
          {tab === "overview" && (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card
                  title="Expense Trend"
                  sub={`${g === "day" ? "Daily" : "Monthly"} totals`}
                  action={
                    <button
                      onClick={() =>
                        downloadCSV(
                          "expense-trend.csv",
                          trend.map((t) => ({
                            period: t.period,
                            total: t.total,
                          }))
                        )
                      }
                      className={S.btnGhost + " !py-1.5 !text-xs"}
                    >
                      ↓ CSV
                    </button>
                  }
                >
                  {trend.length === 0 ? (
                    <div className="py-10 text-center text-sm text-slate-400">
                      No expense trend data yet.
                    </div>
                  ) : (
                    <ExpenseTrendChart trend={trend} height={220} />
                  )}
                </Card>

                <Card title="Top Categories" sub="Where money went">
                  {topCats.length === 0 ? (
                    <div className="py-10 text-center text-sm text-slate-400">
                      No categories yet.
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row items-start gap-2">
                      <div className="shrink-0 w-full sm:w-[200px]">
                        <CategoryDonut cats={topCats} total={totalExpenses} />
                      </div>

                      <div className="flex-1 w-full space-y-2 pt-1">
                        {topCats.map((c, i) => {
                          const pct =
                            totalExpenses > 0
                              ? (c.amount / totalExpenses) * 100
                              : 0;

                          return (
                            <div key={c.category}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="flex items-center gap-2 text-xs font-semibold text-slate-700 truncate max-w-[160px]">
                                  <span
                                    className="h-2 w-2 rounded-full shrink-0"
                                    style={{
                                      backgroundColor:
                                        CAT_PALETTE[i % CAT_PALETTE.length],
                                    }}
                                  />
                                  {c.category}
                                </span>
                                <span className="text-xs font-bold text-slate-900 ml-2">
                                  {pct.toFixed(0)}%
                                </span>
                              </div>

                              <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${Math.max(2, pct)}%`,
                                    backgroundColor:
                                      CAT_PALETTE[i % CAT_PALETTE.length],
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {topCats.length > 0 && (
                    <div className="border-t border-slate-100 mt-4 pt-3 flex items-center justify-between">
                      <span className="text-xs text-slate-500">Total</span>
                      <span className="text-sm font-bold text-slate-900">
                        {fmtMoney(totalExpenses)}
                      </span>
                    </div>
                  )}
                </Card>
              </div>

              <Card
                title="P&L Waterfall"
                sub="Revenue flow to net profit"
              >
                <PnLWaterfall
                  totals={{
                    revenue: Number(totals.revenue ?? 0),
                    discounts: Number(totals.discounts ?? 0),
                    cogs: Number(totals.cogs ?? 0),
                    gross_profit: Number(totals.gross_profit ?? 0),
                    expenses: Number(totals.expenses ?? 0),
                    net_profit: netProfit,
                  }}
                />
              </Card>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {insights.map((ins, i) => (
                  <InsightCard key={i} {...ins} />
                ))}
              </div>
            </div>
          )}

          {tab === "expenses" && (
            <div className="flex flex-col gap-6">
              <Card
                title="Expense by Period"
                sub={`${trend.length} period${trend.length !== 1 ? "s" : ""}`}
                noPad
                action={
                  <button
                    onClick={() =>
                      downloadCSV(
                        "expenses.csv",
                        trend.map((t) => ({
                          period: t.period,
                          total: t.total,
                        }))
                      )
                    }
                    className={S.btnGhost + " !py-1.5 !text-xs mr-5"}
                  >
                    ↓ CSV
                  </button>
                }
              >
                <div
                  className={`${S.tableHead}`}
                  style={{ gridTemplateColumns: "1fr 1fr 1fr" }}
                >
                  <div>Period</div>
                  <div className="text-right">Total Expenses</div>
                  <div className="text-right">Share</div>
                </div>

                <div className="divide-y divide-slate-100 max-h-[440px] overflow-y-auto">
                  {trend.length === 0 ? (
                    <div className="py-12 text-center text-sm text-slate-400">
                      No expenses in this period.
                    </div>
                  ) : (
                    trend.map((t) => {
                      const pct =
                        totalExpenses > 0 ? (t.total / totalExpenses) * 100 : 0;

                      return (
                        <div
                          key={t.period}
                          className="grid items-center gap-4 px-5 py-3 hover:bg-slate-50 transition-colors"
                          style={{ gridTemplateColumns: "1fr 1fr 1fr" }}
                        >
                          <div className="text-sm font-medium text-slate-700">
                            {fmtDate(t.period)}
                          </div>
                          <div className="text-right text-sm font-bold text-slate-900">
                            {fmtMoney(Number(t.total ?? 0))}
                          </div>
                          <div className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-20 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-amber-400"
                                  style={{ width: `${Math.max(2, pct)}%` }}
                                />
                              </div>
                              <span className="text-xs text-slate-500 w-9 text-right">
                                {pct.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {trend.length > 0 && (
                  <div
                    className="border-t border-slate-200 bg-slate-50 px-5 py-3 grid gap-4"
                    style={{ gridTemplateColumns: "1fr 1fr 1fr" }}
                  >
                    <span className="text-xs font-bold text-slate-700">Total</span>
                    <span className="text-right text-sm font-bold text-slate-900">
                      {fmtMoney(totalExpenses)}
                    </span>
                    <span className="text-right text-xs text-slate-500">100%</span>
                  </div>
                )}
              </Card>

              <Card
                title="Category Breakdown"
                sub={`${topCats.length} categories`}
                noPad
                action={
                  <button
                    onClick={() =>
                      downloadCSV(
                        "categories.csv",
                        topCats.map((c) => ({
                          category: c.category,
                          amount: c.amount,
                        }))
                      )
                    }
                    className={S.btnGhost + " !py-1.5 !text-xs mr-5"}
                  >
                    ↓ CSV
                  </button>
                }
              >
                <div
                  className={`${S.tableHead}`}
                  style={{ gridTemplateColumns: "1fr 1fr 1fr" }}
                >
                  <div>Category</div>
                  <div className="text-right">Amount</div>
                  <div className="text-right">Share</div>
                </div>

                <div className="divide-y divide-slate-100">
                  {topCats.length === 0 ? (
                    <div className="py-10 text-center text-sm text-slate-400">
                      No categories.
                    </div>
                  ) : (
                    topCats.map((c, i) => {
                      const pct =
                        totalExpenses > 0 ? (c.amount / totalExpenses) * 100 : 0;

                      return (
                        <div
                          key={c.category}
                          className="grid items-center gap-4 px-5 py-3 hover:bg-slate-50 transition-colors"
                          style={{ gridTemplateColumns: "1fr 1fr 1fr" }}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full shrink-0"
                              style={{
                                backgroundColor:
                                  CAT_PALETTE[i % CAT_PALETTE.length],
                              }}
                            />
                            <span className="text-sm font-semibold text-slate-800">
                              {c.category}
                            </span>
                          </div>

                          <div className="text-right text-sm font-bold text-slate-900">
                            {fmtMoney(Number(c.amount))}
                          </div>

                          <div className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-20 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${Math.max(2, pct)}%`,
                                    backgroundColor:
                                      CAT_PALETTE[i % CAT_PALETTE.length],
                                  }}
                                />
                              </div>
                              <span className="text-xs text-slate-500 w-9 text-right">
                                {pct.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {topCats.length > 0 && (
                  <div
                    className="border-t border-slate-200 bg-slate-50 px-5 py-3 grid gap-4"
                    style={{ gridTemplateColumns: "1fr 1fr 1fr" }}
                  >
                    <span className="text-xs font-bold text-slate-700">Total</span>
                    <span className="text-right text-sm font-bold text-slate-900">
                      {fmtMoney(totalExpenses)}
                    </span>
                    <span className="text-right text-xs text-slate-500">100%</span>
                  </div>
                )}
              </Card>
            </div>
          )}

          {tab === "pnl" && (
            <div className="flex flex-col gap-6">
              <Card
                title="Revenue vs Net Profit"
                sub="Period by period comparison"
                action={
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-4 rounded-full bg-amber-400 inline-block" />
                      Revenue
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-4 rounded-full bg-blue-500 inline-block" />
                      Net Profit
                    </span>
                  </div>
                }
              >
                {pnlRows.length === 0 ? (
                  <div className="py-10 text-center text-sm text-slate-400">
                    No P&amp;L trend yet.
                  </div>
                ) : (
                  <PnLLineChart rows={pnlRows} height={220} />
                )}
              </Card>

              <Card
                title="P&L by Period"
                sub={`${pnlRows.length} period${pnlRows.length !== 1 ? "s" : ""}`}
                noPad
                action={
                  <button
                    onClick={() => downloadCSV("pnl.csv", pnlRows)}
                    className={S.btnGhost + " !py-1.5 !text-xs mr-5"}
                  >
                    ↓ CSV
                  </button>
                }
              >
                <div className="overflow-x-auto">
                  <div
                    className={`${S.tableHead} min-w-[700px]`}
                    style={{
                      gridTemplateColumns:
                        "1.2fr 1fr 1fr 1fr 1fr 1fr 1fr",
                    }}
                  >
                    <div>Period</div>
                    <div className="text-right">Revenue</div>
                    <div className="text-right">Discounts</div>
                    <div className="text-right">COGS</div>
                    <div className="text-right">Gross Profit</div>
                    <div className="text-right">Expenses</div>
                    <div className="text-right">Net Profit</div>
                  </div>

                  <div className="divide-y divide-slate-100 max-h-[440px] overflow-y-auto min-w-[700px]">
                    {pnlRows.length === 0 ? (
                      <div className="py-12 text-center text-sm text-slate-400">
                        No P&amp;L data in this period.
                      </div>
                    ) : (
                      pnlRows.map((r) => (
                        <div
                          key={r.period}
                          className="grid items-center px-5 py-3 hover:bg-slate-50 transition-colors text-sm min-w-[700px]"
                          style={{
                            gridTemplateColumns:
                              "1.2fr 1fr 1fr 1fr 1fr 1fr 1fr",
                          }}
                        >
                          <div className="font-medium text-slate-700">
                            {fmtDate(r.period)}
                          </div>
                          <div className="text-right font-semibold text-slate-900">
                            {fmtMoney(r.revenue)}
                          </div>
                          <div className="text-right text-amber-600">
                            {fmtMoney(r.discounts)}
                          </div>
                          <div className="text-right text-slate-600">
                            {fmtMoney(r.cogs)}
                          </div>
                          <div className="text-right font-semibold text-green-700">
                            {fmtMoney(r.gross_profit)}
                          </div>
                          <div className="text-right text-red-600">
                            {fmtMoney(r.expenses)}
                          </div>
                          <div
                            className={`text-right font-bold ${r.net_profit >= 0 ? "text-green-700" : "text-red-600"}`}
                          >
                            {fmtMoney(r.net_profit)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {pnlRows.length > 0 && (
                    <div
                      className="border-t border-slate-200 bg-slate-50 grid items-center px-5 py-3 text-sm font-bold text-slate-900 min-w-[700px]"
                      style={{
                        gridTemplateColumns:
                          "1.2fr 1fr 1fr 1fr 1fr 1fr 1fr",
                      }}
                    >
                      <span>Total</span>
                      <span className="text-right">
                        {fmtMoney(Number(totals.revenue))}
                      </span>
                      <span className="text-right text-amber-600">
                        {fmtMoney(Number(totals.discounts))}
                      </span>
                      <span className="text-right">
                        {fmtMoney(Number(totals.cogs))}
                      </span>
                      <span className="text-right text-green-700">
                        {fmtMoney(Number(totals.gross_profit))}
                      </span>
                      <span className="text-right text-red-600">
                        {fmtMoney(Number(totals.expenses))}
                      </span>
                      <span
                        className={`text-right ${netProfit >= 0 ? "text-green-700" : "text-red-600"}`}
                      >
                        {fmtMoney(netProfit)}
                      </span>
                    </div>
                  )}
                </div>
              </Card>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <KpiCard
                  label="Gross Margin"
                  value={`${grossMarginPct.toFixed(1)}%`}
                  sub={`${fmtMoney(Number(totals.gross_profit))} gross profit`}
                  icon="📈"
                  variant={grossMarginPct >= 30 ? "success" : "warning"}
                />
                <KpiCard
                  label="Net Margin"
                  value={`${netMarginPct.toFixed(1)}%`}
                  sub={`${fmtMoney(netProfit)} net profit`}
                  icon={netMarginPct >= 0 ? "✅" : "⚠️"}
                  variant={netMarginPct >= 0 ? "success" : "danger"}
                />
                <KpiCard
                  label="Expense Ratio"
                  value={`${expRatioPct.toFixed(1)}%`}
                  sub="Expenses as % of revenue"
                  icon="💸"
                  variant={expRatioPct <= 40 ? "success" : "danger"}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}