"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import {
  getSale,
  listSaleItems,
  voidSaleRestoreInventory,
  type SaleRow,
  type SaleItemRow,
} from "@/lib/api/sales";
import { useOrgRole } from "@/contexts/OrgRoleContext";
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
  if (key === "cash") return S.pillCash;
  if (key === "mpesa") return S.pillMpesa;
  if (key === "card") return S.pillCard;
  if (key === "credit") return S.pillCredit;
  return S.pillNeutral;
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

function saleCanBeVoided(status?: string | null) {
  const s = (status ?? "").trim().toLowerCase();
  if (!s) return true;
  return !["cancelled", "refunded", "void", "voided"].includes(s);
}

function StatusBadge({ status }: { status?: string | null }) {
  if (!status) return <span className="text-slate-400 text-sm">—</span>;

  const lower = status.toLowerCase();
  const cfg =
    lower === "paid" || lower === "completed"
      ? S.statusPaid
      : lower === "pending"
      ? S.statusPending
      : lower === "cancelled" || lower === "refunded"
      ? S.statusBad
      : S.statusNeutral;

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
      className={`rounded-[22px] border p-4 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 ${
        highlight ? "border-slate-300 bg-slate-50" : "border-slate-200"
      }`}
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
      {highlight && <div className="mt-3 h-0.5 w-10 rounded-full bg-slate-900" />}
    </div>
  );
}

