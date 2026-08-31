"use client";

import { PdfReportHeader } from "./PdfReportHeader";
import {
  PdfBar,
  PdfChartFrame,
  PdfEmpty,
  PdfFooter,
  PdfMetricCard,
  PdfSection,
  PdfStory,
  pdfGrid4,
  pdfPage,
} from "./pdf-ui";
import { PDF_HEX } from "@/lib/pdfBrand";

export type InventoryPdfStatus = "out" | "critical" | "low" | "ok";

export type InventoryPdfRow = {
  product_id: string;
  name: string;
  sku?: string | null;
  category?: string | null;
  qty_on_hand: number;
  reorder_level: number;
  status: InventoryPdfStatus | string;
  total_value: number;
  coverage: number;
  urgency: number;
};

export type InventoryPdfCategory = {
  name: string;
  value: number;
  qty: number;
  count: number;
  atRisk: number;
};

export type InventoryPdfTotals = {
  out: number;
  critical: number;
  low: number;
  ok: number;
  totalVal: number;
  atRiskVal: number;
  avgCoverage: number;
  totalQty?: number;
};

export type InventoryPdfInsight = {
  type: string;
  title: string;
  detail: string;
};

type Props = {
  rows: InventoryPdfRow[];
  totals: InventoryPdfTotals;
  categoryData: InventoryPdfCategory[];
  insights?: InventoryPdfInsight[];
  period: string;
  generatedAt: string;
};

