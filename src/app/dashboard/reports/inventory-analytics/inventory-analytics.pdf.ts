import type {
  CategoryData,
  Enriched,
  InventoryInsight,
  Totals,
} from "./inventory-analytics.types";
import { fmtMoney } from "./inventory-analytics.helpers";

export function printInventoryPdfReport(params: {
  rows: Enriched[];
  totals: Totals;
  categoryData: CategoryData[];
  insights: InventoryInsight[];
}) {
  const { rows, totals, categoryData, insights } = params;

  const today = new Date().toLocaleDateString("en-KE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const riskPct = ((totals.atRiskVal / (totals.totalVal || 1)) * 100).toFixed(1);

  const html = `
  <html>
    <head>
      <title>Inventory Analytics Report</title>
      <style>
        body { font-family: Arial, sans-serif; color: #0f172a; padding: 32px; background: #fff; }
        .header { border-bottom: 3px solid #f59e0b; padding-bottom: 16px; margin-bottom: 24px; }
        h1 { margin: 0; font-size: 28px; }
        h2 { margin-top: 28px; font-size: 18px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
        .muted { color: #64748b; font-size: 13px; }
        .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 20px 0; }
        .card { border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px; }
        .label { color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 700; }
        .value { font-size: 20px; font-weight: 800; margin-top: 6px; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
        th { background: #f8fafc; text-align: left; color: #475569; padding: 9px; border-bottom: 1px solid #e2e8f0; }
        td { padding: 9px; border-bottom: 1px solid #e2e8f0; }
        .right { text-align: right; }
        .badge { display: inline-block; padding: 4px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; background: #fef3c7; color: #92400e; }
        .insight { border-left: 4px solid #f59e0b; padding: 10px 12px; margin: 8px 0; background: #fff; }
        .print-btn { margin-top: 28px; padding: 10px 14px; border: 0; border-radius: 10px; background: #f59e0b; color: #fff; font-weight: 700; cursor: pointer; }
        @media print {
          body { padding: 20px; }
          .no-print { display: none; }
          tr { page-break-inside: avoid; page-break-after: auto; }
        }
      </style>
    </head>

    <body>
      <div class="header">
        <h1>Inventory Analytics Report</h1>
        <div class="muted">Generated on ${today}</div>
        <div class="muted">${rows.length} products analysed</div>
      </div>

      <div class="grid">
        <div class="card"><div class="label">Total SKUs</div><div class="value">${rows.length}</div></div>
        <div class="card"><div class="label">Stock Value</div><div class="value">${fmtMoney(totals.totalVal)}</div></div>
        <div class="card"><div class="label">At-Risk Value</div><div class="value">${fmtMoney(totals.atRiskVal)}</div></div>
        <div class="card"><div class="label">Average Coverage</div><div class="value">${totals.avgCoverage.toFixed(1)}×</div></div>
      </div>

      <h2>Executive Summary</h2>
      <p>
        This report reviews inventory value, stock health, reorder urgency,
        category exposure, and capital tied up in at-risk products.
      </p>
      <p>
        Total inventory value is <strong>${fmtMoney(totals.totalVal)}</strong>.
        At-risk inventory value is <strong>${fmtMoney(totals.atRiskVal)}</strong>,
        representing <strong>${riskPct}%</strong> of total inventory value.
      </p>
      <p>
        Current stock health: <strong>${totals.out}</strong> out of stock,
        <strong> ${totals.critical}</strong> critical,
        <strong> ${totals.low}</strong> low, and
        <strong> ${totals.ok}</strong> healthy.
      </p>

      <h2>Key Insights</h2>
      ${insights
        .map(
          (ins) => `
          <div class="insight">
            <strong>${ins.icon} ${ins.title}</strong>
            <div class="muted">${ins.detail}</div>
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
                <td>${cat.name}</td>
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

      <h2>Reorder Priority List</h2>
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
                <td>${r.name}</td>
                <td>${r.sku ?? "—"}</td>
                <td>${r.category ?? "—"}</td>
                <td class="right">${r.qty_on_hand}</td>
                <td class="right">${r.reorder_level}</td>
                <td><span class="badge">${r.status}</span></td>
                <td class="right">${r.coverage >= 99 ? "∞" : `${r.coverage}×`}</td>
                <td class="right">${r.urgency}</td>
              </tr>`
            )
            .join("")}
        </tbody>
      </table>

      <h2>Inventory Valuation</h2>
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>SKU</th>
            <th>Category</th>
            <th>Status</th>
            <th class="right">Qty</th>
            <th class="right">Unit Price</th>
            <th class="right">Total Value</th>
          </tr>
        </thead>
        <tbody>
          ${[...rows]
            .sort((a, b) => b.total_value - a.total_value)
            .slice(0, 60)
            .map(
              (r) => `
              <tr>
                <td>${r.name}</td>
                <td>${r.sku ?? "—"}</td>
                <td>${r.category ?? "—"}</td>
                <td>${r.status}</td>
                <td class="right">${r.qty_on_hand}</td>
                <td class="right">${fmtMoney(r.unit_price)}</td>
                <td class="right">${fmtMoney(r.total_value)}</td>
              </tr>`
            )
            .join("")}
        </tbody>
      </table>

      <h2>Recommended Actions</h2>
      <ol>
        <li>Restock out-of-stock products immediately.</li>
        <li>Place reorder requests for critical products before they hit zero.</li>
        <li>Review high-value products with low coverage to reduce revenue risk.</li>
        <li>Check products with stock but no reorder level configured.</li>
        <li>Prioritise supplier agreements for top-value categories.</li>
      </ol>

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
  }, 500);
}