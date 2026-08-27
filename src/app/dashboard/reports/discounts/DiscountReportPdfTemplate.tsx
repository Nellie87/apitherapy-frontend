import type { DiscountReportRow } from "@/lib/api/reports";
import { PdfReportHeader } from "../components/PdfReportHeader";
import {
  PdfFooter,
  PdfMetricCard,
  PdfSection,
  PdfStory,
  pdfGrid4,
  pdfPage,
} from "../components/pdf-ui";
import { PDF_HEX } from "@/lib/pdfBrand";

type CategoryStat = {
  category: string;
  lines: number;
  qty: number;
  saved: number;
  sales: number;
};

type InfluenceRow = {
  label: string;
  sales: number;
  revenue: number;
  avgBasket: number;
  share: number;
};

type Totals = {
  lines: number;
  discountedQty: number;
  totalSaved: number;
  affectedSales: number;
  avgSavedPerSale: number;
  avgSavedPerLine: number;
  discountRate: number;
};

const th = {
  padding: "9px 8px",
  borderBottom: `1px solid ${PDF_HEX.line}`,
  color: PDF_HEX.muted,
  fontSize: "10px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  textAlign: "left" as const,
};

const td = {
  padding: "10px 8px",
  borderBottom: `1px solid ${PDF_HEX.softLine}`,
  fontSize: "12px",
  color: PDF_HEX.dark,
  verticalAlign: "top" as const,
};

function fmtMoney(value: number) {
  return `Ksh ${Number(value || 0).toLocaleString("en-KE", {
    maximumFractionDigits: 0,
  })}`;
}

function fmtNumber(value: number) {
  return Number(value || 0).toLocaleString("en-KE", {
    maximumFractionDigits: 0,
  });
}

function fmtPct(value: number) {
  return `${Number(value || 0).toFixed(1)}%`;
}

export function DiscountReportPdfTemplate({
  from,
  to,
  category,
  totals,
  rows,
  categoryStats,
  influenceRows,
  discountInfluence,
}: {
  from: string;
  to: string;
  category: string;
  totals: Totals;
  rows: DiscountReportRow[];
  categoryStats: CategoryStat[];
  influenceRows: InfluenceRow[];
  discountInfluence: {
    avgLift: number | null;
    revenueShare: number;
    salesShare: number;
    conclusion: string;
  };
}) {
  const topRows = rows.slice(0, 24);
  const topCategories = categoryStats.slice(0, 8);

  return (
    <div id="discount-report-pdf" style={pdfPage}>
      <PdfReportHeader
        title="Discount report"
        subtitle={`${from} to ${to} · ${category === "all" ? "All categories" : category}`}
      />

      <section style={{ ...pdfGrid4, marginBottom: 8 }}>
        <PdfMetricCard label="Total discounts" value={fmtMoney(totals.totalSaved)} />
        <PdfMetricCard label="Affected sales" value={fmtNumber(totals.affectedSales)} />
        <PdfMetricCard label="Discounted qty" value={fmtNumber(totals.discountedQty)} />
        <PdfMetricCard label="Discount rate" value={fmtPct(totals.discountRate)} />
      </section>

      <PdfStory>{discountInfluence.conclusion}</PdfStory>

      <PdfSection title="Discount vs sales influence">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Segment</th>
              <th style={{ ...th, textAlign: "right" }}>Sales</th>
              <th style={{ ...th, textAlign: "right" }}>Revenue</th>
              <th style={{ ...th, textAlign: "right" }}>Avg Basket</th>
              <th style={{ ...th, textAlign: "right" }}>Revenue Share</th>
            </tr>
          </thead>
          <tbody>
            {influenceRows.map((row) => (
              <tr key={row.label}>
                <td style={td}>{row.label}</td>
                <td style={{ ...td, textAlign: "right" }}>{fmtNumber(row.sales)}</td>
                <td style={{ ...td, textAlign: "right" }}>{fmtMoney(row.revenue)}</td>
                <td style={{ ...td, textAlign: "right" }}>{fmtMoney(row.avgBasket)}</td>
                <td style={{ ...td, textAlign: "right" }}>{fmtPct(row.share)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </PdfSection>

      <PdfSection title="Category breakdown">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Category</th>
              <th style={{ ...th, textAlign: "right" }}>Saved</th>
              <th style={{ ...th, textAlign: "right" }}>Qty</th>
              <th style={{ ...th, textAlign: "right" }}>Lines</th>
              <th style={{ ...th, textAlign: "right" }}>Sales</th>
            </tr>
          </thead>
          <tbody>
            {topCategories.map((row) => (
              <tr key={row.category}>
                <td style={td}>{row.category}</td>
                <td style={{ ...td, textAlign: "right" }}>{fmtMoney(row.saved)}</td>
                <td style={{ ...td, textAlign: "right" }}>{fmtNumber(row.qty)}</td>
                <td style={{ ...td, textAlign: "right" }}>{fmtNumber(row.lines)}</td>
                <td style={{ ...td, textAlign: "right" }}>{fmtNumber(row.sales)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </PdfSection>

      <PdfSection title="Discounted line items">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Sale</th>
              <th style={th}>Product</th>
              <th style={th}>Category</th>
              <th style={{ ...th, textAlign: "right" }}>Qty</th>
              <th style={{ ...th, textAlign: "right" }}>Saved</th>
              <th style={{ ...th, textAlign: "right" }}>Final</th>
            </tr>
          </thead>
          <tbody>
            {topRows.map((row) => (
              <tr key={`${row.sale_id}-${row.product_id}-${row.name}`}>
                <td style={td}>{row.sale_no}</td>
                <td style={td}>{row.name}</td>
                <td style={td}>{row.category || "Uncategorized"}</td>
                <td style={{ ...td, textAlign: "right" }}>{fmtNumber(row.qty)}</td>
                <td style={{ ...td, textAlign: "right" }}>{fmtMoney(row.saved_total)}</td>
                <td style={{ ...td, textAlign: "right" }}>{fmtMoney(row.final_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </PdfSection>

      <PdfFooter extra="generated from the dashboard" />
    </div>
  );
}
