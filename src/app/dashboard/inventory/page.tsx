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
import * as S from "./page.styles";

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */
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

/* ─────────────────────────────────────────────
   Constants
───────────────────────────────────────────── */
const PAGE_SIZE = 8;
const HISTORY_PAGE_SIZE = 10;

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */
function fmtMoney(v: number | string | null | undefined) {
  const n = Number(v || 0);
  return `Ksh ${n.toLocaleString("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function formatQuantity(
  value?: number | string | null,
  unit?: QuantityUnit | string | null
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
  reorder: number
): "out" | "critical" | "low" | "ok" {
  if (qty <= 0) return "out";
  if (reorder > 0 && qty <= Math.max(1, Math.ceil(reorder * 0.3))) return "critical";
  if (qty <= reorder) return "low";
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

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function groupMovementsByTimeline(items: InventoryMovementRow[]) {
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);

  const groups: Record<string, InventoryMovementRow[]> = {
    Today: [],
    Yesterday: [],
    Earlier: [],
  };

  for (const item of items) {
    const d = new Date(item.created_at);
    if (isSameDay(d, now)) groups.Today.push(item);
    else if (isSameDay(d, yesterday)) groups.Yesterday.push(item);
    else groups.Earlier.push(item);
  }

  return groups;
}

function getMonthValue(dateString?: string | null) {
  if (!dateString) return "";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/* ─────────────────────────────────────────────
   Scroll lock
───────────────────────────────────────────── */
function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;

    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalBodyOverflow = document.body.style.overflow;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    return () => {
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.overflow = originalBodyOverflow;
    };
  }, [locked]);
}

/* ─────────────────────────────────────────────
   Toast
───────────────────────────────────────────── */
function Toast({
  message,
  type = "success",
  onClose,
}: {
  message: string;
  type?: "success" | "error";
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className={`fixed bottom-5 right-5 z-[70] flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-xl text-white text-sm font-semibold ${
        type === "success" ? "bg-green-600" : "bg-red-600"
      }`}
    >
      <span>{message}</span>
      <button onClick={onClose} className="text-white/80 hover:text-white text-xs font-bold">
        Close
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Modal
───────────────────────────────────────────── */
function Modal({
  open,
  title,
  sub,
  onClose,
  children,
  footer,
  size = "md",
  closeOnBackdrop = true,
}: {
  open: boolean;
  title: string;
  sub?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "md" | "lg" | "xl";
  closeOnBackdrop?: boolean;
}) {
  useBodyScrollLock(open);

  if (!open) return null;

  const maxW =
    size === "xl" ? "max-w-5xl" : size === "lg" ? "max-w-3xl" : "max-w-xl";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/35 backdrop-blur-sm p-0 sm:items-center sm:p-4"
      onClick={() => closeOnBackdrop && onClose()}
    >
      <div
        className={`flex max-h-[92vh] w-full ${maxW} flex-col overflow-hidden rounded-t-[28px] border border-[#EADFC2] bg-white shadow-2xl sm:rounded-[28px]`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-[#F1E6C9] bg-[linear-gradient(180deg,#FFFDF8_0%,#FFF8E6_100%)] px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-black tracking-tight text-slate-950">{title}</div>
              {sub && <div className="mt-1 text-sm text-slate-500">{sub}</div>}
            </div>

            <button
              onClick={onClose}
              className="rounded-full border border-[#EADFC2] bg-white px-3 py-1.5 text-xs font-bold text-slate-500 transition hover:bg-[#FFF8E6] hover:text-slate-800"
            >
              Close
            </button>
          </div>
        </div>

        <div className="overflow-y-auto px-6 py-6">{children}</div>

        {footer && (
          <div className="sticky bottom-0 flex justify-end gap-3 border-t border-[#F1E6C9] bg-white/95 px-6 py-4 backdrop-blur">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   UI components
───────────────────────────────────────────── */
function TopTabs({
  value,
  onChange,
}: {
  value: MainTab;
  onChange: (v: MainTab) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-2xl border border-[#EADFC2] bg-white/90 p-1 shadow-sm">
      {[
        { key: "overview", label: "Overview" },
        { key: "history", label: "History" },
      ].map((tab) => {
        const active = value === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key as MainTab)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              active
                ? "bg-[#2F2718] text-white shadow-sm"
                : "text-slate-600 hover:bg-[#FFF8E6]"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function HistoryTypeTabs({
  value,
  onChange,
}: {
  value: HistoryTypeFilter;
  onChange: (v: HistoryTypeFilter) => void;
}) {
  const tabs: { key: HistoryTypeFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "restock", label: "Restocked" },
    { key: "add", label: "Added" },
    { key: "remove", label: "Removed" },
    { key: "set", label: "Set" },
    { key: "sale", label: "Sold" },
    { key: "sale_edit", label: "Sale edits" },
    { key: "sale_void", label: "Sale void" },
  ];

  return (
    <div className="inline-flex flex-wrap items-center rounded-2xl border border-[#EADFC2] bg-white/90 p-1 shadow-sm gap-1">
      {tabs.map((tab) => {
        const active = value === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
              active
                ? "bg-[#2F2718] text-white shadow-sm"
                : "text-slate-600 hover:bg-[#FFF8E6]"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
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
  variant?: "neutral" | "warning" | "danger" | "success";
  active?: boolean;
  onClick?: () => void;
}) {
  const cfg = {
    neutral: {
      border: active ? "#0F172A" : "#E2E8F0",
      bg: "#FFFFFF",
      iconBg: "#F8FAFC",
      iconColor: "#475569",
      valueColor: "#0F172A",
      subColor: "#64748B",
    },
    warning: {
      border: active ? "#D97706" : "#FDE68A",
      bg: "#FFFFFF",
      iconBg: "#FFFBEB",
      iconColor: "#B45309",
      valueColor: "#92400E",
      subColor: "#B45309",
    },
    danger: {
      border: active ? "#DC2626" : "#FECACA",
      bg: "#FFFFFF",
      iconBg: "#FEF2F2",
      iconColor: "#B91C1C",
      valueColor: "#991B1B",
      subColor: "#B91C1C",
    },
    success: {
      border: "#BBF7D0",
      bg: "#FFFFFF",
      iconBg: "#F0FDF4",
      iconColor: "#166534",
      valueColor: "#166534",
      subColor: "#16A34A",
    },
  }[variant];

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[22px] p-4 bg-white transition hover:-translate-y-0.5 text-left w-full"
      style={{
        border: `1.5px solid ${cfg.border}`,
        boxShadow: active
          ? "0 10px 30px rgba(15,23,42,0.10)"
          : "0 8px 24px rgba(15,23,42,0.05)",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div
            className="text-[11px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: cfg.subColor }}
          >
            {title}
          </div>
          <div
            className="mt-1 text-[26px] font-bold leading-none"
            style={{ color: cfg.valueColor }}
          >
            {value}
          </div>
          {sub && (
            <div className="mt-1 text-xs" style={{ color: cfg.subColor }}>
              {sub}
            </div>
          )}
        </div>

        {onClick && (
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
            {active ? "Active" : "Filter"}
          </div>
        )}
      </div>
    </button>
  );
}

function StatusBadge({ qty, reorder }: { qty: number; reorder: number }) {
  const status = getStockStatus(qty, reorder);

  if (status === "out") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700 border border-red-200">Out of stock
      </span>
    );
  }

  if (status === "critical") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-700 border border-orange-200">Critical
      </span>
    );
  }

  if (status === "low") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-200">Low stock
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700 border border-green-200">In stock
    </span>
  );
}

function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPage,
  itemLabel,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPage: (p: number) => void;
  itemLabel: string;
}) {
  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-slate-100 bg-slate-50/70 px-6 py-4">
      <span className="text-xs text-slate-500">
        Showing {start}–{end} of {totalItems} {itemLabel}
        {totalItems !== 1 ? "s" : ""}
      </span>

      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page === 1}
          className="h-9 rounded-xl border border-[#EADFC2] bg-white px-3 text-xs font-bold text-slate-600 hover:bg-[#FFF8E6] disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          Prev
        </button>

        <span className="px-3 text-sm font-semibold text-slate-700">
          {page} / {totalPages}
        </span>

        <button
          onClick={() => onPage(page + 1)}
          disabled={page === totalPages}
          className="h-9 rounded-xl border border-[#EADFC2] bg-white px-3 text-xs font-bold text-slate-600 hover:bg-[#FFF8E6] disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          Next
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Page
───────────────────────────────────────────── */
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
  const [historyTypeFilter, setHistoryTypeFilter] =
    useState<HistoryTypeFilter>("all");
  const [historyPage, setHistoryPage] = useState(1);

  const [err, setErr] = useState("");
  const [toast, setToast] = useState<ToastState>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

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

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyRow, setHistoryRow] = useState<InventoryRow | null>(null);
  const [productMovements, setProductMovements] = useState<InventoryMovementRow[]>([]);

  const [restockQty, setRestockQty] = useState<Record<string, string>>({});

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
      }))
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
    [rows]
  );

  const addCandidates = useMemo(
    () =>
      allProducts
        .filter((p) => !productIdsInInventory.has(p.id))
        .sort((a, b) =>
          formatProductDisplayName(a).localeCompare(formatProductDisplayName(b))
        ),
    [allProducts, productIdsInInventory]
  );

  useEffect(() => {
    if (!addProductId && addCandidates.length) {
      setAddProductId(addCandidates[0].id);
    }
  }, [addCandidates, addProductId]);

  const adjustDirty = useMemo(() => {
    if (!adjustRow) return false;

    return (
      adjustMode !== "add" ||
      adjustValue !== "0" ||
      adjustNote.trim() !== ""
    );
  }, [adjustRow, adjustMode, adjustValue, adjustNote]);

  const kpis = useMemo(() => {
    const totalItems = rows.length;
    const outOfStock = rows.filter((r) => Number(r.qty_on_hand ?? 0) <= 0).length;
    const lowStock = rows.filter((r) => {
      const qty = Number(r.qty_on_hand ?? 0);
      const reorder = Number(r.reorder_level ?? 0);
      const status = getStockStatus(qty, reorder);
      return status === "low" || status === "critical";
    }).length;

    const stockCostValue = rows.reduce(
      (sum, r) =>
        sum +
        Number(r.products?.cost_price ?? 0) * Number(r.qty_on_hand ?? 0),
      0
    );

    const stockRetailValue = rows.reduce(
      (sum, r) =>
        sum +
        Number(r.products?.unit_price ?? 0) * Number(r.qty_on_hand ?? 0),
      0
    );

    return {
      totalItems,
      outOfStock,
      lowStock,
      stockCostValue,
      stockRetailValue,
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
      const pack = formatQuantity(p?.quantity_value, p?.quantity_unit).toLowerCase();

      const matchesText =
        !term ||
        displayName.includes(term) ||
        category.includes(term) ||
        sku.includes(term) ||
        barcode.includes(term) ||
        pack.includes(term);

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

  const paginatedRows = filteredRows.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

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

      const matchesText =
        !term ||
        displayName.includes(term) ||
        note.includes(term) ||
        type.includes(term);

      const matchesMonth = !historyMonth || monthValue === historyMonth;
      const matchesType =
        historyTypeFilter === "all" || String(m.type) === historyTypeFilter;

      return matchesText && matchesMonth && matchesType;
    });
  }, [allMovements, historySearch, historyMonth, historyTypeFilter]);

  const historyTotalPages = Math.max(
    1,
    Math.ceil(filteredHistory.length / HISTORY_PAGE_SIZE)
  );
  const safeHistoryPage = Math.min(historyPage, historyTotalPages);

  const paginatedHistory = filteredHistory.slice(
    (safeHistoryPage - 1) * HISTORY_PAGE_SIZE,
    safeHistoryPage * HISTORY_PAGE_SIZE
  );

  useEffect(() => {
    if (historyPage > historyTotalPages) setHistoryPage(historyTotalPages);
  }, [historyPage, historyTotalPages]);

  const groupedTimeline = useMemo(
    () => groupMovementsByTimeline(paginatedHistory),
    [paginatedHistory]
  );

  async function openProductHistory(row: InventoryRow) {
    if (!orgId) return;

    setHistoryRow(row);
    setHistoryOpen(true);
    setLoadingHistory(true);

    try {
      const data = await listInventoryMovements(orgId, row.product_id);
      setProductMovements(data);
    } catch (e: any) {
      setToast({
        message: e.message ?? "Failed to load product history",
        type: "error",
      });
    } finally {
      setLoadingHistory(false);
    }
  }

  function handleAdjustModalClose() {
    if (adjustDirty) return;
    setAdjustOpen(false);
    setAdjustModalError("");
  }

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

  async function handleQuickRestock(row: InventoryRow, amount: number) {
    if (!orgId || amount <= 0 || !Number.isFinite(amount)) {
      setErr("Enter a valid restock quantity.");
      return;
    }

    setSavingId(row.product_id);
    setErr("");

    try {
      await adjustInventoryDelta(orgId, row.product_id, {
        mode: "add",
        amount,
        reorder_level: row.reorder_level,
        note: `Quick restock +${amount}`,
        recordAs: "restock",
      });

      setRestockQty((prev) => ({ ...prev, [row.product_id]: "" }));

      await Promise.all([refresh(orgId), loadAllHistory(orgId)]);

      setToast({
        message: `"${formatProductDisplayName({
          name: row.products?.name,
          quantity_value: row.products?.quantity_value,
          quantity_unit: row.products?.quantity_unit,
        })}" restocked by ${amount}`,
        type: "success",
      });
    } catch (e: any) {
      setErr(e.message ?? String(e));
      setToast({ message: "Failed to restock product", type: "error" });
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

      setToast({
        message: "Reorder level updated",
        type: "success",
      });
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
        note:
          adjustMode === "add" && !adjustNote.trim()
            ? null
            : adjustNote.trim() || null,
      });

      await Promise.all([refresh(orgId), loadAllHistory(orgId)]);
      setAdjustOpen(false);
      setAdjustRow(null);
      setAdjustModalError("");

      setToast({
        message: "Inventory adjusted successfully",
        type: "success",
      });
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
        <div className="text-slate-400 text-sm font-semibold">Loading inventory…</div>
      </div>
    );
  }

  const TABLE_COLS = "2fr 1.05fr 0.85fr 0.95fr 1.1fr 0.95fr 1.6fr";
  const HEADERS = [
    "Product",
    "Category",
    "On hand",
    "Reorder at",
    "Cost value",
    "Status",
    "Actions",
  ];

  return (
    <div className="flex flex-col gap-6">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {err && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="flex-1">{err}</span>
          <button
            onClick={() => setErr("")}
            className="shrink-0 text-red-400 hover:text-red-600 text-lg leading-none"
          >
            ×
          </button>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* <div>

            <h1 className="mt-3 text-[32px] font-bold text-slate-900 tracking-tight">
              Stock Overview
            </h1>
          
          </div> */}

          
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <TopTabs value={tab} onChange={setTab} />
        </div>
      </div>

      

      {tab === "overview" && (
        <>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          title="Total products"
          value={String(kpis.totalItems)}
          sub="tracked stock items"
          variant="neutral"
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
          sub="no packs left"
          variant="danger"
          active={stockFilter === "out"}
          onClick={() => handleStockCardFilter("out")}
        />
        <StatCard
          title="Stock cost value"
          value={fmtMoney(kpis.stockCostValue)}
          sub={`Retail value ${fmtMoney(kpis.stockRetailValue)}`}
          variant="success"
        />
      </div>

        <div className="rounded-[28px] border border-[#EADFC2] bg-white shadow-[0_12px_36px_rgba(92,64,16,0.06)] overflow-hidden">
          <div className="border-b border-[#F1E6C9] bg-[linear-gradient(180deg,#FFFDF8_0%,#FFF9EC_100%)] px-5 py-4 lg:px-6">
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative flex-1 min-w-[220px] max-w-sm">
                <input
                  className="w-full rounded-2xl border border-[#EADFC2] bg-white px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition"
                  placeholder="Search by product, pack size, SKU or category…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                {q && (
                  <button
                    onClick={() => setQ("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600"
                  >
                    Clear
                  </button>
                )}
              </label>

              <span className="ml-auto text-xs text-slate-500 whitespace-nowrap">
                {filteredRows.length} of {rows.length}
              </span>
            </div>
          </div>

          <div className="px-3 py-3 sm:px-4 sm:py-4">
            <div className="hidden lg:block">
              <div
                className="grid items-center gap-4 px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500"
                style={{ gridTemplateColumns: TABLE_COLS }}
              >
                {HEADERS.map((h) => (
                  <div key={h}>{h}</div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {paginatedRows.length === 0 ? (
                <div className="py-20 text-center">
                  <p className="text-lg font-semibold text-slate-700">
                    {rows.length === 0
                      ? "No inventory items yet"
                      : "No matching products"}
                  </p>
                  <p className="text-sm text-slate-400 mt-1">
                    {rows.length === 0
                      ? 'Click "Add stock item" to begin'
                      : "Try adjusting your filters or search"}
                  </p>
                </div>
              ) : (
                paginatedRows.map((r) => {
                  const p = r.products;
                  const displayName = formatProductDisplayName({
                    name: p?.name,
                    quantity_value: p?.quantity_value,
                    quantity_unit: p?.quantity_unit,
                  });

                  const qty = Number(r.qty_on_hand ?? 0);
                  const reorder = Number(r.reorder_level ?? 0);
                  const costPrice = Number(p?.cost_price ?? 0);
                  const retailPrice = Number(p?.unit_price ?? 0);
                  const totalCostValue = costPrice * qty;
                  const isSaving = savingId === r.product_id;

                  return (
                    <div
                      key={r.product_id}
                      className="group rounded-[24px] border border-[#EFE4C6] bg-[linear-gradient(180deg,#FFFFFF_0%,#FFFCF4_100%)] shadow-[0_8px_30px_rgba(92,64,16,0.04)] transition-all duration-200 hover:-translate-y-px hover:shadow-[0_16px_34px_rgba(92,64,16,0.08)]"
                    >
                      <div
                        className="hidden lg:grid items-center gap-4 px-6 py-5 text-sm"
                        style={{ gridTemplateColumns: TABLE_COLS }}
                      >
                        <button
                          type="button"
                          onClick={() => openProductHistory(r)}
                          className="min-w-0 space-y-1 text-left"
                        >
                          <div className="font-semibold text-slate-900 truncate text-[15px] hover:text-blue-700 transition">
                            {displayName}
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            {p?.sku ? `SKU ${p.sku}` : p?.barcode || "—"}
                          </div>
                        </button>

                        <div className="truncate text-sm text-slate-700">
                          {p?.category || <span className="text-slate-300">—</span>}
                        </div>

                        <div>
                          <div className="text-lg font-bold text-slate-900">{qty}</div>
                          <div className="text-xs text-slate-400">packs on hand</div>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            defaultValue={reorder}
                            onBlur={(e) => {
                              const v = Number(e.target.value);
                              if (Number.isFinite(v) && v !== reorder) {
                                handleSaveReorder(r, v);
                              }
                            }}
                            className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-center text-sm text-slate-800 focus:border-slate-400 focus:ring-2 focus:ring-slate-100 outline-none"
                          />
                          {isSaving && (
                            <span className="text-xs text-slate-400 animate-pulse">…</span>
                          )}
                        </div>

                        <div>
                          <div className="font-semibold text-slate-900 text-sm">
                            {fmtMoney(totalCostValue)}
                          </div>
                          <div className="text-xs text-slate-400">
                            {fmtMoney(retailPrice)} each
                          </div>
                        </div>

                        <div>
                          <StatusBadge qty={qty} reorder={reorder} />
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <input
                            type="number"
                            min={1}
                            placeholder="Qty"
                            value={restockQty[r.product_id] ?? ""}
                            onChange={(e) =>
                              setRestockQty((prev) => ({
                                ...prev,
                                [r.product_id]: e.target.value,
                              }))
                            }
                            className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-center text-sm text-slate-800 focus:border-slate-400 focus:ring-2 focus:ring-slate-100 outline-none"
                          />

                          <button
                            disabled={isSaving || !Number(restockQty[r.product_id])}
                            onClick={() =>
                              handleQuickRestock(
                                r,
                                Number(restockQty[r.product_id] || 0)
                              )
                            }
                            className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-100 disabled:opacity-40 transition"
                          >
                            Restock
                          </button>

                          <button
                            onClick={() => openAdjust(r)}
                            className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition"
                          >
                            Adjust
                          </button>

                         
                        </div>
                      </div>

                      <div className="lg:hidden px-5 py-4 space-y-4">
                        <button
                          type="button"
                          onClick={() => openProductHistory(r)}
                          className="w-full text-left flex items-start justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 truncate">
                              {displayName}
                            </div>
                            <div className="mt-0.5 text-xs text-slate-500">
                              {p?.category || "—"}
                            </div>
                            {(p?.sku || p?.barcode) && (
                              <div className="text-xs text-slate-400 mt-1">
                                {p?.sku ? `SKU ${p.sku}` : p?.barcode}
                              </div>
                            )}
                          </div>
                          <StatusBadge qty={qty} reorder={reorder} />
                        </button>

                        <div className="grid grid-cols-3 gap-3 rounded-2xl bg-slate-50 border border-slate-100 p-3 text-sm">
                          <div>
                            <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">
                              On hand
                            </div>
                            <div className="font-bold text-slate-900 mt-0.5">
                              {qty}
                            </div>
                            <div className="text-[11px] text-slate-400">packs</div>
                          </div>

                          <div>
                            <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">
                              Reorder
                            </div>
                            <input
                              type="number"
                              min={0}
                              defaultValue={reorder}
                              onBlur={(e) => {
                                const v = Number(e.target.value);
                                if (Number.isFinite(v) && v !== reorder) {
                                  handleSaveReorder(r, v);
                                }
                              }}
                              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-center text-sm text-slate-800 outline-none focus:border-slate-400"
                            />
                          </div>

                          <div>
                            <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">
                              Cost value
                            </div>
                            <div className="font-semibold text-slate-900 mt-0.5">
                              {fmtMoney(totalCostValue)}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {fmtMoney(retailPrice)} each
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <input
                            type="number"
                            min={1}
                            placeholder="Qty"
                            value={restockQty[r.product_id] ?? ""}
                            onChange={(e) =>
                              setRestockQty((prev) => ({
                                ...prev,
                                [r.product_id]: e.target.value,
                              }))
                            }
                            className="flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-center text-sm text-slate-800 outline-none focus:border-slate-400"
                          />

                          <button
                            disabled={isSaving || !Number(restockQty[r.product_id])}
                            onClick={() =>
                              handleQuickRestock(
                                r,
                                Number(restockQty[r.product_id] || 0)
                              )
                            }
                            className="rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-xs font-semibold text-green-700 hover:bg-green-100 disabled:opacity-40 transition"
                          >
                            Restock
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => openAdjust(r)}
                            className="rounded-xl border border-blue-200 bg-blue-50 py-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition"
                          >
                            Adjust
                          </button>
                          <button
                            onClick={() => openProductHistory(r)}
                            className="rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                          >
                            History
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <Pagination
            page={safePage}
            totalPages={totalPages}
            totalItems={filteredRows.length}
            pageSize={PAGE_SIZE}
            onPage={setPage}
            itemLabel="stock item"
          />
        </div>
        </>
      )}

      {tab === "history" && (
        <div className="rounded-[28px] border border-[#EADFC2] bg-white shadow-[0_12px_36px_rgba(92,64,16,0.06)] overflow-hidden">
          <div className="border-b border-[#F1E6C9] bg-[linear-gradient(180deg,#FFFDF8_0%,#FFF9EC_100%)] px-5 py-4 lg:px-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  Recent stock timeline
                </div>
                
              </div>

              <span className="text-xs text-slate-500">
                {filteredHistory.length} movement{filteredHistory.length !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <label className="relative flex-1 min-w-[220px] max-w-sm">
                  <input
                    className="w-full rounded-2xl border border-[#EADFC2] bg-white px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition"
                    placeholder="Search product, note or movement type…"
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                  />
                  {historySearch && (
                    <button
                      onClick={() => setHistorySearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600"
                    >
                      Clear
                    </button>
                  )}
                </label>

                <input
                  type="month"
                  value={historyMonth}
                  onChange={(e) => setHistoryMonth(e.target.value)}
                  className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-slate-400 focus:ring-2 focus:ring-slate-100 outline-none transition"
                />
              </div>

              <HistoryTypeTabs
                value={historyTypeFilter}
                onChange={setHistoryTypeFilter}
              />
            </div>
          </div>

          <div className="px-5 py-5 space-y-6">
            {filteredHistory.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-lg font-semibold text-slate-700">
                  No stock history found
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  Try another search, month or movement type
                </p>
              </div>
            ) : (
              ["Today", "Yesterday", "Earlier"].map((section) => {
                const items = groupedTimeline[section] ?? [];
                if (!items.length) return null;

                return (
                  <div key={section} className="space-y-3">
                    <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                      {section}
                    </div>

                    <div className="space-y-3">
                      {items.map((m) => (
                        <div
                          key={m.id}
                          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${movementColor(
                                    m.type
                                  )}`}
                                >
                                  {movementLabel(m.type)}
                                </span>

                                <span className="text-xs text-slate-400">
                                  {fmtDateTime(m.created_at)}
                                </span>
                              </div>

                              <div className="mt-2 font-semibold text-slate-900">
                                {formatProductDisplayName({
                                  name: m.products?.name,
                                  quantity_value: m.products?.quantity_value,
                                  quantity_unit: m.products?.quantity_unit,
                                })}
                              </div>

                              <div className="mt-1 text-sm text-slate-600">
                                Before <span className="font-semibold text-slate-900">{m.qty_before}</span>
                                {" · "}
                                After <span className="font-semibold text-slate-900">{m.qty_after}</span>
                                {" · "}
                                Change{" "}
                                <span className="font-semibold text-slate-900">
                                  {m.qty_delta > 0 ? "+" : ""}
                                  {m.qty_delta}
                                </span>
                              </div>

                              {m.note && (
                                <div className="mt-2 text-sm text-slate-500">
                                  Note: {m.note}
                                </div>
                              )}

                              {m.ref_sale_id && (
                                <div className="mt-2">
                                  <a
                                    href={`/dashboard/sales/${m.ref_sale_id}`}
                                    className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-600 hover:border-slate-300 hover:text-slate-900"
                                  >
                                    View related sale
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
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
        size="lg"
        onClose={() => setAddOpen(false)}
        footer={
          <>
            <button className={S.btnGhost} onClick={() => setAddOpen(false)}>
              Cancel
            </button>
            <button
              className={S.btnPrimary}
              onClick={handleAddStock}
              disabled={savingId === addProductId}
            >
              {savingId === addProductId ? "Saving…" : "Add to inventory"}
            </button>
          </>
        }
      >
        {addCandidates.length === 0 ? (
          <div className="rounded-[24px] border border-[#F1E6C9] bg-[#FFFDF8] px-6 py-10 text-center">
            <p className="text-lg font-black text-slate-900">
              All catalog products are already tracked
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Every product in your catalog already has an inventory record.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-[24px] border border-[#F1E6C9] bg-[#FFFDF8] p-5">
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                Product
              </label>

              <select
                className={S.input}
                value={addProductId}
                onChange={(e) => setAddProductId(e.target.value)}
              >
                {addCandidates.map((p) => (
                  <option key={p.id} value={p.id}>
                    {formatProductDisplayName(p)}
                    {p.sku ? ` — ${p.sku}` : ""}
                  </option>
                ))}
              </select>

              <p className="mt-2 text-xs text-slate-500">
                Choose a catalog product that is not yet being tracked in inventory.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-[22px] border border-[#F1E6C9] bg-white p-5">
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Initial packs
                </label>
                <input
                  className={S.input}
                  type="number"
                  min={0}
                  value={addQty}
                  onChange={(e) => setAddQty(e.target.value)}
                />
                <p className="mt-2 text-xs text-slate-500">
                  Current stock available today.
                </p>
              </div>

              <div className="rounded-[22px] border border-[#F1E6C9] bg-white p-5">
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Reorder level
                </label>
                <input
                  className={S.input}
                  type="number"
                  min={0}
                  value={addReorder}
                  onChange={(e) => setAddReorder(e.target.value)}
                />
                <p className="mt-2 text-xs text-slate-500">
                  This becomes the low-stock threshold.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
              Inventory tracking will start immediately after saving.
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
        sub="Add incoming stock, remove damaged stock, or set a corrected stock count"
        size="lg"
        onClose={handleAdjustModalClose}
        closeOnBackdrop={!adjustDirty}
        footer={
          <>
            <button
              className={S.btnGhost}
              onClick={() => {
                setAdjustOpen(false);
                setAdjustModalError("");
              }}
            >
              Cancel
            </button>
            <button
              className={S.btnPrimary}
              onClick={handleAdjustSave}
              disabled={savingId === adjustRow?.product_id}
            >
              {savingId === adjustRow?.product_id
                ? "Saving…"
                : "Confirm adjustment"}
            </button>
          </>
        }
      >
        {adjustRow && (
          <div className="space-y-5">
            {adjustModalError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {adjustModalError}
              </div>
            )}

            <div className="flex items-center justify-between rounded-[24px] border border-[#F1E6C9] bg-[#FFFDF8] p-5">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Current stock
                </div>
                <div className="mt-1 text-3xl font-bold text-slate-900">
                  {Number(adjustRow.qty_on_hand ?? 0)}
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  Reorder at{" "}
                  <span className="font-semibold">
                    {Number(adjustRow.reorder_level ?? 0)}
                  </span>
                </div>
              </div>

              <StatusBadge
                qty={Number(adjustRow.qty_on_hand ?? 0)}
                reorder={Number(adjustRow.reorder_level ?? 0)}
              />
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
                  {adjustMode === "set" ? "New pack count" : "Pack amount"}
                </label>
                <input
                  className={S.input}
                  type="number"
                  min={0}
                  value={adjustValue}
                  onChange={(e) => setAdjustValue(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Note{" "}
                  {adjustMode === "remove" || adjustMode === "set"
                    ? "*"
                    : "(optional)"}
                </label>
                <input
                  className={S.input}
                  placeholder="Reason…"
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500">
              Removing stock will never go below zero.
            </div>

            {adjustDirty && (
              <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                You have unsaved changes. Click{" "}
                <span className="font-semibold text-slate-700">Confirm adjustment</span>{" "}
                or{" "}
                <span className="font-semibold text-slate-700">Cancel</span>.
              </div>
            )}
          </div>
        )}
      </Modal>

    </div>
  );
}