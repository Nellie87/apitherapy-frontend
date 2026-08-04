import type { DiscountReportRow } from "@/lib/api/reports";
import { PdfReportHeader } from "../components/PdfReportHeader";
import { PDF_COMPANY_NAME, PDF_HEX } from "@/lib/pdfBrand";

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

const page = {
  width: "794px",
  minHeight: "1123px",
  background: PDF_HEX.white,
  color: PDF_HEX.dark,
  fontFamily: "Arial, Helvetica, sans-serif",
  padding: "34px",
  boxSizing: "border-box" as const,
};

const card = {
  border: `1px solid ${PDF_HEX.line}`,
  borderRadius: "18px",
  padding: "14px",
  background: PDF_HEX.creamSoft,
};

const th = {
  padding: "9px 8px",
  borderBottom: `1px solid ${PDF_HEX.line}`,
  color: PDF_HEX.honeyDark,
  fontSize: "10px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  textAlign: "left" as const,
};

const td = {
  padding: "9px 8px",
  borderBottom: `1px solid ${PDF_HEX.softLine}`,
  fontSize: "11px",
  color: PDF_HEX.body,
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
    <div id="discount-report-pdf" style={page}>
      <PdfReportHeader
        title="Discount Report"
        subtitle={`${from} to ${to} · ${category === "all" ? "All categories" : category}`}
      />

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "10px",
          marginBottom: "18px",
        }}
      >
        <div style={card}>
          <div style={{ fontSize: "9px", color: PDF_HEX.honeyDark, fontWeight: 700 }}>
            TOTAL DISCOUNTS
          </div>
          <div style={{ marginTop: "7px", fontSize: "18px", fontWeight: 800 }}>
            {fmtMoney(totals.totalSaved)}
          </div>
        </div>

        <div style={card}>
          <div style={{ fontSize: "9px", color: PDF_HEX.honeyDark, fontWeight: 700 }}>
            AFFECTED SALES
          </div>
          <div style={{ marginTop: "7px", fontSize: "18px", fontWeight: 800 }}>
            {fmtNumber(totals.affectedSales)}
          </div>
        </div>

        <div style={card}>
          <div style={{ fontSize: "9px", color: PDF_HEX.honeyDark, fontWeight: 700 }}>
            DISCOUNTED QTY
          </div>
          <div style={{ marginTop: "7px", fontSize: "18px", fontWeight: 800 }}>
            {fmtNumber(totals.discountedQty)}
          </div>
        </div>

        <div style={card}>
          <div style={{ fontSize: "9px", color: PDF_HEX.honeyDark, fontWeight: 700 }}>
            DISCOUNT RATE
          </div>
          <div style={{ marginTop: "7px", fontSize: "18px", fontWeight: 800 }}>
            {fmtPct(totals.discountRate)}
          </div>
        </div>
      </section>

      <section style={{ ...card, marginBottom: "18px", background: "#ffffff" }}>
        <h2 style={{ margin: "0 0 8px", fontSize: "15px" }}>
          Discount vs Sales Influence
        </h2>

        <p style={{ margin: "0 0 12px", color: PDF_HEX.muted, fontSize: "11px" }}>
          {discountInfluence.conclusion}
        </p>

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
                <td style={{ ...td, textAlign: "right" }}>
                  {fmtMoney(row.revenue)}
                </td>
                <td style={{ ...td, textAlign: "right" }}>
                  {fmtMoney(row.avgBasket)}
                </td>
                <td style={{ ...td, textAlign: "right" }}>{fmtPct(row.share)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ marginBottom: "18px" }}>
        <h2 style={{ margin: "0 0 8px", fontSize: "15px" }}>
          Category Breakdown
        </h2>

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
                <td style={{ ...td, textAlign: "right" }}>
                  {fmtNumber(row.lines)}
                </td>
                <td style={{ ...td, textAlign: "right" }}>
                  {fmtNumber(row.sales)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 style={{ margin: "0 0 8px", fontSize: "15px" }}>
          Discounted Line Items
        </h2>

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
                <td style={{ ...td, textAlign: "right" }}>
                  {fmtMoney(row.saved_total)}
                </td>
                <td style={{ ...td, textAlign: "right" }}>
                  {fmtMoney(row.final_price)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <footer
        style={{
          marginTop: "24px",
          paddingTop: "12px",
          borderTop: `1px solid ${PDF_HEX.line}`,
          color: PDF_HEX.lightMuted,
          fontSize: "10px",
        }}
      >
        Generated from the {PDF_COMPANY_NAME} dashboard.
      </footer>
    </div>
  );
}
