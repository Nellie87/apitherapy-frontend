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
  fmtMoney,
} from "../components/report-ui";

import type { NavTab, SortBy } from "./sales-analytics.types";

import {
  buildCompareMetrics,
  buildPeriodSummary,
  daysAgoYMD,
  endOfMonthYMD,
  fmtShortDate,
  startOfMonthYMD,
  todayYMD,
} from "./sales-analytics.helpers";

import {
  CompareBars,
  ProductBar,
  SimpleLineChart,
} from "./sales-analytics.charts";

function pctChange(a: number, b: number) {
  if (!a && !b) return 0;
  if (!a) return null;
  return ((b - a) / Math.abs(a)) * 100;
}

function buildInsights(summary: ReturnType<typeof buildPeriodSummary>) {
  if (!summary.daily.length) return [];

  const sortedDays = [...summary.daily].sort((a, b) => b.total - a.total);
  const best = sortedDays[0];
  const worst = sortedDays[sortedDays.length - 1];

  const sortedProducts = [...summary.products].sort(
    (a, b) => b.revenue - a.revenue
  );

  const top = sortedProducts[0];
  const bottom = sortedProducts[sortedProducts.length - 1];

  const discountRate = summary.gross
    ? (summary.discounts / summary.gross) * 100
    : 0;

  const midpoint = Math.floor(summary.daily.length / 2);

  const firstHalf =
    summary.daily.slice(0, midpoint).reduce((sum, d) => sum + d.total, 0) /
    (midpoint || 1);

  const secondHalf =
    summary.daily.slice(midpoint).reduce((sum, d) => sum + d.total, 0) /
    (summary.daily.length - midpoint || 1);

  const trend = pctChange(firstHalf, secondHalf) ?? 0;

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
          : "Sales momentum weakened. Review stock, pricing, or traffic.",
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
      detail: `${worst.sales_count} transaction(s). Consider a promotion around similar slow days.`,
    },
    ...(top
      ? [
          {
            type: "positive",
            icon: "⭐",
            title: `Top product: ${top.name}`,
            detail: `${fmtMoney(top.revenue)} estimated revenue · ${
              top.qty
            } units sold.`,
          },
        ]
      : []),
    ...(bottom && sortedProducts.length > 1
      ? [
          {
            type: "negative",
            icon: "🔻",
            title: `Weak product: ${bottom.name}`,
            detail: `${fmtMoney(bottom.revenue)} estimated revenue · ${
              bottom.qty
            } units sold.`,
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
  ];
}

function MiniMetric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">
        {label}
      </div>
      <div className="mt-3 text-2xl font-black text-slate-950">{value}</div>
      <div className="mt-1 text-xs font-semibold text-slate-500">{sub}</div>
    </div>
  );
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="pointer-events-none absolute right-0 top-0 h-56 w-56 rounded-full bg-amber-100/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-48 w-48 rounded-full bg-slate-100/60 blur-3xl" />
      <div className="relative">{children}</div>
    </div>
  );
}

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
  const [compareATo, setCompareATo] = useState(
    endOfMonthYMD(currentYear - 1, 0)
  );
  const [compareBFrom, setCompareBFrom] = useState(
    startOfMonthYMD(currentYear, 0)
  );
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
            <button className={S.btnGhost} disabled={loading} onClick={handleCSV}>
              ⬇ CSV
            </button>
          </>
        }
      />

      <DashboardShell>
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-amber-700 shadow-sm">
              Analytics Dashboard
            </div>

            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Revenue, products and sales movement
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
              A clean snapshot of sales performance, payment behavior, discounts
              and product contribution.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
            <SegControl
              value={tab}
              onChange={(v: NavTab) => setTab(v)}
              options={[
                { value: "overview", label: "Overview" },
                { value: "products", label: "Products" },
                { value: "compare", label: "Compare" },
                { value: "insights", label: "Insights" },
              ]}
            />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            {tab !== "compare" && (
              <SegControl
                value={showCustom ? "custom" : String(rangeDays)}
                onChange={(v: string) => {
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

            {tab !== "compare" && showCustom && (
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />

                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
              </div>
            )}

            {tab === "compare" && (
              <div className="grid w-full gap-4 lg:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 text-sm font-black text-slate-950">
                    Period A
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="date"
                      value={compareAFrom}
                      onChange={(e) => setCompareAFrom(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                    />

                    <input
                      type="date"
                      value={compareATo}
                      onChange={(e) => setCompareATo(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                    />
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 text-sm font-black text-slate-950">
                    Period B
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="date"
                      value={compareBFrom}
                      onChange={(e) => setCompareBFrom(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                    />

                    <input
                      type="date"
                      value={compareBTo}
                      onChange={(e) => setCompareBTo(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </DashboardShell>

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
              variant="warning"
            />

            <KpiCard
              label="Total Sales"
              value={String(currentSummary.sales)}
              sub={`${currentSummary.daily.length} active days`}
              icon="🧾"
              variant="neutral"
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
              variant="info"
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
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="flex flex-col gap-6 xl:col-span-8">
            <Card title="Revenue Trend" sub={`${fromDate} → ${toDate}`}>
              <SimpleLineChart daily={currentSummary.daily} />
            </Card>

            <Card title="Top Product Performance" sub="Best performing products">
              <ProductBar data={sortedProducts.slice(0, 6)} valueKey="revenue" />
            </Card>

            <Card
              title="Day-by-Day Summary"
              sub={`${currentSummary.daily.length} active days`}
              noPad
            >
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
                    <div className="text-sm font-bold text-slate-900">
                      {fmtShortDate(r.day)}
                    </div>
                    <div className="text-right text-sm text-slate-600">
                      {r.sales_count}
                    </div>
                    <div className="text-right text-sm text-slate-600">
                      {fmtMoney(r.subtotal)}
                    </div>
                    <div className="text-right text-sm font-bold text-red-500">
                      −{fmtMoney(r.discount_total)}
                    </div>
                    <div className="text-right text-sm font-black text-slate-950">
                      {fmtMoney(r.total)}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="flex flex-col gap-6 xl:col-span-4">
            <MiniMetric
              label="Retail Sales"
              value={fmtMoney(currentSummary.revenue)}
              sub={`${currentSummary.sales} transactions`}
            />

            <MiniMetric
              label="Average Basket"
              value={fmtMoney(currentSummary.avgBasket)}
              sub="average transaction value"
            />

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
                      className="flex items-center justify-between px-5 py-4 hover:bg-slate-50"
                    >
                      <div>
                        <div className="text-sm font-black capitalize text-slate-900">
                          {p.method}
                        </div>
                        <div className="text-xs font-semibold text-slate-400">
                          {p.count} transaction{p.count !== 1 ? "s" : ""}
                        </div>
                      </div>

                      <div className="text-right text-sm font-black text-slate-950">
                        {fmtMoney(p.revenue)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card title="Daily Transaction Count" sub="Sales volume">
              <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
                {[...currentSummary.daily].reverse().map((d) => {
                  const maxSales = Math.max(
                    ...currentSummary.daily.map((x) => x.sales_count),
                    1
                  );
                  const pct = (d.sales_count / maxSales) * 100;

                  return (
                    <div key={d.day}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="font-bold text-slate-600">
                          {fmtShortDate(d.day)}
                        </span>
                        <span className="font-black text-slate-900">
                          {d.sales_count} sales
                        </span>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-amber-500"
                          style={{ width: `${Math.max(3, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
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
                onChange={(v: SortBy) => setSortBy(v)}
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
                  <div className="font-black text-slate-400">
                    {i === 0 ? "🏆" : `#${i + 1}`}
                  </div>
                  <div className="truncate font-bold text-slate-900">
                    {p.name}
                  </div>
                  <div className="text-right font-black text-slate-950">
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

          <Card
            title="Period Comparison"
            sub="How Period B performed against Period A"
          >
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
        </div>
      )}

      {!loading && !err && currentSummary.sales > 0 && tab === "insights" && (
        <div className="flex flex-col gap-6">
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
                  detail: sortedProducts[0]?.name
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
                        )}% of gross revenue. Review if they are improving volume enough.`
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
              ].map((rec) => (
                <div key={rec.step} className="flex items-start gap-4 py-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-xs font-black text-white">
                    {rec.step}
                  </div>
                  <div>
                    <div className="mb-0.5 text-sm font-black text-slate-950">
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