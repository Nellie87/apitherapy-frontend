"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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
  type InventoryProductUnit,
} from "@/lib/api/inventory";
import { listProducts } from "@/lib/api/products";
import RestockModal from "./components/RestockModal";
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
type AdjustMode = "remove" | "set" | "reorder";

type HistoryTypeFilter =
  | "all"
  | "add"
  | "restock"
  | "remove"
  | "set"
  | "sale"
  | "sale_edit"
  | "sale_void";

type ToastItem = {
  id: number;
  message: string;
  type: "success" | "error";
};

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

function fmtPercent(v: number | string | null | undefined) {
  const n = Number(v || 0);
  return `${n.toLocaleString("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })}%`;
}

function fmtNumber(v: number | string | null | undefined) {
  const n = Number(v || 0);
  return n.toLocaleString("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
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
  if (reorder > 0 && qty <= Math.max(1, Math.ceil(reorder * 0.3))) {
    return "critical";
  }
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

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
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

function getBaseUnit(row: InventoryRow): InventoryProductUnit | null {
  const units = row.products?.product_units ?? [];
  return units.find((u) => u.is_default) ?? units[0] ?? null;
}

function getPackageUnits(row: InventoryRow): InventoryProductUnit[] {
  return (row.products?.product_units ?? [])
    .filter(
      (u) =>
        u.active !== false &&
        u.can_restock !== false &&
        Number(u.base_quantity ?? 1) > 1,
    )
    .sort((a: InventoryProductUnit, b: InventoryProductUnit) => {
      const orderA = a.sort_order ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.sort_order ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return a.base_quantity - b.base_quantity;
    });
}

function getBaseUnitLabel(row: InventoryRow) {
  return getBaseUnit(row)?.label ?? "base units";
}

function getBestPackageDisplay(row: InventoryRow) {
  const qty = Number(row.qty_on_hand ?? 0);
  const packages = getPackageUnits(row);

  if (!packages.length) return null;

  const largest = [...packages].sort(
    (a, b) => Number(b.base_quantity ?? 1) - Number(a.base_quantity ?? 1),
  )[0];

  if (!largest || largest.base_quantity <= 1) return null;

  const fullPackages = Math.floor(qty / largest.base_quantity);
  const loose = qty % largest.base_quantity;

  if (fullPackages <= 0) return null;

  return {
    packageLabel: largest.label,
    fullPackages,
    loose,
    baseLabel: getBaseUnitLabel(row),
  };
}

function getBaseCostPerUnit(row: InventoryRow) {
  const baseUnit = getBaseUnit(row);
  if (baseUnit) return Number(baseUnit.cost_price ?? 0);

  return Number(row.products?.cost_price ?? 0);
}

function getBaseRetailPrice(row: InventoryRow) {
  const baseUnit = getBaseUnit(row);
  if (baseUnit) return Number(baseUnit.selling_price ?? 0);

  return Number(row.products?.unit_price ?? 0);
}

function getWholesaleValue(row: InventoryRow) {
  const qty = Number(row.qty_on_hand ?? 0);
  const packages = getPackageUnits(row);

  if (!packages.length) return 0;

  const largest = [...packages].sort(
    (a, b) => Number(b.base_quantity ?? 1) - Number(a.base_quantity ?? 1),
  )[0];

  if (!largest || largest.base_quantity <= 1) return 0;

  const fullPackages = Math.floor(qty / largest.base_quantity);
  const loose = qty % largest.base_quantity;
  const baseRetail = getBaseRetailPrice(row);

  return fullPackages * Number(largest.selling_price ?? 0) + loose * baseRetail;
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
   Toast / Modal
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
      role="status"
      className={`flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-xl text-white text-sm font-semibold transition-all animate-[fadeIn_0.15s_ease-out] ${
        type === "success" ? "bg-green-600" : "bg-red-600"
      }`}
    >
      <span>{message}</span>
      <button
        onClick={onClose}
        aria-label="Dismiss notification"
        className="text-white/80 hover:text-white text-xs font-bold"
      >
        Close
      </button>
    </div>
  );
}

function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  if (!toasts.length) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-5 right-5 z-[70] flex flex-col-reverse gap-2"
    >
      {toasts.map((t) => (
        <Toast
          key={t.id}
          message={t.message}
          type={t.type}
          onClose={() => onDismiss(t.id)}
        />
      ))}
    </div>
  );
}