/* PDF builder — palette aligned with dashboard (slate neutrals, emerald accent, amber discounts) */
async function buildAndDownloadPdf(
  sale: SaleRow,
  items: NormalizedItem[],
  kpis: { subtotal: number; discount_total: number; total: number },
  discountedLines: NormalizedItem[],
  options?: { includeFinancials?: boolean }
) {
  const includeFinancials = options?.includeFinancials !== false;
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const MARGIN = 14;
  const CONTENT_W = PW - MARGIN * 2;

  const SLATE900 = [15, 23, 42] as [number, number, number];
  const SLATE700 = [51, 65, 85] as [number, number, number];
  const SLATE600 = [71, 85, 105] as [number, number, number];
  const SLATE500 = [100, 116, 139] as [number, number, number];
  const SLATE200 = [226, 232, 240] as [number, number, number];
  const SLATE100 = [241, 245, 249] as [number, number, number];
  const SLATE50 = [248, 250, 252] as [number, number, number];
  const EMERALD600 = [5, 150, 105] as [number, number, number];
  const EMERALD700 = [4, 120, 87] as [number, number, number];
  const AMBER800 = [146, 64, 14] as [number, number, number];

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
    doc.setTextColor(...(opts?.color ?? SLATE900));
    doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
    doc.text(str, x, yy, { align: opts?.align ?? "left" });
  }

  /* Brand stripe + light header (matches app cards, not a heavy inverse bar) */
  doc.setFillColor(...EMERALD600);
  doc.rect(0, 0, PW, 3.2, "F");

  let y = 11;
  text("INVOICE", MARGIN, y, { size: 7, color: SLATE500, bold: true });
  text(sale.sale_no ?? "—", MARGIN, y + 11, { size: 20, color: SLATE900, bold: true });

  text("Pollinators Apitherapy", PW - MARGIN, y + 4, {
    size: 11,
    color: SLATE900,
    bold: true,
    align: "right",
  });
  text("Beekeepers Apitherapy", PW - MARGIN, y + 10, {
    size: 8,
    color: SLATE600,
    align: "right",
  });

  y += 28;

  /* Meta panel — slate-50 card with border like dashboard sections */
  const metaBoxH = 20;
  doc.setFillColor(...SLATE50);
  doc.rect(MARGIN, y - 5, CONTENT_W, metaBoxH, "F");
  doc.setDrawColor(...SLATE200);
  doc.setLineWidth(0.35);
  doc.rect(MARGIN, y - 5, CONTENT_W, metaBoxH, "S");

  const metaCol = CONTENT_W / 4;
  [
    { label: "Customer", value: sale.customer_name ?? "Walk-in" },
    { label: "Date", value: sale.created_at ? fmtDate(sale.created_at) : "—" },
    { label: "Status", value: sale.status ?? "—" },
    { label: "Payment", value: sale.payment_method ?? "—" },
  ].forEach((m, i) => {
    const mx = MARGIN + 4 + i * metaCol;
    text(m.label.toUpperCase(), mx, y + 2, {
      size: 6.5,
      color: SLATE500,
      bold: true,
    });
    text(m.value, mx, y + 8, { size: 9, color: SLATE900 });
  });

  y += metaBoxH + 6;

  const recordedLabel =
    sale.recorded_by?.full_name?.trim() ||
    sale.recorded_by?.email?.trim();
  if (recordedLabel) {
    text("RECORDED BY", MARGIN, y, { size: 6.5, color: SLATE500, bold: true });
    text(recordedLabel, MARGIN + 34, y, { size: 9, color: SLATE900 });
    y += 7;
  }

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [["Product", "Qty", "Base", "Discount", "Unit price", "Line total"]],
    body: items.map((x) => [
      x.product_name,
      String(x.qty),
      fmtMoney(x.base),
      x.discountPerUnit > 0 ? `-${fmtMoney(x.discountPerUnit)}` : "—",
      fmtMoney(x.final),
      fmtMoney(x.lineTotal),
    ]),
    headStyles: {
      fillColor: SLATE100,
      textColor: SLATE700,
      fontSize: 7,
      fontStyle: "bold",
      cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 },
      lineColor: SLATE200,
      lineWidth: 0.2,
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: SLATE900,
      cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 },
      lineColor: SLATE200,
    },
    alternateRowStyles: { fillColor: SLATE50 },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { halign: "center", cellWidth: 11 },
      2: { halign: "right", cellWidth: 26 },
      3: { halign: "right", cellWidth: 22 },
      4: { halign: "right", cellWidth: 24 },
      5: { halign: "right", cellWidth: 28, fontStyle: "bold", textColor: SLATE900 },
    },
    tableLineColor: SLATE200,
    tableLineWidth: 0.25,
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  /* Totals — right-aligned block with emphasis card */
  const totalsW = 72;
  const totalsX = PW - MARGIN - totalsW;
  const totalsTop = y - 4;
  let ty = y;

  doc.setFillColor(...SLATE50);
  doc.rect(totalsX, totalsTop, totalsW, kpis.discount_total > 0 ? 34 : 28, "F");
  doc.setDrawColor(...SLATE200);
  doc.setLineWidth(0.35);
  doc.rect(totalsX, totalsTop, totalsW, kpis.discount_total > 0 ? 34 : 28, "S");

  ty += 6;
  text("Subtotal", totalsX + 4, ty, { size: 9, color: SLATE600 });
  text(fmtMoney(kpis.subtotal), totalsX + totalsW - 4, ty, {
    size: 9,
    color: SLATE900,
    align: "right",
  });
  ty += 7;

  if (kpis.discount_total > 0) {
    text("Discounts", totalsX + 4, ty, { size: 9, color: SLATE600 });
    text(`-${fmtMoney(kpis.discount_total)}`, totalsX + totalsW - 4, ty, {
      size: 9,
      color: AMBER800,
      bold: true,
      align: "right",
    });
    ty += 7;
  }

  doc.setDrawColor(...SLATE200);
  doc.setLineWidth(0.25);
  doc.line(totalsX + 4, ty - 1, totalsX + totalsW - 4, ty - 1);

  text("Total due", totalsX + 4, ty + 5, {
    size: 10,
    color: SLATE900,
    bold: true,
  });
  text(fmtMoney(kpis.total), totalsX + totalsW - 4, ty + 5, {
    size: 12,
    color: EMERALD700,
    bold: true,
    align: "right",
  });

  y = ty + 18;

  if (includeFinancials && discountedLines.length > 0) {
    text("Discount detail", MARGIN, y, { size: 8.5, color: SLATE700, bold: true });
    y += 6;
    discountedLines.slice(0, 12).forEach((d) => {
      text(
        `${d.product_name} · saved ${fmtMoney(d.discountPerUnit * d.qty)}`,
        MARGIN,
        y,
        { size: 7.5, color: SLATE600 }
      );
      y += 4.5;
    });
    if (discountedLines.length > 12) {
      text(`… and ${discountedLines.length - 12} more`, MARGIN, y, {
        size: 7,
        color: SLATE500,
      });
      y += 5;
    }
    y += 4;
  } else if (!includeFinancials && discountedLines.length > 0) {
    text("Items included promotional pricing.", MARGIN, y, {
      size: 8,
      color: SLATE600,
    });
    y += 6;
  }

  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const fy = PH - 9;
    doc.setDrawColor(...SLATE200);
    doc.setLineWidth(0.25);
    doc.line(MARGIN, fy - 4, PW - MARGIN, fy - 4);
    text("Thank you for your business.", MARGIN, fy, {
      size: 7.5,
      color: SLATE500,
    });
    text(`Page ${p} of ${totalPages}`, PW - MARGIN, fy, {
      size: 7,
      color: SLATE500,
      align: "right",
    });
  }

  doc.save(`invoice-${sale.sale_no ?? "sale"}.pdf`);
}

