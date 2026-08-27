"use client";

import React from "react";
import type {
  CompareMetric,
  DailyStat,
  NavTab,
  PeriodSummary,
  ProductStat,
  SaleAuditSummary,
  WeekdayStat,
} from "./sales-analytics.types";
import {
  bestAndWorstWeekday,
  fillDailyGaps,
  fmtLongDate,
  fmtPct,
  fmtShortDate,
  fmtValue,
  paymentMethodLabel,
} from "./sales-analytics.helpers";
import { fmtK, fmtMoney } from "../components/report-ui";
import { PdfReportHeader } from "../components/PdfReportHeader";
import {
  PdfBar,
  PdfChartFrame,
  PdfEmpty,
  PdfFooter,
  PdfMetricCard,
  PdfSection,
  PdfStory,
  pdfGrid2,
  pdfGrid4,
  pdfPage,
} from "../components/pdf-ui";
import { PDF_HEX } from "@/lib/pdfBrand";

type Props = {
  mode: NavTab;
  fromDate: string;
  toDate: string;
  currentSummary: PeriodSummary;
  compareA: PeriodSummary;
  compareB: PeriodSummary;
  compareMetrics: CompareMetric[];
  sortedProducts: ProductStat[];
  audit: SaleAuditSummary;
  generatedAt: string;
};

