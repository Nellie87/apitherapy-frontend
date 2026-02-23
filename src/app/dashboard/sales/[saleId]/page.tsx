"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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

// ─── Programmatic PDF (no html2canvas, no color-function issues) ──────────────

type NormalizedItem = {
  id: string;
  product_name: string;
  qty: number;
  base: number;
  discountPerUnit: number;
  final: number;
  lineTotal: number;
};

async function buildAndDownloadPdf(
  sale: SaleRow,
  items: NormalizedItem[],
  kpis: { subtotal: number; discount_total: number; total: number },
  discountedLines: NormalizedItem[]
) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const PW = doc.internal.pageSize.getWidth(); // 210
  const MARGIN = 14;
  const CONTENT_W = PW - MARGIN * 2;

  // ── colour palette ──────────────────────────────────────────────────────────
  const AMBER  = [245, 158, 11] as [number, number, number];
  const ZINC9  = [24,  24,  27] as [number, number, number];
  const ZINC6  = [82,  82,  91] as [number, number, number];
  const ZINC2  = [228, 228, 231] as [number, number, number];
  const WHITE  = [255, 255, 255] as [number, number, number];
  const AMBER_BG = [255, 251, 235] as [number, number, number];

  let y = MARGIN;

  // ── helpers ─────────────────────────────────────────────────────────────────
  function text(
    str: string,
    x: number,
    yy: number,
    opts?: { size?: number; color?: [number,number,number]; bold?: boolean; align?: "left"|"right"|"center" }
  ) {
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

  function pill(
    label: string,
    x: number,
    yy: number,
    bg: [number,number,number],
    fg: [number,number,number]
  ) {
    const pad = 3;
    doc.setFontSize(7.5);
    const w = doc.getTextWidth(label) + pad * 2;
    doc.setFillColor(...bg);
    doc.roundedRect(x, yy - 3.5, w, 5.5, 1.5, 1.5, "F");
    doc.setTextColor(...fg);
    doc.setFont("helvetica", "bold");
    doc.text(label, x + pad, yy);
  }

  // ── HEADER BAND ─────────────────────────────────────────────────────────────
  doc.setFillColor(...ZINC9);
  doc.rect(0, 0, PW, 38, "F");

  // Left: invoice label + sale_no
  text("INVOICE / RECEIPT", MARGIN, 12, { size: 7, color: AMBER, bold: true });
  text(sale.sale_no ?? "—", MARGIN, 24, { size: 22, color: WHITE, bold: true });

  // Right: business name
  text("Pollinators Apitherapy", PW - MARGIN, 14, { size: 11, color: WHITE, bold: true, align: "right" });
  text("Pollinators", PW - MARGIN, 20, { size: 8, color: [161,161,170], align: "right" });

  // Amber accent strip
  doc.setFillColor(...AMBER);
  doc.rect(0, 38, PW, 1.5, "F");

  y = 48;

  // ── META ROW ────────────────────────────────────────────────────────────────
  const metaCol = CONTENT_W / 3;
  const metaItems = [
    { label: "Customer", value: sale.customer_name ?? "—" },
    { label: "Date",     value: sale.created_at ? fmtDate(sale.created_at) : "—" },
    { label: "Status",   value: sale.status ?? "—" },
  ];

  metaItems.forEach((m, i) => {
    const mx = MARGIN + i * metaCol;
    text(m.label.toUpperCase(), mx, y, { size: 6.5, color: ZINC6, bold: true });
    text(m.value, mx, y + 5, { size: 9, color: ZINC9 });
  });

  y += 14;
  y = hrule(y);

  // ── KPI CARDS ───────────────────────────────────────────────────────────────
  const cardW = (CONTENT_W - 8) / 3;
  const cardH = 22;
  const kpiData = [
    { label: "Subtotal",  value: fmtMoney(kpis.subtotal)       },
    { label: "Discounts", value: fmtMoney(kpis.discount_total), note: `${discountedLines.length} discounted line(s)` },
    { label: "Total",     value: fmtMoney(kpis.total), highlight: true },
  ];

  kpiData.forEach((k, i) => {
    const cx = MARGIN + i * (cardW + 4);

    // card bg
    doc.setFillColor(...(k.highlight ? [255, 247, 230] as [number,number,number] : [249,249,250] as [number,number,number]));
    doc.setDrawColor(...(k.highlight ? AMBER : ZINC2));
    doc.setLineWidth(0.4);
    doc.roundedRect(cx, y, cardW, cardH, 3, 3, "FD");

    text(k.label.toUpperCase(), cx + 4, y + 6, { size: 6.5, color: ZINC6, bold: true });
    text(k.value, cx + 4, y + 14, { size: 12, color: k.highlight ? AMBER : ZINC9, bold: true });
    if (k.note) text(k.note, cx + 4, y + 20, { size: 7, color: ZINC6 });
  });

  y += cardH + 8;

  // ── ITEMS TABLE ─────────────────────────────────────────────────────────────
  text("LINE ITEMS", MARGIN, y, { size: 7, color: ZINC6, bold: true });
  y += 4;

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [["Product", "Qty", "Base Price", "Discount", "Unit Price", "Line Total"]],
    body: items.map((x) => [
      x.product_name,
      String(x.qty),
      fmtMoney(x.base),
      x.discountPerUnit > 0 ? `-${fmtMoney(x.discountPerUnit)}` : "—",
      fmtMoney(x.final),
      fmtMoney(x.lineTotal),
    ]),
    headStyles: {
      fillColor: ZINC9,
      textColor: WHITE,
      fontSize: 7.5,
      fontStyle: "bold",
      cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: ZINC9,
      cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 },
    },
    alternateRowStyles: { fillColor: [249, 249, 250] as [number,number,number] },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { halign: "center", cellWidth: 12 },
      2: { halign: "right",  cellWidth: 26 },
      3: { halign: "right",  cellWidth: 24, textColor: [180, 100, 0] as [number,number,number] },
      4: { halign: "right",  cellWidth: 24 },
      5: { halign: "right",  cellWidth: 28, fontStyle: "bold" },
    },
    tableLineColor: ZINC2,
    tableLineWidth: 0.25,
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // ── TOTALS SUMMARY ──────────────────────────────────────────────────────────
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
    text(`-${fmtMoney(kpis.discount_total)}`, valX, sy, { size: 8, color: [180, 100, 0], bold: true, align: "right" });
  }

  sy += 7;
  doc.setFillColor(...AMBER);
  doc.rect(summaryX, sy - 4, summaryW, 0.4, "F");
  sy += 3;
  text("Total", labelX, sy, { size: 10, color: ZINC9, bold: true });
  text(fmtMoney(kpis.total), valX, sy, { size: 10, color: ZINC9, bold: true, align: "right" });

  y = sy + 10;

  // ── DISCOUNTED PRODUCTS (only if any) ───────────────────────────────────────
  if (discountedLines.length > 0) {
    // Page break if needed
    if (y > 230) { doc.addPage(); y = MARGIN; }

    text("DISCOUNTED PRODUCTS", MARGIN, y, { size: 7, color: ZINC6, bold: true });
    y += 4;

    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [["Product", "Base", "Final", "Qty", "Saved"]],
      body: discountedLines.map((x) => [
        x.product_name,
        fmtMoney(x.base),
        fmtMoney(x.final),
        String(x.qty),
        fmtMoney(x.discountPerUnit * x.qty),
      ]),
      headStyles: {
        fillColor: AMBER_BG,
        textColor: [120, 60, 0] as [number,number,number],
        fontSize: 7.5,
        fontStyle: "bold",
        cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
      },
      bodyStyles: {
        fontSize: 8.5,
        textColor: ZINC9,
        cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 },
      },
      alternateRowStyles: { fillColor: [255, 254, 249] as [number,number,number] },
      columnStyles: {
        1: { halign: "right" },
        2: { halign: "right" },
        3: { halign: "center" },
        4: { halign: "right", fontStyle: "bold", textColor: [160, 80, 0] as [number,number,number] },
      },
      tableLineColor: [253, 230, 138] as [number,number,number],
      tableLineWidth: 0.25,
    });

    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ── FOOTER ──────────────────────────────────────────────────────────────────
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

  const [orgId, setOrgId] = useState<string | null>(null);
  const [sale, setSale] = useState<SaleRow | null>(null);
  const [items, setItems] = useState<SaleItemRow[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const o = await bootstrapOrg();
        setOrgId(o);
      } catch (e: any) {
        setErr(e.message ?? String(e));
      }
    })();
  }, []);

  useEffect(() => {
    if (!orgId || !saleId) return;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const s = await getSale(orgId, saleId);
        const it = await listSaleItems(orgId, saleId);
        setSale(s);
        setItems(it);
      } catch (e: any) {
        setErr(e.message ?? String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [orgId, saleId]);

  const normalizedItems = useMemo(() => items.map((x) => {
    const p = Array.isArray(x.products) ? x.products[0] : (x.products as any);
    const name = p?.name ?? "Unknown product";
    const qty = Number(x.qty ?? 0);
    const base = Number((x as any).unit_price_base ?? x.unit_price ?? 0);
    const discountPerUnit = Number((x as any).discount_per_unit ?? 0);
    const final = Math.max(0, base - discountPerUnit);
    const lineTotal = Number(x.line_total ?? final * qty);
    return { ...x, product_name: name, qty, base, discountPerUnit, final, lineTotal };
  }), [items]);

  const discountedLines = useMemo(
    () => normalizedItems.filter((x) => x.discountPerUnit > 0),
    [normalizedItems]
  );

  const kpis = useMemo(() => ({
    subtotal: Number(sale?.subtotal ?? 0),
    discount_total: Number(sale?.discount_total ?? 0),
    total: Number(sale?.total ?? 0),
  }), [sale]);

  async function handleDownload() {
    if (!sale) return;
    setDownloading(true);
    setErr("");
    try {
      await buildAndDownloadPdf(sale, normalizedItems, kpis, discountedLines);
    } catch (e: any) {
      setErr("PDF generation failed: " + (e.message ?? String(e)));
    } finally {
      setDownloading(false);
    }
  }

  if (!orgId && !err) return <div className="p-6">Loading…</div>;

  return (
    <div className="space-y-6">
      {/* Actions bar */}
      <div className={`${S.card} p-6`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-3xl font-black text-zinc-900">Sale</div>
            <div className="mt-1 text-sm text-zinc-500">
              View items, discounts, and totals — download as PDF invoice.
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/dashboard/sales" className={S.btnGhost}>← Back</Link>
            <button
              className={S.btnPrimary}
              onClick={handleDownload}
              disabled={downloading || !sale || loading}
            >
              {downloading ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Generating…
                </span>
              ) : "↓ Download PDF"}
            </button>
          </div>
        </div>
      </div>

      {err && <div className={S.alert}>{err}</div>}

      {/* On-screen invoice preview */}
      <div className="space-y-6 bg-white">
        {/* Header */}
        <div className={`${S.card} p-6`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-black uppercase tracking-wide text-zinc-500">Invoice / Receipt</div>
              <div className="mt-2 text-3xl font-black text-zinc-900">{sale?.sale_no ?? "—"}</div>
              <div className="mt-2 text-sm text-zinc-600 space-y-0.5">
                <div><span className="font-bold">Customer:</span> {sale?.customer_name ?? "—"}</div>
                <div><span className="font-bold">Date:</span> {sale?.created_at ? fmtDate(sale.created_at) : "—"}</div>
                <div><span className="font-bold">Status:</span> {sale?.status ?? "—"}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-zinc-500">Business</div>
              <div className="text-xl font-black text-zinc-900">Pollinators Apitherapy</div>
              <div className="text-sm text-zinc-500">Pollinators</div>
            </div>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            { label: "Subtotal",  value: fmtMoney(kpis.subtotal) },
            { label: "Discounts", value: fmtMoney(kpis.discount_total), sub: `${discountedLines.length} discounted line(s)` },
            { label: "Total",     value: fmtMoney(kpis.total) },
          ].map(({ label, value, sub }) => (
            <div key={label} className={`${S.card} p-6`}>
              <div className="text-[11px] font-black uppercase tracking-wide text-zinc-500">{label}</div>
              <div className="mt-3 text-4xl font-black text-zinc-900">{value}</div>
              {sub && <div className="mt-2 text-sm text-zinc-500">{sub}</div>}
            </div>
          ))}
        </div>

        {/* Items table */}
        <div className={`${S.card} overflow-hidden`}>
          <div className="px-6 py-4">
            <div className={S.tableHead} style={{ gridTemplateColumns: "2fr .6fr .9fr .9fr .9fr 1fr" }}>
              <div>Product</div><div>Qty</div><div>Base</div><div>Discount</div><div>Final</div>
              <div className="text-right">Line Total</div>
            </div>
          </div>
          <div className="divide-y divide-zinc-200">
            {loading ? (
              <div className="px-6 py-10 text-sm text-zinc-500">Loading items…</div>
            ) : normalizedItems.length === 0 ? (
              <div className="px-6 py-10 text-sm text-zinc-500">No items for this sale.</div>
            ) : normalizedItems.map((x) => (
              <div key={x.id} className="grid items-center px-6 py-4 text-sm text-zinc-800"
                style={{ gridTemplateColumns: "2fr .6fr .9fr .9fr .9fr 1fr" }}>
                <div className="font-black text-zinc-900 truncate">{x.product_name}</div>
                <div className="font-black">{x.qty}</div>
                <div className="text-zinc-700">{fmtMoney(x.base)}</div>
                <div className="text-amber-700 font-black">
                  {x.discountPerUnit > 0 ? `-${fmtMoney(x.discountPerUnit)}` : "—"}
                </div>
                <div className="font-black text-zinc-900">{fmtMoney(x.final)}</div>
                <div className="text-right font-black">{fmtMoney(x.lineTotal)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Discounted products */}
        <div className={`${S.card} p-6`}>
          <div className="text-lg font-black text-zinc-900">Discounted Products</div>
          <div className="mt-1 text-sm text-zinc-500">Only products that had a discount applied.</div>
          <div className="mt-4 divide-y divide-zinc-200 rounded-2xl border border-zinc-200 overflow-hidden">
            {discountedLines.length === 0 ? (
              <div className="px-4 py-6 text-sm text-zinc-500">No discounts were applied on this sale.</div>
            ) : discountedLines.map((x) => (
              <div key={x.id} className="px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-black text-zinc-900 truncate">{x.product_name}</div>
                    <div className="text-xs text-zinc-500">
                      Base {fmtMoney(x.base)} → Final {fmtMoney(x.final)} · Qty {x.qty}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`${S.badge} bg-amber-50 text-amber-700`}>
                      -{fmtMoney(x.discountPerUnit)} / unit
                    </div>
                    <div className="mt-1 text-sm font-black text-zinc-900">
                      Saved: {fmtMoney(x.discountPerUnit * x.qty)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 text-xs text-zinc-400">Thank you for your business.</div>
        </div>
      </div>
    </div>
  );
}