"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
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

type PaymentStat = {
  method: string;
  count: number;
  revenue: number;
};

type PeriodSummary = {
  label: string;
  from: string;
  to: string;
  sales: number;
  gross: number;
  discounts: number;
  revenue: number;
  avgBasket: number;
  avgDaily: number;
  products: ProductStat[];
  payments: PaymentStat[];
  daily: DailyStat[];
};

type CompareMetric = {
  label: string;
  a: number;
  b: number;
  diff: number;
  pct: number | null;
  money?: boolean;
};

type NavTab = "overview" | "products" | "compare" | "insights";
type SortBy = "revenue" | "qty";

/* ════════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════════ */
const toYMD = (s: string) => s.slice(0, 10);

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

const todayYMD = () => ymd(new Date());

const daysAgoYMD = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return ymd(d);
};

const startOfMonthYMD = (year: number, monthIndex: number) =>
  ymd(new Date(year, monthIndex, 1));

const endOfMonthYMD = (year: number, monthIndex: number) =>
  ymd(new Date(year, monthIndex + 1, 0));

const fmtShortDate = (date: string) => {
  try {
    const [y, m, d] = date.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-KE", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return date;
  }
};

const pctChange = (a: number, b: number) => {
  if (!a && !b) return 0;
  if (!a) return null;
  return ((b - a) / Math.abs(a)) * 100;
};