function PdfRevenueChart({
  daily,
  from,
  to,
}: {
  daily: DailyStat[];
  from?: string;
  to?: string;
}) {
  const series = fillDailyGaps(daily, from, to);
  const W = 710;
  const H = 210;
  const P = { t: 14, r: 12, b: 32, l: 48 };
  const iW = W - P.l - P.r;
  const iH = H - P.t - P.b;
  const maxV = Math.max(...series.map((d) => d.total), 1);
  const x = (i: number) =>
    P.l + (series.length < 2 ? iW / 2 : (i / (series.length - 1)) * iW);
  const y = (v: number) => P.t + iH - (v / maxV) * iH;
  const path = series
    .map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d.total)}`)
    .join(" ");
  const area = series.length
    ? `${path} L${x(series.length - 1)},${P.t + iH} L${x(0)},${P.t + iH} Z`
    : "";
  const grids = [0, 0.25, 0.5, 0.75, 1].map((f) => maxV * f);
  const step = Math.max(1, Math.floor(series.length / 6));
  const labels = series
    .map((d, i) => ({ d, i }))
    .filter(({ i }) => i % step === 0 || i === series.length - 1);

  if (!series.length) {
    return <PdfEmpty>No chart data for this range.</PdfEmpty>;
  }

  return (
    <PdfChartFrame>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <defs>
          <linearGradient id="pdfSalesArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PDF_HEX.honey} stopOpacity="0.18" />
            <stop offset="100%" stopColor={PDF_HEX.honey} stopOpacity="0" />
          </linearGradient>
        </defs>
        {grids.map((v, i) => (
          <g key={i}>
            <line
              x1={P.l}
              x2={W - P.r}
              y1={y(v)}
              y2={y(v)}
              stroke={PDF_HEX.softLine}
              strokeWidth="1"
            />
            <text
              x={P.l - 8}
              y={y(v) + 4}
              textAnchor="end"
              fontSize="10"
              fill={PDF_HEX.muted}
              fontWeight="500"
            >
              {fmtK(v)}
            </text>
          </g>
        ))}
        <path d={area} fill="url(#pdfSalesArea)" />
        <path
          d={path}
          fill="none"
          stroke={PDF_HEX.honey}
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {labels.map(({ d, i }) => (
          <text
            key={d.day}
            x={x(i)}
            y={H - 8}
            textAnchor="middle"
            fontSize="10"
            fill={PDF_HEX.muted}
            fontWeight="500"
          >
            {fmtShortDate(d.day)}
          </text>
        ))}
      </svg>
    </PdfChartFrame>
  );
}

function PdfWeekdayPolls({ weekdays }: { weekdays: WeekdayStat[] }) {
  const max = Math.max(...weekdays.map((d) => d.revenue), 1);
  const withSales = weekdays.filter((d) => d.sales_count > 0);
  const bestId = withSales.length
    ? [...withSales].sort((a, b) => b.revenue - a.revenue)[0].weekday
    : null;
  const worstId =
    withSales.length > 1
      ? [...withSales].sort((a, b) => a.revenue - b.revenue)[0].weekday
      : null;

  if (!withSales.length) {
    return <PdfEmpty>No weekday pattern in this range.</PdfEmpty>;
  }

  return (
    <PdfChartFrame>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {weekdays.map((d) => {
            const pct = (d.revenue / max) * 100;
            const isBest = d.weekday === bestId;
            const isWorst = d.weekday === worstId;

            return (
              <tr key={d.weekday}>
                <td
                  style={{
                    width: 92,
                    padding: "9px 12px 9px 0",
                    verticalAlign: "middle",
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: PDF_HEX.dark,
                    }}
                  >
                    {d.label}
                  </div>
                  <div
                    style={{
                      marginTop: 2,
                      fontSize: 11,
                      fontWeight: 500,
                      color: PDF_HEX.muted,
                    }}
                  >
                    {d.sales_count} sale{d.sales_count !== 1 ? "s" : ""}
                    {d.sales_count ? ` · ${fmtMoney(d.avgBasket)} avg` : ""}
                  </div>
                </td>
                <td style={{ padding: "9px 12px", verticalAlign: "middle" }}>
                  <PdfBar
                    pct={Math.max(d.sales_count ? 4 : 0, pct)}
                    color={PDF_HEX.honey}
                  />
                </td>
                <td
                  style={{
                    width: 150,
                    padding: "9px 0 9px 8px",
                    textAlign: "right",
                    verticalAlign: "middle",
                    whiteSpace: "nowrap",
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: PDF_HEX.dark,
                    }}
                  >
                    {fmtMoney(d.revenue)}
                  </div>
                  {isBest || isWorst ? (
                    <div
                      style={{
                        marginTop: 2,
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: isBest ? PDF_HEX.green : PDF_HEX.red,
                      }}
                    >
                      {isBest ? "Best" : "Slowest"}
                    </div>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </PdfChartFrame>
  );
}

function PdfTopSellers({
  products,
  revenue,
}: {
  products: ProductStat[];
  revenue: number;
}) {
  const top5 = products.slice(0, 5);
  const max = Math.max(...top5.map((p) => p.revenue), 1);

  if (!top5.length) {
    return <PdfEmpty>No product sales in this range.</PdfEmpty>;
  }

  return (
    <PdfChartFrame>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {top5.map((p, i) => {
            const pct = (p.revenue / max) * 100;
            const share = revenue ? ((p.revenue / revenue) * 100).toFixed(1) : "0.0";

            return (
              <tr key={p.product_id}>
                <td
                  style={{
                    width: 28,
                    padding: "10px 8px 10px 0",
                    fontSize: 12,
                    fontWeight: 700,
                    color: PDF_HEX.lightMuted,
                    verticalAlign: "middle",
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </td>
                <td style={{ padding: "10px 12px 10px 0", verticalAlign: "middle" }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: PDF_HEX.dark,
                    }}
                  >
                    {p.name}
                  </div>
                  <div
                    style={{
                      marginTop: 3,
                    }}
                  >
                    <PdfBar pct={Math.max(4, pct)} color={PDF_HEX.honey} />
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 11,
                      fontWeight: 500,
                      color: PDF_HEX.muted,
                    }}
                  >
                    {p.qty.toLocaleString("en-KE")} unit{p.qty === 1 ? "" : "s"} ·{" "}
                    {share}% of revenue
                  </div>
                </td>
                <td
                  style={{
                    width: 120,
                    padding: "10px 0 10px 8px",
                    fontSize: 13,
                    fontWeight: 700,
                    color: PDF_HEX.dark,
                    textAlign: "right",
                    verticalAlign: "middle",
                    whiteSpace: "nowrap",
                  }}
                >
                  {fmtMoney(p.revenue)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </PdfChartFrame>
  );
}

function PdfPaymentPolls({
  payments,
  revenue,
}: {
  payments: PeriodSummary["payments"];
  revenue: number;
}) {
  const max = Math.max(...payments.map((p) => p.revenue), 1);

  if (!payments.length) return null;

  return (
    <PdfChartFrame>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {payments.map((p) => {
            const pct = (p.revenue / max) * 100;
            const share = revenue ? ((p.revenue / revenue) * 100).toFixed(1) : "0.0";

            return (
              <tr key={p.method}>
                <td
                  style={{
                    width: 130,
                    padding: "9px 12px 9px 0",
                    verticalAlign: "middle",
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: PDF_HEX.dark,
                    }}
                  >
                    {paymentMethodLabel(p.method)}
                  </div>
                  <div
                    style={{
                      marginTop: 2,
                      fontSize: 11,
                      fontWeight: 500,
                      color: PDF_HEX.muted,
                    }}
                  >
                    {p.count} transaction{p.count !== 1 ? "s" : ""}
                  </div>
                </td>
                <td style={{ padding: "9px 12px", verticalAlign: "middle" }}>
                  <PdfBar pct={Math.max(4, pct)} color={PDF_HEX.honey} />
                </td>
                <td
                  style={{
                    width: 150,
                    padding: "9px 0 9px 8px",
                    textAlign: "right",
                    verticalAlign: "middle",
                    whiteSpace: "nowrap",
                    fontSize: 13,
                    fontWeight: 700,
                    color: PDF_HEX.dark,
                  }}
                >
                  {fmtMoney(p.revenue)}
                  <span
                    style={{
                      marginLeft: 6,
                      fontSize: 11,
                      fontWeight: 500,
                      color: PDF_HEX.muted,
                    }}
                  >
                    {share}%
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </PdfChartFrame>
  );
}

function PdfComparePolls({ metrics }: { metrics: CompareMetric[] }) {
  return (
    <PdfChartFrame>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {metrics.map((m) => {
            const max = Math.max(Math.abs(m.a), Math.abs(m.b), 1);
            const aPct = (Math.abs(m.a) / max) * 100;
            const bPct = (Math.abs(m.b) / max) * 100;
            const up = (m.diff ?? 0) >= 0;

            return (
              <tr key={m.label}>
                <td
                  style={{
                    padding: "14px 16px 14px 0",
                    verticalAlign: "top",
                    width: "38%",
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: PDF_HEX.dark,
                    }}
                  >
                    {m.label}
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 11,
                      fontWeight: 500,
                      color: PDF_HEX.muted,
                    }}
                  >
                    {fmtValue(m.a, m.money)} → {fmtValue(m.b, m.money)}
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      display: "inline-block",
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: up ? PDF_HEX.green : PDF_HEX.red,
                    }}
                  >
                    {up ? "Up" : "Down"} {fmtPct(m.pct)}
                  </div>
                </td>
                <td style={{ padding: "14px 0", verticalAlign: "middle" }}>
                  <div
                    style={{
                      marginBottom: 4,
                      fontSize: 10,
                      fontWeight: 600,
                      color: PDF_HEX.muted,
                    }}
                  >
                    Reference
                  </div>
                  <PdfBar pct={Math.max(4, aPct)} color={PDF_HEX.dark} />
                  <div
                    style={{
                      margin: "10px 0 4px",
                      fontSize: 10,
                      fontWeight: 600,
                      color: PDF_HEX.muted,
                    }}
                  >
                    Comparison
                  </div>
                  <PdfBar pct={Math.max(4, bPct)} color={PDF_HEX.honey} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </PdfChartFrame>
  );
}

function buildPeriodStory(
  summary: PeriodSummary,
  audit: SaleAuditSummary,
  products: ProductStat[],
) {
  const { best, worst } = bestAndWorstWeekday(summary.weekdays);
  const top = products[0];
  const topShare = top && summary.revenue ? (top.revenue / summary.revenue) * 100 : 0;
  const parts: string[] = [];

  parts.push(
    `From ${fmtLongDate(summary.from)} to ${fmtLongDate(summary.to)}, the shop recorded ${summary.sales} completed sale${summary.sales !== 1 ? "s" : ""} worth ${fmtMoney(summary.revenue)}. The typical basket was ${fmtMoney(summary.avgBasket)}.`,
  );

  if (best && worst && best.weekday !== worst.weekday) {
    parts.push(
      `${best.label} was the strongest weekday (${fmtMoney(best.revenue)} from ${best.sales_count} sale${best.sales_count !== 1 ? "s" : ""}). ${worst.label} was the quietest.`,
    );
  }

  if (top) {
    parts.push(
      `${top.name} was the top seller at ${fmtMoney(top.revenue)} (${topShare.toFixed(1)}% of revenue).`,
    );
  }

  if (audit.cancelledCount > 0) {
    parts.push(
      `${audit.cancelledCount} cancelled sale${audit.cancelledCount !== 1 ? "s" : ""} worth ${fmtMoney(audit.cancelledValue)} are not included in revenue.`,
    );
  }

  return parts.join(" ");
}

function buildOverviewRecommendations(
  summary: PeriodSummary,
  products: ProductStat[],
  audit: SaleAuditSummary,
) {
  const { best, worst } = bestAndWorstWeekday(summary.weekdays);
  const top = products[0];
  const discountRate = summary.gross ? (summary.discounts / summary.gross) * 100 : 0;
  const recs: { title: string; detail: string }[] = [];

  if (best && worst && best.weekday !== worst.weekday) {
    recs.push({
      title: "Staff and stock for busy days",
      detail: `${best.label} was strongest at ${fmtMoney(best.revenue)} from ${best.sales_count} sale${best.sales_count !== 1 ? "s" : ""}. ${worst.label} was quietest — use promotions or lighter staffing that day.`,
    });
  } else if (best) {
    recs.push({
      title: "Protect your strongest weekday",
      detail: `${best.label} brought in the most money. Keep that day well stocked and staffed.`,
    });
  }

  if (top && summary.revenue) {
    const share = ((top.revenue / summary.revenue) * 100).toFixed(1);
    recs.push({
      title: "Keep top sellers in stock",
      detail: `${top.name} is the top seller at ${fmtMoney(top.revenue)} (${share}% of revenue). Restock it first.`,
    });
  }

  recs.push({
    title: "Watch discounting",
    detail:
      discountRate > 10
        ? `Discounts took ${discountRate.toFixed(1)}% of the pre-discount total across ${audit.discountedCount} sale${audit.discountedCount !== 1 ? "s" : ""}. Check whether they are bringing enough extra volume.`
        : `Discount rate is ${discountRate.toFixed(1)}% of the pre-discount total, which looks controlled.`,
  });

  const topPay = summary.payments[0];
  if (topPay) {
    recs.push({
      title: "Know where the money landed",
      detail: `Most revenue came through ${paymentMethodLabel(topPay.method)}. Cash stays in the till; M-Pesa sits in the phone or business account.`,
    });
  }

  return recs;
}

function buildCompareRecommendations(a: PeriodSummary, b: PeriodSummary) {
  const recs: { title: string; detail: string }[] = [];
  const up = b.revenue >= a.revenue;

  recs.push({
    title: up ? "Comparison period was stronger" : "Comparison period was weaker",
    detail: `Revenue went from ${fmtMoney(a.revenue)} to ${fmtMoney(b.revenue)}. Look at which metrics moved the most in the bars above.`,
  });

  if (b.avgBasket !== a.avgBasket) {
    recs.push({
      title:
        b.avgBasket >= a.avgBasket
          ? "Baskets were larger in the comparison window"
          : "Baskets were smaller in the comparison window",
      detail: `Average basket moved from ${fmtMoney(a.avgBasket)} to ${fmtMoney(b.avgBasket)}. Bigger baskets usually mean more items or higher-priced products per sale.`,
    });
  }

  return recs;
}

function PdfRecommendations({ items }: { items: { title: string; detail: string }[] }) {
  if (!items.length) return null;

  return (
    <PdfSection title="Recommendations" caption="Practical next steps from this period.">
      <PdfChartFrame>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {items.map((item, i) => (
              <tr key={item.title}>
                <td
                  style={{
                    width: 36,
                    padding: "12px 10px 12px 0",
                    fontSize: 12,
                    fontWeight: 700,
                    color: PDF_HEX.honeyDark,
                    verticalAlign: "top",
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </td>
                <td style={{ padding: "12px 0", verticalAlign: "top" }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: PDF_HEX.dark,
                    }}
                  >
                    {item.title}
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 12,
                      fontWeight: 500,
                      lineHeight: 1.5,
                      color: PDF_HEX.muted,
                    }}
                  >
                    {item.detail}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </PdfChartFrame>
    </PdfSection>
  );
}

export function SalesAnalyticsPdfTemplate({
  mode,
  fromDate,
  toDate,
  currentSummary,
  compareA,
  compareB,
  compareMetrics,
  sortedProducts,
  audit,
  generatedAt,
}: Props) {
  const isCompare = mode === "compare";
  const discountRate = currentSummary.gross
    ? (currentSummary.discounts / currentSummary.gross) * 100
    : 0;
  const { best, worst } = bestAndWorstWeekday(currentSummary.weekdays);
  const top5 = sortedProducts.slice(0, 5);

  return (
    <div id="sales-analytics-pdf-template" style={pdfPage}>
      <PdfReportHeader
        title={isCompare ? "Sales comparison" : "Sales report"}
        subtitle={
          isCompare
            ? "How two periods compare"
            : "Revenue, weekday mix, and top sellers"
        }
        metaLeft={
          isCompare
            ? `${fmtLongDate(compareA.from)} – ${fmtLongDate(compareA.to)} vs ${fmtLongDate(compareB.from)} – ${fmtLongDate(compareB.to)}`
            : `${fmtLongDate(fromDate)} – ${fmtLongDate(toDate)}`
        }
        metaRight={`Generated ${generatedAt}`}
      />

      {isCompare ? (
        <>
          <section style={pdfGrid2}>
            <PdfMetricCard
              label="Reference period"
              value={fmtMoney(compareA.revenue)}
              hint={`${compareA.sales} sale${compareA.sales !== 1 ? "s" : ""} · ${fmtLongDate(compareA.from)} – ${fmtLongDate(compareA.to)}`}
            />
            <PdfMetricCard
              label="Comparison period"
              value={fmtMoney(compareB.revenue)}
              hint={`${compareB.sales} sale${compareB.sales !== 1 ? "s" : ""} · ${fmtLongDate(compareB.from)} – ${fmtLongDate(compareB.to)}`}
            />
          </section>
          <PdfSection
            title="Performance comparison"
            caption="Dark bars are the reference window. Honey bars are the comparison window."
          >
            <PdfComparePolls metrics={compareMetrics} />
          </PdfSection>
          <PdfRecommendations items={buildCompareRecommendations(compareA, compareB)} />
        </>
      ) : (
        <>
          <section style={pdfGrid4}>
            <PdfMetricCard
              label="Revenue"
              value={fmtMoney(currentSummary.revenue)}
              hint={`${fmtMoney(currentSummary.avgDaily)} typical selling day`}
            />
            <PdfMetricCard
              label="Completed sales"
              value={String(currentSummary.sales)}
              hint={`${currentSummary.daily.length} day${currentSummary.daily.length !== 1 ? "s" : ""} with sales`}
            />
            <PdfMetricCard
              label="Average basket"
              value={fmtMoney(currentSummary.avgBasket)}
              hint="Typical spend per checkout"
            />
            <PdfMetricCard
              label="Discounts"
              value={fmtMoney(currentSummary.discounts)}
              hint={`${audit.discountedCount} sale${audit.discountedCount !== 1 ? "s" : ""} · ${discountRate.toFixed(1)}% of gross`}
            />
          </section>

          <PdfStory>
            {currentSummary.sales
              ? buildPeriodStory(currentSummary, audit, top5)
              : `No completed sales were recorded from ${fmtLongDate(fromDate)} to ${fmtLongDate(toDate)}.`}
          </PdfStory>

          <PdfSection
            title="Revenue trend"
            caption="Daily totals across the selected range, including quiet days."
          >
            <PdfRevenueChart
              daily={currentSummary.daily}
              from={fromDate}
              to={toDate}
            />
          </PdfSection>

          <PdfSection
            title="Sales by weekday"
            caption={
              best && worst
                ? `${best.label} was strongest; ${worst.label} was quietest.`
                : "Revenue grouped by day of week."
            }
          >
            <PdfWeekdayPolls weekdays={currentSummary.weekdays} />
          </PdfSection>

          {currentSummary.payments.length > 0 ? (
            <PdfSection
              title="How customers paid"
              caption="Where the money landed for completed sales."
            >
              <PdfPaymentPolls
                payments={currentSummary.payments}
                revenue={currentSummary.revenue}
              />
            </PdfSection>
          ) : null}

          <PdfSection
            title="Top 5 sellers"
            caption="Products that brought in the most money this period."
          >
            <PdfTopSellers products={sortedProducts} revenue={currentSummary.revenue} />
          </PdfSection>

          <PdfRecommendations
            items={buildOverviewRecommendations(currentSummary, top5, audit)}
          />
        </>
      )}

      <PdfFooter extra={`cancelled sales excluded · generated ${generatedAt}`} />
    </div>
  );
}
