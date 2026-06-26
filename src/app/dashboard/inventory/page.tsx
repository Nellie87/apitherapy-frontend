"use client";

import React, { useEffect, useMemo, useState } from "react";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import {
  listInventory,
  updateInventory,
  adjustInventoryDelta,
  createInventoryInitial,
  listInventoryMovements,
  type InventoryRow,
  type InventoryMovementRow,
  type QuantityUnit,
} from "@/lib/api/inventory";
import { listProducts } from "@/lib/api/products";
import RestockModal from "./components/RestockModal";
import * as S from "./page.styles";

type ProductLite = {
  id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  category?: string | null;
  unit_price?: number | null;
  cost_price?: number | null;
  quantity_value?: number | null;
  quantity_unit?: QuantityUnit | null;
};

type StockFilter = "all" | "low" | "out";
type MainTab = "overview" | "history";
type HistoryTypeFilter =
  | "all"
  | "add"
  | "restock"
  | "remove"
  | "set"
  | "sale"
  | "sale_edit"
  | "sale_void";

type ToastState = {
  message: string;
  type: "success" | "error";
} | null;

const PAGE_SIZE = 8;
const HISTORY_PAGE_SIZE = 10;

function fmtMoney(v: number | string | null | undefined) {
  const n = Number(v || 0);
  return `Ksh ${n.toLocaleString("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function fmtNumber(v: number | string | null | undefined) {
  const n = Number(v || 0);
  return n.toLocaleString("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

function fmtPercent(v: number | string | null | undefined) {
  const n = Number(v || 0);
  return `${n.toLocaleString("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })}%`;
}

function formatQuantity(
  value?: number | string | null,
  unit?: QuantityUnit | string | null,
) {
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
  quantity_unit?: QuantityUnit | string | null;
}) {
  const base = (product.name ?? "").trim();
  const qty = formatQuantity(product.quantity_value, product.quantity_unit);

  if (!base) return qty || "Unnamed product";
  if (!qty) return base;
  return `${base} ${qty}`;
}

function getStockStatus(
  qty: number,
  reorder: number,
): "out" | "critical" | "low" | "ok" {
  if (qty <= 0) return "out";
  if (reorder > 0 && qty <= Math.max(1, Math.ceil(reorder * 0.3))) return "critical";
  if (reorder > 0 && qty <= reorder) return "low";
  return "ok";
}

function movementLabel(type: InventoryMovementRow["type"] | "sale_edit" | string) {
  switch (type) {
    case "add":
      return "Added";
    case "restock":
      return "Restocked";
    case "remove":
      return "Removed";
    case "set":
      return "Set";
    case "sale":
      return "Sold";
    case "sale_edit":
      return "Sale edit";
    case "sale_void":
      return "Sale void";
    default:
      return type;
  }
}

function movementColor(type: InventoryMovementRow["type"] | "sale_edit" | string) {
  switch (type) {
    case "add":
    case "restock":
      return "bg-green-100 text-green-700 border-green-200";
    case "remove":
      return "bg-red-100 text-red-700 border-red-200";
    case "set":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "sale":
      return "bg-violet-100 text-violet-700 border-violet-200";
    case "sale_edit":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "sale_void":
      return "bg-amber-100 text-amber-800 border-amber-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function fmtDateTime(s?: string | null) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return s;
  }
}

function getMonthValue(dateString?: string | null) {
  if (!dateString) return "";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getBaseUnitLabel(row: InventoryRow) {
  const units = row.products?.product_units ?? [];
  const base = units.find((u) => u.is_default) ?? units[0];
  return base?.label ?? "base units";
}

function getValuationUnit(row: InventoryRow) {
  const units = row.products?.product_units ?? [];
  const base = units.find((u) => u.is_default) ?? units[0];
  return {
    cost: Number(base?.cost_price ?? row.products?.cost_price ?? 0),
    sell: Number(base?.selling_price ?? row.products?.unit_price ?? 0),
  };
}

function Toast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: "success" | "error";
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className={`fixed bottom-5 right-5 z-50 rounded-2xl px-5 py-3.5 text-sm font-semibold text-white shadow-xl ${
        type === "success" ? "bg-green-600" : "bg-red-600"
      }`}
    >
      <div className="flex items-center gap-3">
        <span>{message}</span>
        <button
          onClick={onClose}
          className="rounded-full px-2 py-0.5 text-xs text-white/80 hover:bg-white/10 hover:text-white"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  sub,
  variant = "neutral",
  active = false,
  onClick,
}: {
  title: string;
  value: string;
  sub?: string;
  variant?: "neutral" | "success" | "warning" | "danger";
  active?: boolean;
  onClick?: () => void;
}) {
  const styles = {
    neutral: "border-[#EADFC2] bg-white text-slate-900",
    success: "border-green-200 bg-green-50 text-green-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    danger: "border-red-200 bg-red-50 text-red-900",
  }[variant];

  const Comp = onClick ? "button" : "div";

  return (
    <Comp
      onClick={onClick}
      className={`rounded-[24px] border p-5 text-left shadow-[0_10px_28px_rgba(15,23,42,0.04)] transition ${styles} ${
        active ? "ring-2 ring-amber-200" : ""
      } ${onClick ? "hover:-translate-y-0.5" : ""}`}
    >
      <div className="text-[11px] font-black uppercase tracking-[0.18em] opacity-70">
        {title}
      </div>
      <div className="mt-2 text-2xl font-black leading-none">{value}</div>
      {sub && <div className="mt-2 text-xs opacity-70">{sub}</div>}
    </Comp>
  );
}

