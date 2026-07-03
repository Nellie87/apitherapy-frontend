"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import {
  listProducts,
  createProduct,
  archiveProduct,
  restoreProduct,
  type ProductRow,
  type QuantityUnit,
  type ProductUnitSaleType,
} from "@/lib/api/products";
import {
  saveProductUnits,
  type SaveProductUnitPayload,
} from "@/lib/api/productUnits";
import {
  listUnitMeasures,
  listUnitSizes,
  listCategories,
  createCategory,
  listSuppliers,
  createUnitSize,
} from "@/lib/api/lookups";
import { createClient } from "@/lib/supabase/client";
import * as S from "./page.styles";

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */
type UnitKind = "mass" | "volume" | "count";

type MeasureLookup = {
  id: string;
  name: string;
  allowed_kinds: UnitKind[];
};

type UnitSizeLookup = {
  id: string;
  label: string;
  kind: UnitKind;
  grams?: number | null;
  ml?: number | null;
  count?: number | null;
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
  active?: boolean | null;
};

type Product = ProductRow;

type ProductUnitForm = {
  id?: string;
  label: string;
  unitMeasureId: string;
  unitSizeId: string;
  contains: string;
  costPrice: string;
  sellingPrice: string;
  barcode: string;
  canSell: boolean;
  canRestock: boolean;
  isDefault: boolean;
  saleType: ProductUnitSaleType;
  active?: boolean;
};

type FormData = {
  name: string;
  sku: string;
  categoryId: string;
  barcode: string;
  supplierId: string;
  notes: string;
  isSellable: boolean;
  productUnits: ProductUnitForm[];
};

type FormErrors = Partial<Record<keyof FormData, string>>;

/* ─────────────────────────────────────────────
   Constants
───────────────────────────────────────────── */
const BLANK_PRODUCT_UNIT: ProductUnitForm = {
  label: "",
  unitMeasureId: "",
  unitSizeId: "",
  contains: "1",
  costPrice: "",
  sellingPrice: "",
  barcode: "",
  canSell: true,
  canRestock: true,
  isDefault: true,
  saleType: "retail",
  active: true,
};

const BLANK_FORM: FormData = {
  name: "",
  sku: "",
  categoryId: "",
  barcode: "",
  supplierId: "",
  notes: "",
  isSellable: true,
  productUnits: [{ ...BLANK_PRODUCT_UNIT }],
};

const PAGE_SIZE = 5;

const SALE_TYPE_LABELS: Record<ProductUnitSaleType, string> = {
  retail: "Retail / single unit",
  wholesale: "Wholesale / package",
  stock_only: "Stock only",
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
  sell: number | string | null | undefined,
) {
  const c = Number(cost || 0);
  const s = Number(sell || 0);
  if (c <= 0 || s <= 0) return null;
  return ((s - c) / s) * 100;
}

function getCategoryName(p: Product) {
  return p.category?.name ?? "";
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

function sanitizeQuantityInput(value: string) {
  const cleaned = value.replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 1) return cleaned;
  return `${parts[0]}.${parts.slice(1).join("")}`;
}

function normalizeSaleType(value: unknown): ProductUnitSaleType {
  if (value === "retail" || value === "wholesale" || value === "stock_only") {
    return value;
  }
  return "retail";
}

function pluralize(value: string) {
  const clean = value.trim();
  if (!clean) return "base units";
  if (clean.endsWith("s")) return clean;
  return `${clean}s`;
}

function validateForm(form: FormData): FormErrors {
  const errors: FormErrors = {};

  if (!form.name.trim()) errors.name = "Product name is required";
  if (!form.categoryId) errors.categoryId = "Category is required";

  const usableUnits = form.productUnits.filter((u) => u.active !== false);
  if (usableUnits.length === 0) {
    errors.productUnits = "Add at least one stock or selling unit";
  }

  const hasInvalidUnit = usableUnits.some((u, index) => {
    const cost = Number(u.costPrice || 0);
    const sell = Number(u.sellingPrice || 0);

    return (
      !u.unitMeasureId ||
      (index === 0 && !u.unitSizeId) ||
      !u.contains ||
      Number(u.contains) <= 0 ||
      cost <= 0 ||
      sell < 0 ||
      (u.canSell && u.saleType !== "stock_only" && sell <= 0)
    );
  });

  if (hasInvalidUnit) {
    errors.productUnits =
      "Each unit needs a form, quantity, buying cost, and selling price if it can be sold.";
  }

  return errors;
}

function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;

    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, [locked]);
}

/* ─────────────────────────────────────────────
   UI Helpers
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
      <span>{message}</span>
      <button
        onClick={onClose}
        className="ml-2 rounded-full px-2 py-0.5 text-xs text-white/75 hover:bg-white/10 hover:text-white"
      >
        Close
      </button>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  variant = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  variant?: "neutral" | "success" | "warning" | "info";
}) {
  const cfg = {
    neutral: { border: "#F1E4BF", val: "#2A2112", sub: "#9A7A18" },
    success: { border: "#CBE9D2", val: "#166534", sub: "#2C8F4B" },
    warning: { border: "#F4D98C", val: "#8B5A00", sub: "#C17A00" },
    info: { border: "#E7D8A7", val: "#7A6300", sub: "#A28300" },
  }[variant];

  return (
    <div
      className="rounded-[22px] p-4 bg-white transition hover:-translate-y-0.5"
      style={{
        border: `1.5px solid ${cfg.border}`,
        boxShadow: "0 10px 25px rgba(245,197,24,0.06)",
      }}
    >
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

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-500 font-medium">{message}</p>;
}

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
   Inline Creators
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

function InlineUnitSizeCreator({
  orgId,
  measure,
  onCreated,
}: {
  orgId: string;
  measure?: MeasureLookup;
  onCreated: (unitSize: UnitSizeLookup) => void;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<UnitKind>("count");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const allowedKinds = measure?.allowed_kinds?.length
    ? measure.allowed_kinds
    : (["count", "mass", "volume"] as UnitKind[]);

  useEffect(() => {
    if (open && !allowedKinds.includes(kind)) {
      setKind(allowedKinds[0] ?? "count");
    }
  }, [open, allowedKinds, kind]);

  async function handleCreate() {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      setError("Enter a number greater than zero.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const created = await createUnitSize(orgId, kind, numericValue);
      onCreated(created as UnitSizeLookup);
      setValue("");
      setOpen(false);
    } catch (e: any) {
      setError(e.message ?? "Failed to create size");
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
          className="text-xs font-semibold text-amber-600 hover:text-amber-700 transition"
        >
          Add custom size
        </button>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
          <div className="text-xs font-semibold text-amber-800">
            Custom base size
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
              value={kind}
              onChange={(e) => setKind(e.target.value as UnitKind)}
            >
              {allowedKinds.map((k) => (
                <option key={k} value={k}>
                  {k === "mass" ? "grams" : k === "volume" ? "ml" : "pcs"}
                </option>
              ))}
            </select>
            <input
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none"
              value={value}
              inputMode="decimal"
              placeholder={kind === "mass" ? "e.g. 250" : kind === "volume" ? "e.g. 750" : "e.g. 50"}
              onChange={(e) => setValue(sanitizeQuantityInput(e.target.value))}
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving || !value}
              className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50 transition"
            >
              {saving ? "Creating…" : "Create size"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setValue("");
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
   Modals
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
        <div className="mb-5">
          <div className="text-lg font-bold text-slate-900">
            Archive this product?
          </div>
          <div className="text-sm text-slate-500 mt-0.5">
            It will be hidden from sales and new orders, but kept in your records.
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 mb-5">
          <div className="text-sm font-semibold text-slate-900">
            {formatProductDisplayName(product)}
          </div>
          {(product.sku || product.barcode) && (
            <div className="mt-1 text-xs text-slate-500 font-mono">
              {product.sku ? `SKU: ${product.sku}` : `Barcode: ${product.barcode}`}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Keep active
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50 transition"
          >
            {loading ? "Archiving…" : "Archive"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Modal({
  title,
  sub,
  onClose,
  children,
}: {
  title: string;
  sub?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl rounded-2xl bg-white shadow-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 shrink-0">
          <div>
            <div className="text-base font-bold text-slate-900">{title}</div>
            {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
          >
            Close
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Product-unit helpers
───────────────────────────────────────────── */
function getUnitMeasureName(id: string, measures: MeasureLookup[]) {
  return measures.find((m) => m.id === id)?.name ?? "unit";
}

