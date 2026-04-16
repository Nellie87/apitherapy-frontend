"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import { listSales, type SaleRowWithItems } from "@/lib/api/sales";
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
  fmtK,
  fmtMoney,
} from "../_components/report-ui";

/* ════════════════════════════════════════════════════════════════
   TYPES
════════════════════════════════════════════════════════════════ */
type ProductStat = {
  product_id: string;
  name: string;
  qty: number;
  revenue: number;
  appearances: number;
};

type DailyStat = {
  day: string;
  sales_count: number;
  subtotal: number;
  discount_total: number;
  total: number;
};

type WeekdayStat = {
  day: string;
  avg: number;
  count: number;
};

type NavTab = "overview" | "products" | "insights";

/* ════════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════════ */
const toYMD = (s: string) => s.slice(0, 10);

const todayYMD = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
};

const daysAgoYMD = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
};

const fmtShortDate = (ymd: string) => {
  try {
    const [y, m, d] = ymd.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-KE", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return ymd;
  }
};

const WEEKDAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const CAT_PALETTE = [
  "#f59e0b",
  "#3b82f6",
  "#8b5cf6",
  "#10b981",
  "#ef4444",
  "#06b6d4",
  "#f97316",
  "#ec4899",
];

/* ════════════════════════════════════════════════════════════════
   SVG AREA CHART — Revenue vs Discounts
════════════════════════════════════════════════════════════════ */
function AreaChart({
  daily,
  height = 200,
}: {
  daily: DailyStat[];
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const W = 600;
  const H = height;
  const P = { t: 16, r: 16, b: 34, l: 56 };
  const iW = W - P.l - P.r;
  const iH = H - P.t - P.b;

  const maxV = useMemo(() => Math.max(...daily.map((d) => d.total), 1), [daily]);
  const xs = useCallback(
    (i: number) => P.l + (daily.length < 2 ? iW / 2 : (i / (daily.length - 1)) * iW),
    [daily.length, iW]
  );
  const ys = useCallback((v: number) => P.t + iH - (v / maxV) * iH, [maxV, iH]);

  const pathStr = (key: keyof DailyStat) =>
    daily
      .map((d, i) => `${i === 0 ? "M" : "L"}${xs(i).toFixed(1)},${ys(Number(d[key])).toFixed(1)}`)
      .join(" ");

  const areaStr = (key: keyof DailyStat) => {
    if (!daily.length) return "";
    return `${pathStr(key)} L${xs(daily.length - 1).toFixed(1)},${(
      P.t + iH
    ).toFixed(1)} L${xs(0).toFixed(1)},${(P.t + iH).toFixed(1)} Z`;
  };

  const onMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current || daily.length < 2) return;

      const rect = svgRef.current.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width) * W;

      let best = 0;
      let bd = Infinity;

      daily.forEach((_, i) => {
        const d = Math.abs(xs(i) - mx);
        if (d < bd) {
          bd = d;
          best = i;
        }
      });

      setHover(best);
    },
    [daily, xs]
  );

  const grids = [0, 0.25, 0.5, 0.75, 1].map((f) => maxV * f);

  const xLabels = useMemo(() => {
    if (!daily.length) return [];
    const step = Math.max(1, Math.floor(daily.length / 6));
    return daily
      .map((d, i) => ({ d, i }))
      .filter(({ i }) => i % step === 0 || i === daily.length - 1);
  }, [daily]);

  if (!daily.length) {
    return (
      <div
        className="flex items-center justify-center text-sm text-slate-400"
        style={{ height }}
      >
        No data for this period
      </div>
    );
  }

  const hp = hover !== null ? daily[hover] : null;

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
          <linearGradient id="sa-rev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="sa-disc" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.02" />
          </linearGradient>
          <filter id="sa-glow">
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

        <path d={areaStr("discount_total")} fill="url(#sa-disc)" />
        <path d={areaStr("total")} fill="url(#sa-rev)" />
        <path
          d={pathStr("discount_total")}
          fill="none"
          stroke="#ef4444"
          strokeWidth="1.5"
          strokeDasharray="4 3"
          strokeLinejoin="round"
        />
        <path
          d={pathStr("total")}
          fill="none"
          stroke="#f59e0b"
          strokeWidth="2.5"
          strokeLinejoin="round"
          filter="url(#sa-glow)"
        />

        {daily.map((_, i) => (
          <circle
            key={i}
            cx={xs(i)}
            cy={ys(daily[i].total)}
            fill={hover === i ? "#fff" : "#f59e0b"}
            stroke="#f59e0b"
            strokeWidth={hover === i ? 2 : 0}
            r={hover === i ? 5 : 2.5}
            style={{ transition: "r 0.1s" }}
          />
        ))}

        {hover !== null && hp && (
          <circle
            cx={xs(hover)}
            cy={ys(hp.discount_total)}
            r="4.5"
            fill="#fff"
            stroke="#ef4444"
            strokeWidth="2"
          />
        )}

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
            {fmtShortDate(d.day)}
          </text>
        ))}
      </svg>

      {hover !== null && hp && (
        <div className="pointer-events-none absolute top-2 left-14 z-10 rounded-xl border border-slate-200 bg-white/96 backdrop-blur-sm p-3 shadow-xl text-xs w-44">
          <div className="font-bold text-slate-800 mb-2 pb-1.5 border-b border-slate-100">
            {fmtShortDate(hp.day)}
          </div>
          <div className="flex justify-between mb-1">
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              Net Revenue
            </span>
            <span className="font-bold text-slate-900">{fmtMoney(hp.total)}</span>
          </div>
          <div className="flex justify-between mb-1">
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="h-2 w-2 rounded-full bg-slate-300" />
              Gross
            </span>
            <span className="font-bold text-slate-900">
              {fmtMoney(hp.subtotal)}
            </span>
          </div>
          <div className="flex justify-between mb-2">
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="h-2 w-2 rounded-full bg-red-400" />
              Discounts
            </span>
            <span className="font-bold text-red-600">
              {fmtMoney(hp.discount_total)}
            </span>
          </div>
          <div className="pt-1.5 border-t border-slate-100 text-slate-500 flex justify-between">
            <span>Transactions</span>
            <span className="font-bold text-slate-900">{hp.sales_count}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   SVG BAR CHART — Weekday averages
════════════════════════════════════════════════════════════════ */
function WeekdayChart({ data }: { data: WeekdayStat[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const W = 380;
  const H = 160;
  const P = { t: 16, r: 12, b: 32, l: 52 };
  const iW = W - P.l - P.r;
  const iH = H - P.t - P.b;

  const maxV = Math.max(...data.map((d) => d.avg), 1);
  const bW = iW / data.length - 8;
  const maxI = data.reduce((best, d, i) => (d.avg > data[best].avg ? i : best), 0);
  const minI = data.reduce((best, d, i) => {
    if (data[best].avg === 0 || (d.avg > 0 && d.avg < data[best].avg)) return i;
    return best;
  }, 0);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      {[0, 0.5, 1].map((f, i) => {
        const v = maxV * f;
        const y = P.t + iH - (v / maxV) * iH * 0.92;

        return (
          <g key={i}>
            <line
              x1={P.l}
              y1={y}
              x2={W - P.r}
              y2={y}
              stroke="#f1f5f9"
              strokeWidth="1"
            />
            <text
              x={P.l - 6}
              y={y + 4}
              textAnchor="end"
              fontSize="8.5"
              fill="#94a3b8"
            >
              {fmtK(v)}
            </text>
          </g>
        );
      })}

      {data.map((d, i) => {
        const x = P.l + i * (bW + 8) + 4;
        const bH = Math.max(3, (d.avg / maxV) * iH * 0.92);
        const y = P.t + iH - bH;
        const mid = x + bW / 2;
        const isH = hover === i;
        const color =
          i === maxI ? "#f59e0b" : i === minI && d.avg > 0 ? "#ef4444" : "#3b82f6";

        return (
          <g
            key={d.day}
            style={{ cursor: "default" }}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <rect
              x={x}
              y={y}
              width={bW}
              height={bH}
              rx="4"
              fill={color}
              opacity={hover === null || isH ? 0.85 : 0.35}
              style={{ transition: "opacity 0.15s" }}
            />
            {isH && (
              <rect
                x={x - 1}
                y={y - 1}
                width={bW + 2}
                height={bH + 2}
                rx="5"
                fill="none"
                stroke={color}
                strokeWidth="1.5"
              />
            )}
            <text
              x={mid}
              y={P.t + iH + 16}
              textAnchor="middle"
              fontSize="9"
              fill={isH ? "#475569" : "#94a3b8"}
              fontWeight={isH ? "700" : "400"}
            >
              {d.day}
            </text>
            {isH && (
              <text
                x={mid}
                y={y - 5}
                textAnchor="middle"
                fontSize="8.5"
                fill={color}
                fontWeight="700"
              >
                {fmtK(d.avg)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ════════════════════════════════════════════════════════════════
   SVG GROUPED BAR — Gross vs Discount vs Net daily
════════════════════════════════════════════════════════════════ */
function GroupedBarChart({
  daily,
  height = 160,
}: {
  daily: DailyStat[];
  height?: number;
}) {
  const W = 600;
  const H = height;
  const P = { t: 14, r: 12, b: 34, l: 56 };
  const iW = W - P.l - P.r;
  const iH = H - P.t - P.b;

  const maxV = Math.max(...daily.map((d) => d.subtotal), 1);
  const groupW = daily.length > 0 ? iW / daily.length : 0;
  const bW = Math.max(2, groupW / 3 - 2);

  const grids = [0, 0.5, 1].map((f) => maxV * f);

  const xLabels = useMemo(() => {
    if (!daily.length) return [];
    const step = Math.max(1, Math.floor(daily.length / 6));
    return daily
      .map((d, i) => ({ d, i }))
      .filter(({ i }) => i % step === 0 || i === daily.length - 1);
  }, [daily]);

  if (!daily.length) return null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }}>
      {grids.map((v, i) => {
        const y = P.t + iH - (v / maxV) * iH * 0.92;

        return (
          <g key={i}>
            <line
              x1={P.l}
              y1={y}
              x2={W - P.r}
              y2={y}
              stroke="#f1f5f9"
              strokeWidth="1"
            />
            <text
              x={P.l - 6}
              y={y + 4}
              textAnchor="end"
              fontSize="8.5"
              fill="#94a3b8"
            >
              {fmtK(v)}
            </text>
          </g>
        );
      })}

      {daily.map((d, i) => {
        const gx = P.l + i * groupW;
        const vals = [
          { v: d.subtotal, color: "#3b82f6", opacity: 0.65 },
          { v: d.discount_total, color: "#ef4444", opacity: 0.8 },
          { v: d.total, color: "#f59e0b", opacity: 0.9 },
        ];

        return (
          <g key={d.day}>
            {vals.map((b, j) => {
              const bH = Math.max(2, (b.v / maxV) * iH * 0.92);
              const x = gx + j * (bW + 1.5) + 2;
              const y = P.t + iH - bH;

              return (
                <rect
                  key={j}
                  x={x}
                  y={y}
                  width={bW}
                  height={bH}
                  rx="2"
                  fill={b.color}
                  opacity={b.opacity}
                />
              );
            })}
          </g>
        );
      })}

      {xLabels.map(({ d, i }) => {
        const gx = P.l + i * groupW + groupW / 2;
        return (
          <text
            key={i}
            x={gx}
            y={H - 6}
            textAnchor="middle"
            fontSize="9"
            fill="#94a3b8"
          >
            {fmtShortDate(d.day)}
          </text>
        );
      })}
    </svg>
  );
}

/* ════════════════════════════════════════════════════════════════
   HORIZONTAL BAR — Products
════════════════════════════════════════════════════════════════ */
function ProductBar({
  data,
  valueKey,
}: {
  data: ProductStat[];
  valueKey: "revenue" | "qty";
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d[valueKey] as number), 1);

  return (
    <div className="space-y-3">
      {data.slice(0, 10).map((p, i) => {
        const pct = ((p[valueKey] as number) / max) * 100;
        const isH = hover === i;
        const isTop = i === 0;
        const color = isTop ? "#f59e0b" : CAT_PALETTE[(i + 1) % CAT_PALETTE.length];

        return (
          <div
            key={p.product_id}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            className="cursor-default"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 min-w-0">
                {isTop && <span className="text-sm shrink-0">🏆</span>}
                {i === data.length - 1 && data.length > 1 && (
                  <span className="text-sm shrink-0">⚠️</span>
                )}
                <span
                  className={`text-xs font-medium truncate max-w-[200px] transition-colors ${
                    isH ? "text-slate-900" : "text-slate-600"
                  }`}
                >
                  {p.name}
                </span>
              </div>

              <span
                className={`text-xs font-bold ml-2 shrink-0 transition-colors ${
                  isH ? "text-slate-900" : "text-slate-700"
                }`}
              >
                {valueKey === "revenue" ? fmtMoney(p.revenue) : `${p.qty} units`}
              </span>
            </div>

            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.max(1.5, pct)}%`,
                  background: color,
                  opacity: isH ? 1 : 0.7,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   INSIGHT ENGINE
════════════════════════════════════════════════════════════════ */
function buildInsights(
  daily: DailyStat[],
  products: ProductStat[],
  discountRate: number
) {
  if (!daily.length) return [];

  const sorted = [...daily].sort((a, b) => b.total - a.total);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  const mid = Math.floor(daily.length / 2);
  const f1Avg = daily.slice(0, mid).reduce((s, r) => s + r.total, 0) / (mid || 1);
  const f2Avg =
    daily.slice(mid).reduce((s, r) => s + r.total, 0) /
    (daily.length - mid || 1);

  const trendPct = ((f2Avg - f1Avg) / (f1Avg || 1)) * 100;

  const top = [...products].sort((a, b) => b.revenue - a.revenue)[0];
  const bottom = [...products].sort((a, b) => a.revenue - b.revenue)[0];

  const wdMap: Record<string, { total: number; count: number }> = {};
  daily.forEach((r) => {
    const wd = new Date(r.day).toLocaleDateString("en-US", {
      weekday: "short",
    });
    if (!wdMap[wd]) wdMap[wd] = { total: 0, count: 0 };
    wdMap[wd].total += r.total;
    wdMap[wd].count++;
  });

  const wdArr = Object.entries(wdMap).map(([day, v]) => ({
    day,
    avg: v.total / v.count,
  }));

  const bestWd = [...wdArr].sort((a, b) => b.avg - a.avg)[0];
  const worstWd = [...wdArr].sort((a, b) => a.avg - b.avg)[0];

  type IType = "positive" | "negative" | "warning" | "neutral";

  return [
    {
      type: trendPct >= 0 ? "positive" : "negative",
      icon: trendPct >= 0 ? "📈" : "📉",
      title: `Revenue ${trendPct >= 0 ? "up" : "down"} ${Math.abs(trendPct).toFixed(
        1
      )}% vs prior half`,
      detail:
        trendPct >= 0
          ? "Momentum is positive. Push harder on what is already working."
          : "Revenue weakened in the second half of the selected period.",
    },
    {
      type: "positive" as IType,
      icon: "🏆",
      title: `Best day: ${fmtShortDate(best.day)} — ${fmtMoney(best.total)}`,
      detail: `${best.sales_count} transactions. Review what drove that spike and repeat it.`,
    },
    {
      type: "warning" as IType,
      icon: "⚠️",
      title: `Slowest day: ${fmtShortDate(worst.day)} — ${fmtMoney(worst.total)}`,
      detail: `Only ${worst.sales_count} sales. Consider targeted offers on recurring slow days.`,
    },
    ...(top
      ? [
          {
            type: "positive" as IType,
            icon: "⭐",
            title: `Top product: ${top.name}`,
            detail: `${fmtMoney(top.revenue)} revenue · ${top.qty} units. Keep it consistently stocked.`,
          },
        ]
      : []),
    ...(bottom && products.length > 1
      ? [
          {
            type: "negative" as IType,
            icon: "🔻",
            title: `Underperformer: ${bottom.name}`,
            detail: `${fmtMoney(bottom.revenue)} revenue · ${bottom.qty} units. Bundle or reposition it.`,
          },
        ]
      : []),
    {
      type: discountRate > 10 ? "warning" : "neutral",
      icon: "🏷️",
      title: `Discount rate: ${discountRate.toFixed(1)}% of gross`,
      detail:
        discountRate > 10
          ? "Discounting is taking a meaningful bite out of margins."
          : "Discount levels look controlled.",
    },
    ...(bestWd
      ? [
          {
            type: "positive" as IType,
            icon: "📅",
            title: `Strongest weekday: ${bestWd.day}`,
            detail: `${fmtMoney(bestWd.avg)} average revenue. Align staffing and stock for this day.`,
          },
        ]
      : []),
    ...(worstWd
      ? [
          {
            type: "warning" as IType,
            icon: "😴",
            title: `Weakest weekday: ${worstWd.day}`,
            detail: `${fmtMoney(worstWd.avg)} average revenue. Use targeted promotions to lift it.`,
          },
        ]
      : []),
  ];
}

/* ════════════════════════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════════════════════════ */
export default function SalesAnalyticsPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [allSales, setAllSales] = useState<SaleRowWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [rangeDays, setRangeDays] = useState(13);
  const [tab, setTab] = useState<NavTab>("overview");
  const [sortBy, setSortBy] = useState<"revenue" | "qty">("revenue");
  const [showCustom, setShowCustom] = useState(false);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const o = await bootstrapOrg();
        setOrgId(o);
      } catch (e: any) {
        setErr(e.message ?? String(e));
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!orgId) return;

    let live = true;

    (async () => {
      setLoading(true);
      setErr("");

      try {
        const data = await listSales(orgId);
        if (live) setAllSales(data);
      } catch (e: any) {
        if (live) setErr(e.message ?? String(e));
      } finally {
        if (live) setLoading(false);
      }
    })();

    return () => {
      live = false;
    };
  }, [orgId]);

  const { fromDate, toDate } = useMemo(() => {
    if (showCustom && customFrom && customTo && customFrom <= customTo) {
      return { fromDate: customFrom, toDate: customTo };
    }
    return { fromDate: daysAgoYMD(rangeDays), toDate: todayYMD() };
  }, [rangeDays, showCustom, customFrom, customTo]);

  const filteredSales = useMemo(
    () =>
      allSales.filter((s) => {
        const d = toYMD(s.created_at);
        return d >= fromDate && d <= toDate;
      }),
    [allSales, fromDate, toDate]
  );

  const dailyStats = useMemo<DailyStat[]>(() => {
    const map: Record<string, DailyStat> = {};

    filteredSales.forEach((s) => {
      const day = toYMD(s.created_at);
      if (!map[day]) {
        map[day] = {
          day,
          sales_count: 0,
          subtotal: 0,
          discount_total: 0,
          total: 0,
        };
      }

      map[day].sales_count++;
      map[day].subtotal += s.subtotal;
      map[day].discount_total += s.discount_total;
      map[day].total += s.total;
    });

    return Object.values(map).sort((a, b) => a.day.localeCompare(b.day));
  }, [filteredSales]);

  const productStats = useMemo<ProductStat[]>(() => {
    const map: Record<string, ProductStat> = {};

    filteredSales.forEach((s) => {
      (s.sale_items ?? []).forEach((item) => {
        const name = item.products?.name ?? "Unknown";
        const pid = item.product_id;

        if (!map[pid]) {
          map[pid] = {
            product_id: pid,
            name,
            qty: 0,
            revenue: 0,
            appearances: 0,
          };
        }

        map[pid].qty += item.qty;
        map[pid].appearances++;
      });
    });

    filteredSales.forEach((s) => {
      const items = s.sale_items ?? [];
      const totalQ = items.reduce((sum, i) => sum + i.qty, 0);
      if (!totalQ) return;

      items.forEach((item) => {
        if (!map[item.product_id]) return;
        map[item.product_id].revenue += (item.qty / totalQ) * s.total;
      });
    });

    return Object.values(map);
  }, [filteredSales]);

  const totals = useMemo(
    () => ({
      revenue: filteredSales.reduce((s, r) => s + r.total, 0),
      gross: filteredSales.reduce((s, r) => s + r.subtotal, 0),
      discounts: filteredSales.reduce((s, r) => s + r.discount_total, 0),
      sales: filteredSales.length,
      avgDaily: dailyStats.length
        ? filteredSales.reduce((s, r) => s + r.total, 0) / dailyStats.length
        : 0,
    }),
    [filteredSales, dailyStats]
  );

  const discountRate = totals.gross ? (totals.discounts / totals.gross) * 100 : 0;
  const avgBasket = totals.sales ? totals.revenue / totals.sales : 0;

  const weekdayData = useMemo<WeekdayStat[]>(() => {
    const map: Record<string, { total: number; count: number }> = {};

    dailyStats.forEach((r) => {
      const wd = new Date(r.day).toLocaleDateString("en-US", {
        weekday: "short",
      });
      if (!map[wd]) map[wd] = { total: 0, count: 0 };
      map[wd].total += r.total;
      map[wd].count++;
    });

    return WEEKDAY_ORDER.map((d) => ({
      day: d,
      avg: map[d] ? Math.round(map[d].total / map[d].count) : 0,
      count: map[d]?.count ?? 0,
    }));
  }, [dailyStats]);

  const insights = useMemo(
    () => buildInsights(dailyStats, productStats, discountRate),
    [dailyStats, productStats, discountRate]
  );

  const sortedProducts = useMemo(
    () => [...productStats].sort((a, b) => b[sortBy] - a[sortBy]),
    [productStats, sortBy]
  );

  const handleCSV = useCallback(() => {
    downloadCSV(
      `sales-analytics_${fromDate}_to_${toDate}.csv`,
      dailyStats.map((r) => ({
        day: r.day,
        sales_count: r.sales_count,
        subtotal: r.subtotal,
        discount_total: r.discount_total,
        total: r.total,
      }))
    );
  }, [dailyStats, fromDate, toDate]);

  if (!orgId && !err) return <Spinner h={200} />;

  return (
    <div className="flex flex-col gap-6">
      <ReportHeader
        title="Sales Analytics"
        subtitle={`${fromDate} → ${toDate} · ${filteredSales.length} transactions`}
        actions={
          <>
            <ReportsBackButton />
            <button className={S.btnGhost} disabled={!dailyStats.length || loading} onClick={handleCSV}>
              ⬇ CSV
            </button>
          </>
        }
      />

      <Card title="Filters" sub="Choose range and section">
        <div className="flex flex-wrap items-center gap-3">
          <SegControl
            value={showCustom ? "custom" : String(rangeDays)}
            onChange={(v) => {
              if (v === "custom") {
                setShowCustom(true);
              } else {
                setRangeDays(Number(v));
                setShowCustom(false);
              }
            }}
            options={[
              { value: "6", label: "7D" },
              { value: "13", label: "14D" },
              { value: "29", label: "30D" },
              { value: "custom", label: "Custom" },
            ]}
          />

          <SegControl
            value={tab}
            onChange={setTab}
            options={[
              { value: "overview", label: "📊 Overview" },
              { value: "products", label: "📦 Products" },
              { value: "insights", label: "💡 Insights" },
            ]}
          />
        </div>

        {showCustom && (
          <div className="mt-3 flex flex-wrap items-end gap-3 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-500 whitespace-nowrap">
                From
              </label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-500 whitespace-nowrap">
                To
              </label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
              />
            </div>

            <button onClick={() => setShowCustom(false)} className={S.btnGhost}>
              Done
            </button>
          </div>
        )}
      </Card>

      {err && <ErrorBanner message={err} onClose={() => setErr("")} />}

      {loading && <Spinner h={200} />}

      {!loading && !err && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <KpiCard
              label="Net Revenue"
              value={fmtMoney(totals.revenue)}
              sub={`${fmtMoney(totals.avgDaily)}/day avg`}
              icon="💰"
              variant="neutral"
            />
            <KpiCard
              label="Total Sales"
              value={String(totals.sales)}
              sub={`${dailyStats.length} active days`}
              icon="🧾"
              variant="info"
            />
            <KpiCard
              label="Gross Revenue"
              value={fmtMoney(totals.gross)}
              sub="before discounts"
              icon="📊"
              variant="success"
            />
            <KpiCard
              label="Discounts Given"
              value={fmtMoney(totals.discounts)}
              sub={`${discountRate.toFixed(1)}% of gross`}
              icon="🏷️"
              variant="danger"
            />
            <KpiCard
              label="Avg Basket"
              value={fmtMoney(avgBasket)}
              sub="per transaction"
              icon="🛒"
              variant="warning"
            />
          </div>

          {filteredSales.length === 0 && (
            <EmptyState
              icon="📭"
              title="No sales found in this range"
              detail="Try expanding the date range or check back later."
            />
          )}

          {filteredSales.length > 0 && (
            <>
              {tab === "overview" && (
                <div className="flex flex-col gap-6">
                  <Card
                    title="Revenue Trend"
                    sub={`${fromDate} → ${toDate} · hover for details`}
                    action={
                      <div className="flex items-center gap-4 text-xs font-semibold">
                        <span className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                          Net Revenue
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="inline-block w-5 border-t-2 border-dashed border-red-400" />
                          Discounts
                        </span>
                      </div>
                    }
                  >
                    <AreaChart daily={dailyStats} height={210} />
                  </Card>

                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <Card title="Avg Revenue by Weekday" sub="Hover bars · 🟡 Best · 🔴 Slowest">
                      <WeekdayChart data={weekdayData} />
                      <div className="flex gap-4 mt-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                          Best
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                          Slowest
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-blue-400" />
                          Other
                        </span>
                      </div>
                    </Card>

                    <Card title="Daily Transaction Count" sub="Volume over the period">
                      <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                        {[...dailyStats].reverse().map((d) => {
                          const maxS = Math.max(...dailyStats.map((x) => x.sales_count), 1);
                          const pct = (d.sales_count / maxS) * 100;

                          return (
                            <div key={d.day}>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-slate-600 font-medium">
                                  {fmtShortDate(d.day)}
                                </span>
                                <span className="font-bold text-slate-900">
                                  {d.sales_count} sales
                                </span>
                              </div>
                              <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${Math.max(2, pct)}%`,
                                    background: pct >= 85 ? "#f59e0b" : "#3b82f6",
                                    opacity: 0.75,
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  </div>

                  <Card
                    title="Gross vs Discounts vs Net — Daily"
                    sub="Blue = Gross · Red = Discounts · Amber = Net"
                    action={
                      <div className="flex items-center gap-3 text-xs font-semibold">
                        <span className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-blue-400" />
                          Gross
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                          Disc
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                          Net
                        </span>
                      </div>
                    }
                  >
                    <GroupedBarChart daily={dailyStats} height={150} />
                  </Card>
                </div>
              )}

              {tab === "products" && (
                <div className="flex flex-col gap-6">
                  <Card
                    title="Products"
                    sub={`${sortedProducts.length} products tracked`}
                    action={
                      <SegControl
                        value={sortBy}
                        onChange={setSortBy}
                        options={[
                          { value: "revenue", label: "Revenue" },
                          { value: "qty", label: "Units Sold" },
                        ]}
                      />
                    }
                  >
                    <ProductBar data={sortedProducts} valueKey={sortBy} />
                  </Card>

                  <Card title="Full Product Ranking" sub={`${sortedProducts.length} products`} noPad>
                    <div
                      className={`${S.tableHead} hidden sm:grid`}
                      style={{ gridTemplateColumns: "0.5fr 2fr 1fr 1fr 0.8fr" }}
                    >
                      <div>#</div>
                      <div>Product</div>
                      <div className="text-right">Revenue</div>
                      <div className="text-right">Units</div>
                      <div className="text-right">Sales In</div>
                    </div>

                    <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                      {sortedProducts.length === 0 ? (
                        <div className="py-10 text-center text-sm text-slate-400">
                          No product data available.
                        </div>
                      ) : (
                        sortedProducts.map((p, i) => (
                          <div
                            key={p.product_id}
                            className={`grid items-center gap-4 px-5 py-3.5 text-sm transition-colors hover:bg-slate-50 ${
                              i === 0 ? "bg-amber-50/40" : ""
                            }`}
                            style={{ gridTemplateColumns: "0.5fr 2fr 1fr 1fr 0.8fr" }}
                          >
                            <div
                              className={`text-sm font-bold ${
                                i === 0
                                  ? "text-amber-600"
                                  : i === sortedProducts.length - 1
                                    ? "text-red-400"
                                    : "text-slate-400"
                              }`}
                            >
                              {i === 0 ? "🏆" : i === sortedProducts.length - 1 ? "⚠️" : `#${i + 1}`}
                            </div>
                            <div className="font-semibold text-slate-900 truncate">
                              {p.name}
                            </div>
                            <div className="text-right font-bold text-slate-900">
                              {fmtMoney(p.revenue)}
                            </div>
                            <div className="text-right text-slate-600">
                              {p.qty.toLocaleString()}
                            </div>
                            <div className="text-right text-slate-400">
                              {p.appearances}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </Card>
                </div>
              )}

              {tab === "insights" && (
                <div className="flex flex-col gap-6">
                  <p className="text-sm text-slate-500">
                    Data-driven analysis of{" "}
                    <span className="font-semibold text-slate-700">
                      {dailyStats.length} active trading days
                    </span>{" "}
                    — {filteredSales.length} transactions.
                  </p>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {insights.map((ins, i) => (
                      <InsightCard key={i} {...ins} />
                    ))}
                  </div>

                  <Card title="🚀 Action Plan" sub="Steps to grow sales based on your data">
                    <div className="divide-y divide-slate-100">
                      {[
                        {
                          step: "01",
                          action: "Bundle slow movers with top sellers",
                          detail:
                            sortedProducts.length >= 2
                              ? `Pair "${sortedProducts[sortedProducts.length - 1]?.name}" with "${sortedProducts[0]?.name}" to lift basket size.`
                              : "Identify low-revenue items and pair them with stronger performers.",
                        },
                        {
                          step: "02",
                          action: "Run weekday-specific promotions",
                          detail: `${
                            weekdayData.sort((a, b) => a.avg - b.avg)[0]?.day ?? "Slow days"
                          } underperforms most. Use focused promotions there.`,
                        },
                        {
                          step: "03",
                          action: "Create a loyalty programme",
                          detail:
                            "A simple repeat-customer reward system can raise visit frequency and retention.",
                        },
                        {
                          step: "04",
                          action:
                            discountRate > 10
                              ? "Reduce blanket discounts"
                              : "Maintain discount discipline",
                          detail:
                            discountRate > 10
                              ? `At ${discountRate.toFixed(
                                  1
                                )}% of gross, discounting is hurting margin.`
                              : `Your ${discountRate.toFixed(1)}% discount rate looks controlled.`,
                        },
                        {
                          step: "05",
                          action: "Optimise staffing and stock for peak days",
                          detail: `Your strongest weekday is ${
                            weekdayData.sort((a, b) => b.avg - a.avg)[0]?.day ?? "peak days"
                          }. Align stock and staffing around it.`,
                        },
                      ].map((rec, i) => (
                        <div key={i} className="flex gap-4 items-start py-4">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-xs font-bold text-white">
                            {rec.step}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-900 mb-0.5">
                              {rec.action}
                            </div>
                            <div className="text-xs text-slate-500 leading-relaxed">
                              {rec.detail}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card title="Day-by-Day Summary" sub={`${dailyStats.length} days`} noPad>
                    <div
                      className={`${S.tableHead} hidden sm:grid`}
                      style={{ gridTemplateColumns: "1fr 0.8fr 1fr 1fr 1fr" }}
                    >
                      <div>Date</div>
                      <div className="text-right">Txns</div>
                      <div className="text-right">Gross</div>
                      <div className="text-right">Discounts</div>
                      <div className="text-right">Net</div>
                    </div>

                    <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                      {[...dailyStats].reverse().map((r) => (
                        <div
                          key={r.day}
                          className="grid items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors"
                          style={{ gridTemplateColumns: "1fr 0.8fr 1fr 1fr 1fr" }}
                        >
                          <div className="text-sm font-semibold text-slate-900">
                            {fmtShortDate(r.day)}
                          </div>
                          <div className="text-right text-sm text-slate-600">
                            {r.sales_count}
                          </div>
                          <div className="text-right text-sm text-slate-600">
                            {fmtMoney(r.subtotal)}
                          </div>
                          <div className="text-right text-sm text-red-500 font-semibold">
                            −{fmtMoney(r.discount_total)}
                          </div>
                          <div className="text-right text-sm font-bold text-slate-900">
                            {fmtMoney(r.total)}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div
                      className="border-t border-slate-100 bg-slate-50 px-5 py-3 grid"
                      style={{ gridTemplateColumns: "1fr 0.8fr 1fr 1fr 1fr" }}
                    >
                      <div className="text-xs font-bold text-slate-600">Total</div>
                      <div className="text-right text-xs font-bold text-slate-600">
                        {totals.sales}
                      </div>
                      <div className="text-right text-xs font-bold text-slate-600">
                        {fmtMoney(totals.gross)}
                      </div>
                      <div className="text-right text-xs font-bold text-red-500">
                        {fmtMoney(totals.discounts)}
                      </div>
                      <div className="text-right text-xs font-bold text-slate-900">
                        {fmtMoney(totals.revenue)}
                      </div>
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