"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import {
  getSale,
  listSaleItems,
  listSaleActivityLogs,
  voidSaleRestoreInventory,
  editSaleItemsRestoreInventory,
  updateSaleDateStrict,
  type SaleRow,
  type SaleItemRow,
  type SaleActivityLog,
} from "@/lib/api/sales";
import { fetchMyOrgRole } from "@/lib/auth/orgRole";
import { useOrgRole } from "@/contexts/OrgRoleContext";
import * as S from "./page.styles";

/* Helpers */
function fmtMoney(v: number) {
  return `Ksh ${Number(v || 0).toLocaleString("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function formatQuantity(value?: number | string | null, unit?: string | null) {
  if (value === null || value === undefined || value === "") return "";
  if (!unit) return "";

  const n = Number(value);
  if (!Number.isFinite(n)) return "";

  const formatted = Number.isInteger(n)
    ? String(n)
    : n.toLocaleString("en-KE", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3,
      });

  return `${formatted} ${unit}`;
}

function formatProductDisplayName(product: {
  name?: string | null;
  quantity_value?: number | string | null;
  quantity_unit?: string | null;
}) {
  const base = (product.name ?? "").trim();
  const qty = formatQuantity(product.quantity_value, product.quantity_unit);

  if (!base) return qty || "Unknown product";
  if (!qty) return base;
  return `${base} ${qty}`;
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

function toDateInputValue(d?: string | null) {
  if (!d) return "";
  return d.slice(0, 10);
}

function todayInputDate() {
  return new Date().toISOString().slice(0, 10);
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
  saleItemId: string;
  productId: string;
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

type EditLine = {
  saleItemId: string;
  productId: string;
  productName: string;
  qty: string;
  unitPriceBase: number;
  discountPerUnit: number;
};

function isCancelledSale(status?: string | null) {
  return ["cancelled", "refunded", "void", "voided"].includes(
    (status ?? "").trim().toLowerCase()
  );
}

function saleCanBeVoided(status?: string | null) {
  const s = (status ?? "").trim().toLowerCase();
  if (!s) return true;
  return !isCancelledSale(s);
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
  discountedLines: NormalizedItem[]
) {
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
  const showRecorder = Boolean(sale.recorded_by_name);
  const metaBoxH = showRecorder ? 30 : 20;

  doc.setFillColor(...SLATE50);
  doc.rect(MARGIN, y - 5, CONTENT_W, metaBoxH, "F");
  doc.setDrawColor(...SLATE200);
  doc.setLineWidth(0.35);
  doc.rect(MARGIN, y - 5, CONTENT_W, metaBoxH, "S");

  const metaCol = CONTENT_W / 4;
  [
    { label: "Customer", value: sale.customer_name ?? "Walk-in" },
    {
      label: "Sale Date",
      value: sale.sold_at
        ? fmtDate(sale.sold_at)
        : sale.created_at
        ? fmtDate(sale.created_at)
        : "—",
    },
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

  if (showRecorder && sale.recorded_by_name) {
    text("RECORDED BY", MARGIN + 4, y + 16, {
      size: 6.5,
      color: SLATE500,
      bold: true,
    });
    text(sale.recorded_by_name, MARGIN + 34, y + 16, { size: 9, color: SLATE900 });
  }

  y += metaBoxH + 6;

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

  if (discountedLines.length > 0) {
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

export default function SaleDetailsPage() {
  const params = useParams<{ saleId: string }>();
  const saleId = params?.saleId;

  const [orgId, setOrgId] = useState<string | null>(null);
  const [sale, setSale] = useState<SaleRow | null>(null);
  const [items, setItems] = useState<SaleItemRow[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidNote, setVoidNote] = useState("");
  const [voidSubmitting, setVoidSubmitting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editLines, setEditLines] = useState<EditLine[]>([]);
  const [editNote, setEditNote] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [editSaleDate, setEditSaleDate] = useState("");
  const [editDateNote, setEditDateNote] = useState("");
  const [dateSubmitting, setDateSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [activityLogs, setActivityLogs] = useState<SaleActivityLog[]>([]);

  const { role, loading: roleLoading } = useOrgRole();

  const hideSensitive =
    !roleLoading && ["sales_clerk", "cashier", "pos"].includes(role ?? "none");

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
        const role = await fetchMyOrgRole(orgId);
        const hideCost = role === "sales_clerk";
        const [s, it, logs] = await Promise.all([
          getSale(orgId, saleId),
          listSaleItems(orgId, saleId, { hideCostFields: hideCost }),
          listSaleActivityLogs(orgId, saleId),
        ]);
        setSale(s);
        setItems(it);
        setActivityLogs(logs);
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

  async function reloadSale() {
    if (!orgId || !saleId) return;

    const role = await fetchMyOrgRole(orgId);
    const hideCost = role === "sales_clerk";
    const [s, it, logs] = await Promise.all([
      getSale(orgId, saleId),
      listSaleItems(orgId, saleId, { hideCostFields: hideCost }),
      listSaleActivityLogs(orgId, saleId),
    ]);

    setSale(s);
    setItems(it);
    setActivityLogs(logs);
  }

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
          saleItemId: x.id,
          productId: x.product_id,
          product_name: formatProductDisplayName(p),
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

  const itemGridStyle = hideSensitive
    ? { gridTemplateColumns: "1.5fr 0.5fr 0.9fr 0.9fr 0.9fr 1fr" }
    : { gridTemplateColumns: "1.5fr 0.5fr 0.9fr 0.9fr 0.9fr 0.9fr 0.9fr 1fr" };

  const tableMinClass = hideSensitive ? "min-w-[620px]" : "min-w-[760px]";

  const canEditSale = Boolean(sale && saleCanBeVoided(sale.status) && !hideSensitive);

  const canEditSaleDate = Boolean(
    sale &&
      saleCanBeVoided(sale.status) &&
      !hideSensitive &&
      ["admin", "owner", "manager"].includes(role ?? "")
  );

  const editTotals = useMemo(() => {
    const activeLines = editLines.filter((line) => Number(line.qty) > 0);
    const subtotal = activeLines.reduce(
      (sum, line) => sum + Number(line.unitPriceBase || 0) * Number(line.qty || 0),
      0
    );
    const discountTotal = activeLines.reduce(
      (sum, line) =>
        sum + Number(line.discountPerUnit || 0) * Number(line.qty || 0),
      0
    );

    return {
      subtotal,
      discountTotal,
      total: Math.max(0, subtotal - discountTotal),
      itemCount: activeLines.length,
    };
  }, [editLines]);

  function openEditSale() {
    const nextLines = items.map((x) => {
      const p = Array.isArray(x.products) ? x.products[0] : (x.products as any);
      return {
        saleItemId: x.id,
        productId: x.product_id,
        productName: formatProductDisplayName(p),
        qty: String(Number(x.qty ?? 0)),
        unitPriceBase: Number(x.unit_price_base ?? x.unit_price ?? 0),
        discountPerUnit: Number(x.discount_per_unit ?? 0),
      };
    });

    setEditLines(nextLines);
    setEditNote("");
    setErr("");
    setEditOpen(true);
  }

  function updateEditQty(saleItemId: string, qty: string) {
    if (qty !== "" && !/^\d*(\.\d{0,3})?$/.test(qty)) return;

    setEditLines((prev) =>
      prev.map((line) =>
        line.saleItemId === saleItemId ? { ...line, qty } : line
      )
    );
  }

  function removeEditLine(saleItemId: string) {
    setEditLines((prev) =>
      prev.map((line) =>
        line.saleItemId === saleItemId ? { ...line, qty: "0" } : line
      )
    );
  }

  async function handleSaveEdit() {
    if (!orgId || !saleId) return;

    const cleaned = editLines
      .map((line) => ({
        sale_item_id: line.saleItemId,
        product_id: line.productId,
        qty: Number(line.qty || 0),
      }))
      .filter((line) => Number.isFinite(line.qty) && line.qty > 0);

    if (cleaned.length === 0) {
      setErr("A sale must have at least one product. Void the sale instead if it should be cancelled.");
      return;
    }

    setEditSubmitting(true);
    setErr("");

    try {
      await editSaleItemsRestoreInventory(orgId, saleId, {
        items: cleaned,
        note: editNote.trim() || null,
      });

      setEditOpen(false);
      setSuccessMsg("Sale updated and inventory adjusted.");
      await reloadSale();
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleSaveSaleDate() {
    if (!orgId || !saleId) return;

    if (!editSaleDate) {
      setErr("Sale date is required.");
      return;
    }

    if (editSaleDate > todayInputDate()) {
      setErr("Sale date cannot be in the future.");
      return;
    }

    setDateSubmitting(true);
    setErr("");

    try {
      await updateSaleDateStrict(
        orgId,
        saleId,
        editSaleDate,
        editDateNote.trim() || null
      );

      setDateOpen(false);
      setEditSaleDate("");
      setEditDateNote("");
      setSuccessMsg("Sale date updated.");
      await reloadSale();
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally {
      setDateSubmitting(false);
    }
  }

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

      await reloadSale();
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
            {hideSensitive
              ? "Items, totals and payment for this sale"
              : "View items, totals, payment and cost snapshot"}
          </p>
        </div>

        <div
          className={`flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3 ${S.noPrint}`}
        >
          <Link href="/dashboard/sales" className={S.btnGhost}>
            ← Back
          </Link>
          {!loading && canEditSale && (
            <button
              type="button"
              className={S.btnGhost}
              onClick={openEditSale}
              disabled={editSubmitting || voidSubmitting || dateSubmitting}
            >
              Edit sale items
            </button>
          )}

          {!loading && canEditSaleDate && (
            <button
              type="button"
              className={S.btnGhost}
              onClick={() => {
                setEditSaleDate(toDateInputValue(sale?.sold_at ?? sale?.created_at));
                setEditDateNote("");
                setErr("");
                setDateOpen(true);
              }}
              disabled={dateSubmitting || editSubmitting || voidSubmitting}
            >
              Edit sale date
            </button>
          )}

          {!loading && canEditSale && (
            <button
              type="button"
              className={S.btnDanger}
              onClick={() => {
                setVoidOpen(true);
                setVoidNote("");
                setErr("");
              }}
              disabled={voidSubmitting || editSubmitting || dateSubmitting}
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
{sale?.sold_at
                    ? fmtDate(sale.sold_at)
                    : sale?.created_at
                    ? fmtDate(sale.created_at)
                    : "—"}
                </span>
              </div>

              {sale?.created_at && (
                <div className="flex items-center gap-2">
                  <span className="w-20 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Recorded
                  </span>
                  <span className="text-slate-500">{fmtDate(sale.created_at)}</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <span className="w-20 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Status
                </span>
                <StatusBadge status={sale?.status} />
                {Number(sale?.edit_count ?? 0) > 0 && !isCancelledSale(sale?.status) && (
                  <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-black uppercase tracking-[0.12em] text-blue-700">
                    Edited
                  </span>
                )}
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

              {sale?.recorded_by_name?.trim() && (
                <div className="flex items-center gap-2">
                  <span className="w-20 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Recorded by
                  </span>
                  <span className="text-slate-700 font-medium">{sale.recorded_by_name.trim()}</span>
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
          hideSensitive ? "lg:grid-cols-3" : "lg:grid-cols-3 xl:grid-cols-5"
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
        {!hideSensitive && (
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
            className={`${S.tableHead} ${tableMinClass} items-center gap-4 px-5 py-3`}
            style={itemGridStyle}
          >
            <div>Product</div>
            <div className="text-center">Qty</div>
            <div className="text-right">Base</div>
            <div className="text-right">Discount</div>
            <div className="text-right">Unit Price</div>
            {!hideSensitive && (
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
                className={`grid ${tableMinClass} items-center gap-4 px-5 py-3.5 text-sm transition-colors hover:bg-slate-50`}
                style={itemGridStyle}
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
                {!hideSensitive && (
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

            {!hideSensitive && (
              <>
                <div className="flex items-center justify-between text-slate-500">
                  <span>Cost at sale</span>
                  <span className="font-medium text-slate-700">{fmtMoney(kpis.totalCost)}</span>
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
                  <div className="mt-1 text-sm font-bold text-emerald-700">
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

      <div className={`${S.card} overflow-hidden`}>
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-base font-bold text-slate-900">Sale Activity</div>
            <div className="mt-0.5 text-xs text-slate-500">
              Edits, cancellations, and stock-impacting changes
            </div>
          </div>

          {!loading && Number(sale?.edit_count ?? 0) > 0 && (
            <span className="inline-flex shrink-0 items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-blue-700">
              Edited {sale?.edit_count} time{Number(sale?.edit_count ?? 0) !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm text-slate-400">
            Loading activity…
          </div>
        ) : activityLogs.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">
            No edits or cancellations recorded for this sale.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {activityLogs.map((log) => {
              const isCancel = ["cancel", "void"].includes(log.action);
              const isEdit = log.action === "edit";
              const beforeTotal = Number((log.before_json as any)?.sale?.total ?? 0);
              const afterTotal = Number((log.after_json as any)?.total ?? 0);

              return (
                <div key={log.id} className="px-5 py-4 transition-colors hover:bg-slate-50">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-black uppercase tracking-[0.12em] ${
                          isCancel
                            ? "bg-red-100 text-red-700"
                            : isEdit
                            ? "bg-blue-100 text-blue-700"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {isCancel ? "Cancelled" : isEdit ? "Edited" : log.action}
                      </span>

                      {isEdit && beforeTotal !== afterTotal && afterTotal > 0 && (
                        <span className="text-xs font-semibold text-slate-500">
                          {fmtMoney(beforeTotal)} → {fmtMoney(afterTotal)}
                        </span>
                      )}
                    </div>

                    <span className="text-xs font-semibold text-slate-400">
                      {fmtDate(log.created_at)}
                    </span>
                  </div>

                  {log.note && (
                    <div className="mt-2 text-sm text-slate-600">{log.note}</div>
                  )}

                  {isCancel && sale?.cancel_note && (
                    <div className="mt-2 rounded-2xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                      Reason: {sale.cancel_note}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {dateOpen && (
        <div
          className={`${S.overlayWrap} ${S.noPrint}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-sale-date-title"
        >
          <button
            type="button"
            className={S.overlayBackdrop}
            aria-label="Close dialog"
            onClick={() => !dateSubmitting && setDateOpen(false)}
          />

          <div className={S.modalSheet}>
            <div className={S.modalSheetBody}>
              <h2
                id="edit-sale-date-title"
                className="text-lg font-bold leading-snug text-slate-900"
              >
                Edit sale date
              </h2>

              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                This changes the sale date used in reports. It does not change
                when the record was entered.
              </p>

              <label className="mt-5 block">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Sale date
                </span>
                <input
                  type="date"
                  className={`${S.input} mt-2`}
                  value={editSaleDate}
                  max={todayInputDate()}
                  onChange={(e) => setEditSaleDate(e.target.value)}
                  disabled={dateSubmitting}
                />
              </label>

              <label className="mt-5 block">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Note (optional)
                </span>
                <textarea
                  className={`${S.input} mt-2 min-h-[76px] resize-y`}
                  value={editDateNote}
                  onChange={(e) => setEditDateNote(e.target.value)}
                  placeholder="Reason for changing the sale date…"
                  disabled={dateSubmitting}
                />
              </label>

              <div className="mt-6 flex flex-col-reverse gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end sm:gap-3 sm:border-t-0 sm:pt-0">
                <button
                  type="button"
                  className={S.btnGhost}
                  onClick={() => setDateOpen(false)}
                  disabled={dateSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={S.btnPrimary}
                  onClick={handleSaveSaleDate}
                  disabled={dateSubmitting}
                >
                  {dateSubmitting ? "Saving…" : "Save date"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editOpen && (
        <div
          className={`${S.overlayWrap} ${S.noPrint}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-sale-title"
        >
          <button
            type="button"
            className={S.overlayBackdrop}
            aria-label="Close dialog"
            onClick={() => !editSubmitting && setEditOpen(false)}
          />

          <div className={S.modalSheet}>
            <div className={S.modalSheetBody}>
              <h2
                id="edit-sale-title"
                className="text-lg font-bold leading-snug text-slate-900"
              >
                Edit sale items
              </h2>

              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Change the quantity or remove a product. Saving will recalculate
                the sale total and adjust inventory using the difference.
              </p>

              <div className="mt-5 max-h-[50vh] space-y-2 overflow-y-auto pr-1">
                {editLines.map((line) => {
                  const qty = Number(line.qty || 0);
                  const unitFinal = Math.max(
                    0,
                    Number(line.unitPriceBase || 0) -
                      Number(line.discountPerUnit || 0)
                  );

                  return (
                    <div
                      key={line.saleItemId}
                      className={`rounded-2xl border p-3 ${
                        qty <= 0
                          ? "border-red-100 bg-red-50/50"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-slate-900">
                            {line.productName}
                          </div>
                          <div className="mt-0.5 text-xs text-slate-500">
                            Unit {fmtMoney(unitFinal)} · Line {fmtMoney(unitFinal * qty)}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <label className="sr-only">Quantity</label>
                          <input
                            className="h-10 w-24 rounded-xl border border-slate-300 bg-white px-3 text-right text-sm font-bold text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                            value={line.qty}
                            inputMode="decimal"
                            onChange={(e) =>
                              updateEditQty(line.saleItemId, e.target.value)
                            }
                            disabled={editSubmitting}
                          />

                          <button
                            type="button"
                            className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
                            onClick={() => removeEditLine(line.saleItemId)}
                            disabled={editSubmitting || qty <= 0}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <div className="flex items-center justify-between text-slate-600">
                  <span>New subtotal</span>
                  <span className="font-bold text-slate-900">
                    {fmtMoney(editTotals.subtotal)}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-slate-600">
                  <span>New discount</span>
                  <span className="font-bold text-amber-700">
                    -{fmtMoney(editTotals.discountTotal)}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2 text-slate-900">
                  <span className="font-black">New total</span>
                  <span className="text-lg font-black">
                    {fmtMoney(editTotals.total)}
                  </span>
                </div>
              </div>

              <label className="mt-5 block">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Note (optional)
                </span>
                <textarea
                  className={`${S.input} mt-2 min-h-[76px] resize-y`}
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="Reason for editing this sale…"
                  disabled={editSubmitting}
                />
              </label>

              <div className="mt-6 flex flex-col-reverse gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end sm:gap-3 sm:border-t-0 sm:pt-0">
                <button
                  type="button"
                  className={S.btnGhost}
                  onClick={() => setEditOpen(false)}
                  disabled={editSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={S.btnPrimary}
                  onClick={handleSaveEdit}
                  disabled={editSubmitting}
                >
                  {editSubmitting ? "Saving…" : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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