function getUnitSizeLabel(id: string, sizes: UnitSizeLookup[]) {
  return sizes.find((s) => s.id === id)?.label ?? "";
}

function makeProductUnitLabel(
  unit: ProductUnitForm,
  measures: MeasureLookup[],
  sizes: UnitSizeLookup[],
) {
  const typed = unit.label.trim();
  if (typed) return typed;

  const measure = getUnitMeasureName(unit.unitMeasureId, measures);
  const size = getUnitSizeLabel(unit.unitSizeId, sizes);

  if (unit.isDefault && measure && size) return `${measure} (${size})`;
  return measure || size || "Unit";
}

function getQuantityFromUnitSize(
  unitSizeId: string,
  sizes: UnitSizeLookup[],
): { value: number | null; unit: QuantityUnit | null } {
  const size = sizes.find((s) => s.id === unitSizeId);
  if (!size) return { value: null, unit: null };

  if (size.kind === "mass") return { value: Number(size.grams ?? 0), unit: "g" };
  if (size.kind === "volume") return { value: Number(size.ml ?? 0), unit: "ml" };
  if (size.kind === "count") return { value: Number(size.count ?? 0), unit: "pc" };

  return { value: null, unit: null };
}

function getBaseUnitText(form: FormData, measures: MeasureLookup[]) {
  const base = form.productUnits[0];
  if (!base) return "base units";
  return pluralize(getUnitMeasureName(base.unitMeasureId, measures));
}

function toProductUnitPayload(
  form: FormData,
  measures: MeasureLookup[],
  sizes: UnitSizeLookup[],
): SaveProductUnitPayload[] {
  return form.productUnits
    .filter((u) => u.active !== false)
    .map((u, index) => ({
      id: u.id,
      product_id: "",
      label: makeProductUnitLabel({ ...u, isDefault: index === 0 }, measures, sizes),
      base_quantity: index === 0 ? 1 : Number(u.contains || 1),
      cost_price: Number(u.costPrice || 0),
      selling_price: Number(u.sellingPrice || 0),
      can_sell: u.saleType === "stock_only" ? false : u.canSell,
      can_restock: u.canRestock,
      is_default: index === 0,
      active: true,
      sale_type: u.saleType,
      unit_measure_id: u.unitMeasureId || null,
      unit_size_id: index === 0 ? u.unitSizeId || null : null,
      barcode: u.barcode || null,
      sort_order: index,
    }));
}