function Modal({
  open,
  title,
  sub,
  onClose,
  children,
  footer,
  size = "md",
  closeOnBackdrop = true,
  initialFocusRef,
}: {
  open: boolean;
  title: string;
  sub?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "md" | "lg" | "xl";
  closeOnBackdrop?: boolean;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
}) {
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && closeOnBackdrop) {
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, closeOnBackdrop, onClose]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => initialFocusRef?.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open, initialFocusRef]);

  if (!open) return null;

  const maxW =
    size === "xl" ? "max-w-5xl" : size === "lg" ? "max-w-3xl" : "max-w-xl";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/35 backdrop-blur-sm p-0 sm:items-center sm:p-4"
      onClick={() => closeOnBackdrop && onClose()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`flex max-h-[92vh] w-full ${maxW} flex-col overflow-hidden rounded-t-[28px] border border-[#EADFC2] bg-white shadow-2xl sm:rounded-[28px]`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-[#F1E6C9] bg-[linear-gradient(180deg,#FFFDF8_0%,#FFF8E6_100%)] px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-black tracking-tight text-slate-950">
                {title}
              </div>
              {sub && <div className="mt-1 text-sm text-slate-500">{sub}</div>}
            </div>

            <button
              onClick={onClose}
              aria-label="Close dialog"
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
   Small UI
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
      valueColor: "#0F172A",
      subColor: "#64748B",
    },
    warning: {
      border: active ? "#D97706" : "#FDE68A",
      valueColor: "#92400E",
      subColor: "#B45309",
    },
    danger: {
      border: active ? "#DC2626" : "#FECACA",
      valueColor: "#991B1B",
      subColor: "#B91C1C",
    },
    success: {
      border: "#BBF7D0",
      valueColor: "#166534",
      subColor: "#16A34A",
    },
  }[variant];

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={onClick ? active : undefined}
      className="rounded-[22px] p-4 bg-white transition hover:-translate-y-0.5 text-left w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
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
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700 border border-red-200">
        Out of stock
      </span>
    );
  }

  if (status === "critical") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-700 border border-orange-200">
        Critical
      </span>
    );
  }

  if (status === "low") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
        Low stock
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700 border border-green-200">
      In stock
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
          aria-label="Previous page"
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
          aria-label="Next page"
          className="h-9 rounded-xl border border-[#EADFC2] bg-white px-3 text-xs font-bold text-slate-600 hover:bg-[#FFF8E6] disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function QuickAddStock({
  value,
  baseLabel,
  saving,
  onChange,
  onAdd,
}: {
  value: string;
  baseLabel: string;
  saving: boolean;
  onChange: (value: string) => void;
  onAdd: () => void;
}) {
  const canSubmit = !saving && Number(value) > 0;

  return (
    <div className="flex items-center gap-1 rounded-xl border border-green-200 bg-green-50 p-1">
      <input
        type="number"
        min={1}
        placeholder="+ qty"
        value={value}
        aria-label={`Quick add ${baseLabel}`}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && canSubmit) {
            e.preventDefault();
            onAdd();
          }
        }}
        className="h-9 w-20 rounded-lg border border-green-100 bg-white px-2 text-center text-xs font-semibold text-slate-800 outline-none"
      />

      <button
        disabled={!canSubmit}
        onClick={onAdd}
        className="h-9 rounded-lg bg-green-600 px-3 text-xs font-bold text-white hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {saving ? "Adding…" : `Add ${baseLabel}`}
      </button>
    </div>
  );
}

function InventorySkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-[22px] border border-slate-100 bg-slate-50"
          />
        ))}
      </div>
      <div className="rounded-[28px] border border-[#EADFC2] bg-white p-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="mb-3 h-16 animate-pulse rounded-2xl bg-slate-50"
          />
        ))}
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
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastCounter = useRef(0);

  const [savingId, setSavingId] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [addProductId, setAddProductId] = useState("");
  const [addQty, setAddQty] = useState("0");
  const [addReorder, setAddReorder] = useState("5");
  const addSelectRef = useRef<HTMLSelectElement>(null);

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustRow, setAdjustRow] = useState<InventoryRow | null>(null);
  const [adjustMode, setAdjustMode] = useState<AdjustMode>("remove");
  const [adjustValue, setAdjustValue] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [adjustModalError, setAdjustModalError] = useState("");
  const adjustValueRef = useRef<HTMLInputElement>(null);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyRow, setHistoryRow] = useState<InventoryRow | null>(null);
  const [productMovements, setProductMovements] = useState<
    InventoryMovementRow[]
  >([]);

  const [restockQty, setRestockQty] = useState<Record<string, string>>({});
  const [packageRestockRow, setPackageRestockRow] =
    useState<InventoryRow | null>(null);

  function pushToast(message: string, type: "success" | "error") {
    toastCounter.current += 1;
    const id = toastCounter.current;
    setToasts((prev) => [...prev, { id, message, type }]);
  }

  function dismissToast(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

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
        category:
          typeof p.category === "string" ? p.category : p.category?.name ?? null,
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

  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const o = await bootstrapOrg();
        setOrgId(o);
        await Promise.all([refresh(o), loadProducts(o), loadAllHistory(o)]);
      } catch (e: any) {
        setErr(e.message ?? String(e));
      } finally {
        setInitialLoading(false);
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
        .sort((a, b) =>
          formatProductDisplayName(a).localeCompare(formatProductDisplayName(b)),
        ),
    [allProducts, productIdsInInventory],
  );

  useEffect(() => {
    if (!addProductId && addCandidates.length) {
      setAddProductId(addCandidates[0].id);
    }
  }, [addCandidates, addProductId]);

  const adjustDirty = useMemo(() => {
    if (!adjustRow) return false;

    return (
      adjustValue.trim() !== "" ||
      adjustNote.trim() !== "" ||
      adjustMode !== "remove"
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
      (sum, r) => sum + getBaseCostPerUnit(r) * Number(r.qty_on_hand ?? 0),
      0,
    );

    const stockRetailValue = rows.reduce(
      (sum, r) => sum + getBaseRetailPrice(r) * Number(r.qty_on_hand ?? 0),
      0,
    );

    const wholesaleValue = rows.reduce(
      (sum, r) => sum + getWholesaleValue(r),
      0,
    );

    const potentialGrossProfit = stockRetailValue - stockCostValue;

    const grossMargin =
      stockRetailValue > 0 ? (potentialGrossProfit / stockRetailValue) * 100 : 0;

    return {
      totalItems,
      outOfStock,
      lowStock,
      stockCostValue,
      stockRetailValue,
      wholesaleValue,
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
      const units = (p?.product_units ?? [])
        .map((unit) => unit.label)
        .join(" ")
        .toLowerCase();

      const matchesText =
        !term ||
        displayName.includes(term) ||
        category.includes(term) ||
        sku.includes(term) ||
        barcode.includes(term) ||
        units.includes(term);

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
    safePage * PAGE_SIZE,
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
    Math.ceil(filteredHistory.length / HISTORY_PAGE_SIZE),
  );
  const safeHistoryPage = Math.min(historyPage, historyTotalPages);
  const paginatedHistory = filteredHistory.slice(
    (safeHistoryPage - 1) * HISTORY_PAGE_SIZE,
    safeHistoryPage * HISTORY_PAGE_SIZE,
  );

  useEffect(() => {
    if (historyPage > historyTotalPages) setHistoryPage(historyTotalPages);
  }, [historyPage, historyTotalPages]);

  const groupedTimeline = useMemo(
    () => groupMovementsByTimeline(paginatedHistory),
    [paginatedHistory],
  );

  const hasActiveHistoryFilters = Boolean(
    historySearch || historyMonth || historyTypeFilter !== "all",
  );

  function clearHistoryFilters() {
    setHistorySearch("");
    setHistoryMonth("");
    setHistoryTypeFilter("all");
  }

  async function openProductHistory(row: InventoryRow) {
    if (!orgId) return;

    setHistoryRow(row);
    setHistoryOpen(true);
    setLoadingHistory(true);

    try {
      const data = await listInventoryMovements(orgId, row.product_id);
      setProductMovements(data);
    } catch (e: any) {
      pushToast(e.message ?? "Failed to load product history", "error");
    } finally {
      setLoadingHistory(false);
    }
  }

  function handleAdjustModalClose() {
    if (adjustDirty) return;
    setAdjustOpen(false);
    setAdjustModalError("");
    setAdjustRow(null);
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

      await Promise.all([
        refresh(orgId),
        loadProducts(orgId),
        loadAllHistory(orgId),
      ]);

      setAddOpen(false);
      setAddQty("0");
      setAddReorder("5");

      pushToast(
        `"${
          selectedProduct
            ? formatProductDisplayName(selectedProduct)
            : "Product"
        }" added to inventory`,
        "success",
      );
    } catch (e: any) {
      setErr(e.message ?? String(e));
      pushToast("Failed to add inventory item", "error");
    } finally {
      setSavingId(null);
    }
  }

  async function handleQuickRestock(row: InventoryRow, amount: number) {
    if (!orgId || amount <= 0 || !Number.isFinite(amount)) {
      setErr("Enter a valid restock quantity.");
      return;
    }

    const baseLabel = getBaseUnitLabel(row);

    setSavingId(row.product_id);
    setErr("");

    try {
      await adjustInventoryDelta(orgId, row.product_id, {
        mode: "add",
        amount,
        reorder_level: row.reorder_level,
        note: `Quick add +${amount} ${baseLabel}`,
        recordAs: "restock",
      });

      setRestockQty((prev) => ({ ...prev, [row.product_id]: "" }));

      await Promise.all([refresh(orgId), loadAllHistory(orgId)]);

      pushToast(`${fmtNumber(amount)} ${baseLabel} added`, "success");
    } catch (e: any) {
      setErr(e.message ?? String(e));
      pushToast("Failed to add stock", "error");
    } finally {
      setSavingId(null);
    }
  }

  function openAdjust(row: InventoryRow, mode: AdjustMode) {
    setAdjustRow(row);
    setAdjustMode(mode);
    setAdjustValue(mode === "reorder" ? String(row.reorder_level ?? 0) : "");
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
      setAdjustModalError("Enter a valid number.");
      return;
    }

    const currentQty = Number(adjustRow.qty_on_hand ?? 0);

    if (adjustMode === "remove" && n > currentQty) {
      setAdjustModalError(
        `Cannot remove more than the current stock (${fmtNumber(
          currentQty,
        )} ${getBaseUnitLabel(adjustRow)} available).`,
      );
      return;
    }

    if (
      (adjustMode === "remove" || adjustMode === "set") &&
      !adjustNote.trim()
    ) {
      setAdjustModalError("Please provide a note for this change.");
      return;
    }

    setSavingId(adjustRow.product_id);

    try {
      if (adjustMode === "reorder") {
        await updateInventory(orgId, adjustRow.product_id, {
          qty_on_hand: adjustRow.qty_on_hand,
          reorder_level: n,
        });
      } else {
        await adjustInventoryDelta(orgId, adjustRow.product_id, {
          mode: adjustMode,
          amount: n,
          reorder_level: adjustRow.reorder_level,
          note: adjustNote.trim(),
        });
      }

      await Promise.all([refresh(orgId), loadAllHistory(orgId)]);

      setAdjustOpen(false);
      setAdjustRow(null);
      setAdjustModalError("");

      pushToast(
        adjustMode === "reorder"
          ? "Reorder level updated"
          : "Inventory adjusted successfully",
        "success",
      );
    } catch (e: any) {
      setErr(e.message ?? String(e));
      pushToast("Failed to adjust inventory", "error");
    } finally {
      setSavingId(null);
    }
  }

  function handleStockCardFilter(next: StockFilter) {
    setStockFilter((prev) => (prev === next ? "all" : next));
  }

  if (!orgId && !err) {
    return <InventorySkeleton />;
  }

  const TABLE_COLS = "2fr 1.05fr 1.2fr 0.95fr 1.15fr 0.95fr 2fr";
  const HEADERS = [
    "Product",
    "Category",
    "Stock",
    "Reorder at",
    "Values",
    "Status",
    "Actions",
  ];

  return (
    <div className="flex flex-col gap-6">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {err && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="flex-1">{err}</span>
          <button
            onClick={() => setErr("")}
            aria-label="Dismiss error"
            className="shrink-0 text-red-400 hover:text-red-600 text-lg leading-none"
          >
            ×
          </button>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <TopTabs value={tab} onChange={setTab} />
      </div>

      {tab === "overview" && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
              sub="no stock left"
              variant="danger"
              active={stockFilter === "out"}
              onClick={() => handleStockCardFilter("out")}
            />
            <StatCard
              title="Inventory cost"
              value={fmtMoney(kpis.stockCostValue)}
              sub="based on purchase cost"
              variant="success"
            />
            <StatCard
              title="Retail value"
              value={fmtMoney(kpis.stockRetailValue)}
              sub="if sold as retail/base units"
              variant="neutral"
            />
            <StatCard
              title="Wholesale value"
              value={fmtMoney(kpis.wholesaleValue)}
              sub="full packages + loose retail"
              variant="neutral"
            />
            <StatCard
              title="Potential gross profit"
              value={fmtMoney(kpis.potentialGrossProfit)}
              sub="retail value minus inventory cost"
              variant={kpis.potentialGrossProfit < 0 ? "danger" : "success"}
            />
            <StatCard
              title="Gross margin"
              value={fmtPercent(kpis.grossMargin)}
              sub="potential margin"
              variant={kpis.grossMargin < 0 ? "danger" : "neutral"}
            />
          </div>

          <div className="rounded-[28px] border border-[#EADFC2] bg-white shadow-[0_12px_36px_rgba(92,64,16,0.06)] overflow-hidden">
            <div className="border-b border-[#F1E6C9] bg-[linear-gradient(180deg,#FFFDF8_0%,#FFF9EC_100%)] px-5 py-4 lg:px-6">
              <div className="flex flex-wrap items-center gap-2">
                <label className="relative flex-1 min-w-[220px] max-w-sm">
                  <input
                    className="w-full rounded-2xl border border-[#EADFC2] bg-white px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition"
                    placeholder="Search product, unit, SKU or category…"
                    aria-label="Search inventory"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                  {q && (
                    <button
                      onClick={() => setQ("")}
                      aria-label="Clear search"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600"
                    >
                      Clear
                    </button>
                  )}
                </label>

                <button
                  type="button"
                  onClick={() => setAddOpen(true)}
                  className={S.btnPrimary}
                >
                  Add stock item
                </button>

                <span className="ml-auto text-xs text-slate-500 whitespace-nowrap">
                  {filteredRows.length} of {rows.length}
                </span>
              </div>

              {stockFilter !== "all" && (
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                  Filtering by{" "}
                  <span className="font-semibold text-slate-700">
                    {stockFilter === "low" ? "Low stock" : "Out of stock"}
                  </span>
                  <button
                    onClick={() => setStockFilter("all")}
                    className="font-bold text-amber-700 hover:underline"
                  >
                    Clear filter
                  </button>
                </div>
              )}
            </div>

            <div className="px-3 py-3 sm:px-4 sm:py-4">
              {initialLoading ? (
                <div className="space-y-3 px-3 py-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-20 animate-pulse rounded-[24px] bg-slate-50"
                    />
                  ))}
                </div>
              ) : (
                <>
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
                        {rows.length > 0 && (q || stockFilter !== "all") && (
                          <button
                            onClick={() => {
                              setQ("");
                              setStockFilter("all");
                            }}
                            className="mt-4 rounded-xl border border-[#EADFC2] bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-[#FFF8E6]"
                          >
                            Clear search & filters
                          </button>
                        )}
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
                        const baseUnitLabel = getBaseUnitLabel(r);
                        const packageDisplay = getBestPackageDisplay(r);
                        const totalCostValue = getBaseCostPerUnit(r) * qty;
                        const totalRetailValue = getBaseRetailPrice(r) * qty;
                        const wholesaleValue = getWholesaleValue(r);
                        const isSaving = savingId === r.product_id;
                        const hasPackages = getPackageUnits(r).length > 0;

                        const actionBtnDisabledCls = isSaving
                          ? "opacity-40 cursor-not-allowed"
                          : "";

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
                                {p?.category || (
                                  <span className="text-slate-300">—</span>
                                )}
                              </div>

                              <div>
                                {packageDisplay ? (
                                  <>
                                    <div className="text-lg font-bold text-slate-900">
                                      {fmtNumber(packageDisplay.fullPackages)}{" "}
                                      {packageDisplay.packageLabel}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                      {fmtNumber(qty)} {baseUnitLabel}
                                    </div>
                                    {packageDisplay.loose > 0 && (
                                      <div className="text-xs text-amber-700 font-semibold">
                                        + {fmtNumber(packageDisplay.loose)} loose
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    <div className="text-lg font-bold text-slate-900">
                                      {fmtNumber(qty)}
                                    </div>
                                    <div className="text-xs text-slate-400">
                                      {baseUnitLabel}
                                    </div>
                                  </>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={() => openAdjust(r, "reorder")}
                                className="w-fit rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                {fmtNumber(reorder)}
                              </button>

                              <div>
                                <div className="font-semibold text-slate-900 text-sm">
                                  {fmtMoney(totalCostValue)}
                                </div>
                                <div className="text-xs text-slate-400">
                                  Cost value
                                </div>
                                <div className="mt-1 text-xs font-semibold text-green-700">
                                  Retail {fmtMoney(totalRetailValue)}
                                </div>
                                {wholesaleValue > 0 && (
                                  <div className="mt-1 text-xs font-semibold text-purple-700">
                                    Wholesale {fmtMoney(wholesaleValue)}
                                  </div>
                                )}
                              </div>

                              <div>
                                <StatusBadge qty={qty} reorder={reorder} />
                              </div>

                              <div className="flex items-center gap-2 flex-wrap">
                                <QuickAddStock
                                  value={restockQty[r.product_id] ?? ""}
                                  baseLabel={baseUnitLabel}
                                  saving={isSaving}
                                  onChange={(value) =>
                                    setRestockQty((prev) => ({
                                      ...prev,
                                      [r.product_id]: value,
                                    }))
                                  }
                                  onAdd={() =>
                                    handleQuickRestock(
                                      r,
                                      Number(restockQty[r.product_id] || 0),
                                    )
                                  }
                                />

                                {hasPackages && (
                                  <button
                                    type="button"
                                    disabled={isSaving}
                                    onClick={() => setPackageRestockRow(r)}
                                    className={`rounded-xl border border-purple-200 bg-purple-50 px-3 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-100 transition ${actionBtnDisabledCls}`}
                                  >
                                    Add boxes
                                  </button>
                                )}

                                <button
                                  type="button"
                                  disabled={isSaving || qty <= 0}
                                  onClick={() => openAdjust(r, "remove")}
                                  title={
                                    qty <= 0
                                      ? "No stock to remove"
                                      : undefined
                                  }
                                  className={`rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 transition ${
                                    isSaving || qty <= 0
                                      ? "opacity-40 cursor-not-allowed"
                                      : ""
                                  }`}
                                >
                                  Remove
                                </button>

                                <button
                                  type="button"
                                  disabled={isSaving}
                                  onClick={() => openAdjust(r, "set")}
                                  className={`rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition ${actionBtnDisabledCls}`}
                                >
                                  Set
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
                                    Stock
                                  </div>
                                  <div className="font-bold text-slate-900 mt-0.5">
                                    {packageDisplay
                                      ? `${fmtNumber(
                                          packageDisplay.fullPackages,
                                        )} ${packageDisplay.packageLabel}`
                                      : fmtNumber(qty)}
                                  </div>
                                  <div className="text-[11px] text-slate-400">
                                    {fmtNumber(qty)} {baseUnitLabel}
                                  </div>
                                </div>

                                <div>
                                  <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">
                                    Reorder
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => openAdjust(r, "reorder")}
                                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-center text-sm font-semibold text-slate-800 outline-none"
                                  >
                                    {fmtNumber(reorder)}
                                  </button>
                                </div>

                                <div>
                                  <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">
                                    Cost value
                                  </div>
                                  <div className="font-semibold text-slate-900 mt-0.5">
                                    {fmtMoney(totalCostValue)}
                                  </div>
                                  <div className="mt-1 text-[11px] font-semibold text-green-700">
                                    Retail {fmtMoney(totalRetailValue)}
                                  </div>
                                </div>
                              </div>

                              <div className="flex gap-2">
                                <QuickAddStock
                                  value={restockQty[r.product_id] ?? ""}
                                  baseLabel={baseUnitLabel}
                                  saving={isSaving}
                                  onChange={(value) =>
                                    setRestockQty((prev) => ({
                                      ...prev,
                                      [r.product_id]: value,
                                    }))
                                  }
                                  onAdd={() =>
                                    handleQuickRestock(
                                      r,
                                      Number(restockQty[r.product_id] || 0),
                                    )
                                  }
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                {hasPackages && (
                                  <button
                                    type="button"
                                    disabled={isSaving}
                                    onClick={() => setPackageRestockRow(r)}
                                    className={`rounded-xl border border-purple-200 bg-purple-50 py-2.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 transition ${actionBtnDisabledCls}`}
                                  >
                                    Add boxes
                                  </button>
                                )}

                                <button
                                  type="button"
                                  disabled={isSaving || qty <= 0}
                                  onClick={() => openAdjust(r, "remove")}
                                  className={`rounded-xl border border-red-200 bg-red-50 py-2.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition ${
                                    isSaving || qty <= 0
                                      ? "opacity-40 cursor-not-allowed"
                                      : ""
                                  }`}
                                >
                                  Remove
                                </button>

                                <button
                                  type="button"
                                  disabled={isSaving}
                                  onClick={() => openAdjust(r, "set")}
                                  className={`rounded-xl border border-blue-200 bg-blue-50 py-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition ${actionBtnDisabledCls}`}
                                >
                                  Set count
                                </button>

                                <button
                                  type="button"
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
                </>
              )}
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
                {filteredHistory.length} movement
                {filteredHistory.length !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <label className="relative flex-1 min-w-[220px] max-w-sm">
                  <input
                    className="w-full rounded-2xl border border-[#EADFC2] bg-white px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition"
                    placeholder="Search product, note or movement type…"
                    aria-label="Search stock history"
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                  />
                  {historySearch && (
                    <button
                      onClick={() => setHistorySearch("")}
                      aria-label="Clear history search"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600"
                    >
                      Clear
                    </button>
                  )}
                </label>

                <div className="flex items-center gap-1.5">
                  <input
                    type="month"
                    value={historyMonth}
                    aria-label="Filter by month"
                    onChange={(e) => setHistoryMonth(e.target.value)}
                    className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-slate-400 focus:ring-2 focus:ring-slate-100 outline-none transition"
                  />
                  {historyMonth && (
                    <button
                      onClick={() => setHistoryMonth("")}
                      aria-label="Clear month filter"
                      className="text-xs font-bold text-slate-400 hover:text-slate-600"
                    >
                      ×
                    </button>
                  )}
                </div>

                {hasActiveHistoryFilters && (
                  <button
                    onClick={clearHistoryFilters}
                    className="text-xs font-bold text-amber-700 hover:underline"
                  >
                    Clear all filters
                  </button>
                )}
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
                {hasActiveHistoryFilters && (
                  <button
                    onClick={clearHistoryFilters}
                    className="mt-4 rounded-xl border border-[#EADFC2] bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-[#FFF8E6]"
                  >
                    Clear filters
                  </button>
                )}
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
                                    m.type,
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
                                Before{" "}
                                <span className="font-semibold text-slate-900">
                                  {fmtNumber(m.qty_before)}
                                </span>
                                {" · "}
                                After{" "}
                                <span className="font-semibold text-slate-900">
                                  {fmtNumber(m.qty_after)}
                                </span>
                                {" · "}
                                Change{" "}
                                <span className="font-semibold text-slate-900">
                                  {m.qty_delta > 0 ? "+" : ""}
                                  {fmtNumber(m.qty_delta)}
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
        initialFocusRef={addSelectRef}
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
          <div
            className="space-y-6"
            onKeyDown={(e) => {
              if (e.key === "Enter" && savingId !== addProductId) {
                e.preventDefault();
                handleAddStock();
              }
            }}
          >
            <div className="rounded-[24px] border border-[#F1E6C9] bg-[#FFFDF8] p-5">
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                Product
              </label>

              <select
                ref={addSelectRef}
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
                  Initial base units
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
          </div>
        )}
      </Modal>

      <Modal
        open={adjustOpen}
        title={
          adjustRow
            ? adjustMode === "remove"
              ? `Remove stock — ${formatProductDisplayName({
                  name: adjustRow.products?.name,
                  quantity_value: adjustRow.products?.quantity_value,
                  quantity_unit: adjustRow.products?.quantity_unit,
                })}`
              : adjustMode === "set"
                ? `Set stock count — ${formatProductDisplayName({
                    name: adjustRow.products?.name,
                    quantity_value: adjustRow.products?.quantity_value,
                    quantity_unit: adjustRow.products?.quantity_unit,
                  })}`
                : `Edit reorder level — ${formatProductDisplayName({
                    name: adjustRow.products?.name,
                    quantity_value: adjustRow.products?.quantity_value,
                    quantity_unit: adjustRow.products?.quantity_unit,
                  })}`
            : "Adjust stock"
        }
        sub={
          adjustMode === "remove"
            ? "Use this for damaged, expired, lost, or corrected stock."
            : adjustMode === "set"
              ? "Use this after physically counting stock."
              : "Set the low-stock threshold for this product."
        }
        size="lg"
        onClose={handleAdjustModalClose}
        closeOnBackdrop={!adjustDirty}
        initialFocusRef={adjustValueRef}
        footer={
          <>
            <button
              className={S.btnGhost}
              onClick={() => {
                setAdjustOpen(false);
                setAdjustModalError("");
                setAdjustRow(null);
              }}
            >
              Cancel
            </button>
            <button
              className={S.btnPrimary}
              onClick={handleAdjustSave}
              disabled={savingId === adjustRow?.product_id}
            >
              {savingId === adjustRow?.product_id ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        {adjustRow && (() => {
          const currentQty = Number(adjustRow.qty_on_hand ?? 0);
          const enteredNum = Number(adjustValue || 0);
          const hasValue = adjustValue.trim() !== "" && Number.isFinite(enteredNum);
          const previewAfter =
            adjustMode === "remove"
              ? currentQty - enteredNum
              : adjustMode === "set"
                ? enteredNum
                : null;
          const previewInvalid = adjustMode === "remove" && enteredNum > currentQty;

          return (
            <div
              className="space-y-5"
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  (e.target as HTMLElement).tagName !== "TEXTAREA" &&
                  savingId !== adjustRow.product_id
                ) {
                  e.preventDefault();
                  handleAdjustSave();
                }
              }}
            >
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
                    {fmtNumber(currentQty)}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    {getBaseUnitLabel(adjustRow)}
                  </div>
                </div>

                <StatusBadge
                  qty={currentQty}
                  reorder={Number(adjustRow.reorder_level ?? 0)}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    {adjustMode === "set"
                      ? "New stock count"
                      : adjustMode === "reorder"
                        ? "New reorder level"
                        : "Amount to remove"}
                  </label>
                  <input
                    ref={adjustValueRef}
                    className={S.input}
                    type="number"
                    min={0}
                    max={adjustMode === "remove" ? currentQty : undefined}
                    value={adjustValue}
                    onChange={(e) => setAdjustValue(e.target.value)}
                  />
                  {adjustMode === "remove" && (
                    <p className="mt-1 text-xs text-slate-400">
                      Max {fmtNumber(currentQty)} {getBaseUnitLabel(adjustRow)}
                    </p>
                  )}
                </div>

                {adjustMode !== "reorder" && (
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Note *
                    </label>
                    <input
                      className={S.input}
                      placeholder="Reason…"
                      value={adjustNote}
                      onChange={(e) => setAdjustNote(e.target.value)}
                    />
                  </div>
                )}
              </div>

              {adjustMode !== "reorder" && hasValue && (
                <div
                  className={`rounded-2xl border p-4 text-sm ${
                    previewInvalid
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-blue-100 bg-blue-50 text-blue-800"
                  }`}
                >
                  {previewInvalid ? (
                    <>
                      That's more than the current stock (
                      {fmtNumber(currentQty)} {getBaseUnitLabel(adjustRow)}{" "}
                      available).
                    </>
                  ) : (
                    <>
                      Stock will change from{" "}
                      <strong>{fmtNumber(currentQty)}</strong> to{" "}
                      <strong>{fmtNumber(previewAfter ?? 0)}</strong>{" "}
                      {getBaseUnitLabel(adjustRow)}.
                    </>
                  )}
                </div>
              )}

              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                Remove and set changes are logged in stock history.
              </div>

              {adjustDirty && (
                <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                  You have unsaved changes. Click Save or Cancel.
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      <Modal
        open={historyOpen}
        title={
          historyRow
            ? `History — ${formatProductDisplayName({
                name: historyRow.products?.name,
                quantity_value: historyRow.products?.quantity_value,
                quantity_unit: historyRow.products?.quantity_unit,
              })}`
            : "Product history"
        }
        sub="Recent movements for this product"
        size="lg"
        onClose={() => {
          setHistoryOpen(false);
          setHistoryRow(null);
          setProductMovements([]);
        }}
      >
        {loadingHistory ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-2xl bg-slate-50"
              />
            ))}
          </div>
        ) : productMovements.length === 0 ? (
          <div className="py-12 text-center text-sm font-semibold text-slate-400">
            No movements found.
          </div>
        ) : (
          <div className="space-y-3">
            {productMovements.map((m) => (
              <div
                key={m.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${movementColor(
                      m.type,
                    )}`}
                  >
                    {movementLabel(m.type)}
                  </span>

                  <span className="text-xs text-slate-400">
                    {fmtDateTime(m.created_at)}
                  </span>
                </div>

                <div className="mt-2 text-sm text-slate-600">
                  Before{" "}
                  <span className="font-semibold text-slate-900">
                    {fmtNumber(m.qty_before)}
                  </span>
                  {" · "}
                  After{" "}
                  <span className="font-semibold text-slate-900">
                    {fmtNumber(m.qty_after)}
                  </span>
                  {" · "}
                  Change{" "}
                  <span className="font-semibold text-slate-900">
                    {m.qty_delta > 0 ? "+" : ""}
                    {fmtNumber(m.qty_delta)}
                  </span>
                </div>

                {m.note && (
                  <div className="mt-2 text-sm text-slate-500">
                    Note: {m.note}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>

      <RestockModal
        open={Boolean(packageRestockRow)}
        orgId={orgId ?? ""}
        inventoryRow={packageRestockRow}
        onClose={() => setPackageRestockRow(null)}
        onRestocked={async () => {
          if (!orgId) return;
          await Promise.all([refresh(orgId), loadAllHistory(orgId)]);
        }}
      />
    </div>
  );
}