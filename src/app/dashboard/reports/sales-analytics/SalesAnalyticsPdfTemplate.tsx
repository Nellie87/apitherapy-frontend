"use client";

import React, { type CSSProperties } from "react";
import type {
  CompareMetric,
  NavTab,
  PeriodSummary,
  ProductStat,
} from "./sales-analytics.types";
import { fmtPct, fmtShortDate, fmtValue } from "./sales-analytics.helpers";
import { fmtMoney } from "../components/report-ui";

type Props = {
  mode: NavTab;
  fromDate: string;
  toDate: string;
  currentSummary: PeriodSummary;
  compareA: PeriodSummary;
  compareB: PeriodSummary;
  compareMetrics: CompareMetric[];
  sortedProducts: ProductStat[];
  generatedAt: string;
};

const colors = {
  text: "#1f1b14",
  muted: "#766b59",
  lightMuted: "#9a9386",
  line: "#eadfc2",
  softLine: "#f1e6c9",
  cream: "#fffdf8",
  cream2: "#fff8e6",
  honey: "#d6a324",
  honeyDark: "#8a6a00",
  dark: "#2f2718",
  green: "#15803d",
  red: "#b91c1c",
};

const page: CSSProperties = {
  width: 794,
  minHeight: 1123,
  background: "#ffffff",
  color: colors.text,
  padding: 38,
  fontFamily: "Arial, Helvetica, sans-serif",
  boxSizing: "border-box",
};

const header: CSSProperties = {
  borderBottom: `4px solid ${colors.honey}`,
  paddingBottom: 18,
};

const kicker: CSSProperties = {
  color: colors.honeyDark,
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 2.4,
  textTransform: "uppercase",
};

const h1: CSSProperties = {
  margin: "8px 0 0",
  color: colors.text,
  fontSize: 30,
  lineHeight: 1.05,
  fontWeight: 900,
  letterSpacing: -1,
};

const metaRow: CSSProperties = {
  marginTop: 10,
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  color: colors.muted,
  fontSize: 11,
  fontWeight: 700,
};

const grid4: CSSProperties = {
  marginTop: 24,
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: 10,
};

const grid2: CSSProperties = {
  marginTop: 24,
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: 10,
};

const card: CSSProperties = {
  border: `1px solid ${colors.line}`,
  background: colors.cream,
  borderRadius: 16,
  padding: 14,
  boxSizing: "border-box",
};

const metricLabel: CSSProperties = {
  color: colors.honeyDark,
  fontSize: 9,
  fontWeight: 900,
  letterSpacing: 1.4,
  textTransform: "uppercase",
};

const metricValue: CSSProperties = {
  marginTop: 8,
  color: colors.text,
  fontSize: 18,
  fontWeight: 900,
  lineHeight: 1.15,
};

const metricSub: CSSProperties = {
  marginTop: 5,
  color: colors.muted,
  fontSize: 10,
  fontWeight: 700,
};

const sectionWrap: CSSProperties = {
  marginTop: 28,
};

const sectionTitle: CSSProperties = {
  margin: 0,
  color: colors.text,
  fontSize: 15,
  fontWeight: 900,
};

const sectionSub: CSSProperties = {
  margin: "4px 0 0",
  color: colors.muted,
  fontSize: 10,
};

const table: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  marginTop: 10,
  fontSize: 10.5,
};

const thBase: CSSProperties = {
  border: `1px solid ${colors.line}`,
  background: colors.cream2,
  color: colors.honeyDark,
  padding: "8px 9px",
  fontSize: 9,
  fontWeight: 900,
  letterSpacing: 1.1,
  textTransform: "uppercase",
};

const tdBase: CSSProperties = {
  border: `1px solid ${colors.line}`,
  color: colors.text,
  padding: "8px 9px",
  verticalAlign: "top",
};

const footer: CSSProperties = {
  marginTop: 34,
  borderTop: `1px solid ${colors.line}`,
  paddingTop: 12,
  color: colors.lightMuted,
  fontSize: 9,
  fontWeight: 700,
};

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={card}>
      <div style={metricLabel}>{label}</div>
      <div style={metricValue}>{value}</div>
      {sub ? <div style={metricSub}>{sub}</div> : null}
    </div>
  );
}

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section style={sectionWrap}>
      <h2 style={sectionTitle}>{title}</h2>
      {sub ? <p style={sectionSub}>{sub}</p> : null}
      {children}
    </section>
  );
}

function Th({ children, right = false }: { children: React.ReactNode; right?: boolean }) {
  return <th style={{ ...thBase, textAlign: right ? "right" : "left" }}>{children}</th>;
}

