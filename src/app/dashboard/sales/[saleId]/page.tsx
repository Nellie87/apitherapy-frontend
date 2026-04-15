"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import {
  getSale,
  listSaleItems,
  type SaleRow,
  type SaleItemRow,
} from "@/lib/api/sales";
import * as S from "./page.styles";

/* Helpers */
function fmtMoney(v: number) {
  return `Ksh ${Number(v || 0).toLocaleString("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function fmtDate(d: string) {
  try {
    return new Date(d).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return d;
  }
}

function paymentPill(method?: string | null) {
  const key = (method ?? "").toLowerCase();
  if (key === "cash") return "bg-green-100 text-green-700";
  if (key === "mpesa") return "bg-blue-100 text-blue-700";
  if (key === "card") return "bg-purple-100 text-purple-700";
  if (key === "credit") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

/* Types */
type NormalizedItem = {
  id: string;
  product_name: string;
  qty: number;
  base: number;
  discountPerUnit: number;
  final: number;
  costAtSale: number;
  lineTotal: number;
  lineCost: number;
  lineProfit: number;
};

function StatusBadge({ status }: { status?: string | null }) {
  if (!status) return <span className="text-slate-400 text-sm">—</span>;

  const lower = status.toLowerCase();
  const cfg =
    lower === "paid" || lower === "completed"
      ? "bg-green-100 text-green-700"
      : lower === "pending"
      ? "bg-amber-100 text-amber-700"
      : lower === "cancelled" || lower === "refunded"
      ? "bg-red-100 text-red-700"
      : "bg-slate-100 text-slate-600";

  return <span className={`${S.badge} ${cfg}`}>{status}</span>;
}

function StatCard({
  label,
  value,
  sub,
  highlight = false,
  loading = false,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
  loading?: boolean;
}) {
  return (
    <div
      className={`rounded-[22px] p-4 bg-white transition hover:-translate-y-0.5 ${
        highlight ? "border-slate-300 bg-slate-50" : ""
      }`}
      style={{
        border: `1.5px solid ${highlight ? "#CBD5E1" : "#E2E8F0"}`,
        boxShadow: "0 8px 24px rgba(15,23,42,0.05)",
      }}
    >
      <div
        className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${
          highlight ? "text-slate-600" : "text-slate-500"
        }`}
      >
        {label}
      </div>
      <div className="mt-1 text-[26px] font-bold leading-none text-slate-900">
        {loading ? <span className="text-slate-300">—</span> : value}
      </div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
      {highlight && <div className="mt-3 h-0.5 w-10 rounded-full bg-slate-800" />}
    </div>
  );
}