function productUnitsFromProduct(product: Product): ProductUnitForm[] {
  const units = product.product_units?.length
    ? product.product_units
    : [
        {
          id: undefined,
          label: product.unit_size?.label || "Default unit",
          base_quantity: 1,
          cost_price: Number(product.cost_price ?? 0),
          selling_price: Number(product.unit_price ?? 0),
          can_sell: product.is_sellable !== false,
          can_restock: true,
          is_default: true,
          active: true,
          sale_type: "retail",
          unit_measure_id: product.unit_measure_id ?? null,
          unit_size_id: product.unit_size_id ?? null,
          barcode: product.barcode ?? null,
          sort_order: 0,
        } as any,
      ];

  return units
    .filter((u: any) => u.active !== false)
    .sort((a: any, b: any) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
    .map((u: any, index: number) => ({
      id: u.id,
      label: u.label ?? "",
      unitMeasureId: u.unit_measure_id ?? "",
      unitSizeId: index === 0 ? u.unit_size_id ?? "" : "",
      contains: String(index === 0 ? 1 : u.base_quantity ?? 1),
      costPrice: String(u.cost_price ?? ""),
      sellingPrice: String(u.selling_price ?? ""),
      barcode: u.barcode ?? "",
      canSell: u.can_sell !== false,
      canRestock: u.can_restock !== false,
      isDefault: index === 0 || Boolean(u.is_default),
      saleType: normalizeSaleType(u.sale_type),
      active: u.active !== false,
    }));
}

function SaleTypeBadge({ type }: { type: ProductUnitSaleType }) {
  const classes =
    type === "retail"
      ? "bg-blue-50 text-blue-700 border-blue-200"
      : type === "wholesale"
        ? "bg-purple-50 text-purple-700 border-purple-200"
        : "bg-slate-100 text-slate-600 border-slate-200";

  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${classes}`}>
      {SALE_TYPE_LABELS[type]}
    </span>
  );
}

function normalizeProductUnitSaleType(value: unknown): ProductUnitSaleType {
  return normalizeSaleType(value);
}

function getProductBaseUnit(product: Product) {
  const units = product.product_units ?? [];
  return units.find((unit: any) => unit.is_default) ?? units[0] ?? null;
}

function getProductRetailUnits(product: Product) {
  return (product.product_units ?? []).filter((unit: any) => {
    const saleType = normalizeProductUnitSaleType(unit.sale_type);
    return unit.active !== false && unit.can_sell !== false && saleType === "retail";
  });
}

function getProductWholesaleUnits(product: Product) {
  return (product.product_units ?? []).filter((unit: any) => {
    const saleType = normalizeProductUnitSaleType(unit.sale_type);
    return unit.active !== false && unit.can_sell !== false && saleType === "wholesale";
  });
}

function getProductStockOnlyUnits(product: Product) {
  return (product.product_units ?? []).filter((unit: any) => {
    const saleType = normalizeProductUnitSaleType(unit.sale_type);
    return unit.active !== false && saleType === "stock_only";
  });
}


function formatUnitPriceLine(unit: any | null) {
  if (!unit) return "—";
  const cost = Number(unit.cost_price ?? 0);
  const sell = Number(unit.selling_price ?? 0);
  return `${fmt(cost)} cost · ${fmt(sell)} sell`;
}

function getPrimaryRetailUnit(product: Product) {
  const baseUnit = getProductBaseUnit(product);
  const retailUnits = getProductRetailUnits(product);
  return retailUnits[0] ?? baseUnit ?? null;
}

function getPrimaryWholesaleUnit(product: Product) {
  return getProductWholesaleUnits(product)[0] ?? null;
}

function UnitPriceText({ unit }: { unit: any | null }) {
  if (!unit) return <span className="text-slate-300">—</span>;

  return (
    <span className="font-bold text-slate-900">
      {fmt(unit.selling_price)}
    </span>
  );
}

function CompactUnitsSummary({ product }: { product: Product }) {
  const baseUnit = getProductBaseUnit(product);
  const retailUnit = getPrimaryRetailUnit(product);
  const wholesaleUnit = getPrimaryWholesaleUnit(product);
  const baseLabel = baseUnit?.label ?? "base unit";

  return (
    <div className="min-w-0 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {retailUnit && (
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
            Retail: {retailUnit.label}
          </span>
        )}

        {wholesaleUnit && (
          <span className="inline-flex items-center rounded-full border border-purple-200 bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700">
            Package: {wholesaleUnit.label}
          </span>
        )}
      </div>

      <div className="truncate text-xs text-slate-500">
        {wholesaleUnit
          ? `${wholesaleUnit.label} = ${Number(wholesaleUnit.base_quantity ?? 1)} ${baseLabel}`
          : `Sold as separate ${baseLabel}`}
      </div>
    </div>
  );
}

function ProductUnitDetails({ product }: { product: Product }) {
  const baseUnit = getProductBaseUnit(product);
  const retailUnits = getProductRetailUnits(product);
  const wholesaleUnits = getProductWholesaleUnits(product);
  const stockOnlyUnits = getProductStockOnlyUnits(product);
  const baseLabel = baseUnit?.label ?? product.unit_measure?.name ?? "base units";
  const visibleRetailUnits = retailUnits.length ? retailUnits : baseUnit ? [baseUnit] : [];

  const rows = [
    ...visibleRetailUnits.map((unit: any) => ({
      key: unit.id ?? unit.label,
      type: "Retail",
      unit: unit.label,
      details: "Sold separately",
      cost: unit.cost_price,
      sell: unit.selling_price,
      tone: "text-slate-700",
    })),
    ...wholesaleUnits.map((unit: any) => ({
      key: unit.id ?? unit.label,
      type: "Wholesale",
      unit: unit.label,
      details: `Contains ${Number(unit.base_quantity ?? 1)} ${baseLabel}`,
      cost: unit.cost_price,
      sell: unit.selling_price,
      tone: "text-purple-700",
    })),
    ...stockOnlyUnits.map((unit: any) => ({
      key: unit.id ?? unit.label,
      type: "Stock only",
      unit: unit.label,
      details: `Contains ${Number(unit.base_quantity ?? 1)} ${baseLabel}`,
      cost: unit.cost_price,
      sell: unit.selling_price,
      tone: "text-slate-500",
    })),
  ];

  return (
    <div className="border-t border-[#F1E6C9] bg-[#FFFDF8] px-5 py-4 lg:px-6">
      <div className="rounded-2xl border border-[#EADFC2] bg-white overflow-hidden">
        <div className="grid grid-cols-4 gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
          <div>Unit</div>
          <div>Meaning</div>
          <div className="text-right">Cost</div>
          <div className="text-right">Sell</div>
        </div>

        {rows.length ? (
          rows.map((row) => (
            <div
              key={row.key}
              className="grid grid-cols-1 gap-2 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0 sm:grid-cols-4 sm:items-center sm:gap-3"
            >
              <div>
                <div className="font-bold text-slate-900">{row.unit}</div>
                <div className={`text-xs font-semibold ${row.tone}`}>{row.type}</div>
              </div>

              <div className="text-sm text-slate-500">{row.details}</div>

              <div className="font-semibold text-slate-700 sm:text-right">
                {fmt(row.cost)}
              </div>

              <div className="font-bold text-slate-900 sm:text-right">
                {fmt(row.sell)}
              </div>
            </div>
          ))
        ) : (
          <div className="px-4 py-5 text-sm text-slate-500">
            No product units have been set up yet.
          </div>
        )}
      </div>
    </div>
  );
}


function ConfirmSaveModal({
  open,
  mode,
  form,
  categories,
  measures,
  unitSizes,
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  mode: "add" | "edit";
  form: FormData;
  categories: CategoryLookup[];
  measures: MeasureLookup[];
  unitSizes: UnitSizeLookup[];
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  const cat = categories.find((c) => c.id === form.categoryId);
  const baseUnitText = getBaseUnitText(form, measures);
  const firstUnit = form.productUnits[0];
  const otherUnits = form.productUnits.slice(1);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-100 bg-[#FFF9EC] px-6 py-5">
          <div className="text-xl font-bold text-slate-900">
            {mode === "add" ? "Review product before adding" : "Review product changes"}
          </div>
          <div className="text-sm text-slate-500 mt-1">
            Confirm the product details and units are correct.
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-6 space-y-5">
          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Product
            </div>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-slate-500">Name</div>
                <div className="font-bold text-slate-900">{form.name || "—"}</div>
              </div>
              <div>
                <div className="text-slate-500">Category</div>
                <div className="font-bold text-slate-900">{cat?.name || "—"}</div>
              </div>
              <div>
                <div className="text-slate-500">SKU</div>
                <div className="font-bold text-slate-900">{form.sku || "—"}</div>
              </div>
              <div>
                <div className="text-slate-500">Barcode</div>
                <div className="font-bold text-slate-900">{form.barcode || "—"}</div>
              </div>
            </div>
          </div>

          {firstUnit && (
            <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest text-green-700">
                    Smallest inventory unit
                  </div>
                  <div className="mt-1 text-lg font-bold text-green-950">
                    {makeProductUnitLabel({ ...firstUnit, isDefault: true }, measures, unitSizes)}
                  </div>
                </div>
                <SaleTypeBadge type={firstUnit.saleType} />
              </div>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <div className="text-green-700/70">Contains</div>
                  <div className="font-bold text-green-950">1 {baseUnitText}</div>
                </div>
                <div>
                  <div className="text-green-700/70">Buying cost</div>
                  <div className="font-bold text-green-950">{fmt(firstUnit.costPrice)}</div>
                </div>
                <div>
                  <div className="text-green-700/70">Selling price</div>
                  <div className="font-bold text-green-950">{fmt(firstUnit.sellingPrice)}</div>
                </div>
                <div>
                  <div className="text-green-700/70">Margin</div>
                  <div className="font-bold text-green-950">
                    {margin(firstUnit.costPrice, firstUnit.sellingPrice)?.toFixed(0) ?? "0"}%
                  </div>
                </div>
              </div>
            </div>
          )}

          {otherUnits.length > 0 && (
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Retail / wholesale units
              </div>
              {otherUnits.map((u, i) => {
                const contains = Number(u.contains || 0);
                return (
                  <div key={`${u.id ?? "new"}-${i}`} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-bold text-slate-900">
                        {makeProductUnitLabel(u, measures, unitSizes)}
                      </div>
                      <SaleTypeBadge type={u.saleType} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <div>
                        <div className="text-slate-500">Contains</div>
                        <div className="font-bold text-slate-900">{contains} {baseUnitText}</div>
                      </div>
                      <div>
                        <div className="text-slate-500">Buying cost</div>
                        <div className="font-bold text-slate-900">{fmt(u.costPrice)}</div>
                      </div>
                      <div>
                        <div className="text-slate-500">Selling price</div>
                        <div className="font-bold text-slate-900">{fmt(u.sellingPrice)}</div>
                      </div>
                      <div>
                        <div className="text-slate-500">Cost per base</div>
                        <div className="font-bold text-slate-900">{fmt(contains > 0 ? Number(u.costPrice || 0) / contains : 0)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex gap-3 border-t border-slate-100 px-6 py-4 bg-slate-50">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Go back
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50 transition"
          >
            {loading ? "Saving…" : mode === "add" ? "Confirm & add" : "Confirm & save"}
          </button>
        </div>
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
  unitSizes,
  categories,
  suppliers,
  orgId,
  onCategoryCreated,
  onUnitSizeCreated,
  onSubmit,
  onCancel,
  saving,
  mode,
}: {
  form: FormData;
  setForm: React.Dispatch<React.SetStateAction<FormData>>;
  measures: MeasureLookup[];
  unitSizes: UnitSizeLookup[];
  categories: CategoryLookup[];
  suppliers: SupplierLookup[];
  orgId: string;
  onCategoryCreated: (id: string, name: string) => void;
  onUnitSizeCreated: (size: UnitSizeLookup, targetIndex: number) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  saving: boolean;
  mode: "add" | "edit";
}) {
  const [touched, setTouched] = useState<Partial<Record<keyof FormData, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const errors = validateForm(form);
  const hasErrors = Object.keys(errors).length > 0;
  const baseUnitText = getBaseUnitText(form, measures);

  const setField =
    (k: keyof FormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const value = e.target.value;
      setForm((prev) => ({ ...prev, [k]: value as never }));
      setTouched((t) => ({ ...t, [k]: true }));
    };

  const touch = (k: keyof FormData) => setTouched((t) => ({ ...t, [k]: true }));
  const showErr = (k: keyof FormData) =>
    errors[k] && (touched[k] || submitAttempted) ? errors[k] : undefined;

  function updateUnit(index: number, patch: Partial<ProductUnitForm>) {
    setForm((prev) => ({
      ...prev,
      productUnits: prev.productUnits.map((unit, i) =>
        i === index ? { ...unit, ...patch } : unit,
      ),
    }));
  }

  function addWholesaleUnit() {
    setForm((prev) => ({
      ...prev,
      productUnits: [
        ...prev.productUnits,
        {
          ...BLANK_PRODUCT_UNIT,
          isDefault: false,
          unitMeasureId: "",
          unitSizeId: "",
          contains: "",
          costPrice: "",
          sellingPrice: "",
          saleType: "wholesale",
          canSell: true,
          canRestock: true,
        },
      ],
    }));
  }

  function removeUnit(index: number) {
    setForm((prev) => {
      if (prev.productUnits.length <= 1) return prev;
      const next = prev.productUnits.filter((_, i) => i !== index);
      return {
        ...prev,
        productUnits: next.map((u, i) => ({ ...u, isDefault: i === 0 })),
      };
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitAttempted(true);
    if (hasErrors) return;
    onSubmit(e);
  }

  const baseUnit = form.productUnits[0];
  const selectedBaseMeasure = measures.find((m) => m.id === baseUnit?.unitMeasureId);

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {submitAttempted && hasErrors && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Please fix the highlighted fields before continuing.
        </div>
      )}

      <FormSection title="Product information">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Start with the basic product details. You only need package/wholesale details if this item is also bought or sold in boxes, cartons, crates, or trays.
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label required>Product name</Label>
            <input
              className={`${S.inputCls} ${showErr("name") ? "border-red-400 focus:border-red-400 focus:ring-red-100" : ""}`}
              placeholder="e.g. Honey sachet, Propolis"
              value={form.name}
              onChange={setField("name")}
              onBlur={() => touch("name")}
            />
            <FieldError message={showErr("name")} />
          </div>

          <div>
            <Label>SKU</Label>
            <input className={S.inputCls} placeholder="e.g. HNY-SAC" value={form.sku} onChange={setField("sku")} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Barcode</Label>
            <input className={`${S.inputCls} font-mono`} placeholder="Main product barcode (optional)" value={form.barcode} onChange={setField("barcode")} />
          </div>

          <div>
            <Label required>Category</Label>
            <select
              className={`${S.selectCls} ${showErr("categoryId") ? "border-red-400 focus:border-red-400 focus:ring-red-100" : ""}`}
              value={form.categoryId}
              onChange={setField("categoryId")}
              onBlur={() => touch("categoryId")}
              style={S.selectChevronStyle}
            >
              <option value="">— Select category —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <FieldError message={showErr("categoryId")} />
            <InlineCategoryCreator orgId={orgId} onCreated={onCategoryCreated} />
          </div>
        </div>

        <div>
          <Label>Supplier</Label>
          <select className={S.selectCls} style={S.selectChevronStyle} value={form.supplierId} onChange={setField("supplierId")}>
            <option value="">— Select supplier —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div>
          <Label>Notes</Label>
          <textarea rows={3} className={`${S.inputCls} resize-none`} placeholder="Batch details, storage info, supplier notes…" value={form.notes} onChange={setField("notes")} />
        </div>
      </FormSection>

      <FormSection title="Smallest inventory unit">
        <div className="rounded-2xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-900">
          This is the smallest item you track or sell individually. Examples: 1 sachet, 1 bottle, 1 piece, 1 packet. Inventory will be counted using this unit.
        </div>

        <FieldError message={showErr("productUnits")} />

        <div className="rounded-[22px] border border-[#EADFC2] bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-slate-900">Base item</div>
              <div className="mt-0.5 text-xs text-slate-500">Simple product setup only needs this section.</div>
            </div>
            <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700 border border-green-200">Required</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label required>Item form</Label>
              <select
                className={S.selectCls}
                style={S.selectChevronStyle}
                value={baseUnit?.unitMeasureId ?? ""}
                onChange={(e) => updateUnit(0, { unitMeasureId: e.target.value, label: "" })}
              >
                <option value="">— Select —</option>
                {measures.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-400">Example: sachet, packet, bottle, piece.</p>
            </div>

            <div>
              <Label required>Size</Label>
              <select
                className={S.selectCls}
                style={S.selectChevronStyle}
                value={baseUnit?.unitSizeId ?? ""}
                onChange={(e) => updateUnit(0, { unitSizeId: e.target.value, label: "" })}
              >
                <option value="">— Select —</option>
                {unitSizes.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
              <InlineUnitSizeCreator orgId={orgId} measure={selectedBaseMeasure} onCreated={(size) => onUnitSizeCreated(size, 0)} />
            </div>

            <div>
              <Label required>Buying cost (Ksh)</Label>
              <input
                className={S.inputCls}
                type="text"
                inputMode="decimal"
                placeholder="e.g. 10"
                value={baseUnit?.costPrice ?? ""}
                onChange={(e) => updateUnit(0, { costPrice: sanitizeQuantityInput(e.target.value) })}
              />
            </div>

            <div>
              <Label required>Selling price (Ksh)</Label>
              <input
                className={S.inputCls}
                type="text"
                inputMode="decimal"
                placeholder="e.g. 30"
                value={baseUnit?.sellingPrice ?? ""}
                onChange={(e) => updateUnit(0, { sellingPrice: sanitizeQuantityInput(e.target.value) })}
              />
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-3 grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">Inventory unit</div>
              <div className="font-semibold text-slate-900 mt-0.5">{makeProductUnitLabel({ ...baseUnit, isDefault: true } as ProductUnitForm, measures, unitSizes)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">Contains</div>
              <div className="font-semibold text-slate-900 mt-0.5">1 {baseUnitText}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">Profit</div>
              <div className="font-semibold text-slate-900 mt-0.5">{fmt(Number(baseUnit?.sellingPrice || 0) - Number(baseUnit?.costPrice || 0))}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">Margin</div>
              <div className="font-semibold text-slate-900 mt-0.5">{margin(baseUnit?.costPrice, baseUnit?.sellingPrice)?.toFixed(0) ?? "—"}%</div>
            </div>
          </div>
        </div>
      </FormSection>

      <FormSection title="Wholesale / package units">
        <div className="rounded-2xl border border-purple-100 bg-purple-50 px-4 py-3 text-sm text-purple-900">
          Optional. Add this only if you also buy or sell this product as a box, carton, crate, tray, bundle, or other package.
        </div>

        {form.productUnits.length <= 1 ? (
          <div className="rounded-[22px] border border-dashed border-purple-200 bg-white p-5 text-center">
            <div className="text-sm font-semibold text-slate-800">No package unit added</div>
            <div className="mt-1 text-xs text-slate-500">For a simple retail product, you can leave it like this.</div>
          </div>
        ) : (
          <div className="space-y-4">
            {form.productUnits.slice(1).map((unit, unitOffset) => {
              const index = unitOffset + 1;
              const contains = Number(unit.contains || 0);
              const cost = Number(unit.costPrice || 0);
              const sell = Number(unit.sellingPrice || 0);
              const displayUnit = makeProductUnitLabel(unit, measures, unitSizes);
              const costPerBase = contains > 0 ? cost / contains : 0;
              const sellPerBase = contains > 0 ? sell / contains : 0;
              const profit = sell - cost;
              const marginPct = sell > 0 ? ((sell - cost) / sell) * 100 : null;

              return (
                <div key={`${unit.id ?? "new"}-${index}`} className="rounded-[22px] border border-[#EADFC2] bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-4">
                    <div>
                      <div className="text-sm font-bold text-slate-900">Package unit {index}</div>
                      <div className="text-xs text-slate-500 mt-0.5">This package contains {unit.contains || "—"} {baseUnitText}.</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <SaleTypeBadge type="wholesale" />
                      <button type="button" onClick={() => removeUnit(index)} className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition">
                        Remove
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <Label required>Package type</Label>
                      <select
                        className={S.selectCls}
                        style={S.selectChevronStyle}
                        value={unit.unitMeasureId}
                        onChange={(e) => updateUnit(index, { unitMeasureId: e.target.value, unitSizeId: "", label: "", saleType: "wholesale" })}
                      >
                        <option value="">— Select —</option>
                        {measures.map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-slate-400">Example: box, carton, crate, tray.</p>
                    </div>

                    <div>
                      <Label required>Contains ({baseUnitText})</Label>
                      <input
                        className={S.inputCls}
                        type="text"
                        inputMode="decimal"
                        placeholder="e.g. 50"
                        value={unit.contains}
                        onChange={(e) => updateUnit(index, { contains: sanitizeQuantityInput(e.target.value) })}
                      />
                      <p className="mt-1 text-xs text-slate-400">Example: 1 box = 50 {baseUnitText}.</p>
                    </div>

                    <div>
                      <Label required>Package buying cost</Label>
                      <input
                        className={S.inputCls}
                        type="text"
                        inputMode="decimal"
                        placeholder="e.g. 500"
                        value={unit.costPrice}
                        onChange={(e) => updateUnit(index, { costPrice: sanitizeQuantityInput(e.target.value) })}
                      />
                    </div>

                    <div>
                      <Label required>Package selling price</Label>
                      <input
                        className={S.inputCls}
                        type="text"
                        inputMode="decimal"
                        placeholder="e.g. 1200"
                        value={unit.sellingPrice}
                        onChange={(e) => updateUnit(index, { sellingPrice: sanitizeQuantityInput(e.target.value) })}
                      />
                    </div>
                  </div>

                  <details className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <summary className="cursor-pointer text-sm font-bold text-slate-700">More package options</summary>
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <Label>Package barcode</Label>
                        <input className={`${S.inputCls} font-mono`} placeholder="Optional" value={unit.barcode} onChange={(e) => updateUnit(index, { barcode: e.target.value })} />
                      </div>
                      <div>
                        <Label>Can sell package?</Label>
                        <select className={S.selectCls} style={S.selectChevronStyle} value={unit.canSell ? "yes" : "no"} onChange={(e) => updateUnit(index, { canSell: e.target.value === "yes" })}>
                          <option value="yes">Yes</option>
                          <option value="no">No</option>
                        </select>
                      </div>
                      <div>
                        <Label>Can restock package?</Label>
                        <select className={S.selectCls} style={S.selectChevronStyle} value={unit.canRestock ? "yes" : "no"} onChange={(e) => updateUnit(index, { canRestock: e.target.value === "yes" })}>
                          <option value="yes">Yes</option>
                          <option value="no">No</option>
                        </select>
                      </div>
                    </div>
                  </details>

                  <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-3 grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">Package</div>
                      <div className="font-semibold text-slate-900 mt-0.5">{displayUnit}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">Cost per base unit</div>
                      <div className="font-semibold text-slate-900 mt-0.5">{fmt(costPerBase)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">Sell per base unit</div>
                      <div className="font-semibold text-slate-900 mt-0.5">{fmt(sellPerBase)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">Profit / Margin</div>
                      <div className="font-semibold text-slate-900 mt-0.5">{fmt(profit)} {marginPct !== null ? `• ${marginPct.toFixed(0)}%` : ""}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <button type="button" onClick={addWholesaleUnit} className="rounded-2xl border border-purple-200 bg-purple-50 px-4 py-2.5 text-sm font-bold text-purple-700 hover:bg-purple-100 transition">
          Add wholesale / package unit
        </button>
      </FormSection>

      <FormSection title="Status">
        <div>
          <Label>Available at checkout</Label>
          <select className={S.selectCls} style={S.selectChevronStyle} value={form.isSellable ? "yes" : "no"} onChange={(e) => setForm((prev) => ({ ...prev, isSellable: e.target.value === "yes" }))}>
            <option value="yes">Yes — show this product on POS</option>
            <option value="no">No — internal use only</option>
          </select>
        </div>
      </FormSection>

      <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
        <button type="button" onClick={onCancel} className={S.btnGhost}>Cancel</button>
        <button type="submit" disabled={saving} className={S.btnPrimary}>
          {saving ? "Saving…" : mode === "add" ? "Review & add" : "Review & save"}
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

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-[#F1E6C9] bg-[#FFFDF8] px-6 py-4">
      <span className="text-xs text-slate-500">Showing {start}–{end} of {totalItems} product{totalItems !== 1 ? "s" : ""}</span>
      <div className="flex items-center gap-1.5">
        <button onClick={() => onPage(page - 1)} disabled={page === 1} className="h-9 rounded-xl border border-[#EADFC2] bg-white px-3 text-xs font-bold text-slate-600 hover:bg-[#FFF8E6] disabled:opacity-40 disabled:cursor-not-allowed transition">Prev</button>
        <span className="px-3 text-sm font-semibold text-slate-600">{page} / {totalPages}</span>
        <button onClick={() => onPage(page + 1)} disabled={page === totalPages} className="h-9 rounded-xl border border-[#EADFC2] bg-white px-3 text-xs font-bold text-slate-600 hover:bg-[#FFF8E6] disabled:opacity-40 disabled:cursor-not-allowed transition">Next</button>
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
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [measures, setMeasures] = useState<MeasureLookup[]>([]);
  const [unitSizes, setUnitSizes] = useState<UnitSizeLookup[]>([]);
  const [categories, setCategories] = useState<CategoryLookup[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierLookup[]>([]);

  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [filterStatus, setFilterStatus] = useState<"" | "sellable" | "not_sellable">("");
  const [showArchived, setShowArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [expandedProductIds, setExpandedProductIds] = useState<Record<string, boolean>>({});

  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);

  const [addForm, setAddForm] = useState<FormData>({ ...BLANK_FORM });
  const [editForm, setEditForm] = useState<FormData>({ ...BLANK_FORM });

  const [pendingAddConfirm, setPendingAddConfirm] = useState(false);
  const [pendingEditConfirm, setPendingEditConfirm] = useState(false);

  const isAnyModalOpen = showAddModal || !!editProduct || !!deletingProduct || pendingAddConfirm || pendingEditConfirm;
  useBodyScrollLock(isAnyModalOpen);

  async function refresh(o: string) {
    const rows = await listProducts(o, !showArchived);
    setItems(rows);
  }

  function makeInitialUnit(measureId = measures[0]?.id ?? "", sizeId = unitSizes[0]?.id ?? "") {
    return {
      ...BLANK_PRODUCT_UNIT,
      unitMeasureId: measureId,
      unitSizeId: sizeId,
      contains: "1",
      saleType: "retail" as ProductUnitSaleType,
      isDefault: true,
    };
  }

  useEffect(() => {
    (async () => {
      try {
        const o = await bootstrapOrg();
        setOrgId(o);

        const [uoms, sizes, cats, sups] = await Promise.all([
          listUnitMeasures(o),
          listUnitSizes(o),
          listCategories(o),
          listSuppliers(o),
        ]);

        const typedMeasures = uoms as MeasureLookup[];
        const typedSizes = sizes as UnitSizeLookup[];
        setMeasures(typedMeasures);
        setUnitSizes(typedSizes);
        setCategories(cats as CategoryLookup[]);
        setSuppliers(sups as SupplierLookup[]);

        const firstMeasureId = typedMeasures?.[0]?.id ?? "";
        const firstSizeId = typedSizes?.[0]?.id ?? "";

        setAddForm((f) => ({
          ...f,
          productUnits: [makeInitialUnit(firstMeasureId, firstSizeId)],
        }));

        await refresh(o);
      } catch (e: any) {
        setErr(e.message ?? String(e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showArchived]);

  useEffect(() => {
    setPage(1);
  }, [search, filterCat, filterStatus, showArchived]);

  const allCategories = useMemo(() => {
    return categories.map((c) => c.name).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [categories]);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();

    return items.filter((p) => {
      const displayName = formatProductDisplayName(p).toLowerCase();
      const catName = getCategoryName(p).toLowerCase();
      const sku = (p.sku ?? "").toLowerCase();
      const supplierName = (p.supplier?.name ?? "").toLowerCase();
      const unitNames = (p.product_units ?? []).map((u) => u.label).join(" ").toLowerCase();

      const matchText = !t || displayName.includes(t) || sku.includes(t) || (p.barcode ?? "").toLowerCase().includes(t) || supplierName.includes(t) || catName.includes(t) || unitNames.includes(t);
      const matchCat = !filterCat || getCategoryName(p) === filterCat;
      const matchStatus = !filterStatus || (filterStatus === "sellable" && p.is_sellable !== false) || (filterStatus === "not_sellable" && p.is_sellable === false);

      return matchText && matchCat && matchStatus;
    });
  }, [items, search, filterCat, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const kpis = useMemo(() => {
    const total = items.length;
    const activeSellable = items.filter((p) => p.is_sellable !== false).length;
    const archived = items.filter((p) => p.active === false).length;
    const margins = items.map((p) => margin(p.cost_price, p.unit_price)).filter((m) => m !== null) as number[];
    const avgMargin = margins.length ? margins.reduce((a, b) => a + b, 0) / margins.length : 0;
    const categoriesCount = new Set(items.map((p) => getCategoryName(p)).filter(Boolean)).size;

    return { total, activeSellable, archived, avgMargin, categories: categoriesCount };
  }, [items]);

  function handleAddCategoryCreated(id: string, name: string) {
    setCategories((prev) => [...prev, { id, name }].sort((a, b) => a.name.localeCompare(b.name)));
    setAddForm((f) => ({ ...f, categoryId: id }));
    setToast({ message: `Category "${name}" created`, type: "success" });
  }

  function handleEditCategoryCreated(id: string, name: string) {
    setCategories((prev) => [...prev, { id, name }].sort((a, b) => a.name.localeCompare(b.name)));
    setEditForm((f) => ({ ...f, categoryId: id }));
    setToast({ message: `Category "${name}" created`, type: "success" });
  }

  function handleUnitSizeCreated(size: UnitSizeLookup, targetIndex: number, mode: "add" | "edit") {
    setUnitSizes((prev) => {
      const exists = prev.some((s) => s.id === size.id);
      const next = exists ? prev : [...prev, size];
      return next.sort((a, b) => a.label.localeCompare(b.label));
    });

    const setter = mode === "add" ? setAddForm : setEditForm;
    setter((prev) => ({
      ...prev,
      productUnits: prev.productUnits.map((unit, index) =>
        index === targetIndex ? { ...unit, unitSizeId: size.id, label: "" } : unit,
      ),
    }));
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
      const firstUnit = addForm.productUnits[0];
      const quantity = getQuantityFromUnitSize(firstUnit?.unitSizeId ?? "", unitSizes);
      const productDisplay = addForm.name.trim();

      const created = await createProduct(orgId, {
        name: addForm.name.trim(),
        sku: addForm.sku.trim() || undefined,
        category_id: addForm.categoryId || null,
        barcode: addForm.barcode.trim() || undefined,
        supplier_id: addForm.supplierId || null,
        notes: addForm.notes.trim() || undefined,
        cost_price: Number(firstUnit?.costPrice || 0),
        unit_price: Number(firstUnit?.sellingPrice || 0),
        quantity_value: quantity.value,
        quantity_unit: quantity.unit,
        unit_measure_id: firstUnit?.unitMeasureId || null,
        unit_size_id: firstUnit?.unitSizeId || null,
        is_sellable: addForm.isSellable,
        create_default_unit: false,
      });

      const unitsPayload = toProductUnitPayload(addForm, measures, unitSizes).map((u) => ({ ...u, product_id: created.id }));
      await saveProductUnits(orgId, created.id, unitsPayload);

      setAddForm({ ...BLANK_FORM, productUnits: [makeInitialUnit()] });
      setShowAddModal(false);
      setPendingAddConfirm(false);
      await refresh(orgId);
      setToast({ message: `"${productDisplay}" added successfully`, type: "success" });
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
      const firstUnit = editForm.productUnits[0];
      const quantity = getQuantityFromUnitSize(firstUnit?.unitSizeId ?? "", unitSizes);
      const updatedDisplay = editForm.name.trim();
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
          cost_price: Number(firstUnit?.costPrice || 0),
          unit_price: Number(firstUnit?.sellingPrice || 0),
          quantity_value: quantity.value,
          quantity_unit: quantity.unit,
          unit_measure_id: firstUnit?.unitMeasureId || null,
          unit_size_id: firstUnit?.unitSizeId || null,
          is_sellable: editForm.isSellable,
        })
        .eq("org_id", orgId)
        .eq("id", editProduct.id);

      if (error) throw new Error(error.message);

      const unitsPayload = toProductUnitPayload(editForm, measures, unitSizes).map((u) => ({ ...u, product_id: editProduct.id }));
      await saveProductUnits(orgId, editProduct.id, unitsPayload);

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
      setToast({ message: productName ? `"${productName}" archived` : "Product archived", type: "success" });
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
      setToast({ message: product ? `"${formatProductDisplayName(product)}" restored` : "Product restored", type: "success" });
    } catch (e: any) {
      setErr(e.message ?? String(e));
      setToast({ message: "Failed to restore", type: "error" });
    }
  }

  function openEdit(p: Product) {
    const fallbackMeasureId = p.unit_measure_id ?? measures[0]?.id ?? "";
    const fallbackSizeId = p.unit_size_id ?? unitSizes[0]?.id ?? "";
    const units = productUnitsFromProduct(p).map((u, index) => ({
      ...u,
      unitMeasureId: u.unitMeasureId || fallbackMeasureId,
      unitSizeId: index === 0 ? u.unitSizeId || fallbackSizeId : "",
      isDefault: index === 0,
    }));

    setEditForm({
      name: p.name ?? "",
      sku: p.sku ?? "",
      categoryId: p.category_id ?? p.category?.id ?? "",
      barcode: p.barcode ?? "",
      supplierId: p.supplier_id ?? p.supplier?.id ?? "",
      notes: p.notes ?? "",
      isSellable: p.is_sellable ?? true,
      productUnits: units.length ? units : [makeInitialUnit(fallbackMeasureId, fallbackSizeId)],
    });

    setEditProduct(p);
  }

  function clearFilters() {
    setSearch("");
    setFilterCat("");
    setFilterStatus("");
  }

  function toggleUnitDetails(productId: string) {
    setExpandedProductIds((prev) => ({
      ...prev,
      [productId]: !prev[productId],
    }));
  }

  const hasFilters = !!(search || filterCat || filterStatus);
  const TABLE_COLS = "2.1fr 2.4fr 1fr 1fr 1.2fr";
  const HEADERS = ["Product", "Units", "Price", "Status", "Actions"];

  if (!orgId && !err) {
    return <div className="flex h-64 items-center justify-center"><div className="text-slate-400 text-sm font-semibold">Loading catalog…</div></div>;
  }

  return (
    <div className="flex flex-col gap-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {err && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="flex-1">{err}</span>
          <button onClick={() => setErr("")} className="shrink-0 text-red-400 hover:text-red-600 text-lg leading-none">×</button>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button className={`${S.btnPrimary} shadow-[0_12px_28px_rgba(245,197,24,0.25)]`} onClick={() => setShowAddModal(true)}>
          Add product
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label="Total products" value={String(kpis.total)} sub={showArchived ? "active + archived" : "active only"} />
        <KpiCard label="For sale" value={String(kpis.activeSellable)} sub="active listings" variant="success" />
        <KpiCard label="Archived" value={String(kpis.archived)} sub="hidden from sales" variant="warning" />
        <KpiCard label="Categories" value={String(kpis.categories)} sub="product groups" variant="info" />
        <KpiCard label="Avg margin" value={`${kpis.avgMargin.toFixed(0)}%`} sub="gross margin" variant={kpis.avgMargin >= 30 ? "success" : kpis.avgMargin >= 10 ? "warning" : "neutral"} />
      </div>

      <div className="rounded-[24px] border border-[#EADFC2] bg-white shadow-[0_12px_36px_rgba(245,197,24,0.06)] overflow-hidden">
        <div className="border-b border-[#F1E6C9] bg-[linear-gradient(180deg,#FFFDF8_0%,#FFF9EC_100%)] px-5 py-4 lg:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative flex-1 min-w-[220px] max-w-sm">
              <input className="w-full rounded-2xl border border-[#EADFC2] bg-white px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-100 outline-none transition" placeholder="Search products, units, SKU…" value={search} onChange={(e) => setSearch(e.target.value)} />
              {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">Clear</button>}
            </label>

            <select className="rounded-2xl border border-[#EADFC2] bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-100 outline-none transition cursor-pointer" style={S.selectChevronStyle} value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
              <option value="">All categories</option>
              {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>

            <select className="rounded-2xl border border-[#EADFC2] bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-100 outline-none transition cursor-pointer" style={S.selectChevronStyle} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as "" | "sellable" | "not_sellable")}>
              <option value="">All statuses</option>
              <option value="sellable">For sale</option>
              <option value="not_sellable">Not for sale</option>
            </select>

            {hasFilters && <button onClick={clearFilters} className="text-sm font-semibold text-amber-600 hover:text-amber-700 transition px-1">Clear</button>}

            <button type="button" onClick={() => setShowArchived((v) => !v)} className={`rounded-2xl border px-3.5 py-2.5 text-sm font-semibold transition ${showArchived ? "border-amber-300 bg-amber-50 text-amber-700 shadow-[0_8px_20px_rgba(245,197,24,0.12)]" : "border-[#EADFC2] bg-white text-slate-700 hover:bg-[#FFF8E6]"}`}>
              {showArchived ? "Showing archived too" : "Show archived"}
            </button>

            <span className="ml-auto text-xs text-slate-500 whitespace-nowrap">{filtered.length} of {items.length}</span>
          </div>
        </div>

        <div className="px-3 py-3 sm:px-4 sm:py-4">
          <div className="hidden lg:block">
            <div className="grid items-center gap-4 px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500" style={{ gridTemplateColumns: TABLE_COLS }}>
              {HEADERS.map((h) => <div key={h}>{h}</div>)}
            </div>
          </div>

          <div className="space-y-3">
            {paginated.length === 0 ? (
              <div className="py-20 text-center">
                <p className="text-lg font-semibold text-slate-700">{items.length === 0 ? "No products yet" : "No matching products"}</p>
                <p className="text-sm text-slate-400 mt-1">{items.length === 0 ? 'Click "Add product" to get started' : "Try adjusting your filters"}</p>
              </div>
            ) : (
              paginated.map((p) => {
                const mgn = margin(p.cost_price, p.unit_price);
                const categoryName = getCategoryName(p);
                const displayName = formatProductDisplayName(p);
                const baseUnit = getProductBaseUnit(p);
                const retailUnits = getProductRetailUnits(p);
                const wholesaleUnits = getProductWholesaleUnits(p);
                const isExpanded = Boolean(expandedProductIds[p.id]);
                const unitSummary = [
                  baseUnit ? `Retail: ${baseUnit.label}` : null,
                  wholesaleUnits.length
                    ? `Wholesale: ${wholesaleUnits
                        .map((u: any) => `${u.label} of ${Number(u.base_quantity ?? 1)}`)
                        .join(", ")}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ");

                return (
                  <div key={p.id} className="group rounded-[24px] border border-[#EFE4C6] bg-[linear-gradient(180deg,#FFFFFF_0%,#FFFCF4_100%)] shadow-[0_8px_30px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-px hover:shadow-[0_16px_34px_rgba(245,197,24,0.10)] hover:border-[#E5D28D]">
                    <div className="hidden lg:grid items-center gap-4 px-6 py-5 text-sm" style={{ gridTemplateColumns: TABLE_COLS }}>
                      <div className="min-w-0 space-y-1">
                        <div className="font-semibold text-slate-900 truncate text-[15px]">{displayName}</div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                          {categoryName && <span>{categoryName}</span>}
                          {p.supplier?.name && <span>• {p.supplier.name}</span>}
                          {p.sku && <span className="font-mono">• SKU {p.sku}</span>}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleUnitDetails(p.id)}
                        className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:border-amber-200 hover:bg-amber-50/40"
                      >
                        <CompactUnitsSummary product={p} />
                        <div className="mt-1 text-xs font-bold text-amber-700">
                          {isExpanded ? "Hide details" : "View details"}
                        </div>
                      </button>

                      <div>
                        <div className="text-xs text-slate-400">Retail price</div>
                        <div className="font-bold text-slate-900">{fmt(p.unit_price)}</div>
                        <div className="mt-0.5 text-xs text-slate-500">Cost {fmt(p.cost_price)}</div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap"><SellBadge isSellable={p.is_sellable} /><ArchiveBadge active={p.active} /></div>

                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(p)} className="rounded-xl border border-slate-200 bg-white px-3.5 h-9 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition">Edit</button>
                        {p.active === false ? (
                          <button onClick={() => handleRestore(p.id, p)} className="rounded-xl border border-green-200 bg-green-50 px-3.5 h-9 text-xs font-semibold text-green-700 hover:bg-green-100 transition">Restore</button>
                        ) : (
                          <button onClick={() => setDeletingProduct(p)} className="rounded-xl border border-red-200 bg-red-50 px-3.5 h-9 text-xs font-semibold text-red-600 hover:bg-red-100 transition">Archive</button>
                        )}
                      </div>
                    </div>

                    {isExpanded && <div className="hidden lg:block"><ProductUnitDetails product={p} /></div>}

                    <div className="lg:hidden px-5 py-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 truncate">{displayName}</div>
                          {categoryName && <div className="mt-0.5 text-xs text-slate-500">{categoryName}</div>}
                          {unitSummary && <div className="text-xs text-slate-400 mt-1 line-clamp-2">{unitSummary}</div>}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap justify-end"><SellBadge isSellable={p.is_sellable} /><ArchiveBadge active={p.active} /></div>
                      </div>

                      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <CompactUnitsSummary product={p} />
                        <button
                          type="button"
                          onClick={() => toggleUnitDetails(p.id)}
                          className="shrink-0 rounded-xl border border-amber-200 bg-white px-3 py-1.5 text-xs font-bold text-amber-700"
                        >
                          {isExpanded ? "Hide" : "Units"}
                        </button>
                      </div>

                      {isExpanded && <ProductUnitDetails product={p} />}

                      <div className="grid grid-cols-3 gap-3 rounded-2xl bg-[#FFF9EC] border border-[#F1E6C9] p-3 text-sm">
                        <div><div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Cost</div><div className="font-medium text-slate-800 mt-0.5">{fmt(p.cost_price)}</div></div>
                        <div><div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Sell</div><div className="font-bold text-slate-900 mt-0.5">{fmt(p.unit_price)}</div></div>
                        <div><div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Margin</div><div className="mt-0.5"><MarginBadge pct={mgn} /></div></div>
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button onClick={() => openEdit(p)} className="flex-1 flex items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 py-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition">Edit</button>
                        {p.active === false ? (
                          <button onClick={() => handleRestore(p.id, p)} className="flex-1 flex items-center justify-center gap-2 rounded-2xl border border-green-200 bg-green-50 py-2.5 text-xs font-semibold text-green-700 hover:bg-green-100 transition">Restore</button>
                        ) : (
                          <button onClick={() => setDeletingProduct(p)} className="flex-1 flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition">Archive</button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <Pagination page={safePage} totalPages={totalPages} totalItems={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} />
      </div>

      {showAddModal && orgId && (
        <Modal title="Add product" sub="Fill in the details below" onClose={() => setShowAddModal(false)}>
          <ProductForm form={addForm} setForm={setAddForm} measures={measures} unitSizes={unitSizes} categories={categories} suppliers={suppliers} orgId={orgId} onCategoryCreated={handleAddCategoryCreated} onUnitSizeCreated={(size, index) => handleUnitSizeCreated(size, index, "add")} onSubmit={handleAdd} onCancel={() => setShowAddModal(false)} saving={saving} mode="add" />
        </Modal>
      )}

      {editProduct && orgId && (
        <Modal title="Edit product" sub={formatProductDisplayName(editProduct)} onClose={() => setEditProduct(null)}>
          <ProductForm form={editForm} setForm={setEditForm} measures={measures} unitSizes={unitSizes} categories={categories} suppliers={suppliers} orgId={orgId} onCategoryCreated={handleEditCategoryCreated} onUnitSizeCreated={(size, index) => handleUnitSizeCreated(size, index, "edit")} onSubmit={handleEdit} onCancel={() => setEditProduct(null)} saving={saving} mode="edit" />
        </Modal>
      )}

      {deletingProduct && <ArchiveModal product={deletingProduct} onConfirm={handleArchive} onCancel={() => setDeletingProduct(null)} loading={deleting} />}

      <ConfirmSaveModal open={pendingAddConfirm} mode="add" form={addForm} categories={categories} measures={measures} unitSizes={unitSizes} loading={saving} onConfirm={performAdd} onCancel={() => setPendingAddConfirm(false)} />
      <ConfirmSaveModal open={pendingEditConfirm} mode="edit" form={editForm} categories={categories} measures={measures} unitSizes={unitSizes} loading={saving} onConfirm={performEdit} onCancel={() => setPendingEditConfirm(false)} />
    </div>
  );
}
