"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import { getSale, listSaleItems, type SaleRow, type SaleItemRow } from "@/lib/api/sales";
import * as S from "./page.styles";

/* ─── Helpers ────────────────────────────────────────────────── */
function fmtMoney(v: number) {
  return `Ksh ${Number(v || 0).toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtDate(d: string) {
  try {
    return new Date(d).toLocaleString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return d; }
}

/* ─── Types ──────────────────────────────────────────────────── */
type NormalizedItem = {
  id: string;
  product_name: string;
  qty: number;
  base: number;
  costAtSale: number;
  discountPerUnit: number;
  final: number;
  lineTotal: number;
  lineProfit: number;
};

/* ─── Status Badge ───────────────────────────────────────────── */
function StatusBadge({ status }: { status?: string | null }) {
  if (!status) return <span className="text-slate-400 text-sm">—</span>;
  const lower = status.toLowerCase();
  const cfg =
    lower === "paid" || lower === "completed" ? "bg-green-100 text-green-700" :
    lower === "pending"                        ? "bg-amber-100 text-amber-700" :
    lower === "cancelled" || lower === "refunded" ? "bg-red-100 text-red-700" :
    "bg-slate-100 text-slate-600";
  return <span className={`${S.badge} ${cfg}`}>{status}</span>;
}

/* ─── Stat Card ─────────────────────────────────────────────── */
function StatCard({ label, value, sub, highlight = false, loading = false }: {
  label: string; value: string; sub?: string; highlight?: boolean; loading?: boolean;
}) {
  return (
    <div className={`${S.card} p-5 transition-all hover:shadow-md ${
      highlight ? "border-amber-300 bg-amber-50" : ""
    }`}>
      <div className={`text-xs font-semibold uppercase tracking-wider mb-2 ${
        highlight ? "text-amber-600" : "text-slate-500"
      }`}>{label}</div>
      <div className={`text-2xl font-bold leading-none ${
        highlight ? "text-amber-700" : "text-slate-900"
      }`}>
        {loading ? <span className="text-slate-300">—</span> : value}
      </div>
      {sub && <div className="mt-1.5 text-xs text-slate-500">{sub}</div>}
      {highlight && <div className="mt-3 h-0.5 w-10 rounded-full bg-amber-400" />}
    </div>
  );
}

/* ─── PDF builder (unchanged logic) ─────────────────────────── */
async function buildAndDownloadPdf(
  sale: SaleRow,
  items: NormalizedItem[],
  kpis: { subtotal: number; discount_total: number; total: number },
  discountedLines: NormalizedItem[]
) {
  const { default: jsPDF }    = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const PW = doc.internal.pageSize.getWidth();
  const MARGIN = 14;
  const CONTENT_W = PW - MARGIN * 2;

  const AMBER    = [245, 158,  11] as [number,number,number];
  const ZINC9    = [ 24,  24,  27] as [number,number,number];
  const ZINC6    = [ 82,  82,  91] as [number,number,number];
  const ZINC2    = [228, 228, 231] as [number,number,number];
  const WHITE    = [255, 255, 255] as [number,number,number];
  const AMBER_BG = [255, 251, 235] as [number,number,number];

  let y = MARGIN;

  function text(str: string, x: number, yy: number, opts?: {
    size?: number; color?: [number,number,number]; bold?: boolean; align?: "left"|"right"|"center";
  }) {
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

  // Header bar
  doc.setFillColor(...ZINC9);
  doc.rect(0, 0, PW, 38, "F");
  text("INVOICE / RECEIPT", MARGIN, 12, { size: 7, color: AMBER, bold: true });
  text(sale.sale_no ?? "—", MARGIN, 24, { size: 22, color: WHITE, bold: true });
  text("Pollinators Apitherapy", PW - MARGIN, 14, { size: 11, color: WHITE, bold: true, align: "right" });
  doc.setFillColor(...AMBER);
  doc.rect(0, 38, PW, 1.5, "F");
  y = 48;

  // Meta row
  const metaCol = CONTENT_W / 3;
  [
    { label: "Customer", value: sale.customer_name ?? "—" },
    { label: "Date",     value: sale.created_at ? fmtDate(sale.created_at) : "—" },
    { label: "Status",   value: sale.status ?? "—" },
  ].forEach((m, i) => {
    const mx = MARGIN + i * metaCol;
    text(m.label.toUpperCase(), mx, y,     { size: 6.5, color: ZINC6, bold: true });
    text(m.value,               mx, y + 5, { size: 9,   color: ZINC9 });
  });
  y += 14;
  y = hrule(y);

  // KPI cards
  const cardW = (CONTENT_W - 8) / 3;
  const cardH = 22;
  [
    { label: "Subtotal",  value: fmtMoney(kpis.subtotal), highlight: false },
    { label: "Discounts", value: fmtMoney(kpis.discount_total), note: `${discountedLines.length} discounted line(s)`, highlight: false },
    { label: "Total",     value: fmtMoney(kpis.total), highlight: true },
  ].forEach((k, i) => {
    const cx = MARGIN + i * (cardW + 4);
    doc.setFillColor(...(k.highlight ? [255,247,230] as [number,number,number] : [249,249,250] as [number,number,number]));
    doc.setDrawColor(...(k.highlight ? AMBER : ZINC2));
    doc.setLineWidth(0.4);
    doc.roundedRect(cx, y, cardW, cardH, 3, 3, "FD");
    text(k.label.toUpperCase(), cx + 4, y + 6,  { size: 6.5, color: ZINC6, bold: true });
    text(k.value,               cx + 4, y + 14, { size: 12,  color: k.highlight ? AMBER : ZINC9, bold: true });
    if ((k as any).note) text((k as any).note, cx + 4, y + 20, { size: 7, color: ZINC6 });
  });
  y += cardH + 8;

  // Line items table
  text("LINE ITEMS", MARGIN, y, { size: 7, color: ZINC6, bold: true });
  y += 4;
  autoTable(doc, {
    startY: y, margin: { left: MARGIN, right: MARGIN },
    head: [["Product", "Qty", "Base Price", "Discount", "Unit Price", "Line Total"]],
    body: items.map((x) => [
      x.product_name, String(x.qty),
      fmtMoney(x.base),
      x.discountPerUnit > 0 ? `-${fmtMoney(x.discountPerUnit)}` : "—",
      fmtMoney(x.final), fmtMoney(x.lineTotal),
    ]),
    headStyles:         { fillColor: ZINC9, textColor: WHITE, fontSize: 7.5, fontStyle: "bold", cellPadding: { top: 3, bottom: 3, left: 3, right: 3 } },
    bodyStyles:         { fontSize: 8.5, textColor: ZINC9, cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 } },
    alternateRowStyles: { fillColor: [249,249,250] as [number,number,number] },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { halign: "center", cellWidth: 12 },
      2: { halign: "right",  cellWidth: 26 },
      3: { halign: "right",  cellWidth: 24, textColor: [180,100,0] as [number,number,number] },
      4: { halign: "right",  cellWidth: 24 },
      5: { halign: "right",  cellWidth: 28, fontStyle: "bold" },
    },
    tableLineColor: ZINC2, tableLineWidth: 0.25,
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // Summary box
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
    text(`-${fmtMoney(kpis.discount_total)}`, valX, sy, { size: 8, color: [180,100,0] as [number,number,number], bold: true, align: "right" });
  }
  sy += 7;
  doc.setFillColor(...AMBER);
  doc.rect(summaryX, sy - 4, summaryW, 0.4, "F");
  sy += 3;
  text("Total",            labelX, sy, { size: 10, color: ZINC9, bold: true });
  text(fmtMoney(kpis.total), valX, sy, { size: 10, color: ZINC9, bold: true, align: "right" });
  y = sy + 10;

  // Discounts table
  if (discountedLines.length > 0) {
    if (y > 230) { doc.addPage(); y = MARGIN; }
    text("DISCOUNTED PRODUCTS", MARGIN, y, { size: 7, color: ZINC6, bold: true });
    y += 4;
    autoTable(doc, {
      startY: y, margin: { left: MARGIN, right: MARGIN },
      head: [["Product", "Base", "Final", "Qty", "Saved"]],
      body: discountedLines.map((x) => [
        x.product_name, fmtMoney(x.base), fmtMoney(x.final),
        String(x.qty), fmtMoney(x.discountPerUnit * x.qty),
      ]),
      headStyles:         { fillColor: AMBER_BG, textColor: [120,60,0] as [number,number,number], fontSize: 7.5, fontStyle: "bold", cellPadding: { top: 3, bottom: 3, left: 3, right: 3 } },
      bodyStyles:         { fontSize: 8.5, textColor: ZINC9, cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 } },
      alternateRowStyles: { fillColor: [255,254,249] as [number,number,number] },
      columnStyles: {
        1: { halign: "right" }, 2: { halign: "right" },
        3: { halign: "center" },
        4: { halign: "right", fontStyle: "bold", textColor: [160,80,0] as [number,number,number] },
      },
      tableLineColor: [253,230,138] as [number,number,number], tableLineWidth: 0.25,
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Page footer
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

/* ─── Page ───────────────────────────────────────────────────── */
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

const normalizedItems = useMemo<NormalizedItem[]>(() => items.map((x) => {
  const p = Array.isArray(x.products) ? x.products[0] : (x.products as any);
  const qty = Number(x.qty ?? 0);
  const base = Number((x as any).unit_price_base ?? x.unit_price ?? 0);
  const costAtSale = Number((x as any).cost_price_at_sale ?? 0);
  const discountPerUnit = Number((x as any).discount_per_unit ?? 0);
  const final = Math.max(0, base - discountPerUnit);
  const lineTotal = Number(x.line_total ?? final * qty);
  const lineProfit = (final - costAtSale) * qty;

  return {
    id: x.id,
    product_name: p?.name ?? "Unknown product",
    qty,
    base,
    costAtSale,
    discountPerUnit,
    final,
    lineTotal,
    lineProfit,
  };
}), [items]);

  const discountedLines = useMemo(() => normalizedItems.filter((x) => x.discountPerUnit > 0), [normalizedItems]);

  const kpis = useMemo(() => ({
    subtotal:       Number(sale?.subtotal       ?? 0),
    discount_total: Number(sale?.discount_total ?? 0),
    total:          Number(sale?.total          ?? 0),
  }), [sale]);
const totalProfit = useMemo(
  () => normalizedItems.reduce((sum, x) => sum + x.lineProfit, 0),
  [normalizedItems]
);
  async function handleDownload() {
    if (!sale) return;
    setDownloading(true); setErr("");
    try { await buildAndDownloadPdf(sale, normalizedItems, kpis, discountedLines); }
    catch (e: any) { setErr("PDF generation failed: " + (e.message ?? String(e))); }
    finally { setDownloading(false); }
  }

  if (!orgId && !err) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" strokeOpacity="0.2" />
            <path d="M12 2a10 10 0 0110 10" />
          </svg>
          <span className="text-sm font-medium">Loading sale…</span>
        </div>
      </div>
    );
  }

  return (
    <div className={S.printWrap}>

      {/* ── Header / Actions ── */}
      <div className={`${S.card} px-6 py-5 ${S.noPrint}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Sale Details</h1>
            <p className="mt-1 text-sm text-slate-500">
              View items, discounts, and totals — download as PDF invoice.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link href="/dashboard/sales" className={S.btnGhost}>← Back</Link>
            <button
              className={S.btnPrimary}
              onClick={handleDownload}
              disabled={downloading || !sale || loading}
            >
              {downloading ? (
                <>
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
                    <path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Generating…
                </>
              ) : "↓ Download Invoice"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Error ── */}
      {err && (
        <div className={S.alert}>
          <span className="shrink-0 mt-0.5">⚠️</span>
          <span className="flex-1">{err}</span>
          <button onClick={() => setErr("")} className="ml-auto shrink-0 text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* ── Invoice Identity Card ── */}
      <div className={`${S.card} overflow-hidden`}>
        {/* Amber accent bar */}
        <div className="h-1 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400" />

        <div className="flex flex-col gap-6 px-6 py-6 sm:flex-row sm:items-start sm:justify-between">
          {/* Left: invoice meta */}
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              Invoice / Receipt
            </div>
            <div className="text-3xl font-bold text-slate-900 leading-none">
              {loading ? <span className="text-slate-300">Loading…</span> : (sale?.sale_no ?? "—")}
            </div>
           <div className="space-y-1.5 text-sm">
            </div>
  <div className="flex items-center gap-2">
    <span className="w-20 text-xs font-semibold uppercase tracking-wider text-slate-400">Customer</span>
    <span className="text-slate-700 font-medium">
      {sale?.customer_name ?? <span className="text-slate-400 italic">Walk-in</span>}
    </span>
  </div>

  <div className="flex items-center gap-2">
    <span className="w-20 text-xs font-semibold uppercase tracking-wider text-slate-400">Date</span>
    <span className="text-slate-700">
      {sale?.created_at ? fmtDate(sale.created_at) : "—"}
    </span>
  </div>

  <div className="flex items-center gap-2">
    <span className="w-20 text-xs font-semibold uppercase tracking-wider text-slate-400">Payment</span>
    <span className="text-slate-700 capitalize">
      {sale?.payment_method ?? "—"}
    </span>
  </div>

  <div className="flex items-center gap-2">
    <span className="w-20 text-xs font-semibold uppercase tracking-wider text-slate-400">Status</span>
    <StatusBadge status={sale?.status} />
  </div>
</div>

          {/* Right: business identity */}
          <div className="text-right space-y-1">
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">Issued by</div>
            <div className="text-xl font-bold text-slate-900">
              Pollin<span className="italic text-green-600">ators</span>
            </div>
            <div className="text-sm text-slate-500">Beekeepers Apitherapy</div>
            <div className="mt-2 text-3xl">🍯</div>
          </div>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard label="Subtotal"  value={fmtMoney(kpis.subtotal)}       loading={loading} />
        <StatCard label="Discounts" value={fmtMoney(kpis.discount_total)} loading={loading}
          sub={discountedLines.length > 0 ? `${discountedLines.length} line${discountedLines.length !== 1 ? "s" : ""} discounted` : undefined} />
        <StatCard label="Total"     value={fmtMoney(kpis.total)}          loading={loading} highlight />
        <StatCard
  label="Profit"
  value={fmtMoney(totalProfit)}
  loading={loading}
  sub="based on cost snapshot"
/>
      </div>

      {/* ── Line Items Table ── */}
      <div className={`${S.card} overflow-hidden`}>
        <div className="border-b border-slate-100 bg-white px-5 py-4">
          <div className="text-base font-bold text-slate-900">Line Items</div>
          {!loading && normalizedItems.length > 0 && (
            <div className="mt-0.5 text-xs text-slate-500">{normalizedItems.length} product{normalizedItems.length !== 1 ? "s" : ""}</div>
          )}
        </div>

        {/* Column headers */}
        <div
          className={`${S.tableHead} items-center gap-4 px-5 py-3`}
          style={{ gridTemplateColumns: S.itemsGrid }}
        >
          <div>Product</div>
          <div className="text-center">Qty</div>
          <div className="text-right">Base</div>
          <div className="text-right">Discount</div>
          <div className="text-right">Unit Price</div>
          <div className="text-right">Line Total</div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="flex items-center justify-center gap-3 py-14 text-slate-400">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" strokeOpacity="0.2" />
                <path d="M12 2a10 10 0 0110 10" />
              </svg>
              <span className="text-sm">Loading items…</span>
            </div>
          ) : normalizedItems.length === 0 ? (
            <div className="py-14 text-center text-sm text-slate-400">
              No items found for this sale.
            </div>
          ) : normalizedItems.map((x) => (
            <div
              key={x.id}
              className="grid items-center gap-4 px-5 py-3.5 text-sm transition-colors hover:bg-slate-50"
              style={{ gridTemplateColumns: S.itemsGrid }}
            >
              <div className="min-w-0 font-semibold text-slate-900 truncate">{x.product_name}</div>
              <div className="text-center text-slate-600">{x.qty}</div>
              <div className="text-right text-slate-600">{fmtMoney(x.base)}</div>
              <div className={`text-right font-semibold ${x.discountPerUnit > 0 ? "text-amber-600" : "text-slate-300"}`}>
                {x.discountPerUnit > 0 ? `-${fmtMoney(x.discountPerUnit)}` : "—"}
              </div>
              <div className="text-right font-medium text-slate-800">{fmtMoney(x.final)}</div>
              <div className="text-right font-bold text-slate-900">{fmtMoney(x.lineTotal)}</div>
            </div>
          ))}
        </div>

        {/* Totals footer */}
        <div className="border-t border-slate-100 bg-slate-50 px-5 py-4 flex justify-end">
          <div className="w-56 space-y-2 text-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span>Subtotal</span>
              <span className="font-medium text-slate-700">{fmtMoney(kpis.subtotal)}</span>
            </div>
            {kpis.discount_total > 0 && (
              <div className="flex items-center justify-between text-amber-600">
                <span>Discounts</span>
                <span className="font-semibold">-{fmtMoney(kpis.discount_total)}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-slate-200 pt-2">
              <span className="font-bold text-slate-900">Total</span>
              <span className="text-lg font-bold text-slate-900">{fmtMoney(kpis.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Discounted Products ── */}
      <div className={`${S.card} overflow-hidden`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <div className="text-base font-bold text-slate-900">Discounted Products</div>
            <div className="mt-0.5 text-xs text-slate-500">Items with a price reduction applied</div>
          </div>
          {discountedLines.length > 0 && (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
              {discountedLines.length} item{discountedLines.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {discountedLines.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">
            No discounts were applied on this sale.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {discountedLines.map((x) => (
              <div key={x.id} className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-slate-50">
                {/* Left */}
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate">{x.product_name}</div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    Base {fmtMoney(x.base)} → Final {fmtMoney(x.final)} · Qty {x.qty}
                  </div>
                </div>
                {/* Right */}
                <div className="text-right shrink-0">
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">
                    -{fmtMoney(x.discountPerUnit)} / unit
                  </span>
                  <div className="mt-1 text-sm font-bold text-green-600">
                    Saved {fmtMoney(x.discountPerUnit * x.qty)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
          Thank you for your business. 🍯
        </div>
      </div>

    </div>
  );
}