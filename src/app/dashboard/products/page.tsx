"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import {
  listProducts,
  createProduct,
  archiveProduct,
  restoreProduct,
} from "@/lib/api/products";
import {
  listUnitMeasures,
  listCategories,
  createCategory,
  listSuppliers,
} from "@/lib/api/lookups";
import { createClient } from "@/lib/supabase/client";

import * as S from "./page.styles";

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */
type UnitKind = "mass" | "volume" | "count";
type QuantityUnit = "g" | "kg" | "ml" | "L" | "pc";

type MeasureLookup = {
  id: string;
  name: string;
  allowed_kinds: UnitKind[];
};

type CategoryLookup = {
  id: string;
  name: string;
};

type SupplierLookup = {
  id: string;
  name: string;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  active?: boolean;
};

type Product = {
  id: string;
  name?: string;
  sku?: string | null;
  category_id?: string | null;
  category?: { id?: string; name?: string } | null;
  barcode?: string | null;
  supplier_id?: string | null;
supplier?: {
  id?: string;
  name?: string;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  active?: boolean | null;
} | null;
  notes?: string | null;
  cost_price?: number | string | null;
  unit_price?: number | string | null;
  quantity_value?: number | string | null;
  quantity_unit?: QuantityUnit | null;
  unit_measure_id?: string | null;
  unit_measure?: { id?: string; name?: string } | null;
  is_sellable?: boolean;
  active?: boolean;
};

type FormData = {
  name: string;
  sku: string;
  categoryId: string;
  barcode: string;
  supplierId: string;
  notes: string;
  costPrice: string;
  sellPrice: string;
  quantityValue: string;
  quantityUnit: QuantityUnit | "";
  unitMeasureId: string;
  isSellable: boolean;
};

type FormErrors = Partial<Record<keyof FormData, string>>;

/* ─────────────────────────────────────────────
   Constants
───────────────────────────────────────────── */
const BLANK_FORM: FormData = {
  name: "",
  sku: "",
  categoryId: "",
  barcode: "",
  supplierId: "",
  notes: "",
  costPrice: "0",
  sellPrice: "0",
  quantityValue: "",
  quantityUnit: "",
  unitMeasureId: "",
  isSellable: true,
};

const PAGE_SIZE = 5;

const UNIT_OPTIONS_BY_KIND: Record<UnitKind, QuantityUnit[]> = {
  mass: ["g", "kg"],
  volume: ["ml", "L"],
  count: ["pc"],
};

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */
function fmt(v: number | string | null | undefined) {
  const n = Number(v || 0);
  return `Ksh ${n.toLocaleString("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function margin(
  cost: number | string | null | undefined,
  sell: number | string | null | undefined
) {
  const c = Number(cost || 0);
  const s = Number(sell || 0);
  if (c <= 0 || s <= 0) return null;
  return ((s - c) / s) * 100;
}

function getCategoryName(p: Product) {
  return p.category?.name ?? "";
}

function getAllowedQuantityUnits(
  measureId: string,
  measures: MeasureLookup[]
): QuantityUnit[] {
  const measure = measures.find((m) => m.id === measureId);
  if (!measure?.allowed_kinds?.length) return [];

  const units = new Set<QuantityUnit>();
  for (const kind of measure.allowed_kinds) {
    UNIT_OPTIONS_BY_KIND[kind].forEach((u) => units.add(u));
  }
  return Array.from(units);
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

function validateForm(form: FormData): FormErrors {
  const errors: FormErrors = {};

  if (!form.name.trim()) errors.name = "Product name is required";
  if (!form.categoryId) errors.categoryId = "Category is required";
  if (!form.unitMeasureId) errors.unitMeasureId = "Container / form is required";
  if (!form.quantityValue || Number(form.quantityValue) <= 0) {
    errors.quantityValue = "Quantity is required";
  }
  if (!form.quantityUnit) {
    errors.quantityUnit = "Unit is required";
  }
  if (form.isSellable && Number(form.sellPrice || 0) <= 0) {
    errors.sellPrice = "Sell price is required for sellable products";
  }

  return errors;
}

/* ─────────────────────────────────────────────
   Icons
───────────────────────────────────────────── */
const IconPlus = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const IconSearch = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const IconTrash = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

const IconEdit = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const IconCheck = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconX = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconChevronLeft = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
  >
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const IconChevronRight = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

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
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-xl text-white text-sm font-semibold transition-all duration-300 ${
        type === "success" ? "bg-green-600" : "bg-red-600"
      }`}
    >
      <span className="shrink-0">
        {type === "success" ? <IconCheck /> : <IconX />}
      </span>
      <span>{message}</span>
      <button
        onClick={onClose}
        className="ml-1 text-white/70 hover:text-white"
      >
        <IconX />
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────
   KPI Card