function StatusBadge({ qty, reorder }: { qty: number; reorder: number }) {
  const status = getStockStatus(qty, reorder);

  const config = {
    out: "bg-red-100 text-red-700 border-red-200",
    critical: "bg-red-100 text-red-700 border-red-200",
    low: "bg-amber-100 text-amber-800 border-amber-200",
    ok: "bg-green-100 text-green-700 border-green-200",
  }[status];

  const label = {
    out: "Out of stock",
    critical: "Critical",
    low: "Low stock",
    ok: "In stock",
  }[status];

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${config}`}>
      {label}
    </span>
  );
}

function TopTabs({
  value,
  onChange,
}: {
  value: MainTab;
  onChange: (value: MainTab) => void;
}) {
  const tabs: { key: MainTab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "history", label: "Movement history" },
  ];

  return (
    <div className="inline-flex rounded-2xl border border-[#EADFC2] bg-white p-1 shadow-sm">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
            value === tab.key
              ? "bg-amber-500 text-white shadow"
              : "text-slate-600 hover:bg-amber-50"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPage,
  itemLabel = "item",
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPage: (page: number) => void;
  itemLabel?: string;
}) {
  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex flex-col gap-3 border-t border-[#F1E6C9] bg-[#FFFDF8] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-xs text-slate-500">
        Showing {start}–{end} of {totalItems} {itemLabel}
        {totalItems === 1 ? "" : "s"}
      </span>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page === 1}
          className="h-9 rounded-xl border border-[#EADFC2] bg-white px-3 text-xs font-bold text-slate-600 hover:bg-[#FFF8E6] disabled:opacity-40"
        >
          Prev
        </button>
        <span className="px-2 text-sm font-bold text-slate-700">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onPage(page + 1)}
          disabled={page === totalPages}
          className="h-9 rounded-xl border border-[#EADFC2] bg-white px-3 text-xs font-bold text-slate-600 hover:bg-[#FFF8E6] disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function Modal({
  open,
  title,
  sub,
  children,
  footer,
  onClose,
}: {
  open: boolean;
  title: string;
  sub?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-[26px] bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <div className="text-lg font-black text-slate-900">{title}</div>
            {sub && <div className="mt-1 text-sm text-slate-500">{sub}</div>}
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="border-t border-slate-100 bg-slate-50 px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}

export default function InventoryPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [allProducts, setAllProducts] = useState<ProductLite[]>([]);
  const [allMovements, setAllMovements] = useState<InventoryMovementRow[]>([]);

  const [tab, setTab] = useState<MainTab>("overview");
  const [q, setQ] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [page, setPage] = useState(1);

  const [historySearch, setHistorySearch] = useState("");
  const [historyMonth, setHistoryMonth] = useState("");
  const [historyTypeFilter, setHistoryTypeFilter] = useState<HistoryTypeFilter>("all");
  const [historyPage, setHistoryPage] = useState(1);

  const [err, setErr] = useState("");
  const [toast, setToast] = useState<ToastState>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addProductId, setAddProductId] = useState("");
  const [addQty, setAddQty] = useState("0");
  const [addReorder, setAddReorder] = useState("5");

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustRow, setAdjustRow] = useState<InventoryRow | null>(null);
  const [adjustMode, setAdjustMode] = useState<"add" | "remove" | "set">("add");
  const [adjustValue, setAdjustValue] = useState("0");
  const [adjustNote, setAdjustNote] = useState("");
  const [adjustModalError, setAdjustModalError] = useState("");

  const [restockRow, setRestockRow] = useState<InventoryRow | null>(null);

  async function refresh(o: string) {
    setRows(await listInventory(o));
  }

  async function loadProducts(o: string) {
    const ps = await listProducts(o);
    setAllProducts(
      (ps ?? []).map((p: any) => ({
        id: p.id,
        name: p.name,
        sku: p.sku ?? null,
        barcode: p.barcode ?? null,
        category: typeof p.category === "string" ? p.category : p.category?.name ?? null,
        unit_price: Number(p.unit_price ?? 0),
        cost_price: Number(p.cost_price ?? 0),
        quantity_value:
          p.quantity_value !== null && p.quantity_value !== undefined
            ? Number(p.quantity_value)
            : null,
        quantity_unit: p.quantity_unit ?? null,
      })),
    );
  }

  async function loadAllHistory(o: string) {
    const history = await listInventoryMovements(o);
    setAllMovements(history);
  }

  useEffect(() => {
    (async () => {
      try {
        const o = await bootstrapOrg();
        setOrgId(o);
        await Promise.all([refresh(o), loadProducts(o), loadAllHistory(o)]);
      } catch (e: any) {
        setErr(e.message ?? String(e));
      }
    })();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [q, stockFilter, tab]);

  useEffect(() => {
    setHistoryPage(1);
  }, [historySearch, historyMonth, historyTypeFilter, tab]);

  const productIdsInInventory = useMemo(
    () => new Set(rows.map((r) => r.product_id)),
    [rows],
  );

  const addCandidates = useMemo(
    () =>
      allProducts
        .filter((p) => !productIdsInInventory.has(p.id))
        .sort((a: ProductLite, b: ProductLite) =>
          formatProductDisplayName(a).localeCompare(formatProductDisplayName(b)),
        ),
    [allProducts, productIdsInInventory],
  );

  useEffect(() => {
    if (!addProductId && addCandidates.length) setAddProductId(addCandidates[0].id);
  }, [addCandidates, addProductId]);

  const kpis = useMemo(() => {
    const totalItems = rows.length;
    const outOfStock = rows.filter((r) => Number(r.qty_on_hand ?? 0) <= 0).length;
    const lowStock = rows.filter((r) => {
      const qty = Number(r.qty_on_hand ?? 0);
      const reorder = Number(r.reorder_level ?? 0);
      const status = getStockStatus(qty, reorder);
      return status === "low" || status === "critical";
    }).length;

    const stockCostValue = rows.reduce((sum, r) => {
      const { cost } = getValuationUnit(r);
      return sum + cost * Number(r.qty_on_hand ?? 0);
    }, 0);

    const stockRetailValue = rows.reduce((sum, r) => {
      const { sell } = getValuationUnit(r);
      return sum + sell * Number(r.qty_on_hand ?? 0);
    }, 0);

    const potentialGrossProfit = stockRetailValue - stockCostValue;
    const grossMargin = stockRetailValue > 0 ? (potentialGrossProfit / stockRetailValue) * 100 : 0;

    return {
      totalItems,
      outOfStock,
      lowStock,
      stockCostValue,
      stockRetailValue,
      potentialGrossProfit,
      grossMargin,
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const term = q.trim().toLowerCase();

    return rows.filter((r) => {
      const p = r.products;
      const displayName = formatProductDisplayName({
        name: p?.name,
        quantity_value: p?.quantity_value,
        quantity_unit: p?.quantity_unit,
      }).toLowerCase();

      const category = (p?.category ?? "").toLowerCase();
      const sku = (p?.sku ?? "").toLowerCase();
      const barcode = (p?.barcode ?? "").toLowerCase();
      const baseUnitLabel = getBaseUnitLabel(r).toLowerCase();

      const matchesText =
        !term ||
        displayName.includes(term) ||
        category.includes(term) ||
        sku.includes(term) ||
        barcode.includes(term) ||
        baseUnitLabel.includes(term);

      const qty = Number(r.qty_on_hand ?? 0);
      const reorder = Number(r.reorder_level ?? 0);
      const status = getStockStatus(qty, reorder);

      const matchesFilter =
        stockFilter === "all" ||
        (stockFilter === "out" && status === "out") ||
        (stockFilter === "low" && (status === "low" || status === "critical"));

      return matchesText && matchesFilter;
    });
  }, [rows, q, stockFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const filteredHistory = useMemo(() => {
    const term = historySearch.trim().toLowerCase();

    return allMovements.filter((m) => {
      const displayName = formatProductDisplayName({
        name: m.products?.name,
        quantity_value: m.products?.quantity_value,
        quantity_unit: m.products?.quantity_unit,
      }).toLowerCase();

      const note = (m.note ?? "").toLowerCase();
      const type = movementLabel(m.type).toLowerCase();
      const monthValue = getMonthValue(m.created_at);

      const matchesText = !term || displayName.includes(term) || note.includes(term) || type.includes(term);
      const matchesMonth = !historyMonth || monthValue === historyMonth;
      const matchesType = historyTypeFilter === "all" || String(m.type) === historyTypeFilter;

      return matchesText && matchesMonth && matchesType;
    });
  }, [allMovements, historySearch, historyMonth, historyTypeFilter]);

  const historyTotalPages = Math.max(1, Math.ceil(filteredHistory.length / HISTORY_PAGE_SIZE));
  const safeHistoryPage = Math.min(historyPage, historyTotalPages);
  const paginatedHistory = filteredHistory.slice(
    (safeHistoryPage - 1) * HISTORY_PAGE_SIZE,
    safeHistoryPage * HISTORY_PAGE_SIZE,
  );

  useEffect(() => {
    if (historyPage > historyTotalPages) setHistoryPage(historyTotalPages);
  }, [historyPage, historyTotalPages]);

  async function handleAddStock() {
    if (!orgId || !addProductId) {
      setErr("Select a product.");
      return;
    }

    const qty = Number(addQty || 0);
    const reorder = Number(addReorder || 0);

    if (!Number.isFinite(qty) || qty < 0) {
      setErr("Initial quantity must be 0 or more.");
      return;
    }

    if (!Number.isFinite(reorder) || reorder < 0) {
      setErr("Reorder level must be 0 or more.");
      return;
    }

    setSavingId(addProductId);
    setErr("");

    try {
      const selectedProduct = addCandidates.find((p) => p.id === addProductId);

      await createInventoryInitial(orgId, {
        product_id: addProductId,
        qty_on_hand: qty,
        reorder_level: reorder,
        note: "Initial stock entry",
      });

      await Promise.all([refresh(orgId), loadProducts(orgId), loadAllHistory(orgId)]);
      setAddOpen(false);
      setAddQty("0");
      setAddReorder("5");

      setToast({
        message: `"${selectedProduct ? formatProductDisplayName(selectedProduct) : "Product"}" added to inventory`,
        type: "success",
      });
    } catch (e: any) {
      setErr(e.message ?? String(e));
      setToast({ message: "Failed to add inventory item", type: "error" });
    } finally {
      setSavingId(null);
    }
  }

  async function handleSaveReorder(row: InventoryRow, newLevel: number) {
    if (!orgId) return;

    if (!Number.isFinite(newLevel) || newLevel < 0) {
      setToast({ message: "Reorder level must be 0 or more", type: "error" });
      return;
    }

    setSavingId(row.product_id);
    setErr("");

    try {
      await updateInventory(orgId, row.product_id, {
        qty_on_hand: row.qty_on_hand,
        reorder_level: newLevel,
      });

      await refresh(orgId);
      setToast({ message: "Reorder level updated", type: "success" });
    } catch (e: any) {
      setErr(e.message ?? String(e));
      setToast({ message: "Failed to update reorder level", type: "error" });
    } finally {
      setSavingId(null);
    }
  }

  function openAdjust(row: InventoryRow) {
    setAdjustRow(row);
    setAdjustMode("add");
    setAdjustValue("0");
    setAdjustNote("");
    setAdjustModalError("");
    setAdjustOpen(true);
  }

  async function handleAdjustSave() {
    if (!orgId || !adjustRow) return;

    const n = Number(adjustValue || 0);
    setAdjustModalError("");
    setErr("");

    if (!Number.isFinite(n) || n < 0) {
      setAdjustModalError("Enter a valid adjustment amount.");
      return;
    }

    if ((adjustMode === "remove" || adjustMode === "set") && !adjustNote.trim()) {
      setAdjustModalError("Please provide a note for remove or set adjustments.");
      return;
    }

    setSavingId(adjustRow.product_id);

    try {
      await adjustInventoryDelta(orgId, adjustRow.product_id, {
        mode: adjustMode,
        amount: n,
        reorder_level: adjustRow.reorder_level,
        note: adjustMode === "add" && !adjustNote.trim() ? null : adjustNote.trim() || null,
      });

      await Promise.all([refresh(orgId), loadAllHistory(orgId)]);
      setAdjustOpen(false);
      setAdjustRow(null);
      setAdjustModalError("");

      setToast({ message: "Inventory adjusted successfully", type: "success" });
    } catch (e: any) {
      setErr(e.message ?? String(e));
      setToast({ message: "Failed to adjust inventory", type: "error" });
    } finally {
      setSavingId(null);
    }
  }

  function handleStockCardFilter(next: StockFilter) {
    setStockFilter((prev) => (prev === next ? "all" : next));
  }

  if (!orgId && !err) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-sm font-semibold text-slate-400">Loading inventory…</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {err && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="flex-1">{err}</span>
          <button
            onClick={() => setErr("")}
            className="shrink-0 text-lg leading-none text-red-400 hover:text-red-600"
          >
            ×
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <TopTabs value={tab} onChange={setTab} />
        <button className={S.btnPrimary} onClick={() => setAddOpen(true)}>
          Add stock item
        </button>
      </div>

      {tab === "overview" && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Total products"
              value={String(kpis.totalItems)}
              sub="tracked stock items"
              active={stockFilter === "all"}
              onClick={() => setStockFilter("all")}
            />
            <StatCard
              title="Low stock"
              value={String(kpis.lowStock)}
              sub="below reorder level"
              variant="warning"
              active={stockFilter === "low"}
              onClick={() => handleStockCardFilter("low")}
            />
            <StatCard
              title="Out of stock"
              value={String(kpis.outOfStock)}
              sub="no base units left"
              variant="danger"
              active={stockFilter === "out"}
              onClick={() => handleStockCardFilter("out")}
            />
            <StatCard
              title="Inventory cost"
              value={fmtMoney(kpis.stockCostValue)}
              sub="Based on base unit cost"
              variant="success"
            />
            <StatCard
              title="Retail value"
              value={fmtMoney(kpis.stockRetailValue)}
              sub="Based on base selling price"
            />
            <StatCard
              title="Potential gross profit"
              value={fmtMoney(kpis.potentialGrossProfit)}
              sub="Retail value minus cost"
              variant={kpis.potentialGrossProfit < 0 ? "danger" : "success"}
            />
            <StatCard
              title="Gross margin"
              value={fmtPercent(kpis.grossMargin)}
              sub="Potential margin"
              variant={kpis.grossMargin < 0 ? "danger" : "neutral"}
            />
          </div>

          <div className="overflow-hidden rounded-[28px] border border-[#EADFC2] bg-white shadow-[0_12px_36px_rgba(92,64,16,0.06)]">
            <div className="border-b border-[#F1E6C9] bg-[linear-gradient(180deg,#FFFDF8_0%,#FFF9EC_100%)] px-5 py-4 lg:px-6">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className="min-w-[220px] flex-1 rounded-2xl border border-[#EADFC2] bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                  placeholder="Search inventory…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />

                <select
                  className="rounded-2xl border border-[#EADFC2] bg-white px-3.5 py-2.5 text-sm text-slate-700 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                  value={stockFilter}
                  onChange={(e) => setStockFilter(e.target.value as StockFilter)}
                >
                  <option value="all">All stock</option>
                  <option value="low">Low stock</option>
                  <option value="out">Out of stock</option>
                </select>

                <span className="ml-auto whitespace-nowrap text-xs text-slate-500">
                  {filteredRows.length} of {rows.length}
                </span>
              </div>
            </div>

            <div className="divide-y divide-[#F1E6C9]">
              {paginatedRows.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <p className="text-lg font-bold text-slate-800">No inventory items found</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Add a stock item or adjust your filters.
                  </p>
                </div>
              ) : (
                paginatedRows.map((r) => {
                  const p = r.products;
                  const qty = Number(r.qty_on_hand ?? 0);
                  const reorder = Number(r.reorder_level ?? 0);
                  const isSaving = savingId === r.product_id;
                  const baseUnit = getBaseUnitLabel(r);
                  const { cost, sell } = getValuationUnit(r);
                  const totalCostValue = cost * qty;
                  const totalRetailValue = sell * qty;

                  return (
                    <div key={r.product_id} className="px-5 py-4 transition hover:bg-[#FFFDF8] lg:px-6">
                      <div className="grid gap-4 lg:grid-cols-[2fr_1fr_1fr_1fr_1.2fr_1.6fr] lg:items-center">
                        <div className="min-w-0">
                          <div className="truncate text-[15px] font-black text-slate-900">
                            {formatProductDisplayName({
                              name: p?.name,
                              quantity_value: p?.quantity_value,
                              quantity_unit: p?.quantity_unit,
                            })}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {p?.sku ? `SKU ${p.sku}` : p?.barcode || "No SKU/barcode"}
                          </div>
                        </div>

                        <div className="text-sm text-slate-700">
                          {p?.category || <span className="text-slate-300">—</span>}
                        </div>

                        <div>
                          <div className="text-lg font-black text-slate-900">{fmtNumber(qty)}</div>
                          <div className="text-xs text-slate-500">{baseUnit}</div>
                        </div>

                        <div>
                          <input
                            type="number"
                            min={0}
                            defaultValue={reorder}
                            onBlur={(e) => {
                              const v = Number(e.target.value);
                              if (Number.isFinite(v) && v !== reorder) handleSaveReorder(r, v);
                            }}
                            className="w-20 rounded-xl border border-slate-300 px-2 py-2 text-center text-sm text-slate-800 outline-none focus:border-slate-400"
                          />
                          {isSaving && <span className="ml-2 text-xs text-slate-400">Saving…</span>}
                        </div>

                        <div>
                          <div className="font-bold text-slate-900">{fmtMoney(totalCostValue)}</div>
                          <div className="text-xs text-slate-500">Cost · {fmtMoney(cost)} / {baseUnit}</div>
                          <div className="mt-1 text-xs font-semibold text-green-700">
                            Retail {fmtMoney(totalRetailValue)}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                          <StatusBadge qty={qty} reorder={reorder} />
                          <button
                            onClick={() => setRestockRow(r)}
                            className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-xs font-bold text-green-700 transition hover:bg-green-100"
                          >
                            Restock
                          </button>
                          <button
                            onClick={() => openAdjust(r)}
                            className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-100"
                          >
                            Adjust
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <Pagination
              page={safePage}
              totalPages={totalPages}
              totalItems={filteredRows.length}
              pageSize={PAGE_SIZE}
              onPage={setPage}
              itemLabel="item"
            />
          </div>
        </>
      )}

      {tab === "history" && (
        <div className="overflow-hidden rounded-[28px] border border-[#EADFC2] bg-white shadow-[0_12px_36px_rgba(92,64,16,0.06)]">
          <div className="border-b border-[#F1E6C9] bg-[linear-gradient(180deg,#FFFDF8_0%,#FFF9EC_100%)] px-5 py-4 lg:px-6">
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="min-w-[220px] flex-1 rounded-2xl border border-[#EADFC2] bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                placeholder="Search movement history…"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
              />

              <input
                type="month"
                className="rounded-2xl border border-[#EADFC2] bg-white px-3.5 py-2.5 text-sm text-slate-700 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                value={historyMonth}
                onChange={(e) => setHistoryMonth(e.target.value)}
              />

              <select
                className="rounded-2xl border border-[#EADFC2] bg-white px-3.5 py-2.5 text-sm text-slate-700 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                value={historyTypeFilter}
                onChange={(e) => setHistoryTypeFilter(e.target.value as HistoryTypeFilter)}
              >
                <option value="all">All movements</option>
                <option value="add">Added</option>
                <option value="restock">Restocked</option>
                <option value="remove">Removed</option>
                <option value="set">Set</option>
                <option value="sale">Sold</option>
                <option value="sale_void">Sale void</option>
              </select>
            </div>
          </div>

          <div className="divide-y divide-[#F1E6C9]">
            {paginatedHistory.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <p className="text-lg font-bold text-slate-800">No movements found</p>
                <p className="mt-1 text-sm text-slate-500">Try adjusting your filters.</p>
              </div>
            ) : (
              paginatedHistory.map((m) => {
                const productName = formatProductDisplayName({
                  name: m.products?.name,
                  quantity_value: m.products?.quantity_value,
                  quantity_unit: m.products?.quantity_unit,
                });

                return (
                  <div key={m.id} className="px-5 py-4 lg:px-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${movementColor(m.type)}`}>
                            {movementLabel(m.type)}
                          </span>
                          <span className="font-bold text-slate-900">{productName}</span>
                        </div>
                        <div className="mt-1 text-sm text-slate-500">
                          {fmtDateTime(m.created_at)}
                        </div>
                        {m.note && <div className="mt-2 text-sm text-slate-600">{m.note}</div>}
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
                        <div className="text-xs font-bold uppercase tracking-wide text-slate-400">
                          Change
                        </div>
                        <div className={`mt-1 text-lg font-black ${m.qty_delta >= 0 ? "text-green-700" : "text-red-700"}`}>
                          {m.qty_delta >= 0 ? "+" : ""}{fmtNumber(m.qty_delta)}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {fmtNumber(m.qty_before)} → {fmtNumber(m.qty_after)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <Pagination
            page={safeHistoryPage}
            totalPages={historyTotalPages}
            totalItems={filteredHistory.length}
            pageSize={HISTORY_PAGE_SIZE}
            onPage={setHistoryPage}
            itemLabel="movement"
          />
        </div>
      )}

      <Modal
        open={addOpen}
        title="Add stock item"
        sub="Start tracking a catalog product in inventory"
        onClose={() => setAddOpen(false)}
        footer={
          <div className="flex justify-end gap-3">
            <button className={S.btnGhost} onClick={() => setAddOpen(false)}>
              Cancel
            </button>
            <button className={S.btnPrimary} onClick={handleAddStock} disabled={savingId === addProductId}>
              {savingId === addProductId ? "Saving…" : "Add to inventory"}
            </button>
          </div>
        }
      >
        {addCandidates.length === 0 ? (
          <div className="rounded-[24px] border border-[#F1E6C9] bg-[#FFFDF8] px-6 py-10 text-center">
            <p className="text-lg font-black text-slate-900">All catalog products are already tracked</p>
            <p className="mt-1 text-sm text-slate-500">
              Every product in your catalog already has an inventory record.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                Product
              </label>
              <select className={S.input} value={addProductId} onChange={(e) => setAddProductId(e.target.value)}>
                {addCandidates.map((p) => (
                  <option key={p.id} value={p.id}>
                    {formatProductDisplayName(p)}{p.sku ? ` — ${p.sku}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Initial base units
                </label>
                <input className={S.input} type="number" min={0} value={addQty} onChange={(e) => setAddQty(e.target.value)} />
                <p className="mt-2 text-xs text-slate-500">Use base units here. Use Restock later for boxes/cartons.</p>
              </div>

              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Reorder level
                </label>
                <input className={S.input} type="number" min={0} value={addReorder} onChange={(e) => setAddReorder(e.target.value)} />
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={adjustOpen}
        title={
          adjustRow
            ? `Adjust — ${formatProductDisplayName({
                name: adjustRow.products?.name,
                quantity_value: adjustRow.products?.quantity_value,
                quantity_unit: adjustRow.products?.quantity_unit,
              })}`
            : "Adjust stock"
        }
        sub="Add, remove, or set stock directly in base units"
        onClose={() => setAdjustOpen(false)}
        footer={
          <div className="flex justify-end gap-3">
            <button className={S.btnGhost} onClick={() => setAdjustOpen(false)}>
              Cancel
            </button>
            <button className={S.btnPrimary} onClick={handleAdjustSave} disabled={savingId === adjustRow?.product_id}>
              {savingId === adjustRow?.product_id ? "Saving…" : "Confirm adjustment"}
            </button>
          </div>
        }
      >
        {adjustRow && (
          <div className="space-y-5">
            {adjustModalError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {adjustModalError}
              </div>
            )}

            <div className="rounded-[24px] border border-[#F1E6C9] bg-[#FFFDF8] p-5">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Current stock</div>
              <div className="mt-1 text-3xl font-black text-slate-900">
                {fmtNumber(adjustRow.qty_on_hand)} {getBaseUnitLabel(adjustRow)}
              </div>
              <div className="mt-1 text-sm text-slate-500">Reorder at {fmtNumber(adjustRow.reorder_level)}</div>
            </div>

            <div className="grid grid-cols-3 gap-2 rounded-[22px] border border-[#F1E6C9] bg-white p-2">
              {(["add", "remove", "set"] as const).map((m) => (
                <button
                  key={m}
                  className={`rounded-xl border py-2.5 text-sm font-semibold transition ${
                    adjustMode === m
                      ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                      : "border-transparent text-slate-600 hover:bg-[#FFF8E6]"
                  }`}
                  onClick={() => setAdjustMode(m)}
                >
                  {m === "add" ? "Add" : m === "remove" ? "Remove" : "Set"}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  {adjustMode === "set" ? "New base count" : "Base amount"}
                </label>
                <input className={S.input} type="number" min={0} value={adjustValue} onChange={(e) => setAdjustValue(e.target.value)} />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Note {adjustMode === "remove" || adjustMode === "set" ? "*" : "(optional)"}
                </label>
                <input className={S.input} placeholder="Reason…" value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} />
              </div>
            </div>
          </div>
        )}
      </Modal>

      {orgId && (
        <RestockModal
          open={Boolean(restockRow)}
          orgId={orgId}
          inventoryRow={restockRow}
          onClose={() => setRestockRow(null)}
          onRestocked={async () => {
            await Promise.all([refresh(orgId), loadAllHistory(orgId)]);
            setToast({ message: "Product restocked", type: "success" });
          }}
        />
      )}
    </div>
  );
}