const GRID_LINE_ITEMS_FULL =
  "1.5fr 0.5fr 0.9fr 0.9fr 0.9fr 0.9fr 0.9fr 1fr";
const GRID_LINE_ITEMS_CLERK = "1.6fr 0.55fr 1fr 1fr 1fr 1.35fr";

export default function SaleDetailsPage() {
  const params = useParams<{ saleId: string }>();
  const saleId = params?.saleId;

  const { isAdmin, loading: roleLoading } = useOrgRole();
  const showFinancials = !roleLoading && isAdmin;

  const [orgId, setOrgId] = useState<string | null>(null);
  const [sale, setSale] = useState<SaleRow | null>(null);
  const [items, setItems] = useState<SaleItemRow[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidNote, setVoidNote] = useState("");
  const [voidSubmitting, setVoidSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

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

  useEffect(() => {
    if (!successMsg) return;
    const t = window.setTimeout(() => setSuccessMsg(""), 6000);
    return () => window.clearTimeout(t);
  }, [successMsg]);

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
      await buildAndDownloadPdf(sale, normalizedItems, kpis, discountedLines, {
        includeFinancials: showFinancials,
      });
    } catch (e: any) {
      setErr("PDF generation failed: " + (e.message ?? String(e)));
    } finally {
      setDownloading(false);
    }
  }

  async function handleConfirmVoid() {
    if (!orgId || !saleId) return;

    setVoidSubmitting(true);
    setErr("");

    try {
      await voidSaleRestoreInventory(orgId, saleId, {
        note: voidNote.trim() || null,
      });
      setVoidOpen(false);
      setVoidNote("");
      setSuccessMsg("Sale voided and stock restored to inventory.");

      const [s, it] = await Promise.all([
        getSale(orgId, saleId),
        listSaleItems(orgId, saleId),
      ]);
      setSale(s);
      setItems(it);
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally {
      setVoidSubmitting(false);
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-600">
            Sales
          </div>
          <h1 className="mt-3 text-[28px] font-bold leading-tight text-slate-900 tracking-tight sm:text-[32px]">
            Sale Details
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {showFinancials
              ? "View items, totals, payment and cost snapshot"
              : "View items, totals and payment for this sale"}
          </p>
        </div>

        <div
          className={`flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3 ${S.noPrint}`}
        >
          <Link href="/dashboard/sales" className={S.btnGhost}>
            ← Back
          </Link>
          {!loading &&
            !roleLoading &&
            sale &&
            isAdmin &&
            saleCanBeVoided(sale.status) && (
            <button
              type="button"
              className={S.btnDanger}
              onClick={() => {
                setVoidOpen(true);
                setVoidNote("");
                setErr("");
              }}
              disabled={voidSubmitting}
            >
              Void sale · restore stock
            </button>
          )}
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

      {successMsg && (
        <div className={S.bannerSuccess}>
          <span className="mt-0.5 shrink-0 text-emerald-600" aria-hidden>
            ✓
          </span>
          <span className="flex-1">{successMsg}</span>
          <button
            type="button"
            onClick={() => setSuccessMsg("")}
            className="ml-auto shrink-0 rounded-lg px-1.5 text-emerald-700 transition hover:bg-emerald-100 hover:text-emerald-900"
          >
            ✕
          </button>
        </div>
      )}

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

      <div className={S.card}>
        <div className="flex flex-col gap-6 px-5 py-6 sm:px-6 sm:flex-row sm:items-start sm:justify-between">
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

              {(sale?.recorded_by?.full_name || sale?.recorded_by?.email) && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="w-20 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Recorded by
                  </span>
                  <span className="text-slate-700 font-medium">
                    {sale.recorded_by?.full_name?.trim() ||
                      sale.recorded_by?.email ||
                      "—"}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1 text-left sm:text-right">
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              Business
            </div>
            <div className="text-xl font-bold text-slate-900">
              Pollin<span className="italic text-emerald-700">ators</span>
            </div>
            <div className="text-sm text-slate-500">Beekeepers Apitherapy</div>
            <div className="mt-2 text-3xl">🍯</div>
          </div>
        </div>
      </div>

      <div
        className={`grid grid-cols-2 gap-3 sm:gap-4 ${
          showFinancials ? "lg:grid-cols-3 xl:grid-cols-5" : "lg:grid-cols-3"
        }`}
      >
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
        {showFinancials && (
          <>
            <StatCard label="Cost at Sale" value={fmtMoney(kpis.totalCost)} loading={loading} />
            <StatCard
              label="Estimated Profit"
              value={fmtMoney(kpis.totalProfit)}
              loading={loading}
              sub="based on saved cost snapshot"
            />
          </>
        )}
      </div>

      <div className={`${S.card} overflow-hidden`}>
        <div className="border-b border-slate-100 bg-white px-5 py-4">
          <div className="text-base font-bold text-slate-900">Line Items</div>
          {!loading && normalizedItems.length > 0 && (
            <div className="mt-0.5 text-xs text-slate-500">
              {normalizedItems.length} product{normalizedItems.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>

        <div className="overflow-x-auto border-b border-slate-100">
          <div
            className={`${S.tableHead} items-center gap-4 px-5 py-3 ${showFinancials ? "min-w-[760px]" : "min-w-[520px]"}`}
            style={{
              gridTemplateColumns: showFinancials
                ? GRID_LINE_ITEMS_FULL
                : GRID_LINE_ITEMS_CLERK,
            }}
          >
            <div>Product</div>
            <div className="text-center">Qty</div>
            <div className="text-right">Base</div>
            <div className="text-right">Discount</div>
            <div className="text-right">Unit Price</div>
            {showFinancials && (
              <>
                <div className="text-right">Cost</div>
                <div className="text-right">Profit</div>
              </>
            )}
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
                className={`grid items-center gap-4 px-5 py-3.5 text-sm transition-colors hover:bg-slate-50 ${showFinancials ? "min-w-[760px]" : "min-w-[520px]"}`}
                style={{
                  gridTemplateColumns: showFinancials
                    ? GRID_LINE_ITEMS_FULL
                    : GRID_LINE_ITEMS_CLERK,
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
                {showFinancials && (
                  <>
                    <div className="text-right text-slate-600">
                      {fmtMoney(x.lineCost)}
                    </div>
                    <div className="text-right font-medium text-emerald-700">
                      {fmtMoney(x.lineProfit)}
                    </div>
                  </>
                )}
                <div className="text-right font-bold text-slate-900">
                  {fmtMoney(x.lineTotal)}
                </div>
              </div>
            ))
          )}
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-100 bg-slate-50 px-5 py-4">
          <div className="w-full max-w-xs space-y-2 text-sm sm:max-w-sm">
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

            {showFinancials && (
              <>
                <div className="flex items-center justify-between text-slate-500">
                  <span>Cost at sale</span>
                  <span className="font-medium text-slate-700">
                    {fmtMoney(kpis.totalCost)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-emerald-700">
                  <span>Estimated profit</span>
                  <span className="font-semibold">{fmtMoney(kpis.totalProfit)}</span>
                </div>
              </>
            )}

            <div className="flex items-center justify-between border-t border-slate-200 pt-2">
              <span className="font-bold text-slate-900">Total</span>
              <span className="text-lg font-bold text-slate-900">
                {fmtMoney(kpis.total)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className={`${S.card} overflow-hidden`}>
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-base font-bold text-slate-900">
              Discounted Products
            </div>
            <div className="mt-0.5 text-xs text-slate-500">
              Items with a price reduction applied
            </div>
          </div>
          {discountedLines.length > 0 && (
            <span className="inline-flex shrink-0 items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
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
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900">
                    -{fmtMoney(x.discountPerUnit)} / unit
                  </span>
                  {showFinancials && (
                    <div className="mt-1 text-sm font-bold text-emerald-700">
                      Saved {fmtMoney(x.discountPerUnit * x.qty)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
          Thank you for your business. 🍯
        </div>
      </div>

      {voidOpen && (
        <div
          className={`${S.overlayWrap} ${S.noPrint}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="void-sale-title"
        >
          <button
            type="button"
            className={S.overlayBackdrop}
            aria-label="Close dialog"
            onClick={() => !voidSubmitting && setVoidOpen(false)}
          />
          <div className={S.modalSheet}>
            <div className={S.modalSheetBody}>
              <h2
                id="void-sale-title"
                className="text-lg font-bold leading-snug text-slate-900"
              >
                Void this sale?
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                The sale will be marked cancelled and sold quantities will be added back to
                inventory. This cannot be undone from this screen.
              </p>
              <label className="mt-5 block">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Note (optional)
                </span>
                <textarea
                  className={`${S.input} mt-2 min-h-[88px] resize-y`}
                  value={voidNote}
                  onChange={(e) => setVoidNote(e.target.value)}
                  placeholder="Reason for void…"
                  disabled={voidSubmitting}
                />
              </label>
              <div className="mt-6 flex flex-col-reverse gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end sm:gap-3 sm:border-t-0 sm:pt-0">
                <button
                  type="button"
                  className={S.btnGhost}
                  onClick={() => setVoidOpen(false)}
                  disabled={voidSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={S.btnDanger}
                  onClick={handleConfirmVoid}
                  disabled={voidSubmitting}
                >
                  {voidSubmitting ? "Working…" : "Void sale · restore stock"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}