function Td({ children, right = false }: { children: React.ReactNode; right?: boolean }) {
  return <td style={{ ...tdBase, textAlign: right ? "right" : "left" }}>{children}</td>;
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
  generatedAt,
}: Props) {
  const isCompare = mode === "compare";
  const discountRate = currentSummary.gross
    ? (currentSummary.discounts / currentSummary.gross) * 100
    : 0;

  return (
    <div id="sales-analytics-pdf-template" style={page}>
      <header style={header}>
        <div style={kicker}>Pollinator Beekeeping &amp; Apitherapy</div>
        <h1 style={h1}>{isCompare ? "Sales Comparison Report" : "Sales Analytics Report"}</h1>
        <div style={metaRow}>
          <span>
            {isCompare
              ? `${compareA.from} to ${compareA.to} compared with ${compareB.from} to ${compareB.to}`
              : `${fromDate} to ${toDate}`}
          </span>
          <span>Generated {generatedAt}</span>
        </div>
      </header>

      {isCompare ? (
        <>
          <section style={grid2}>
            <MetricCard
              label="Reference Period"
              value={fmtMoney(compareA.revenue)}
              sub={`${compareA.sales} sale${compareA.sales !== 1 ? "s" : ""}`}
            />
            <MetricCard
              label="Comparison Period"
              value={fmtMoney(compareB.revenue)}
              sub={`${compareB.sales} sale${compareB.sales !== 1 ? "s" : ""}`}
            />
          </section>

          <Section title="Comparison Metrics" sub="Comparison period measured against the reference period.">
            <table style={table}>
              <thead>
                <tr>
                  <Th>Metric</Th>
                  <Th right>Reference</Th>
                  <Th right>Comparison</Th>
                  <Th right>Difference</Th>
                  <Th right>Change</Th>
                </tr>
              </thead>
              <tbody>
                {compareMetrics.map((m) => (
                  <tr key={m.label}>
                    <Td>{m.label}</Td>
                    <Td right>{fmtValue(m.a, m.money)}</Td>
                    <Td right>{fmtValue(m.b, m.money)}</Td>
                    <Td right>{fmtValue(m.diff, m.money)}</Td>
                    <Td right>{fmtPct(m.pct)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        </>
      ) : (
        <>
          <section style={grid4}>
            <MetricCard
              label="Revenue"
              value={fmtMoney(currentSummary.revenue)}
              sub={`${fmtMoney(currentSummary.avgDaily)}/day`}
            />
            <MetricCard
              label="Sales"
              value={String(currentSummary.sales)}
              sub={`${currentSummary.daily.length} active day${currentSummary.daily.length !== 1 ? "s" : ""}`}
            />
            <MetricCard
              label="Average Basket"
              value={fmtMoney(currentSummary.avgBasket)}
              sub="Per transaction"
            />
            <MetricCard
              label="Discounts"
              value={fmtMoney(currentSummary.discounts)}
              sub={`${discountRate.toFixed(1)}% of gross`}
            />
          </section>

          <Section title="Daily Summary" sub="Revenue and transaction totals by day.">
            <table style={table}>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th right>Sales</Th>
                  <Th right>Gross</Th>
                  <Th right>Discounts</Th>
                  <Th right>Net</Th>
                </tr>
              </thead>
              <tbody>
                {currentSummary.daily.length ? (
                  [...currentSummary.daily].reverse().slice(0, 22).map((r) => (
                    <tr key={r.day}>
                      <Td>{fmtShortDate(r.day)}</Td>
                      <Td right>{r.sales_count}</Td>
                      <Td right>{fmtMoney(r.subtotal)}</Td>
                      <Td right>{fmtMoney(r.discount_total)}</Td>
                      <Td right>{fmtMoney(r.total)}</Td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <Td>No daily sales data for this range.</Td>
                    <Td right>—</Td>
                    <Td right>—</Td>
                    <Td right>—</Td>
                    <Td right>—</Td>
                  </tr>
                )}
              </tbody>
            </table>
          </Section>

          <Section title="Top Products" sub="Highest product contribution in the selected range.">
            <table style={table}>
              <thead>
                <tr>
                  <Th>Rank</Th>
                  <Th>Product</Th>
                  <Th right>Revenue</Th>
                  <Th right>Units</Th>
                  <Th right>Sales In</Th>
                </tr>
              </thead>
              <tbody>
                {sortedProducts.length ? (
                  sortedProducts.slice(0, 12).map((p, i) => (
                    <tr key={p.product_id}>
                      <Td>#{i + 1}</Td>
                      <Td>{p.name}</Td>
                      <Td right>{fmtMoney(p.revenue)}</Td>
                      <Td right>{p.qty.toLocaleString("en-KE")}</Td>
                      <Td right>{p.appearances}</Td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <Td>No product data for this range.</Td>
                    <Td>—</Td>
                    <Td right>—</Td>
                    <Td right>—</Td>
                    <Td right>—</Td>
                  </tr>
                )}
              </tbody>
            </table>
          </Section>

          <Section title="Payment Methods" sub="Revenue split by payment method.">
            <table style={table}>
              <thead>
                <tr>
                  <Th>Method</Th>
                  <Th right>Transactions</Th>
                  <Th right>Revenue</Th>
                </tr>
              </thead>
              <tbody>
                {currentSummary.payments.length ? (
                  currentSummary.payments.map((p) => (
                    <tr key={p.method}>
                      <Td>{p.method}</Td>
                      <Td right>{p.count}</Td>
                      <Td right>{fmtMoney(p.revenue)}</Td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <Td>No payment data for this range.</Td>
                    <Td right>—</Td>
                    <Td right>—</Td>
                  </tr>
                )}
              </tbody>
            </table>
          </Section>
        </>
      )}

      <footer style={footer}>
        Generated from the Pollinator dashboard. Values are based on sales records available at export time.
      </footer>
    </div>
  );
}
