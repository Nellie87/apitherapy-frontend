import type {
  CategoryData,
  Enriched,
  InventoryInsight,
  Totals,
} from "./inventory-analytics.types";
import { fmtMoney } from "./inventory-analytics.helpers";
import {
  PDF_COMPANY_NAME,
  PDF_HEX,
  PDF_LOGO_WORDMARK,
  pdfAssetUrl,
} from "@/lib/pdfBrand";

const esc = (v: unknown) =>
  String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

export function printInventoryPdfReport(params: {
  rows: Enriched[];
  totals: Totals;
  categoryData: CategoryData[];
  insights: InventoryInsight[];
  from?: string;
  to?: string;
}) {
  const { rows, totals, categoryData, insights, from, to } = params;

  const today = new Date().toLocaleDateString("en-KE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const period =
    from || to
      ? `${from || "Start"} to ${to || "Today"}`
      : "All available inventory records";

  const riskPct = ((totals.atRiskVal / (totals.totalVal || 1)) * 100).toFixed(1);
  const logoUrl = pdfAssetUrl(PDF_LOGO_WORDMARK);

  const html = `
  <html>
    <head>
      <title>Inventory Analytics Report — ${esc(PDF_COMPANY_NAME)}</title>
      <style>
        body {
          font-family: "DM Sans", Arial, sans-serif;
          color: ${PDF_HEX.dark};
          padding: 40px 42px;
          background: ${PDF_HEX.white};
        }
        .header {
          border-bottom: 1px solid ${PDF_HEX.line};
          padding-bottom: 18px;
          margin-bottom: 22px;
        }
        .brand-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }
        .brand-logo { height: 40px; width: auto; object-fit: contain; }
        .brand-name {
          color: ${PDF_HEX.muted};
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          text-align: right;
          max-width: 220px;
          line-height: 1.45;
        }
        .accent {
          margin-top: 18px;
          width: 36px;
          height: 3px;
          background: ${PDF_HEX.honey};
          border-radius: 2px;
        }
        h1 {
          margin: 12px 0 0;
          font-size: 32px;
          color: ${PDF_HEX.dark};
          font-family: "DM Serif Display", Georgia, serif;
          font-weight: 400;
          letter-spacing: -0.02em;
        }
        h2 {
          margin-top: 28px;
          margin-bottom: 8px;
          font-size: 16px;
          color: ${PDF_HEX.dark};
          font-weight: 700;
        }
        .muted { color: ${PDF_HEX.muted}; font-size: 13px; font-weight: 500; }
        .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 8px 0 20px; }
        .card {
          border: 1px solid ${PDF_HEX.line};
          border-top: 3px solid ${PDF_HEX.honey};
          border-radius: 12px;
          padding: 14px;
          background: ${PDF_HEX.white};
        }
        .label {
          color: ${PDF_HEX.muted};
          font-size: 10px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          font-weight: 700;
        }
        .value { font-size: 22px; font-weight: 700; margin-top: 8px; letter-spacing: -0.03em; color: ${PDF_HEX.dark}; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
        th {
          text-align: left;
          color: ${PDF_HEX.muted};
          padding: 9px 8px;
          border-bottom: 1px solid ${PDF_HEX.line};
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        td { padding: 10px 8px; border-bottom: 1px solid ${PDF_HEX.softLine}; color: ${PDF_HEX.dark}; }
        .right { text-align: right; }
        .badge {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          background: ${PDF_HEX.cream};
          color: ${PDF_HEX.dark};
        }
        .insight {
          border-left: 3px solid ${PDF_HEX.honey};
          padding: 10px 0 10px 14px;
          margin: 10px 0;
        }
        .insight strong { font-size: 14px; color: ${PDF_HEX.dark}; }
        .print-btn {
          margin-top: 28px;
          padding: 10px 14px;
          border: 0;
          border-radius: 10px;
          background: ${PDF_HEX.dark};
          color: ${PDF_HEX.white};
          font-weight: 700;
          cursor: pointer;
        }
        .footer {
          margin-top: 32px;
          padding-top: 12px;
          border-top: 1px solid ${PDF_HEX.line};
          color: ${PDF_HEX.lightMuted};
          font-size: 11px;
        }
        @media print {
          body { padding: 20px; }
          .no-print { display: none; }
          tr { page-break-inside: avoid; }
        }
      </style>
    </head>

    <body>
      <div class="header">
        <div class="brand-row">
          <img class="brand-logo" src="${esc(logoUrl)}" alt="${esc(PDF_COMPANY_NAME)}" />
          <div class="brand-name">${esc(PDF_COMPANY_NAME)}</div>
        </div>
        <div class="accent"></div>
        <h1>Inventory analytics</h1>
        <div class="muted" style="margin-top:8px">Generated ${today} · ${esc(period)} · ${rows.length} products</div>
      </div>

      <div class="grid">
        <div class="card"><div class="label">Total SKUs</div><div class="value">${rows.length}</div></div>
        <div class="card"><div class="label">Stock Value</div><div class="value">${fmtMoney(totals.totalVal)}</div></div>
        <div class="card"><div class="label">At-Risk Value</div><div class="value">${fmtMoney(totals.atRiskVal)}</div></div>
        <div class="card"><div class="label">Average Coverage</div><div class="value">${totals.avgCoverage.toFixed(1)}×</div></div>
      </div>

      <h2>Summary</h2>
      <p>
        Total inventory value is <strong>${fmtMoney(totals.totalVal)}</strong>.
        At-risk inventory value is <strong>${fmtMoney(totals.atRiskVal)}</strong>,
        representing <strong>${riskPct}%</strong> of total inventory value.
      </p>
      <p>
        Stock health: <strong>${totals.out}</strong> out of stock,
        <strong> ${totals.critical}</strong> critical,
        <strong> ${totals.low}</strong> low, and
        <strong> ${totals.ok}</strong> healthy.
      </p>

      <h2>Recommendations</h2>
      ${insights
        .map(
          (ins) => `
          <div class="insight">
            <strong>${esc(ins.title)}</strong>
            <div class="muted" style="margin-top:6px">${esc(ins.detail)}</div>
          </div>`
        )
        .join("")}

      <h2>Category Summary</h2>
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th class="right">Products</th>
            <th class="right">At Risk</th>
            <th class="right">Risk %</th>
            <th class="right">Quantity</th>
            <th class="right">Stock Value</th>
          </tr>
        </thead>
        <tbody>
          ${categoryData
            .map((cat) => {
              const pct = cat.count ? (cat.atRisk / cat.count) * 100 : 0;
              return `
              <tr>
                <td>${esc(cat.name)}</td>
                <td class="right">${cat.count}</td>
                <td class="right">${cat.atRisk}</td>
                <td class="right">${pct.toFixed(0)}%</td>
                <td class="right">${cat.qty.toLocaleString()}</td>
                <td class="right">${fmtMoney(cat.value)}</td>
              </tr>`;
            })
            .join("")}
        </tbody>
      </table>

      <h2>Reorder Priority</h2>
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>SKU</th>
            <th>Category</th>
            <th class="right">Qty</th>
            <th class="right">Reorder</th>
            <th>Status</th>
            <th class="right">Coverage</th>
            <th class="right">Urgency</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .filter((r) => r.status !== "ok")
            .sort((a, b) => b.urgency - a.urgency)
            .slice(0, 40)
            .map(
              (r) => `
              <tr>
                <td>${esc(r.name)}</td>
                <td>${esc(r.sku ?? "—")}</td>
                <td>${esc(r.category ?? "—")}</td>
                <td class="right">${r.qty_on_hand}</td>
                <td class="right">${r.reorder_level}</td>
                <td><span class="badge">${esc(r.status)}</span></td>
                <td class="right">${r.coverage >= 99 ? "∞" : `${r.coverage}×`}</td>
                <td class="right">${r.urgency}</td>
              </tr>`
            )
            .join("")}
        </tbody>
      </table>

      <div class="footer">Generated from the ${esc(PDF_COMPANY_NAME)} dashboard.</div>
      <button class="print-btn no-print" onclick="window.print()">Print / Save PDF</button>
    </body>
  </html>
  `;

  const win = window.open("", "_blank", "width=1100,height=800");
  if (!win) return;

  win.document.write(html);
  win.document.close();

  setTimeout(() => {
    win.focus();
    win.print();
  }, 400);
}