const fmtPct = (v: number | null) => {
  if (v === null) return "New";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}%`;
};

const fmtValue = (v: number, money?: boolean) =>
  money ? fmtMoney(v) : Number(v || 0).toLocaleString("en-KE");

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

function filterSalesByRange(sales: SaleRowWithItems[], from: string, to: string) {
  return sales.filter((s) => {
    const d = toYMD(s.created_at);
    return d >= from && d <= to;
  });
}

function getProductStats(sales: SaleRowWithItems[]): ProductStat[] {
  const map: Record<string, ProductStat> = {};

  sales.forEach((s) => {
    const items = s.sale_items ?? [];
    const totalQty = items.reduce((sum, item) => sum + Number(item.qty ?? 0), 0);

    items.forEach((item) => {
      const pid = item.product_id;
      const name = item.products?.name ?? "Unknown product";
      const qty = Number(item.qty ?? 0);

      if (!map[pid]) {
        map[pid] = {
          product_id: pid,
          name,
          qty: 0,
          revenue: 0,
          appearances: 0,
        };
      }

      map[pid].qty += qty;
      map[pid].appearances += 1;

      if (totalQty > 0) {
        map[pid].revenue += (qty / totalQty) * Number(s.total ?? 0);
      }
    });
  });

  return Object.values(map);
}

function getDailyStats(sales: SaleRowWithItems[]): DailyStat[] {
  const map: Record<string, DailyStat> = {};

  sales.forEach((s) => {
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

    map[day].sales_count += 1;
    map[day].subtotal += Number(s.subtotal ?? 0);
    map[day].discount_total += Number(s.discount_total ?? 0);
    map[day].total += Number(s.total ?? 0);
  });

  return Object.values(map).sort((a, b) => a.day.localeCompare(b.day));
}

function getPaymentStats(sales: SaleRowWithItems[]): PaymentStat[] {
  const map: Record<string, PaymentStat> = {};

  sales.forEach((s) => {
    const method = String(s.payment_method || "unknown").toLowerCase();

    if (!map[method]) {
      map[method] = {
        method,
        count: 0,
        revenue: 0,
      };
    }

    map[method].count += 1;
    map[method].revenue += Number(s.total ?? 0);
  });

  return Object.values(map).sort((a, b) => b.revenue - a.revenue);
}

function buildPeriodSummary(
  label: string,
  allSales: SaleRowWithItems[],
  from: string,
  to: string
): PeriodSummary {
  const sales = filterSalesByRange(allSales, from, to);
  const daily = getDailyStats(sales);
  const products = getProductStats(sales);
  const payments = getPaymentStats(sales);

  const revenue = sales.reduce((sum, r) => sum + Number(r.total ?? 0), 0);
  const gross = sales.reduce((sum, r) => sum + Number(r.subtotal ?? 0), 0);
  const discounts = sales.reduce((sum, r) => sum + Number(r.discount_total ?? 0), 0);

  return {
    label,
    from,
    to,
    sales: sales.length,
    gross,
    discounts,
    revenue,
    avgBasket: sales.length ? revenue / sales.length : 0,
    avgDaily: daily.length ? revenue / daily.length : 0,
    products,
    payments,
    daily,
  };
}

function buildCompareMetrics(a: PeriodSummary, b: PeriodSummary): CompareMetric[] {
  return [
    {
      label: "Net Revenue",
      a: a.revenue,
      b: b.revenue,
      diff: b.revenue - a.revenue,
      pct: pctChange(a.revenue, b.revenue),
      money: true,
    },
    {
      label: "Gross Revenue",
      a: a.gross,
      b: b.gross,
      diff: b.gross - a.gross,
      pct: pctChange(a.gross, b.gross),
      money: true,
    },
    {
      label: "Total Sales",
      a: a.sales,
      b: b.sales,
      diff: b.sales - a.sales,
      pct: pctChange(a.sales, b.sales),
    },
    {
      label: "Average Basket",
      a: a.avgBasket,
      b: b.avgBasket,
      diff: b.avgBasket - a.avgBasket,
      pct: pctChange(a.avgBasket, b.avgBasket),
      money: true,
    },
    {
      label: "Discounts",
      a: a.discounts,
      b: b.discounts,
      diff: b.discounts - a.discounts,
      pct: pctChange(a.discounts, b.discounts),
      money: true,
    },
  ];
}

/* ════════════════════════════════════════════════════════════════
   CHARTS
════════════════════════════════════════════════════════════════ */
function SimpleLineChart({ daily }: { daily: DailyStat[] }) {
  const W = 600;
  const H = 210;
  const P = { t: 18, r: 18, b: 34, l: 58 };
  const iW = W - P.l - P.r;
  const iH = H - P.t - P.b;

  const maxV = Math.max(...daily.map((d) => d.total), 1);

  const x = (i: number) =>
    P.l + (daily.length < 2 ? iW / 2 : (i / (daily.length - 1)) * iW);
  const y = (v: number) => P.t + iH - (v / maxV) * iH;

  const path = daily
    .map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d.total)}`)
    .join(" ");

  const area = daily.length
    ? `${path} L${x(daily.length - 1)},${P.t + iH} L${x(0)},${P.t + iH} Z`
    : "";

  const grids = [0, 0.25, 0.5, 0.75, 1].map((f) => maxV * f);

  const labels = useMemo(() => {
    if (!daily.length) return [];
    const step = Math.max(1, Math.floor(daily.length / 6));
    return daily
      .map((d, i) => ({ d, i }))
      .filter(({ i }) => i % step === 0 || i === daily.length - 1);
  }, [daily]);

  if (!daily.length) {
    return (
      <div className="flex h-52 items-center justify-center text-sm text-slate-400">
        No chart data for this range
      </div>
    );
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      <defs>
        <linearGradient id="salesArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {grids.map((v, i) => (
        <g key={i}>
          <line
            x1={P.l}
            x2={W - P.r}
            y1={y(v)}
            y2={y(v)}
            stroke="#f1f5f9"
          />
          <text
            x={P.l - 8}
            y={y(v) + 4}
            textAnchor="end"
            fontSize="9"
            fill="#94a3b8"
          >
            {fmtK(v)}
          </text>
        </g>
      ))}

      <path d={area} fill="url(#salesArea)" />
      <path d={path} fill="none" stroke="#f59e0b" strokeWidth="2.5" />

      {daily.map((d, i) => (
        <circle key={d.day} cx={x(i)} cy={y(d.total)} r="3" fill="#f59e0b" />
      ))}

      {labels.map(({ d, i }) => (
        <text
          key={d.day}
          x={x(i)}
          y={H - 8}
          textAnchor="middle"
          fontSize="9"
          fill="#94a3b8"
        >
          {fmtShortDate(d.day)}
        </text>
      ))}
    </svg>
  );
}