const fmtMoney = (v: number) =>
  `Ksh ${Number(v || 0).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;

const STATUS: Record<
  InventoryPdfStatus,
  { label: string; color: string; bg: string }
> = {
  out: { label: "Out of stock", color: PDF_HEX.red, bg: "#FEF2F2" },
  critical: { label: "Critical", color: "#C2410C", bg: "#FFF7ED" },
  low: { label: "Low", color: PDF_HEX.honeyDark, bg: "#FFFBEB" },
  ok: { label: "Healthy", color: PDF_HEX.green, bg: "#F0FDF4" },
};

const th = {
  padding: "9px 8px",
  borderBottom: `1px solid ${PDF_HEX.line}`,
  color: PDF_HEX.muted,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  textAlign: "left" as const,
};

const td = {
  padding: "10px 8px",
  borderBottom: `1px solid ${PDF_HEX.softLine}`,
  fontSize: 12,
  color: PDF_HEX.dark,
  verticalAlign: "middle" as const,
};

function statusOf(value: string): InventoryPdfStatus {
  if (value === "out" || value === "critical" || value === "low" || value === "ok") {
    return value;
  }
  return "ok";
}

function StatusPill({ status }: { status: string }) {
  const cfg = STATUS[statusOf(status)];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 8px",
        borderRadius: 999,
        background: cfg.bg,
        color: cfg.color,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {cfg.label}
    </span>
  );
}

function HealthMix({ totals }: { totals: InventoryPdfTotals }) {
  const segs = [
    { label: "Out", value: totals.out, color: PDF_HEX.red },
    { label: "Critical", value: totals.critical, color: "#C2410C" },
    { label: "Low", value: totals.low, color: PDF_HEX.honey },
    { label: "Healthy", value: totals.ok, color: PDF_HEX.green },
  ];
  const total = segs.reduce((sum, s) => sum + s.value, 0) || 1;

  return (
    <PdfChartFrame>
      <div
        style={{
          display: "flex",
          height: 14,
          overflow: "hidden",
          borderRadius: 999,
          background: "#F3EEE4",
        }}
      >
        {segs.map((s) =>
          s.value > 0 ? (
            <div
              key={s.label}
              style={{
                width: `${(s.value / total) * 100}%`,
                background: s.color,
                height: "100%",
              }}
            />
          ) : null,
        )}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 14 }}>
        <tbody>
          {segs.map((s) => (
            <tr key={s.label}>
              <td style={{ padding: "6px 8px 6px 0", width: 110 }}>
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: s.color,
                    marginRight: 8,
                  }}
                />
                <span style={{ fontSize: 12, fontWeight: 700, color: PDF_HEX.dark }}>
                  {s.label}
                </span>
              </td>
              <td style={{ padding: "6px 8px", fontSize: 12, color: PDF_HEX.muted }}>
                {s.value} product{s.value !== 1 ? "s" : ""}
              </td>
              <td
                style={{
                  padding: "6px 0 6px 8px",
                  textAlign: "right",
                  fontSize: 12,
                  fontWeight: 700,
                  color: PDF_HEX.dark,
                }}
              >
                {((s.value / total) * 100).toFixed(0)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </PdfChartFrame>
  );
}

function CategoryBars({ categories, totalVal }: { categories: InventoryPdfCategory[]; totalVal: number }) {
  const max = Math.max(...categories.map((c) => c.value), 1);

  if (!categories.length) {
    return <PdfEmpty>No category breakdown available.</PdfEmpty>;
  }

  return (
    <PdfChartFrame>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {categories.slice(0, 8).map((cat) => {
            const riskPct = cat.count ? (cat.atRisk / cat.count) * 100 : 0;
            return (
              <tr key={cat.name}>
                <td style={{ padding: "10px 12px 10px 0", verticalAlign: "middle" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: PDF_HEX.dark }}>
                    {cat.name}
                  </div>
                  <div style={{ marginTop: 3 }}>
                    <PdfBar pct={Math.max(4, (cat.value / max) * 100)} color={PDF_HEX.honey} />
                  </div>
                  <div style={{ marginTop: 4, fontSize: 11, color: PDF_HEX.muted, fontWeight: 500 }}>
                    {cat.count} product{cat.count !== 1 ? "s" : ""} · {cat.atRisk} at risk
                    {cat.count ? ` (${riskPct.toFixed(0)}%)` : ""}
                  </div>
                </td>
                <td
                  style={{
                    width: 120,
                    padding: "10px 0 10px 8px",
                    textAlign: "right",
                    fontSize: 13,
                    fontWeight: 700,
                    color: PDF_HEX.dark,
                    whiteSpace: "nowrap",
                    verticalAlign: "middle",
                  }}
                >
                  {fmtMoney(cat.value)}
                  <div style={{ marginTop: 2, fontSize: 11, fontWeight: 500, color: PDF_HEX.muted }}>
                    {totalVal ? `${((cat.value / totalVal) * 100).toFixed(0)}% of value` : ""}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </PdfChartFrame>
  );
}

export function InventoryReportPdfTemplate({
  rows,
  totals,
  categoryData,
  insights = [],
  period,
  generatedAt,
}: Props) {
  const riskPct = ((totals.atRiskVal / (totals.totalVal || 1)) * 100).toFixed(1);
  const skuCount = rows.length;
  const reorder = [...rows]
    .filter((r) => r.status !== "ok")
    .sort((a, b) => b.urgency - a.urgency)
    .slice(0, 28);
  const topValue = [...rows]
    .sort((a, b) => b.total_value - a.total_value)
    .slice(0, 5);
  const topMax = Math.max(...topValue.map((r) => r.total_value), 1);

  const story = skuCount
    ? `Stock on hand is worth ${fmtMoney(totals.totalVal)}. ${fmtMoney(
        totals.atRiskVal,
      )} (${riskPct}%) sits in products that are low, critical, or out of stock. ${
        totals.out
      } SKU${totals.out !== 1 ? "s are" : " is"} out of stock, ${
        totals.critical + totals.low
      } need a reorder, and ${totals.ok} ${
        totals.ok === 1 ? "is" : "are"
      } healthy. Average coverage is ${totals.avgCoverage.toFixed(1)}× the reorder level.`
    : "No inventory records were available for this export.";

  return (
    <div id="inventory-report-pdf" style={pdfPage}>
      <PdfReportHeader
        title="Inventory report"
        subtitle="Stock value, health mix, and reorder priority"
        metaLeft={period}
        metaRight={`Generated ${generatedAt}`}
      />

      <section style={pdfGrid4}>
        <PdfMetricCard
          label="Stock value"
          value={fmtMoney(totals.totalVal)}
          hint={`${skuCount} product${skuCount !== 1 ? "s" : ""} tracked`}
        />
        <PdfMetricCard
          label="At-risk value"
          value={fmtMoney(totals.atRiskVal)}
          hint={`${riskPct}% of stock value`}
        />
        <PdfMetricCard
          label="Out of stock"
          value={String(totals.out)}
          hint={`${totals.critical} critical · ${totals.low} low`}
        />
        <PdfMetricCard
          label="Avg coverage"
          value={`${totals.avgCoverage.toFixed(1)}×`}
          hint="On-hand vs reorder level"
        />
      </section>

      <PdfStory>{story}</PdfStory>

      <PdfSection
        title="Stock health"
        caption="How many products are healthy, low, critical, or sold out."
      >
        <HealthMix totals={totals} />
      </PdfSection>

      <PdfSection
        title="Value by category"
        caption="Where inventory value is concentrated."
      >
        <CategoryBars categories={categoryData} totalVal={totals.totalVal} />
      </PdfSection>

      {topValue.length > 0 ? (
        <PdfSection
          title="Highest-value stock"
          caption="Products tying up the most cost value."
        >
          <PdfChartFrame>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {topValue.map((row, i) => (
                  <tr key={row.product_id}>
                    <td
                      style={{
                        width: 28,
                        padding: "10px 8px 10px 0",
                        fontSize: 12,
                        fontWeight: 700,
                        color: PDF_HEX.lightMuted,
                      }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </td>
                    <td style={{ padding: "10px 12px 10px 0" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: PDF_HEX.dark }}>
                        {row.name}
                      </div>
                      <div style={{ marginTop: 3 }}>
                        <PdfBar
                          pct={Math.max(4, (row.total_value / topMax) * 100)}
                          color={PDF_HEX.honey}
                        />
                      </div>
                    </td>
                    <td
                      style={{
                        width: 120,
                        padding: "10px 0 10px 8px",
                        textAlign: "right",
                        fontSize: 13,
                        fontWeight: 700,
                        color: PDF_HEX.dark,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {fmtMoney(row.total_value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PdfChartFrame>
        </PdfSection>
      ) : null}

      <PdfSection
        title="Reorder priority"
        caption="Out-of-stock and below-reorder products, ranked by urgency."
      >
        {reorder.length === 0 ? (
          <PdfEmpty>Every tracked product is at a healthy stock level.</PdfEmpty>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Product</th>
                <th style={{ ...th, textAlign: "right" }}>Qty</th>
                <th style={{ ...th, textAlign: "right" }}>Reorder</th>
                <th style={th}>Status</th>
                <th style={{ ...th, textAlign: "right" }}>Coverage</th>
                <th style={{ ...th, textAlign: "right" }}>Urgency</th>
              </tr>
            </thead>
            <tbody>
              {reorder.map((row) => (
                <tr key={row.product_id}>
                  <td style={td}>
                    <div style={{ fontWeight: 700 }}>{row.name}</div>
                    {row.sku ? (
                      <div style={{ marginTop: 2, fontSize: 11, color: PDF_HEX.muted }}>
                        {row.sku}
                      </div>
                    ) : null}
                  </td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>
                    {row.qty_on_hand.toLocaleString("en-KE")}
                  </td>
                  <td style={{ ...td, textAlign: "right", color: PDF_HEX.muted }}>
                    {row.reorder_level.toLocaleString("en-KE")}
                  </td>
                  <td style={td}>
                    <StatusPill status={row.status} />
                  </td>
                  <td style={{ ...td, textAlign: "right", color: PDF_HEX.muted }}>
                    {row.coverage >= 99 ? "∞" : `${row.coverage.toFixed(2)}×`}
                  </td>
                  <td style={{ ...td, textAlign: "right", width: 90 }}>
                    <div style={{ fontWeight: 700 }}>{row.urgency}</div>
                    <div style={{ marginTop: 4 }}>
                      <PdfBar
                        pct={Math.max(6, row.urgency)}
                        color={
                          row.urgency >= 75
                            ? PDF_HEX.red
                            : row.urgency >= 45
                              ? "#C2410C"
                              : PDF_HEX.honey
                        }
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </PdfSection>

      {insights.length > 0 ? (
        <PdfSection title="What to do next" caption="Actions from the current stock position.">
          <PdfChartFrame>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {insights.map((item, i) => (
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
                      <div style={{ fontSize: 14, fontWeight: 700, color: PDF_HEX.dark }}>
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
      ) : null}

      <PdfFooter extra={`${skuCount} products · generated ${generatedAt}`} />
    </div>
  );
}