/* PDF builder */
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

  const SLATE9 = [15, 23, 42] as [number, number, number];
  const SLATE6 = [71, 85, 105] as [number, number, number];
  const SLATE2 = [226, 232, 240] as [number, number, number];
  const WHITE = [255, 255, 255] as [number, number, number];
  const GREEN = [34, 197, 94] as [number, number, number];

  let y = MARGIN;

  function text(
    str: string,
    x: number,
    yy: number,
    opts?: {
      size?: number;
      color?: [number, number, number];
      bold?: boolean;
      align?: "left" | "right" | "center";
    }
  ) {
    doc.setFontSize(opts?.size ?? 10);
    doc.setTextColor(...(opts?.color ?? SLATE9));
    doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
    doc.text(str, x, yy, { align: opts?.align ?? "left" });
  }

  doc.setFillColor(...SLATE9);
  doc.rect(0, 0, PW, 34, "F");
  text("SALE RECEIPT", MARGIN, 12, { size: 7, color: WHITE, bold: true });
  text(sale.sale_no ?? "—", MARGIN, 23, { size: 20, color: WHITE, bold: true });
  text("Pollinators Apitherapy", PW - MARGIN, 16, {
    size: 10,
    color: WHITE,
    bold: true,
    align: "right",
  });

  y = 44;

  const metaCol = CONTENT_W / 4;
  [
    { label: "Customer", value: sale.customer_name ?? "—" },
    { label: "Date", value: sale.created_at ? fmtDate(sale.created_at) : "—" },
    { label: "Status", value: sale.status ?? "—" },
    { label: "Payment", value: sale.payment_method ?? "—" },
  ].forEach((m, i) => {
    const mx = MARGIN + i * metaCol;
    text(m.label.toUpperCase(), mx, y, { size: 6.5, color: SLATE6, bold: true });
    text(m.value, mx, y + 5, { size: 9, color: SLATE9 });
  });

  y += 16;

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
      fillColor: SLATE9,
      textColor: WHITE,
      fontSize: 7.5,
      fontStyle: "bold",
      cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: SLATE9,
      cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] as [number, number, number] },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { halign: "center", cellWidth: 12 },
      2: { halign: "right", cellWidth: 26 },
      3: { halign: "right", cellWidth: 24 },
      4: { halign: "right", cellWidth: 24 },
      5: { halign: "right", cellWidth: 28, fontStyle: "bold" },
    },
    tableLineColor: SLATE2,
    tableLineWidth: 0.25,
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  text("Subtotal", PW - MARGIN - 50, y, { size: 9, color: SLATE6 });
  text(fmtMoney(kpis.subtotal), PW - MARGIN, y, {
    size: 9,
    color: SLATE9,
    align: "right",
  });
  y += 6;

  if (kpis.discount_total > 0) {
    text("Discounts", PW - MARGIN - 50, y, { size: 9, color: SLATE6 });
    text(`-${fmtMoney(kpis.discount_total)}`, PW - MARGIN, y, {
      size: 9,
      color: SLATE9,
      align: "right",
    });
    y += 6;
  }

  text("Total", PW - MARGIN - 50, y + 2, { size: 11, color: SLATE9, bold: true });
  text(fmtMoney(kpis.total), PW - MARGIN, y + 2, {
    size: 11,
    color: GREEN,
    bold: true,
    align: "right",
  });

  if (discountedLines.length > 0) {
    y += 16;
    text("Discounted products", MARGIN, y, { size: 8, color: SLATE6, bold: true });
  }

  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const fy = doc.internal.pageSize.getHeight() - 8;
    doc.setDrawColor(...SLATE2);
    doc.setLineWidth(0.25);
    doc.line(MARGIN, fy - 3, PW - MARGIN, fy - 3);
    text("Thank you for your business.", MARGIN, fy, {
      size: 7,
      color: SLATE6,
    });
    text(`Page ${p} of ${totalPages}`, PW - MARGIN, fy, {
      size: 7,
      color: SLATE6,
      align: "right",
    });
  }

  doc.save(`invoice-${sale.sale_no ?? "sale"}.pdf`);
}

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
        setOrgId(await bootstrapOrg());
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
        const [s, it] = await Promise.all([
          getSale(orgId, saleId),
          listSaleItems(orgId, saleId),
        ]);
        setSale(s);
        setItems(it);
      } catch (e: any) {
        setErr(e.message ?? String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [orgId, saleId]);

  const normalizedItems = useMemo<NormalizedItem[]>(
    () =>
      items.map((x) => {
        const p = Array.isArray(x.products) ? x.products[0] : (x.products as any);
        const qty = Number(x.qty ?? 0);
        const base = Number(x.unit_price_base ?? x.unit_price ?? 0);
        const discountPerUnit = Number(x.discount_per_unit ?? 0);
        const final = Math.max(0, base - discountPerUnit);
        const costAtSale = Number((x as any).cost_price_at_sale ?? 0);
        const lineTotal = Number(x.line_total ?? final * qty);
        const lineCost = costAtSale * qty;
        const lineProfit = lineTotal - lineCost;

        return {
          id: x.id,
          product_name: p?.name ?? "Unknown product",
          qty,
          base,
          discountPerUnit,
          final,
          costAtSale,
          lineTotal,
          lineCost,
          lineProfit,
        };
      }),
    [items]
  );

  const discountedLines = useMemo(
    () => normalizedItems.filter((x) => x.discountPerUnit > 0),
    [normalizedItems]
  );

  const kpis = useMemo(
    () => ({
      subtotal: Number(sale?.subtotal ?? 0),
      discount_total: Number(sale?.discount_total ?? 0),
      total: Number(sale?.total ?? 0),
      totalCost: normalizedItems.reduce((s, i) => s + i.lineCost, 0),
      totalProfit: normalizedItems.reduce((s, i) => s + i.lineProfit, 0),
    }),
    [sale, normalizedItems]
  );

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

  if (!orgId && !err) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500">
          <svg
            className="h-5 w-5 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-600">
            Sales
          </div>
          <h1 className="mt-3 text-[32px] font-bold text-slate-900 tracking-tight">
            Sale Details
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            View items, totals, payment and cost snapshot
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link href="/dashboard/sales" className={S.btnGhost}>
            ← Back
          </Link>
          <button
            className={S.btnPrimary}
            onClick={handleDownload}
            disabled={downloading || !sale || loading}
          >
            {downloading ? (
              <>
                <svg
                  className="animate-spin"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                    opacity="0.3"
                  />
                  <path
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
                Generating…
              </>
            ) : (
              "↓ Download Invoice"
            )}
          </button>
        </div>
      </div>

      {err && (
        <div className={S.alert}>
          <span className="shrink-0 mt-0.5">⚠️</span>
          <span className="flex-1">{err}</span>
          <button
            onClick={() => setErr("")}
            className="ml-auto shrink-0 text-red-400 hover:text-red-600"
          >
            ✕
          </button>
        </div>
      )}

      <div className="rounded-[24px] border border-slate-200 bg-white shadow-[0_12px_36px_rgba(15,23,42,0.05)] overflow-hidden">
        <div className="flex flex-col gap-6 px-6 py-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              Sale Number
            </div>

            <div className="text-3xl font-bold text-slate-900 leading-none">
              {loading ? <span className="text-slate-300">Loading…</span> : sale?.sale_no ?? "—"}
            </div>

            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-20 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Customer
                </span>
                <span className="text-slate-700 font-medium">
                  {sale?.customer_name ?? (
                    <span className="text-slate-400 italic">Walk-in</span>
                  )}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="w-20 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Date
                </span>
                <span className="text-slate-700">
                  {sale?.created_at ? fmtDate(sale.created_at) : "—"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="w-20 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Status
                </span>
                <StatusBadge status={sale?.status} />
              </div>

              <div className="flex items-center gap-2">
                <span className="w-20 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Payment
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${paymentPill(
                    sale?.payment_method
                  )}`}
                >
                  {sale?.payment_method || "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="text-right space-y-1">
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              Business
            </div>
            <div className="text-xl font-bold text-slate-900">
              Pollin<span className="italic text-green-600">ators</span>
            </div>
            <div className="text-sm text-slate-500">Beekeepers Apitherapy</div>
            <div className="mt-2 text-3xl">🍯</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
        <StatCard label="Subtotal" value={fmtMoney(kpis.subtotal)} loading={loading} />
        <StatCard
          label="Discounts"
          value={fmtMoney(kpis.discount_total)}
          loading={loading}
          sub={
            discountedLines.length > 0
              ? `${discountedLines.length} line${discountedLines.length !== 1 ? "s" : ""} discounted`
              : undefined
          }
        />
        <StatCard label="Total" value={fmtMoney(kpis.total)} loading={loading} highlight />
        <StatCard label="Cost at Sale" value={fmtMoney(kpis.totalCost)} loading={loading} />
        <StatCard
          label="Estimated Profit"
          value={fmtMoney(kpis.totalProfit)}
          loading={loading}
          sub="based on saved cost snapshot"
        />
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-white shadow-[0_12px_36px_rgba(15,23,42,0.05)] overflow-hidden">
        <div className="border-b border-slate-100 bg-white px-5 py-4">
          <div className="text-base font-bold text-slate-900">Line Items</div>
          {!loading && normalizedItems.length > 0 && (
            <div className="mt-0.5 text-xs text-slate-500">
              {normalizedItems.length} product{normalizedItems.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>

        <div
          className={`${S.tableHead} items-center gap-4 px-5 py-3`}
          style={{
            gridTemplateColumns: "1.5fr 0.5fr 0.9fr 0.9fr 0.9fr 0.9fr 0.9fr 1fr",
          }}
        >
          <div>Product</div>
          <div className="text-center">Qty</div>
          <div className="text-right">Base</div>
          <div className="text-right">Discount</div>
          <div className="text-right">Unit Price</div>
          <div className="text-right">Cost</div>
          <div className="text-right">Profit</div>
          <div className="text-right">Line Total</div>
        </div>

        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="flex items-center justify-center gap-3 py-14 text-slate-400">
              <svg
                className="h-4 w-4 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" strokeOpacity="0.2" />
                <path d="M12 2a10 10 0 0110 10" />
              </svg>
              <span className="text-sm">Loading items…</span>
            </div>
          ) : normalizedItems.length === 0 ? (
            <div className="py-14 text-center text-sm text-slate-400">
              No items found for this sale.
            </div>
          ) : (
            normalizedItems.map((x) => (
              <div
                key={x.id}
                className="grid items-center gap-4 px-5 py-3.5 text-sm transition-colors hover:bg-slate-50"
                style={{
                  gridTemplateColumns:
                    "1.5fr 0.5fr 0.9fr 0.9fr 0.9fr 0.9fr 0.9fr 1fr",
                }}
              >
                <div className="min-w-0 font-semibold text-slate-900 truncate">
                  {x.product_name}
                </div>
                <div className="text-center text-slate-600">{x.qty}</div>
                <div className="text-right text-slate-600">{fmtMoney(x.base)}</div>
                <div
                  className={`text-right font-semibold ${
                    x.discountPerUnit > 0 ? "text-amber-600" : "text-slate-300"
                  }`}
                >
                  {x.discountPerUnit > 0 ? `-${fmtMoney(x.discountPerUnit)}` : "—"}
                </div>
                <div className="text-right font-medium text-slate-800">
                  {fmtMoney(x.final)}
                </div>
                <div className="text-right text-slate-600">
                  {fmtMoney(x.lineCost)}
                </div>
                <div className="text-right font-medium text-green-600">
                  {fmtMoney(x.lineProfit)}
                </div>
                <div className="text-right font-bold text-slate-900">
                  {fmtMoney(x.lineTotal)}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-slate-100 bg-slate-50 px-5 py-4 flex justify-end">
          <div className="w-64 space-y-2 text-sm">
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

            <div className="flex items-center justify-between text-slate-500">
              <span>Cost at sale</span>
              <span className="font-medium text-slate-700">{fmtMoney(kpis.totalCost)}</span>
            </div>

            <div className="flex items-center justify-between text-green-600">
              <span>Estimated profit</span>
              <span className="font-semibold">{fmtMoney(kpis.totalProfit)}</span>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 pt-2">
              <span className="font-bold text-slate-900">Total</span>
              <span className="text-lg font-bold text-slate-900">
                {fmtMoney(kpis.total)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-white shadow-[0_12px_36px_rgba(15,23,42,0.05)] overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <div className="text-base font-bold text-slate-900">
              Discounted Products
            </div>
            <div className="mt-0.5 text-xs text-slate-500">
              Items with a price reduction applied
            </div>
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
              <div
                key={x.id}
                className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate">
                    {x.product_name}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    Base {fmtMoney(x.base)} → Final {fmtMoney(x.final)} · Qty {x.qty}
                  </div>
                </div>

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