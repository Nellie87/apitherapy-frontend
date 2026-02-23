"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import { getSale, listSaleItems, type SaleRow, type SaleItemRow } from "@/lib/api/sales";
import * as S from "./page.styles";

function fmtMoney(v: number) {
  return `Ksh ${Number(v || 0).toFixed(2)}`;
}

function fmtDate(d: string) {
  try {
    return new Date(d).toLocaleString();
  } catch {
    return d;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

type NormalizedItem = {
  id: string;
  product_name: string;
  qty: number;
  base: number;
  discountPerUnit: number;
  final: number;
  lineTotal: number;
};

// ─── PDF builder (unchanged logic) ───────────────────────────────────────────

async function buildAndDownloadPdf(
  sale: SaleRow,
  items: NormalizedItem[],
  kpis: { subtotal: number; discount_total: number; total: number },
  discountedLines: NormalizedItem[]
) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const PW = doc.internal.pageSize.getWidth();
  const MARGIN = 14;
  const CONTENT_W = PW - MARGIN * 2;

  const AMBER    = [245, 158, 11]  as [number, number, number];
  const ZINC9    = [24,  24,  27]  as [number, number, number];
  const ZINC6    = [82,  82,  91]  as [number, number, number];
  const ZINC2    = [228, 228, 231] as [number, number, number];
  const WHITE    = [255, 255, 255] as [number, number, number];
  const AMBER_BG = [255, 251, 235] as [number, number, number];

  let y = MARGIN;

  function text(str: string, x: number, yy: number, opts?: { size?: number; color?: [number,number,number]; bold?: boolean; align?: "left"|"right"|"center" }) {
    doc.setFontSize(opts?.size ?? 10);
    doc.setTextColor(...(opts?.color ?? ZINC9));
    doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
    doc.text(str, x, yy, { align: opts?.align ?? "left" });
  }

  function hrule(yy: number, color: [number,number,number] = ZINC2) {
    doc.setDrawColor(...color);
    doc.setLineWidth(0.25);
    doc.line(MARGIN, yy, PW - MARGIN, yy);
    return yy + 4;
  }

  doc.setFillColor(...ZINC9);
  doc.rect(0, 0, PW, 38, "F");
  text("INVOICE / RECEIPT", MARGIN, 12, { size: 7, color: AMBER, bold: true });
  text(sale.sale_no ?? "—", MARGIN, 24, { size: 22, color: WHITE, bold: true });
  text("Pollinators Apitherapy", PW - MARGIN, 14, { size: 11, color: WHITE, bold: true, align: "right" });
  text("Pollinators", PW - MARGIN, 20, { size: 8, color: [161,161,170], align: "right" });
  doc.setFillColor(...AMBER);
  doc.rect(0, 38, PW, 1.5, "F");
  y = 48;

  const metaCol = CONTENT_W / 3;
  [
    { label: "Customer", value: sale.customer_name ?? "—" },
    { label: "Date",     value: sale.created_at ? fmtDate(sale.created_at) : "—" },
    { label: "Status",   value: sale.status ?? "—" },
  ].forEach((m, i) => {
    const mx = MARGIN + i * metaCol;
    text(m.label.toUpperCase(), mx, y, { size: 6.5, color: ZINC6, bold: true });
    text(m.value, mx, y + 5, { size: 9, color: ZINC9 });
  });
  y += 14;
  y = hrule(y);

  const cardW = (CONTENT_W - 8) / 3;
  const cardH = 22;
  [
    { label: "Subtotal",  value: fmtMoney(kpis.subtotal) },
    { label: "Discounts", value: fmtMoney(kpis.discount_total), note: `${discountedLines.length} discounted line(s)` },
    { label: "Total",     value: fmtMoney(kpis.total), highlight: true },
  ].forEach((k, i) => {
    const cx = MARGIN + i * (cardW + 4);
    doc.setFillColor(...(k.highlight ? [255, 247, 230] as [number,number,number] : [249,249,250] as [number,number,number]));
    doc.setDrawColor(...(k.highlight ? AMBER : ZINC2));
    doc.setLineWidth(0.4);
    doc.roundedRect(cx, y, cardW, cardH, 3, 3, "FD");
    text(k.label.toUpperCase(), cx + 4, y + 6, { size: 6.5, color: ZINC6, bold: true });
    text(k.value, cx + 4, y + 14, { size: 12, color: k.highlight ? AMBER : ZINC9, bold: true });
    if (k.note) text(k.note, cx + 4, y + 20, { size: 7, color: ZINC6 });
  });
  y += cardH + 8;

  text("LINE ITEMS", MARGIN, y, { size: 7, color: ZINC6, bold: true });
  y += 4;

  autoTable(doc, {
    startY: y, margin: { left: MARGIN, right: MARGIN },
    head: [["Product", "Qty", "Base Price", "Discount", "Unit Price", "Line Total"]],
    body: items.map((x) => [x.product_name, String(x.qty), fmtMoney(x.base), x.discountPerUnit > 0 ? `-${fmtMoney(x.discountPerUnit)}` : "—", fmtMoney(x.final), fmtMoney(x.lineTotal)]),
    headStyles: { fillColor: ZINC9, textColor: WHITE, fontSize: 7.5, fontStyle: "bold", cellPadding: { top: 3, bottom: 3, left: 3, right: 3 } },
    bodyStyles: { fontSize: 8.5, textColor: ZINC9, cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 } },
    alternateRowStyles: { fillColor: [249,249,250] as [number,number,number] },
    columnStyles: { 0: { cellWidth: "auto" }, 1: { halign: "center", cellWidth: 12 }, 2: { halign: "right", cellWidth: 26 }, 3: { halign: "right", cellWidth: 24, textColor: [180,100,0] as [number,number,number] }, 4: { halign: "right", cellWidth: 24 }, 5: { halign: "right", cellWidth: 28, fontStyle: "bold" } },
    tableLineColor: ZINC2, tableLineWidth: 0.25,
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  const summaryX = PW - MARGIN - 70;
  const summaryW = 70;
  doc.setFillColor(249, 249, 250);
  doc.setDrawColor(...ZINC2);
  doc.setLineWidth(0.3);
  doc.roundedRect(summaryX, y, summaryW, kpis.discount_total > 0 ? 26 : 18, 3, 3, "FD");
  let sy = y + 6;
  const labelX = summaryX + 4;
  const valX = summaryX + summaryW - 4;
  text("Subtotal", labelX, sy, { size: 8, color: ZINC6 });
  text(fmtMoney(kpis.subtotal), valX, sy, { size: 8, color: ZINC9, align: "right" });
  if (kpis.discount_total > 0) {
    sy += 7;
    text("Discounts", labelX, sy, { size: 8, color: ZINC6 });
    text(`-${fmtMoney(kpis.discount_total)}`, valX, sy, { size: 8, color: [180,100,0], bold: true, align: "right" });
  }
  sy += 7;
  doc.setFillColor(...AMBER);
  doc.rect(summaryX, sy - 4, summaryW, 0.4, "F");
  sy += 3;
  text("Total", labelX, sy, { size: 10, color: ZINC9, bold: true });
  text(fmtMoney(kpis.total), valX, sy, { size: 10, color: ZINC9, bold: true, align: "right" });
  y = sy + 10;

  if (discountedLines.length > 0) {
    if (y > 230) { doc.addPage(); y = MARGIN; }
    text("DISCOUNTED PRODUCTS", MARGIN, y, { size: 7, color: ZINC6, bold: true });
    y += 4;
    autoTable(doc, {
      startY: y, margin: { left: MARGIN, right: MARGIN },
      head: [["Product", "Base", "Final", "Qty", "Saved"]],
      body: discountedLines.map((x) => [x.product_name, fmtMoney(x.base), fmtMoney(x.final), String(x.qty), fmtMoney(x.discountPerUnit * x.qty)]),
      headStyles: { fillColor: AMBER_BG, textColor: [120,60,0] as [number,number,number], fontSize: 7.5, fontStyle: "bold", cellPadding: { top: 3, bottom: 3, left: 3, right: 3 } },
      bodyStyles: { fontSize: 8.5, textColor: ZINC9, cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 } },
      alternateRowStyles: { fillColor: [255,254,249] as [number,number,number] },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "center" }, 4: { halign: "right", fontStyle: "bold", textColor: [160,80,0] as [number,number,number] } },
      tableLineColor: [253,230,138] as [number,number,number], tableLineWidth: 0.25,
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const fy = doc.internal.pageSize.getHeight() - 8;
    doc.setDrawColor(...ZINC2);
    doc.setLineWidth(0.25);
    doc.line(MARGIN, fy - 3, PW - MARGIN, fy - 3);
    text("Thank you for your business.", MARGIN, fy, { size: 7, color: ZINC6 });
    text(`Page ${p} of ${totalPages}`, PW - MARGIN, fy, { size: 7, color: ZINC6, align: "right" });
  }

  doc.save(`invoice-${sale.sale_no ?? "sale"}.pdf`);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SaleDetailsPage() {
  const params = useParams<{ saleId: string }>();
  const saleId = params?.saleId;

  const [orgId,       setOrgId]       = useState<string | null>(null);
  const [sale,        setSale]        = useState<SaleRow | null>(null);
  const [items,       setItems]       = useState<SaleItemRow[]>([]);
  const [err,         setErr]         = useState("");
  const [loading,     setLoading]     = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    (async () => {
      try { setOrgId(await bootstrapOrg()); }
      catch (e: any) { setErr(e.message ?? String(e)); }
    })();
  }, []);

  useEffect(() => {
    if (!orgId || !saleId) return;
    (async () => {
      setLoading(true); setErr("");
      try {
        const [s, it] = await Promise.all([getSale(orgId, saleId), listSaleItems(orgId, saleId)]);
        setSale(s); setItems(it);
      } catch (e: any) { setErr(e.message ?? String(e)); }
      finally { setLoading(false); }
    })();
  }, [orgId, saleId]);

  const normalizedItems = useMemo(() => items.map((x) => {
    const p = Array.isArray(x.products) ? x.products[0] : (x.products as any);
    const qty = Number(x.qty ?? 0);
    const base = Number((x as any).unit_price_base ?? x.unit_price ?? 0);
    const discountPerUnit = Number((x as any).discount_per_unit ?? 0);
    const final = Math.max(0, base - discountPerUnit);
    const lineTotal = Number(x.line_total ?? final * qty);
    return { ...x, product_name: p?.name ?? "Unknown product", qty, base, discountPerUnit, final, lineTotal };
  }), [items]);

  const discountedLines = useMemo(() => normalizedItems.filter(x => x.discountPerUnit > 0), [normalizedItems]);

  const kpis = useMemo(() => ({
    subtotal:       Number(sale?.subtotal       ?? 0),
    discount_total: Number(sale?.discount_total ?? 0),
    total:          Number(sale?.total          ?? 0),
  }), [sale]);

  async function handleDownload() {
    if (!sale) return;
    setDownloading(true); setErr("");
    try { await buildAndDownloadPdf(sale, normalizedItems, kpis, discountedLines); }
    catch (e: any) { setErr("PDF generation failed: " + (e.message ?? String(e))); }
    finally { setDownloading(false); }
  }

  const statusColor = (s?: string | null) => {
    if (!s) return "bg-[#f0ece0] text-[#555540]";
    const lower = s.toLowerCase();
    if (lower === "paid" || lower === "completed") return "bg-[#edf6ef] text-[#3a7d44]";
    if (lower === "pending") return "bg-[#FFF9DC] text-[#92700a]";
    if (lower === "cancelled" || lower === "refunded") return "bg-rose-50 text-rose-700";
    return "bg-[#f0ece0] text-[#555540]";
  };

  if (!orgId && !err) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <span style={{ fontSize: "2.5rem", animation: "floatBee 3s ease-in-out infinite" }}>🐝</span>
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem", color: "#999977", letterSpacing: "0.06em" }}>
          Loading your hive…
        </p>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=DM+Sans:wght@300;400;500&display=swap');

        .sale-page * { font-family: 'DM Sans', sans-serif; font-weight: 300; }
        .sale-page .font-display { font-family: 'Playfair Display', serif; }

        /* KPI hover */
        .kpi-card { transition: transform 0.18s, box-shadow 0.18s; }
        .kpi-card:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(245,197,24,0.15); }

        /* Table row hover */
        .item-row { transition: background 0.15s; }
        .item-row:hover { background: #FFFBEA; }

        /* Discount row hover */
        .disc-row { transition: background 0.15s; }
        .disc-row:hover { background: #FFFBEA; }

        @keyframes floatBee {
          0%, 100% { transform: translateY(0) rotate(-4deg); }
          50%       { transform: translateY(-10px) rotate(4deg); }
        }

        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner { animation: spin 0.7s linear infinite; }
      `}</style>

      <div className="sale-page space-y-5">

        {/* ── TOP ACTION BAR ── */}
        <div className={`${S.card} px-6 py-5 ${S.noPrint}`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="font-display" style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.6rem", fontWeight: 700, color: "#1a1a0a", lineHeight: 1.2 }}>
                Sale <em style={{ fontStyle: "italic", color: "#3a7d44" }}>details</em>
              </h1>
              <p style={{ fontSize: "0.82rem", color: "#999977", marginTop: "0.3rem" }}>
                View items, discounts, and totals — download as PDF invoice.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/dashboard/sales" className={S.btnGhost}>
                ← Back to Sales
              </Link>
              <button
                className={S.btnPrimary}
                onClick={handleDownload}
                disabled={downloading || !sale || loading}
              >
                {downloading ? (
                  <>
                    <svg className="spinner" width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
                      <path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Generating PDF…
                  </>
                ) : (
                  <>↓ Download Invoice</>
                )}
              </button>
            </div>
          </div>
        </div>

        {err && <div className={S.alert}>{err}</div>}

        {/* ── INVOICE HEADER ── */}
        <div className={`${S.card} overflow-hidden`}>
          {/* Yellow top strip */}
          <div style={{ height: 3, background: "linear-gradient(90deg, #F5C518, #FFE566, #F5C518)" }} />

          <div className="flex flex-col gap-6 px-6 py-6 sm:flex-row sm:items-start sm:justify-between">
            {/* Left: invoice identity */}
            <div className="space-y-3">
              <div style={{ fontSize: "0.65rem", fontWeight: 500, letterSpacing: "0.25em", color: "#999977", textTransform: "uppercase" }}>
                Invoice / Receipt
              </div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "2rem", fontWeight: 700, color: "#1a1a0a", lineHeight: 1 }}>
                {loading ? "—" : (sale?.sale_no ?? "—")}
              </div>
              <div className="space-y-1" style={{ fontSize: "0.85rem", color: "#555540" }}>
                <div><span style={{ color: "#999977" }}>Customer</span>&ensp;{sale?.customer_name ?? "—"}</div>
                <div><span style={{ color: "#999977" }}>Date</span>&ensp;{sale?.created_at ? fmtDate(sale.created_at) : "—"}</div>
                <div className="flex items-center gap-2">
                  <span style={{ color: "#999977" }}>Status</span>&ensp;
                  <span className={`${S.badge} ${statusColor(sale?.status)}`} style={{ fontSize: "0.7rem" }}>
                    {sale?.status ?? "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: business */}
            <div className="text-right space-y-1">
              <div style={{ fontSize: "0.65rem", fontWeight: 500, letterSpacing: "0.2em", color: "#999977", textTransform: "uppercase" }}>
                Issued by
              </div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.2rem", fontWeight: 700, color: "#1a1a0a" }}>
                Pollin<em style={{ fontStyle: "italic", color: "#3a7d44" }}>ators</em>
              </div>
              <div style={{ fontSize: "0.78rem", color: "#999977" }}>Beekeepers Apitherapy</div>
              <div style={{ marginTop: "0.6rem", fontSize: "1.5rem" }}>🍯</div>
            </div>
          </div>
        </div>

        {/* ── KPI CARDS ── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { label: "Subtotal",  value: fmtMoney(kpis.subtotal), sub: null,                                       highlight: false },
            { label: "Discounts", value: fmtMoney(kpis.discount_total), sub: `${discountedLines.length} line(s) discounted`, highlight: false },
            { label: "Total",     value: fmtMoney(kpis.total), sub: null,                                           highlight: true  },
          ].map(({ label, value, sub, highlight }) => (
            <div
              key={label}
              className={`kpi-card ${S.card} px-6 py-5`}
              style={highlight ? { borderColor: "rgba(245,197,24,0.5)", background: "#FFFBEA" } : {}}
            >
              <div style={{ fontSize: "0.65rem", fontWeight: 500, letterSpacing: "0.22em", color: highlight ? "#92700a" : "#999977", textTransform: "uppercase" }}>
                {label}
              </div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.9rem", fontWeight: 700, color: highlight ? "#1a1a0a" : "#1a1a0a", marginTop: "0.5rem", lineHeight: 1.1 }}>
                {loading ? "—" : value}
              </div>
              {sub && (
                <div style={{ fontSize: "0.75rem", color: "#999977", marginTop: "0.35rem" }}>{sub}</div>
              )}
              {highlight && (
                <div style={{ marginTop: "0.6rem", height: 2, width: 40, background: "#F5C518", borderRadius: 1 }} />
              )}
            </div>
          ))}
        </div>

        {/* ── LINE ITEMS TABLE ── */}
        <div className={`${S.card} overflow-hidden`}>
          {/* Header */}
          <div style={{ padding: "1.1rem 1.5rem", borderBottom: "1.5px solid rgba(245,197,24,0.2)", background: "#FFFEF5" }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.05rem", fontWeight: 700, color: "#1a1a0a" }}>
              Line Items
            </div>
          </div>

          {/* Table head */}
          <div
            className={S.tableHead}
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 0.5fr 1fr 1fr 1fr 1fr",
              padding: "0.6rem 1.5rem",
              borderBottom: "1px solid rgba(26,26,10,0.06)",
              background: "#FAFAF5",
            }}
          >
            <div>Product</div>
            <div style={{ textAlign: "center" }}>Qty</div>
            <div style={{ textAlign: "right" }}>Base</div>
            <div style={{ textAlign: "right" }}>Discount</div>
            <div style={{ textAlign: "right" }}>Unit Price</div>
            <div style={{ textAlign: "right" }}>Line Total</div>
          </div>

          {/* Rows */}
          <div>
            {loading ? (
              <div style={{ padding: "3rem 1.5rem", textAlign: "center", color: "#999977", fontSize: "0.85rem" }}>
                Loading items…
              </div>
            ) : normalizedItems.length === 0 ? (
              <div style={{ padding: "3rem 1.5rem", textAlign: "center", color: "#999977", fontSize: "0.85rem" }}>
                No items found for this sale.
              </div>
            ) : normalizedItems.map((x, idx) => (
              <div
                key={x.id}
                className="item-row"
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 0.5fr 1fr 1fr 1fr 1fr",
                  alignItems: "center",
                  padding: "0.85rem 1.5rem",
                  borderBottom: idx < normalizedItems.length - 1 ? "1px solid rgba(26,26,10,0.05)" : "none",
                  fontSize: "0.875rem",
                }}
              >
                <div style={{ fontWeight: 500, color: "#1a1a0a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {x.product_name}
                </div>
                <div style={{ textAlign: "center", color: "#555540" }}>{x.qty}</div>
                <div style={{ textAlign: "right", color: "#555540" }}>{fmtMoney(x.base)}</div>
                <div style={{ textAlign: "right", color: x.discountPerUnit > 0 ? "#92700a" : "#bbb", fontWeight: x.discountPerUnit > 0 ? 500 : 300 }}>
                  {x.discountPerUnit > 0 ? `-${fmtMoney(x.discountPerUnit)}` : "—"}
                </div>
                <div style={{ textAlign: "right", color: "#1a1a0a", fontWeight: 500 }}>{fmtMoney(x.final)}</div>
                <div style={{ textAlign: "right", color: "#1a1a0a", fontWeight: 500 }}>{fmtMoney(x.lineTotal)}</div>
              </div>
            ))}
          </div>

          {/* Totals summary footer */}
          <div style={{ padding: "1rem 1.5rem", borderTop: "1.5px solid rgba(245,197,24,0.2)", background: "#FFFBEA", display: "flex", justifyContent: "flex-end" }}>
            <div style={{ minWidth: 200, fontSize: "0.85rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#999977", marginBottom: "0.4rem" }}>
                <span>Subtotal</span><span>{fmtMoney(kpis.subtotal)}</span>
              </div>
              {kpis.discount_total > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", color: "#92700a", marginBottom: "0.4rem" }}>
                  <span>Discounts</span><span>-{fmtMoney(kpis.discount_total)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", color: "#1a1a0a", fontWeight: 500, borderTop: "1.5px solid #F5C518", paddingTop: "0.5rem", marginTop: "0.3rem", fontSize: "1rem" }}>
                <span>Total</span><span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700 }}>{fmtMoney(kpis.total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── DISCOUNTED PRODUCTS ── */}
        <div className={`${S.card} overflow-hidden`}>
          <div style={{ padding: "1.1rem 1.5rem", borderBottom: "1.5px solid rgba(245,197,24,0.2)", background: "#FFFEF5", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.05rem", fontWeight: 700, color: "#1a1a0a" }}>
                Discounted Products
              </div>
              <div style={{ fontSize: "0.75rem", color: "#999977", marginTop: "0.2rem" }}>
                Items with a price reduction applied
              </div>
            </div>
            {discountedLines.length > 0 && (
              <span className={`${S.badge} bg-[#FFF9DC] text-[#92700a]`} style={{ fontSize: "0.7rem" }}>
                {discountedLines.length} item{discountedLines.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {discountedLines.length === 0 ? (
            <div style={{ padding: "2.5rem 1.5rem", textAlign: "center", color: "#bbb", fontSize: "0.85rem" }}>
              No discounts were applied on this sale.
            </div>
          ) : (
            <div>
              {discountedLines.map((x, idx) => (
                <div
                  key={x.id}
                  className="disc-row"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "1rem",
                    padding: "1rem 1.5rem",
                    borderBottom: idx < discountedLines.length - 1 ? "1px solid rgba(26,26,10,0.05)" : "none",
                  }}
                >
                  {/* Left */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 500, color: "#1a1a0a", fontSize: "0.9rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {x.product_name}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#999977", marginTop: "0.2rem" }}>
                      Base {fmtMoney(x.base)} → Final {fmtMoney(x.final)} · Qty {x.qty}
                    </div>
                  </div>

                  {/* Right */}
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div className={`${S.badge} bg-[#FFF9DC] text-[#92700a]`} style={{ fontSize: "0.72rem" }}>
                      -{fmtMoney(x.discountPerUnit)} / unit
                    </div>
                    <div style={{ marginTop: "0.3rem", fontSize: "0.85rem", fontWeight: 500, color: "#3a7d44" }}>
                      Saved {fmtMoney(x.discountPerUnit * x.qty)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ padding: "0.85rem 1.5rem", borderTop: "1px solid rgba(26,26,10,0.05)", fontSize: "0.72rem", color: "#ccc" }}>
            Thank you for your business. 🍯
          </div>
        </div>

      </div>
    </>
  );
}