function ProductBar({ data, valueKey }: { data: ProductStat[]; valueKey: SortBy }) {
  const max = Math.max(...data.map((d) => Number(d[valueKey] ?? 0)), 1);

  if (!data.length) {
    return (
      <div className="py-12 text-center text-sm text-slate-400">
        No product data available.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.slice(0, 10).map((p, i) => {
        const value = Number(p[valueKey] ?? 0);
        const pct = (value / max) * 100;
        const color = i === 0 ? "#f59e0b" : CAT_PALETTE[i % CAT_PALETTE.length];

        return (
          <div key={p.product_id}>
            <div className="mb-1 flex items-center justify-between gap-3">
              <span className="truncate text-xs font-semibold text-slate-700">
                {i === 0 ? "🏆 " : ""}
                {p.name}
              </span>
              <span className="shrink-0 text-xs font-bold text-slate-900">
                {valueKey === "revenue" ? fmtMoney(p.revenue) : `${p.qty} units`}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(2, pct)}%`,
                  background: color,
                  opacity: 0.8,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CompareBars({ metrics }: { metrics: CompareMetric[] }) {
  return (
    <div className="space-y-4">
      {metrics.map((m) => {
        const max = Math.max(Math.abs(m.a), Math.abs(m.b), 1);
        const aPct = (Math.abs(m.a) / max) * 100;
        const bPct = (Math.abs(m.b) / max) * 100;
        const positive = m.diff >= 0;

        return (
          <div key={m.label} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-slate-900">{m.label}</div>
                <div className="mt-0.5 text-xs text-slate-400">
                  Period A vs Period B
                </div>
              </div>

              <div
                className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                  positive
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}
              >
                {positive ? "+" : ""}
                {fmtValue(m.diff, m.money)} · {fmtPct(m.pct)}
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-slate-500">Period A</span>
                  <span className="font-bold text-slate-700">
                    {fmtValue(m.a, m.money)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-slate-400"
                    style={{ width: `${Math.max(2, aPct)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-slate-500">Period B</span>
                  <span className="font-bold text-slate-900">
                    {fmtValue(m.b, m.money)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-amber-500"
                    style={{ width: `${Math.max(2, bPct)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   INSIGHTS
════════════════════════════════════════════════════════════════ */
function buildInsights(summary: PeriodSummary) {
  if (!summary.daily.length) return [];

  const sortedDays = [...summary.daily].sort((a, b) => b.total - a.total);
  const best = sortedDays[0];
  const worst = sortedDays[sortedDays.length - 1];

  const sortedProducts = [...summary.products].sort((a, b) => b.revenue - a.revenue);
  const top = sortedProducts[0];
  const bottom = sortedProducts[sortedProducts.length - 1];

  const discountRate = summary.gross ? (summary.discounts / summary.gross) * 100 : 0;

  const midpoint = Math.floor(summary.daily.length / 2);
  const firstHalf =
    summary.daily.slice(0, midpoint).reduce((sum, d) => sum + d.total, 0) /
    (midpoint || 1);
  const secondHalf =
    summary.daily.slice(midpoint).reduce((sum, d) => sum + d.total, 0) /
    (summary.daily.length - midpoint || 1);
  const trend = pctChange(firstHalf, secondHalf) ?? 0;

  const weekdayMap: Record<string, { total: number; count: number }> = {};
  summary.daily.forEach((d) => {
    const wd = new Date(d.day).toLocaleDateString("en-US", { weekday: "short" });
    if (!weekdayMap[wd]) weekdayMap[wd] = { total: 0, count: 0 };
    weekdayMap[wd].total += d.total;
    weekdayMap[wd].count += 1;
  });

  const weekdays = Object.entries(weekdayMap).map(([day, v]) => ({
    day,
    avg: v.total / v.count,
  }));

  const bestWeekday = [...weekdays].sort((a, b) => b.avg - a.avg)[0];
  const worstWeekday = [...weekdays].sort((a, b) => a.avg - b.avg)[0];

  return [
    {
      type: trend >= 0 ? "positive" : "negative",
      icon: trend >= 0 ? "📈" : "📉",
      title: `Revenue ${trend >= 0 ? "improved" : "dropped"} ${Math.abs(
        trend
      ).toFixed(1)}% in the second half`,
      detail:
        trend >= 0
          ? "Sales momentum improved within the selected range."
          : "Sales momentum weakened. Check stock, pricing, promotions, or foot traffic.",
    },
    {
      type: "positive",
      icon: "🏆",
      title: `Best day: ${fmtShortDate(best.day)} — ${fmtMoney(best.total)}`,
      detail: `${best.sales_count} transactions were recorded on this day.`,
    },
    {
      type: "warning",
      icon: "⚠️",
      title: `Slowest day: ${fmtShortDate(worst.day)} — ${fmtMoney(worst.total)}`,
      detail: `Only ${worst.sales_count} transactions. Consider promotions around similar low days.`,
    },
    ...(top
      ? [
          {
            type: "positive",
            icon: "⭐",
            title: `Top product: ${top.name}`,
            detail: `${fmtMoney(top.revenue)} estimated revenue · ${top.qty} units sold.`,
          },
        ]
      : []),
    ...(bottom && sortedProducts.length > 1
      ? [
          {
            type: "negative",
            icon: "🔻",
            title: `Weak product: ${bottom.name}`,
            detail: `${fmtMoney(bottom.revenue)} estimated revenue · ${bottom.qty} units sold.`,
          },
        ]
      : []),
    {
      type: discountRate > 10 ? "warning" : "neutral",
      icon: "🏷️",
      title: `Discount rate: ${discountRate.toFixed(1)}% of gross`,
      detail:
        discountRate > 10
          ? "Discounts are taking a noticeable amount from revenue."
          : "Discount levels look controlled.",
    },
    ...(bestWeekday
      ? [
          {
            type: "positive",
            icon: "📅",
            title: `Strongest weekday: ${bestWeekday.day}`,
            detail: `${fmtMoney(bestWeekday.avg)} average daily revenue.`,
          },
        ]
      : []),
    ...(worstWeekday
      ? [
          {
            type: "warning",
            icon: "😴",
            title: `Weakest weekday: ${worstWeekday.day}`,
            detail: `${fmtMoney(worstWeekday.avg)} average daily revenue.`,
          },
        ]
      : []),
  ] as any[];
}

/* ════════════════════════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════════════════════════ */
export default function SalesAnalyticsPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [allSales, setAllSales] = useState<SaleRowWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [rangeDays, setRangeDays] = useState(29);
  const [tab, setTab] = useState<NavTab>("overview");
  const [sortBy, setSortBy] = useState<SortBy>("revenue");

  const [showCustom, setShowCustom] = useState(false);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const now = new Date();
  const currentYear = now.getFullYear();

  const [compareAFrom, setCompareAFrom] = useState(
    startOfMonthYMD(currentYear - 1, 0)
  );
  const [compareATo, setCompareATo] = useState(endOfMonthYMD(currentYear - 1, 0));
  const [compareBFrom, setCompareBFrom] = useState(startOfMonthYMD(currentYear, 0));
  const [compareBTo, setCompareBTo] = useState(endOfMonthYMD(currentYear, 0));

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

    return {
      fromDate: daysAgoYMD(rangeDays),
      toDate: todayYMD(),
    };
  }, [rangeDays, showCustom, customFrom, customTo]);

  const currentSummary = useMemo(
    () => buildPeriodSummary("Selected Period", allSales, fromDate, toDate),
    [allSales, fromDate, toDate]
  );

  const compareA = useMemo(
    () => buildPeriodSummary("Period A", allSales, compareAFrom, compareATo),
    [allSales, compareAFrom, compareATo]
  );

  const compareB = useMemo(
    () => buildPeriodSummary("Period B", allSales, compareBFrom, compareBTo),
    [allSales, compareBFrom, compareBTo]
  );

  const compareMetrics = useMemo(
    () => buildCompareMetrics(compareA, compareB),
    [compareA, compareB]
  );

  const sortedProducts = useMemo(
    () =>
      [...currentSummary.products].sort((a, b) =>
        sortBy === "revenue" ? b.revenue - a.revenue : b.qty - a.qty
      ),
    [currentSummary.products, sortBy]
  );

  const insights = useMemo(() => buildInsights(currentSummary), [currentSummary]);

  const discountRate = currentSummary.gross
    ? (currentSummary.discounts / currentSummary.gross) * 100
    : 0;

  const handleCSV = useCallback(() => {
    if (tab === "compare") {
      downloadCSV(
        `sales-comparison_${compareAFrom}_to_${compareATo}_vs_${compareBFrom}_to_${compareBTo}.csv`,
        compareMetrics.map((m) => ({
          metric: m.label,
          period_a: m.a,
          period_b: m.b,
          difference: m.diff,
          percent_change: m.pct,
        }))
      );
      return;
    }

    downloadCSV(
      `sales-analytics_${fromDate}_to_${toDate}.csv`,
      currentSummary.daily.map((r) => ({
        day: r.day,
        sales_count: r.sales_count,
        subtotal: r.subtotal,
        discount_total: r.discount_total,
        total: r.total,
      }))
    );
  }, [
    tab,
    compareAFrom,
    compareATo,
    compareBFrom,
    compareBTo,
    compareMetrics,
    fromDate,
    toDate,
    currentSummary.daily,
  ]);

  if (!orgId && !err) return <Spinner h={200} />;

  return (
    <div className="flex flex-col gap-6">
      <ReportHeader
        title="Sales Analytics"
        subtitle={
          tab === "compare"
            ? `${compareAFrom} → ${compareATo} compared with ${compareBFrom} → ${compareBTo}`
            : `${fromDate} → ${toDate} · ${currentSummary.sales} transactions`
        }
        actions={
          <>
            <ReportsBackButton />
            <button
              className={S.btnGhost}
              disabled={loading}
              onClick={handleCSV}
            >
              ⬇ CSV
            </button>
          </>
        }
      />

      <Card title="Filters" sub="Choose report section and date range">
        <div className="flex flex-wrap items-center gap-3">
          <SegControl
            value={tab}
            onChange={setTab}
            options={[
              { value: "overview", label: "📊 Overview" },
              { value: "products", label: "📦 Products" },
              { value: "compare", label: "⚖️ Compare" },
              { value: "insights", label: "💡 Insights" },
            ]}
          />

          {tab !== "compare" && (
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
                { value: "89", label: "90D" },
                { value: "custom", label: "Custom" },
              ]}
            />
          )}
        </div>

        {tab !== "compare" && showCustom && (
          <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">
                From
              </label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">
                To
              </label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
              />
            </div>
          </div>
        )}

        {tab === "compare" && (
          <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 text-sm font-bold text-slate-900">
                Period A
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">
                    From
                  </label>
                  <input
                    type="date"
                    value={compareAFrom}
                    onChange={(e) => setCompareAFrom(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">
                    To
                  </label>
                  <input
                    type="date"
                    value={compareATo}
                    onChange={(e) => setCompareATo(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
              <div className="mb-3 text-sm font-bold text-slate-900">
                Period B
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">
                    From
                  </label>
                  <input
                    type="date"
                    value={compareBFrom}
                    onChange={(e) => setCompareBFrom(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">
                    To
                  </label>
                  <input
                    type="date"
                    value={compareBTo}
                    onChange={(e) => setCompareBTo(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {err && <ErrorBanner message={err} onClose={() => setErr("")} />}
      {loading && <Spinner h={200} />}

      {!loading && !err && tab !== "compare" && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <KpiCard
              label="Net Revenue"
              value={fmtMoney(currentSummary.revenue)}
              sub={`${fmtMoney(currentSummary.avgDaily)}/day avg`}
              icon="💰"
              variant="neutral"
            />
            <KpiCard
              label="Total Sales"
              value={String(currentSummary.sales)}
              sub={`${currentSummary.daily.length} active days`}
              icon="🧾"
              variant="info"
            />
            <KpiCard
              label="Gross Revenue"
              value={fmtMoney(currentSummary.gross)}
              sub="before discounts"
              icon="📊"
              variant="success"
            />
            <KpiCard
              label="Discounts"
              value={fmtMoney(currentSummary.discounts)}
              sub={`${discountRate.toFixed(1)}% of gross`}
              icon="🏷️"
              variant="danger"
            />
            <KpiCard
              label="Avg Basket"
              value={fmtMoney(currentSummary.avgBasket)}
              sub="per transaction"
              icon="🛒"
              variant="warning"
            />
          </div>

          {currentSummary.sales === 0 && (
            <EmptyState
              icon="📭"
              title="No sales found in this range"
              detail="Try expanding the date range or check back later."
            />
          )}
        </>
      )}

      {!loading && !err && currentSummary.sales > 0 && tab === "overview" && (
        <div className="flex flex-col gap-6">
          <Card
            title="Revenue Trend"
            sub={`${fromDate} → ${toDate}`}
            action={
              <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                Net Revenue
              </span>
            }
          >
            <SimpleLineChart daily={currentSummary.daily} />
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card title="Payment Split" sub="Revenue by payment method" noPad>
              <div className="divide-y divide-slate-100">
                {currentSummary.payments.length === 0 ? (
                  <div className="py-10 text-center text-sm text-slate-400">
                    No payment data.
                  </div>
                ) : (
                  currentSummary.payments.map((p) => (
                    <div
                      key={p.method}
                      className="flex items-center justify-between px-5 py-3.5"
                    >
                      <div>
                        <div className="text-sm font-bold capitalize text-slate-900">
                          {p.method}
                        </div>
                        <div className="text-xs text-slate-400">
                          {p.count} transaction{p.count !== 1 ? "s" : ""}
                        </div>
                      </div>
                      <div className="text-right text-sm font-bold text-slate-900">
                        {fmtMoney(p.revenue)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card title="Daily Transaction Count" sub="Sales volume">
              <div className="max-h-64 space-y-2.5 overflow-y-auto pr-1">
                {[...currentSummary.daily].reverse().map((d) => {
                  const maxSales = Math.max(
                    ...currentSummary.daily.map((x) => x.sales_count),
                    1
                  );
                  const pct = (d.sales_count / maxSales) * 100;

                  return (
                    <div key={d.day}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="font-medium text-slate-600">
                          {fmtShortDate(d.day)}
                        </span>
                        <span className="font-bold text-slate-900">
                          {d.sales_count} sales
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-blue-500"
                          style={{ width: `${Math.max(2, pct)}%`, opacity: 0.7 }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          <Card title="Day-by-Day Summary" sub={`${currentSummary.daily.length} days`} noPad>
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

            <div className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
              {[...currentSummary.daily].reverse().map((r) => (
                <div
                  key={r.day}
                  className="grid items-center gap-4 px-5 py-3.5 transition-colors hover:bg-slate-50"
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
                  <div className="text-right text-sm font-semibold text-red-500">
                    −{fmtMoney(r.discount_total)}
                  </div>
                  <div className="text-right text-sm font-bold text-slate-900">
                    {fmtMoney(r.total)}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {!loading && !err && currentSummary.sales > 0 && tab === "products" && (
        <div className="flex flex-col gap-6">
          <Card
            title="Product Performance"
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

          <Card title="Product Ranking" sub="Detailed performance" noPad>
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

            <div className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
              {sortedProducts.map((p, i) => (
                <div
                  key={p.product_id}
                  className={`grid items-center gap-4 px-5 py-3.5 text-sm transition-colors hover:bg-slate-50 ${
                    i === 0 ? "bg-amber-50/40" : ""
                  }`}
                  style={{ gridTemplateColumns: "0.5fr 2fr 1fr 1fr 0.8fr" }}
                >
                  <div className="font-bold text-slate-400">
                    {i === 0 ? "🏆" : `#${i + 1}`}
                  </div>
                  <div className="truncate font-semibold text-slate-900">
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
              ))}
            </div>
          </Card>
        </div>
      )}

      {!loading && !err && tab === "compare" && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <KpiCard
              label="Period A Revenue"
              value={fmtMoney(compareA.revenue)}
              sub={`${compareA.sales} sales · ${compareA.from} → ${compareA.to}`}
              icon="◻️"
              variant="neutral"
            />
            <KpiCard
              label="Period B Revenue"
              value={fmtMoney(compareB.revenue)}
              sub={`${compareB.sales} sales · ${compareB.from} → ${compareB.to}`}
              icon="🟨"
              variant="warning"
            />
          </div>

          <Card title="Period Comparison" sub="How Period B performed against Period A">
            <CompareBars metrics={compareMetrics} />
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card title="Period A Trend" sub={`${compareA.from} → ${compareA.to}`}>
              <SimpleLineChart daily={compareA.daily} />
            </Card>

            <Card title="Period B Trend" sub={`${compareB.from} → ${compareB.to}`}>
              <SimpleLineChart daily={compareB.daily} />
            </Card>
          </div>

          <Card title="Product Movement" sub="Top products in Period B" noPad>
            <div
              className={`${S.tableHead} hidden sm:grid`}
              style={{ gridTemplateColumns: "2fr 1fr 1fr" }}
            >
              <div>Product</div>
              <div className="text-right">Units</div>
              <div className="text-right">Revenue</div>
            </div>

            <div className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
              {[...compareB.products]
                .sort((a, b) => b.revenue - a.revenue)
                .slice(0, 12)
                .map((p) => (
                  <div
                    key={p.product_id}
                    className="grid items-center gap-4 px-5 py-3.5 text-sm hover:bg-slate-50"
                    style={{ gridTemplateColumns: "2fr 1fr 1fr" }}
                  >
                    <div className="truncate font-semibold text-slate-900">
                      {p.name}
                    </div>
                    <div className="text-right text-slate-600">{p.qty}</div>
                    <div className="text-right font-bold text-slate-900">
                      {fmtMoney(p.revenue)}
                    </div>
                  </div>
                ))}
            </div>
          </Card>
        </div>
      )}

      {!loading && !err && currentSummary.sales > 0 && tab === "insights" && (
        <div className="flex flex-col gap-6">
          <p className="text-sm text-slate-500">
            Data-driven analysis of{" "}
            <span className="font-semibold text-slate-700">
              {currentSummary.daily.length} active trading days
            </span>{" "}
            and {currentSummary.sales} transactions.
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {insights.map((ins, i) => (
              <InsightCard key={i} {...ins} />
            ))}
          </div>

          <Card title="Action Plan" sub="Practical next steps">
            <div className="divide-y divide-slate-100">
              {[
                {
                  step: "01",
                  action: "Protect top sellers",
                  detail:
                    sortedProducts[0]?.name
                      ? `Keep "${sortedProducts[0].name}" well stocked because it is currently your strongest performer.`
                      : "Identify and protect your strongest products.",
                },
                {
                  step: "02",
                  action: "Review discounting",
                  detail:
                    discountRate > 10
                      ? `Discounts are ${discountRate.toFixed(
                          1
                        )}% of gross revenue. Review whether they are improving volume enough.`
                      : `Discount rate is ${discountRate.toFixed(
                          1
                        )}%, which looks controlled.`,
                },
                {
                  step: "03",
                  action: "Lift weak products",
                  detail:
                    sortedProducts.length > 1
                      ? `Bundle or reposition "${
                          sortedProducts[sortedProducts.length - 1].name
                        }" because it is the weakest performer.`
                      : "Watch for slow-moving products as more sales data comes in.",
                },
                {
                  step: "04",
                  action: "Use comparisons monthly",
                  detail:
                    "Compare the same month year-over-year, like Jan last year vs Jan this year, to track real business growth.",
                },
              ].map((rec) => (
                <div key={rec.step} className="flex items-start gap-4 py-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-xs font-bold text-white">
                    {rec.step}
                  </div>
                  <div>
                    <div className="mb-0.5 text-sm font-bold text-slate-900">
                      {rec.action}
                    </div>
                    <div className="text-xs leading-relaxed text-slate-500">
                      {rec.detail}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}