───────────────────────────────────────────── */
function KpiCard({
  icon,
  label,
  value,
  sub,
  variant = "neutral",
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  variant?: "neutral" | "success" | "warning" | "info";
}) {
  const cfg = {
    neutral: {
      border: "#F1E4BF",
      iconBg: "#FFF9E7",
      iconColor: "#8A6A00",
      val: "#2A2112",
      sub: "#9A7A18",
      shadow: "0 10px 25px rgba(245,197,24,0.06)",
    },
    success: {
      border: "#CBE9D2",
      iconBg: "#EAF8EE",
      iconColor: "#166534",
      val: "#166534",
      sub: "#2C8F4B",
      shadow: "0 10px 25px rgba(34,197,94,0.08)",
    },
    warning: {
      border: "#F4D98C",
      iconBg: "#FFF6D9",
      iconColor: "#9A5B00",
      val: "#8B5A00",
      sub: "#C17A00",
      shadow: "0 10px 25px rgba(245,158,11,0.08)",
    },
    info: {
      border: "#E7D8A7",
      iconBg: "#FFF7D6",
      iconColor: "#7A6300",
      val: "#7A6300",
      sub: "#A28300",
      shadow: "0 10px 25px rgba(245,197,24,0.08)",
    },
  }[variant];

  return (
    <div
      className="rounded-[22px] p-4 bg-white transition hover:-translate-y-0.5"
      style={{
        border: `1.5px solid ${cfg.border}`,
        boxShadow: cfg.shadow,
      }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-lg"
          style={{ background: cfg.iconBg, color: cfg.iconColor }}
        >
          {icon}
        </div>
      </div>
      <div
        className="text-[11px] font-semibold uppercase tracking-[0.18em] mb-1"
        style={{ color: cfg.sub }}
      >
        {label}
      </div>
      <div
        className="text-[28px] font-bold leading-none"
        style={{ color: cfg.val }}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-1.5 text-xs" style={{ color: cfg.sub }}>
          {sub}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Badges
───────────────────────────────────────────── */
function MarginBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-sm text-slate-300">—</span>;

  const color =
    pct >= 30
      ? "bg-green-100 text-green-700 border border-green-200"
      : pct >= 10
      ? "bg-amber-100 text-amber-700 border border-amber-200"
      : "bg-red-100 text-red-700 border border-red-200";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${color}`}
    >
      {pct.toFixed(0)}%
    </span>
  );
}

function SellBadge({ isSellable }: { isSellable?: boolean }) {
  return isSellable !== false ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700 border border-green-200">
      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
      For sale
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500 border border-slate-200">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
      Not for sale
    </span>
  );
}

function ArchiveBadge({ active }: { active?: boolean }) {
  if (active !== false) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      Archived
    </span>
  );
}

/* ─────────────────────────────────────────────
   Field Error
───────────────────────────────────────────── */
function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-500 font-medium">{message}</p>;
}

/* ─────────────────────────────────────────────
   Form Label
───────────────────────────────────────────── */
function Label({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

/* ─────────────────────────────────────────────
   Section Divider
───────────────────────────────────────────── */
function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
          {title}
        </span>
        <div className="flex-1 border-t border-slate-100" />
      </div>
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Inline Category Creator
───────────────────────────────────────────── */
function InlineCategoryCreator({
  orgId,
  onCreated,
}: {
  orgId: string;
  onCreated: (id: string, name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const created = await createCategory(orgId, name.trim());
      onCreated(created.id, created.name ?? name.trim());
      setName("");
      setOpen(false);
    } catch (e: any) {
      setError(e.message ?? "Failed to create category");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-1">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 hover:text-amber-700 transition"
        >
          <IconPlus />
          Add new category
        </button>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
          <div className="text-xs font-semibold text-amber-800 mb-1">
            New category
          </div>
          <input
            ref={inputRef}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none"
            placeholder="e.g. Raw Honey"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCreate();
              }
              if (e.key === "Escape") setOpen(false);
            }}
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving || !name.trim()}
              className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50 transition"
            >
              {saving ? "Creating…" : "Create"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setName("");
                setError("");
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Archive Confirmation Modal
───────────────────────────────────────────── */
function ArchiveModal({
  product,
  onConfirm,
  onCancel,
  loading,
}: {
  product: Product;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4 mb-5">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-amber-100 text-2xl">
            📦
          </div>
          <div>
            <div className="text-lg font-bold text-slate-900">
              Archive this product?
            </div>
            <div className="text-sm text-slate-500 mt-0.5">
              It will be hidden from sales and new orders, but kept in your
              records. You can restore it at any time.
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 mb-5">
          <div className="text-sm font-semibold text-slate-900">
            {formatProductDisplayName(product)}
          </div>
          {(product.sku || product.barcode) && (
            <div className="mt-1 text-xs text-slate-500 font-mono">
              {product.sku
                ? `SKU: ${product.sku}`
                : `Barcode: ${product.barcode}`}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Keep it active
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50 transition"
          >
            {loading ? "Archiving…" : "Yes, archive it"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Confirm Save Modal
───────────────────────────────────────────── */
function ConfirmSaveModal({
  open,
  mode,
  form,
  categories,
  measures,
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  mode: "add" | "edit";
  form: FormData;
  categories: CategoryLookup[];
  measures: MeasureLookup[];
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  const cat = categories.find((c) => c.id === form.categoryId);
  const measure = measures.find((m) => m.id === form.unitMeasureId);

  const rows = [
    {
      label: "Product",
      value:
        formatProductDisplayName({
          name: form.name,
          quantity_value: form.quantityValue,
          quantity_unit: form.quantityUnit,
        }) || "—",
    },
    { label: "SKU", value: form.sku || "—" },
    { label: "Category", value: cat?.name || "—" },
    { label: "Container / form", value: measure?.name || "—" },
    {
      label: "Quantity",
      value: formatQuantity(form.quantityValue, form.quantityUnit) || "—",
    },
    { label: "Cost", value: fmt(form.costPrice) },
    { label: "Sell price", value: fmt(form.sellPrice) },
    { label: "Sellable", value: form.isSellable ? "Yes" : "No" },
  ];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-lg font-bold text-slate-900 mb-1">
          {mode === "add" ? "Add this product?" : "Save changes?"}
        </div>
        <div className="text-sm text-slate-500 mb-4">
          {mode === "add"
            ? "Please review the details before adding."
            : `You're about to update "${form.name}".`}
        </div>

        <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 mb-5 overflow-hidden">
          {rows.map((r) => (
            <div
              key={r.label}
              className="flex items-center justify-between px-4 py-2.5 text-sm"
            >
              <span className="text-slate-500">{r.label}</span>
              <span className="font-semibold text-slate-900 text-right ml-4 truncate max-w-[60%]">
                {r.value}
              </span>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Go back
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50 transition"
          >
            {loading
              ? "Saving…"
              : mode === "add"
              ? "Confirm & add"
              : "Confirm & save"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Modal Shell
───────────────────────────────────────────── */
function Modal({
  title,
  sub,
  icon,
  iconBg,
  iconColor,
  onClose,
  children,
}: {
  title: string;
  sub?: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="grid h-10 w-10 place-items-center rounded-xl text-lg"
              style={{ background: iconBg, color: iconColor }}
            >
              {icon}
            </div>
            <div>
              <div className="text-base font-bold text-slate-900">{title}</div>
              {sub && (
                <div className="text-xs text-slate-500 mt-0.5">{sub}</div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <IconX />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Product Form
───────────────────────────────────────────── */
function ProductForm({
  form,
  setForm,
  measures,
  categories,
  suppliers,
  orgId,
  onCategoryCreated,
  onSubmit,
  onCancel,
  saving,
  mode,
}: {
  form: FormData;
  setForm: React.Dispatch<React.SetStateAction<FormData>>;
  measures: MeasureLookup[];
  categories: CategoryLookup[];
  suppliers: SupplierLookup[];
  orgId: string;
  onCategoryCreated: (id: string, name: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  saving: boolean;
  mode: "add" | "edit";
}) {
  const [touched, setTouched] = useState<
    Partial<Record<keyof FormData, boolean>>
  >({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const errors = validateForm(form);
  const hasErrors = Object.keys(errors).length > 0;

  const set =
    (k: keyof FormData) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >
    ) => {
      const value = e.target.value;
      setForm((prev) => ({ ...prev, [k]: value as never }));
      setTouched((t) => ({ ...t, [k]: true }));
    };

  const touch = (k: keyof FormData) =>
    setTouched((t) => ({ ...t, [k]: true }));

  const showErr = (k: keyof FormData) =>
    errors[k] && (touched[k] || submitAttempted) ? errors[k] : undefined;

  const marginPct = margin(form.costPrice, form.sellPrice);
  const allowedUnits = useMemo(
    () => getAllowedQuantityUnits(form.unitMeasureId, measures),
    [form.unitMeasureId, measures]
  );

  useEffect(() => {
    if (!allowedUnits.length) return;
    if (!form.quantityUnit || !allowedUnits.includes(form.quantityUnit as QuantityUnit)) {
      setForm((prev) => ({
        ...prev,
        quantityUnit: allowedUnits[0],
      }));
    }
  }, [allowedUnits, form.quantityUnit, setForm]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitAttempted(true);
    if (hasErrors) return;
    onSubmit(e);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {submitAttempted && hasErrors && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
          <span className="shrink-0 mt-0.5">⚠️</span>
          <span>Please fix the highlighted fields before continuing.</span>
        </div>
      )}

      <FormSection title="Identity">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label required>Product name</Label>
            <input
              className={`${S.inputCls} ${
                showErr("name")
                  ? "border-red-400 focus:border-red-400 focus:ring-red-100"
                  : ""
              }`}
              placeholder="e.g. Granola or Raw Honey"
              value={form.name}
              onChange={set("name")}
              onBlur={() => touch("name")}
            />
            <FieldError message={showErr("name")} />
          </div>
          <div>
            <Label>SKU</Label>
            <input
              className={S.inputCls}
              placeholder="e.g. GRA-200"
              value={form.sku}
              onChange={set("sku")}
            />
          </div>
        </div>
        <div>
          <Label>Barcode</Label>
          <input
            className={`${S.inputCls} font-mono`}
            placeholder="EAN / UPC (optional)"
            value={form.barcode}
            onChange={set("barcode")}
          />
        </div>
      </FormSection>

      <FormSection title="Classification">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label required>Category</Label>
            <select
              className={`${S.selectCls} ${
                showErr("categoryId")
                  ? "border-red-400 focus:border-red-400 focus:ring-red-100"
                  : ""
              }`}
              value={form.categoryId}
              onChange={set("categoryId")}
              onBlur={() => touch("categoryId")}
              style={S.selectChevronStyle}
            >
              <option value="">— Select category —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <FieldError message={showErr("categoryId")} />
            <InlineCategoryCreator orgId={orgId} onCreated={onCategoryCreated} />
          </div>

          <div>
            <Label>Supplier</Label>
            <select
              className={S.selectCls}
              style={S.selectChevronStyle}
              value={form.supplierId}
              onChange={set("supplierId")}
            >
              <option value="">— Select supplier —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </FormSection>

      <FormSection title="Product structure">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label required>Container / form</Label>
            <select
              className={`${S.selectCls} ${
                showErr("unitMeasureId")
                  ? "border-red-400 focus:border-red-400 focus:ring-red-100"
                  : ""
              }`}
              style={S.selectChevronStyle}
              value={form.unitMeasureId}
              onChange={set("unitMeasureId")}
              onBlur={() => touch("unitMeasureId")}
            >
              <option value="">— Select form —</option>
              {measures.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <FieldError message={showErr("unitMeasureId")} />
          </div>

          <div>
            <Label required>Quantity</Label>
            <input
              className={`${S.inputCls} ${
                showErr("quantityValue")
                  ? "border-red-400 focus:border-red-400 focus:ring-red-100"
                  : ""
              }`}
              type="number"
              min="0"
              step="0.001"
              placeholder="e.g. 200"
              value={form.quantityValue}
              onChange={set("quantityValue")}
              onBlur={() => touch("quantityValue")}
            />
            <FieldError message={showErr("quantityValue")} />
          </div>

          <div>
            <Label required>Unit</Label>
            <select
              className={`${S.selectCls} ${
                showErr("quantityUnit")
                  ? "border-red-400 focus:border-red-400 focus:ring-red-100"
                  : ""
              }`}
              style={S.selectChevronStyle}
              value={form.quantityUnit}
              onChange={set("quantityUnit")}
              onBlur={() => touch("quantityUnit")}
              disabled={!allowedUnits.length}
            >
              {!allowedUnits.length ? (
                <option value="">Select form first</option>
              ) : (
                <>
                  <option value="">— Select unit —</option>
                  {allowedUnits.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </>
              )}
            </select>
            <FieldError message={showErr("quantityUnit")} />
          </div>
        </div>

        <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700">
            Preview
          </div>
          <div className="mt-1 text-slate-900 font-semibold">
            {formatProductDisplayName({
              name: form.name,
              quantity_value: form.quantityValue,
              quantity_unit: form.quantityUnit,
            })}
          </div>
        </div>
      </FormSection>

      <FormSection title="Pricing">
        <div>
          <Label>Sellable</Label>
          <select
            className={S.selectCls}
            style={S.selectChevronStyle}
            value={form.isSellable ? "yes" : "no"}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                isSellable: e.target.value === "yes",
              }))
            }
          >
            <option value="yes">Yes — available for sale</option>
            <option value="no">No — internal use only</option>
          </select>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>Cost price (Ksh)</Label>
            <input
              className={S.inputCls}
              type="number"
              min="0"
              step="0.01"
              value={form.costPrice}
              onChange={set("costPrice")}
            />
          </div>

          <div>
            <Label required={form.isSellable}>Sell price (Ksh)</Label>
            <input
              className={`${S.inputCls} ${
                showErr("sellPrice")
                  ? "border-red-400 focus:border-red-400 focus:ring-red-100"
                  : ""
              }`}
              type="number"
              min="0"
              step="0.01"
              value={form.sellPrice}
              onChange={set("sellPrice")}
              onBlur={() => touch("sellPrice")}
            />
            <FieldError message={showErr("sellPrice")} />
          </div>

          <div>
            <Label>Margin</Label>
            <div className="flex h-[42px] items-center rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-base font-bold">
              {marginPct !== null ? (
                <span
                  className={
                    marginPct >= 30
                      ? "text-green-600"
                      : marginPct >= 10
                      ? "text-amber-600"
                      : "text-red-600"
                  }
                >
                  {marginPct.toFixed(1)}%
                </span>
              ) : (
                <span className="text-slate-300 text-sm">—</span>
              )}
            </div>
          </div>
        </div>
      </FormSection>

      <FormSection title="Notes">
        <textarea
          rows={3}
          className={`${S.inputCls} resize-none`}
          placeholder="Batch details, storage info, allergens…"
          value={form.notes}
          onChange={set("notes")}
        />
      </FormSection>

      <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
        <button type="button" onClick={onCancel} className={S.btnGhost}>
          Cancel
        </button>
        <button type="submit" disabled={saving} className={S.btnPrimary}>
          {saving
            ? "Saving…"
            : mode === "add"
            ? "Review & add"
            : "Review & save"}
        </button>
      </div>
    </form>
  );
}

/* ─────────────────────────────────────────────
   Pagination
───────────────────────────────────────────── */
function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPage,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  const pages: (number | "…")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("…");
    for (
      let i = Math.max(2, page - 1);
      i <= Math.min(totalPages - 1, page + 1);
      i++
    ) {
      pages.push(i);
    }
    if (page < totalPages - 2) pages.push("…");
    pages.push(totalPages);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-[#F1E6C9] bg-[#FFFDF8] px-6 py-4">
      <span className="text-xs text-slate-500">
        Showing {start}–{end} of {totalItems} product
        {totalItems !== 1 ? "s" : ""}
      </span>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page === 1}
          className="grid h-9 w-9 place-items-center rounded-xl border border-[#EADFC2] bg-white text-slate-500 hover:bg-[#FFF8E6] disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <IconChevronLeft />
        </button>

        {pages.map((p, i) =>
          p === "…" ? (
            <span
              key={`ellipsis-${i}`}
              className="w-8 text-center text-slate-400 text-sm"
            >
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p as number)}
              className={`h-9 min-w-[36px] px-2 rounded-xl text-sm font-semibold transition ${
                p === page
                  ? "bg-amber-500 text-white border border-amber-500 shadow-[0_10px_24px_rgba(245,197,24,0.28)]"
                  : "border border-[#EADFC2] bg-white text-slate-700 hover:bg-[#FFF8E6]"
              }`}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => onPage(page + 1)}
          disabled={page === totalPages}
          className="grid h-9 w-9 place-items-center rounded-xl border border-[#EADFC2] bg-white text-slate-500 hover:bg-[#FFF8E6] disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <IconChevronRight />
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main Page
───────────────────────────────────────────── */
export default function ProductsPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [items, setItems] = useState<Product[]>([]);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const [measures, setMeasures] = useState<MeasureLookup[]>([]);
  const [categories, setCategories] = useState<CategoryLookup[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierLookup[]>([]);

  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [filterStatus, setFilterStatus] = useState<
    "" | "sellable" | "not_sellable"
  >("");
  const [showArchived, setShowArchived] = useState(false);
  const [page, setPage] = useState(1);

  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);

  const [addForm, setAddForm] = useState<FormData>({ ...BLANK_FORM });
  const [editForm, setEditForm] = useState<FormData>({ ...BLANK_FORM });

  const [pendingAddConfirm, setPendingAddConfirm] = useState(false);
  const [pendingEditConfirm, setPendingEditConfirm] = useState(false);

  async function refresh(o: string) {
    setItems(await listProducts(o, !showArchived));
  }

  useEffect(() => {
    (async () => {
      try {
        const o = await bootstrapOrg();
        setOrgId(o);

        const [uoms, cats, sups] = await Promise.all([
          listUnitMeasures(o),
          listCategories(o),
          listSuppliers(o),
        ]);

        const typedMeasures = uoms as MeasureLookup[];
        setMeasures(typedMeasures);
        setCategories(cats as CategoryLookup[]);
        setSuppliers(sups as SupplierLookup[]);

        const firstId = typedMeasures?.[0]?.id ?? "";
        const firstAllowedUnit = getAllowedQuantityUnits(firstId, typedMeasures)[0] ?? "";

        setAddForm((f) => ({
          ...f,
          unitMeasureId: firstId,
          quantityUnit: firstAllowedUnit,
        }));

        await refresh(o);
      } catch (e: any) {
        setErr(e.message ?? String(e));
      }
    })();
  }, [showArchived]);

  useEffect(() => {
    setPage(1);
  }, [search, filterCat, filterStatus, showArchived]);

  const allCategories = useMemo(() => {
    return categories
      .map((c) => c.name)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }, [categories]);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();

    return items.filter((p) => {
      const displayName = formatProductDisplayName(p).toLowerCase();
      const catName = getCategoryName(p).toLowerCase();
      const sku = (p.sku ?? "").toLowerCase();
      const supplierName = (p.supplier?.name ?? "").toLowerCase();
      const qty = formatQuantity(p.quantity_value, p.quantity_unit).toLowerCase();

      const matchText =
        !t ||
        displayName.includes(t) ||
        qty.includes(t) ||
        sku.includes(t) ||
        (p.barcode ?? "").toLowerCase().includes(t) ||
        supplierName.includes(t) ||
        catName.includes(t);

      const matchCat = !filterCat || getCategoryName(p) === filterCat;
      const matchStatus =
        !filterStatus ||
        (filterStatus === "sellable" && p.is_sellable !== false) ||
        (filterStatus === "not_sellable" && p.is_sellable === false);

      return matchText && matchCat && matchStatus;
    });
  }, [items, search, filterCat, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const kpis = useMemo(() => {
    const total = items.length;
    const activeSellable = items.filter((p) => p.is_sellable !== false).length;
    const archived = items.filter((p) => p.active === false).length;
    const margins = items
      .map((p) => margin(p.cost_price, p.unit_price))
      .filter((m) => m !== null) as number[];
    const avgMargin = margins.length
      ? margins.reduce((a, b) => a + b, 0) / margins.length
      : 0;
    const categoriesCount = new Set(
      items.map((p) => getCategoryName(p)).filter(Boolean)
    ).size;

    return {
      total,
      activeSellable,
      archived,
      avgMargin,
      categories: categoriesCount,
    };
  }, [items]);

  function handleAddCategoryCreated(id: string, name: string) {
    setCategories((prev) =>
      [...prev, { id, name }].sort((a, b) => a.name.localeCompare(b.name))
    );
    setAddForm((f) => ({ ...f, categoryId: id }));
    setToast({ message: `Category "${name}" created`, type: "success" });
  }

  function handleEditCategoryCreated(id: string, name: string) {
    setCategories((prev) =>
      [...prev, { id, name }].sort((a, b) => a.name.localeCompare(b.name))
    );
    setEditForm((f) => ({ ...f, categoryId: id }));
    setToast({ message: `Category "${name}" created`, type: "success" });
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const errors = validateForm(addForm);
    if (Object.keys(errors).length > 0) return;
    setPendingAddConfirm(true);
  }

  async function performAdd() {
    if (!orgId) return;
    setSaving(true);
    setErr("");

    try {
      const productDisplay = formatProductDisplayName({
        name: addForm.name.trim(),
        quantity_value: addForm.quantityValue,
        quantity_unit: addForm.quantityUnit,
      });

      await createProduct(orgId, {
        name: addForm.name.trim(),
        sku: addForm.sku.trim() || undefined,
        category_id: addForm.categoryId || null,
        barcode: addForm.barcode.trim() || undefined,
        supplier_id: addForm.supplierId || null,
        notes: addForm.notes.trim() || undefined,
        cost_price: Number(addForm.costPrice || 0),
        unit_price: Number(addForm.sellPrice || 0),
        quantity_value: Number(addForm.quantityValue),
        quantity_unit: addForm.quantityUnit || null,
        unit_measure_id: addForm.unitMeasureId || null,
        is_sellable: addForm.isSellable,
      });

      const allowedUnits = getAllowedQuantityUnits(addForm.unitMeasureId, measures);

      setAddForm({
        ...BLANK_FORM,
        unitMeasureId: addForm.unitMeasureId,
        quantityUnit: allowedUnits[0] ?? "",
      });
      setShowAddModal(false);
      setPendingAddConfirm(false);
      await refresh(orgId);

      setToast({
        message: `"${productDisplay}" added successfully`,
        type: "success",
      });
    } catch (e: any) {
      setErr(e.message ?? String(e));
      setToast({ message: "Failed to add product", type: "error" });
      setPendingAddConfirm(false);
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    const errors = validateForm(editForm);
    if (Object.keys(errors).length > 0) return;
    setPendingEditConfirm(true);
  }

  async function performEdit() {
    if (!orgId || !editProduct) return;
    setSaving(true);
    setErr("");

    try {
      const updatedDisplay = formatProductDisplayName({
        name: editForm.name.trim(),
        quantity_value: editForm.quantityValue,
        quantity_unit: editForm.quantityUnit,
      });

      const supabase = createClient();

      const { error } = await supabase
        .from("products")
        .update({
          name: editForm.name.trim(),
          sku: editForm.sku.trim() || null,
          category_id: editForm.categoryId || null,
          barcode: editForm.barcode.trim() || null,
          supplier_id: editForm.supplierId || null,
          notes: editForm.notes.trim() || null,
          cost_price: Number(editForm.costPrice || 0),
          unit_price: Number(editForm.sellPrice || 0),
          quantity_value: Number(editForm.quantityValue),
          quantity_unit: editForm.quantityUnit || null,
          unit_measure_id: editForm.unitMeasureId || null,
          is_sellable: editForm.isSellable,
        })
        .eq("org_id", orgId)
        .eq("id", editProduct.id);

      if (error) throw new Error(error.message);

      setEditProduct(null);
      setPendingEditConfirm(false);
      await refresh(orgId);

      setToast({ message: `"${updatedDisplay}" updated`, type: "success" });
    } catch (e: any) {
      setErr(e.message ?? String(e));
      setToast({ message: "Failed to update product", type: "error" });
      setPendingEditConfirm(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (!orgId || !deletingProduct?.id) return;
    setDeleting(true);

    try {
      const productName = formatProductDisplayName(deletingProduct);
      await archiveProduct(orgId, deletingProduct.id);
      await refresh(orgId);

      setToast({
        message: productName ? `"${productName}" archived` : "Product archived",
        type: "success",
      });
    } catch (e: any) {
      setErr(e.message ?? String(e));
      setToast({ message: "Failed to archive", type: "error" });
    } finally {
      setDeleting(false);
      setDeletingProduct(null);
    }
  }

  async function handleRestore(id: string, product?: Product) {
    if (!orgId) return;

    try {
      await restoreProduct(orgId, id);
      await refresh(orgId);
      setToast({
        message: product
          ? `"${formatProductDisplayName(product)}" restored`
          : "Product restored",
        type: "success",
      });
    } catch (e: any) {
      setErr(e.message ?? String(e));
      setToast({ message: "Failed to restore", type: "error" });
    }
  }

  function openEdit(p: Product) {
    const allowedUnits = getAllowedQuantityUnits(
      p.unit_measure_id ?? measures[0]?.id ?? "",
      measures
    );

    setEditForm({
      name: p.name ?? "",
      sku: p.sku ?? "",
      categoryId: p.category_id ?? p.category?.id ?? "",
      barcode: p.barcode ?? "",
      supplierId: p.supplier_id ?? p.supplier?.id ?? "",
      notes: p.notes ?? "",
      costPrice: String(p.cost_price ?? "0"),
      sellPrice: String(p.unit_price ?? "0"),
      quantityValue:
        p.quantity_value !== null && p.quantity_value !== undefined
          ? String(p.quantity_value)
          : "",
      quantityUnit:
        (p.quantity_unit as QuantityUnit | null) ??
        allowedUnits[0] ??
        "",
      unitMeasureId: p.unit_measure_id ?? measures[0]?.id ?? "",
      isSellable: p.is_sellable ?? true,
    });
    setEditProduct(p);
  }

  function clearFilters() {
    setSearch("");
    setFilterCat("");
    setFilterStatus("");
  }

  const hasFilters = !!(search || filterCat || filterStatus);

  const TABLE_COLS = S.tableGridCols;
  const HEADERS = [
    "Product",
    "Category",
    "Supplier",
    "Barcode",
    "Cost",
    "Sell",
    "Margin",
    "Status",
    "",
  ];

  if (!orgId && !err) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400 text-sm">
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
          Loading catalog…
        </div>
      </div>
    );
  }

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
          <span className="shrink-0 mt-0.5">⚠️</span>
          <span className="flex-1">{err}</span>
          <button
            onClick={() => setErr("")}
            className="shrink-0 text-red-400 hover:text-red-600 text-lg leading-none"
          >
            ×
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700">
            Catalog
          </div>
          <h1 className="mt-3 text-[32px] font-bold text-slate-900 tracking-tight">
            Product Catalog
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage products, sizes, pricing and availability
          </p>
        </div>

        <button
          className={`${S.btnPrimary} shadow-[0_12px_28px_rgba(245,197,24,0.25)]`}
          onClick={() => setShowAddModal(true)}
        >
          <IconPlus />
          Add product
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard
          icon="📦"
          label="Total products"
          value={String(kpis.total)}
          sub={showArchived ? "active + archived" : "active only"}
        />
        <KpiCard
          icon="✅"
          label="For sale"
          value={String(kpis.activeSellable)}
          sub="active listings"
          variant="success"
        />
        <KpiCard
          icon="🗄️"
          label="Archived"
          value={String(kpis.archived)}
          sub="hidden from sales"
          variant="warning"
        />
        <KpiCard
          icon="🏷️"
          label="Categories"
          value={String(kpis.categories)}
          sub="product groups"
          variant="info"
        />
        <KpiCard
          icon="📈"
          label="Avg margin"
          value={`${kpis.avgMargin.toFixed(0)}%`}
          sub="gross margin"
          variant={
            kpis.avgMargin >= 30
              ? "success"
              : kpis.avgMargin >= 10
              ? "warning"
              : "neutral"
          }
        />
      </div>

      <div className="rounded-[24px] border border-[#EADFC2] bg-white shadow-[0_12px_36px_rgba(245,197,24,0.06)] overflow-hidden">
        <div className="border-b border-[#F1E6C9] bg-[linear-gradient(180deg,#FFFDF8_0%,#FFF9EC_100%)] px-5 py-4 lg:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative flex-1 min-w-[220px] max-w-sm">
              <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <IconSearch />
              </div>
              <input
                className="w-full rounded-2xl border border-[#EADFC2] bg-white pl-10 pr-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-100 outline-none transition"
                placeholder="Search products…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <IconX />
                </button>
              )}
            </label>

            <select
              className="rounded-2xl border border-[#EADFC2] bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-100 outline-none transition cursor-pointer"
              style={S.selectChevronStyle}
              value={filterCat}
              onChange={(e) => setFilterCat(e.target.value)}
            >
              <option value="">All categories</option>
              {allCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              className="rounded-2xl border border-[#EADFC2] bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-100 outline-none transition cursor-pointer"
              style={S.selectChevronStyle}
              value={filterStatus}
              onChange={(e) =>
                setFilterStatus(
                  e.target.value as "" | "sellable" | "not_sellable"
                )
              }
            >
              <option value="">All statuses</option>
              <option value="sellable">For sale</option>
              <option value="not_sellable">Not for sale</option>
            </select>

            {hasFilters && (
              <button
                onClick={clearFilters}
                className="text-sm font-semibold text-amber-600 hover:text-amber-700 transition px-1"
              >
                Clear
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowArchived((v) => !v)}
              className={`rounded-2xl border px-3.5 py-2.5 text-sm font-semibold transition ${
                showArchived
                  ? "border-amber-300 bg-amber-50 text-amber-700 shadow-[0_8px_20px_rgba(245,197,24,0.12)]"
                  : "border-[#EADFC2] bg-white text-slate-700 hover:bg-[#FFF8E6]"
              }`}
            >
              {showArchived ? "Showing archived too" : "Show archived"}
            </button>

            <span className="ml-auto text-xs text-slate-500 whitespace-nowrap">
              {filtered.length} of {items.length}
            </span>
          </div>
        </div>

        <div className="px-3 py-3 sm:px-4 sm:py-4">
          <div className="hidden lg:block">
            <div
              className="grid items-center gap-4 px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500"
              style={{ gridTemplateColumns: TABLE_COLS }}
            >
              {HEADERS.map((h, i) => (
                <div key={i} className={i >= 4 && i <= 6 ? "text-right" : ""}>
                  {h}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {paginated.length === 0 ? (
              <div className="py-20 text-center">
                <div className="text-5xl mb-4">🍯</div>
                <p className="text-lg font-semibold text-slate-700">
                  {items.length === 0 ? "No products yet" : "No matching products"}
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  {items.length === 0
                    ? 'Click "Add product" to get started'
                    : "Try adjusting your filters"}
                </p>
              </div>
            ) : (
              paginated.map((p) => {
                const mgn = margin(p.cost_price, p.unit_price);
                const categoryName = getCategoryName(p);
                const displayName = formatProductDisplayName(p);

                return (
                  <div
                    key={p.id}
                    className="group rounded-[24px] border border-[#EFE4C6] bg-[linear-gradient(180deg,#FFFFFF_0%,#FFFCF4_100%)] shadow-[0_8px_30px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[0_16px_34px_rgba(245,197,24,0.10)] hover:border-[#E5D28D]"
                  >
                    <div
                      className="hidden lg:grid items-center gap-4 px-6 py-5 text-sm"
                      style={{ gridTemplateColumns: TABLE_COLS }}
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="font-semibold text-slate-900 truncate text-[15px]">
                          {displayName}
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          {p.unit_measure?.name || "—"}
                        </div>
                        {p.sku && (
                          <div className="text-[11px] font-mono text-slate-400 truncate">
                            SKU {p.sku}
                          </div>
                        )}
                      </div>

                      <div className="truncate text-sm text-slate-700">
                        {categoryName || <span className="text-slate-300">—</span>}
                      </div>

                      <div className="truncate text-sm text-slate-700">
                        {p.supplier?.name || (
                          <span className="text-slate-300">—</span>
                        )}
                      </div>

                      <div className="truncate font-mono text-xs text-slate-500">
                        {p.barcode || p.sku || (
                          <span className="text-slate-300">—</span>
                        )}
                      </div>

                      <div className="text-right text-slate-700 font-medium">
                        {fmt(p.cost_price)}
                      </div>

                      <div className="text-right font-bold text-slate-900">
                        {fmt(p.unit_price)}
                      </div>

                      <div className="text-right">
                        <MarginBadge pct={mgn} />
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <SellBadge isSellable={p.is_sellable} />
                        <ArchiveBadge active={p.active} />
                      </div>

                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(p)}
                          className="grid h-9 w-9 place-items-center rounded-xl border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 transition opacity-0 group-hover:opacity-100"
                          title="Edit"
                        >
                          <IconEdit />
                        </button>

                        {p.active === false ? (
                          <button
                            onClick={() => handleRestore(p.id, p)}
                            className="rounded-xl border border-green-200 bg-green-50 px-3.5 h-9 text-xs font-semibold text-green-700 hover:bg-green-100 transition opacity-0 group-hover:opacity-100"
                          >
                            Restore
                          </button>
                        ) : (
                          <button
                            onClick={() => setDeletingProduct(p)}
                            className="grid h-9 w-9 place-items-center rounded-xl border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 transition opacity-0 group-hover:opacity-100"
                            title="Archive"
                          >
                            <IconTrash />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="lg:hidden px-5 py-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 truncate">
                            {displayName}
                          </div>
                          {categoryName && (
                            <div className="mt-0.5 text-xs text-slate-500">
                              {categoryName}
                            </div>
                          )}
                          {(p.unit_measure?.name || p.sku) && (
                            <div className="text-xs text-slate-400 mt-1">
                              {p.unit_measure?.name || p.sku}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          <SellBadge isSellable={p.is_sellable} />
                          <ArchiveBadge active={p.active} />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3 rounded-2xl bg-[#FFF9EC] border border-[#F1E6C9] p-3 text-sm">
                        <div>
                          <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">
                            Cost
                          </div>
                          <div className="font-medium text-slate-800 mt-0.5">
                            {fmt(p.cost_price)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">
                            Sell
                          </div>
                          <div className="font-bold text-slate-900 mt-0.5">
                            {fmt(p.unit_price)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">
                            Margin
                          </div>
                          <div className="mt-0.5">
                            <MarginBadge pct={mgn} />
                          </div>
                        </div>
                      </div>

                      {(p.supplier?.name || p.barcode || p.sku) && (
                        <div className="text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-0.5">
                          {p.supplier?.name && (
                            <span>Supplier: {p.supplier.name}</span>
                          )}
                          {p.sku && <span className="font-mono">SKU: {p.sku}</span>}
                          {p.barcode && (
                            <span className="font-mono">Barcode: {p.barcode}</span>
                          )}
                        </div>
                      )}

                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => openEdit(p)}
                          className="flex-1 flex items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 py-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition"
                        >
                          <IconEdit /> Edit
                        </button>

                        {p.active === false ? (
                          <button
                            onClick={() => handleRestore(p.id, p)}
                            className="flex-1 flex items-center justify-center gap-2 rounded-2xl border border-green-200 bg-green-50 py-2.5 text-xs font-semibold text-green-700 hover:bg-green-100 transition"
                          >
                            Restore
                          </button>
                        ) : (
                          <button
                            onClick={() => setDeletingProduct(p)}
                            className="flex-1 flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition"
                          >
                            <IconTrash /> Archive
                          </button>
                        )}
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
          totalItems={filtered.length}
          pageSize={PAGE_SIZE}
          onPage={setPage}
        />
      </div>

      {showAddModal && orgId && (
        <Modal
          title="Add product"
          sub="Fill in the details below"
          icon={<IconPlus />}
          iconBg="#fef3c7"
          iconColor="#92400e"
          onClose={() => setShowAddModal(false)}
        >
          <ProductForm
            form={addForm}
            setForm={setAddForm}
            measures={measures}
            categories={categories}
            suppliers={suppliers}
            orgId={orgId}
            onCategoryCreated={handleAddCategoryCreated}
            onSubmit={handleAdd}
            onCancel={() => setShowAddModal(false)}
            saving={saving}
            mode="add"
          />
        </Modal>
      )}

      {editProduct && orgId && (
        <Modal
          title="Edit product"
          sub={formatProductDisplayName(editProduct)}
          icon={<IconEdit />}
          iconBg="#dbeafe"
          iconColor="#1e40af"
          onClose={() => setEditProduct(null)}
        >
          <ProductForm
            form={editForm}
            setForm={setEditForm}
            measures={measures}
            categories={categories}
            suppliers={suppliers}
            orgId={orgId}
            onCategoryCreated={handleEditCategoryCreated}
            onSubmit={handleEdit}
            onCancel={() => setEditProduct(null)}
            saving={saving}
            mode="edit"
          />
        </Modal>
      )}

      {deletingProduct && (
        <ArchiveModal
          product={deletingProduct}
          onConfirm={handleArchive}
          onCancel={() => setDeletingProduct(null)}
          loading={deleting}
        />
      )}

      <ConfirmSaveModal
        open={pendingAddConfirm}
        mode="add"
        form={addForm}
        categories={categories}
        measures={measures}
        loading={saving}
        onConfirm={performAdd}
        onCancel={() => setPendingAddConfirm(false)}
      />

      <ConfirmSaveModal
        open={pendingEditConfirm}
        mode="edit"
        form={editForm}
        categories={categories}
        measures={measures}
        loading={saving}
        onConfirm={performEdit}
        onCancel={() => setPendingEditConfirm(false)}
      />
    </div>
  );
}