"use client";

import React, { useEffect, useMemo, useState } from "react";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import { supabase } from "@/lib/supabase/client";
import {
  listProducts,
  createProduct,
  archiveProduct,
  restoreProduct,
} from "@/lib/api/products";
import { listUnitMeasures, listUnitSizes } from "@/lib/api/lookups";

import * as S from "./page.styles";

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */
type UnitKind = "mass" | "volume" | "count";
type MeasureLookup = { id: string; name: string; allowed_kinds: UnitKind[] };
type SizeLookup = {
  id: string;
  label: string;
  kind: UnitKind;
  grams?: number | null;
  ml?: number | null;
  count?: number | null;
};

type Product = {
  id: string;
  name?: string;
  category?: string | null;
  barcode?: string | null;
  supplier?: string | null;
  notes?: string | null;
  cost_price?: number | string | null;
  unit_price?: number | string | null;
  unit_measure_id?: string | null;
  unit_size_id?: string | null;
  unit_measure?: { id?: string; name?: string } | null;
  unit_size?: { id?: string; label?: string; kind?: UnitKind } | null;
  sell_status?: "to_be_sold" | "not_to_be_sold" | string;
  active?: boolean;
};

type FormData = {
  name: string;
  category: string;
  barcode: string;
  supplier: string;
  notes: string;
  costPrice: string;
  sellPrice: string;
  unitMeasureId: string;
  unitSizeId: string;
  sellStatus: "to_be_sold" | "not_to_be_sold";
};

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */
const BLANK_FORM: FormData = {
  name: "",
  category: "",
  barcode: "",
  supplier: "",
  notes: "",
  costPrice: "0",
  sellPrice: "0",
  unitMeasureId: "",
  unitSizeId: "",
  sellStatus: "to_be_sold",
};

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

const CATEGORIES = [
  "Raw Honey",
  "Processed Honey",
  "Beeswax",
  "Propolis",
  "Royal Jelly",
  "Pollen",
  "Apitherapy",
  "Equipment",
  "Packaging",
  "Other",
];

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
      className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-xl px-5 py-3.5 shadow-xl text-white text-sm font-semibold transition-all duration-300 ${
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
      border: "#e2e8f0",
      iconBg: "#f8fafc",
      iconColor: "#475569",
      val: "#0f172a",
      sub: "#64748b",
    },
    success: {
      border: "#bbf7d0",
      iconBg: "#dcfce7",
      iconColor: "#166534",
      val: "#166534",
      sub: "#16a34a",
    },
    warning: {
      border: "#fde68a",
      iconBg: "#fef3c7",
      iconColor: "#92400e",
      val: "#92400e",
      sub: "#d97706",
    },
    info: {
      border: "#bfdbfe",
      iconBg: "#dbeafe",
      iconColor: "#1e40af",
      val: "#1e40af",
      sub: "#3b82f6",
    },
  }[variant];

  return (
    <div
      className="rounded-2xl p-4 bg-white transition hover:shadow-md"
      style={{ border: `1.5px solid ${cfg.border}` }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg"
          style={{ background: cfg.iconBg, color: cfg.iconColor }}
        >
          {icon}
        </div>
      </div>
      <div
        className="text-[11px] font-semibold uppercase tracking-wider mb-1"
        style={{ color: cfg.sub }}
      >
        {label}
      </div>
      <div
        className="text-2xl font-bold leading-none"
        style={{ color: cfg.val }}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-1 text-xs" style={{ color: cfg.sub }}>
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
      ? "bg-green-100 text-green-700"
      : pct >= 10
      ? "bg-amber-100 text-amber-700"
      : "bg-red-100 text-red-700";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${color}`}
    >
      {pct.toFixed(0)}%
    </span>
  );
}

function SellBadge({ status }: { status?: string }) {
  const active = status !== "not_to_be_sold";
  return active ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
      For sale
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
      Inactive
    </span>
  );
}

function ArchiveBadge({ active }: { active?: boolean }) {
  if (active !== false) return null;

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
      Archived
    </span>
  );
}

/* ─────────────────────────────────────────────
   Archive Modal
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
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-600 text-2xl">
            📦
          </div>
          <div>
            <div className="text-lg font-bold text-slate-900">
              Archive product?
            </div>
            <div className="text-sm text-slate-500 mt-0.5">
              Hidden from sales but kept in records.
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 mb-5 text-sm font-semibold text-slate-800">
          {product.name}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Cancel
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
   Product Form
───────────────────────────────────────────── */
function ProductForm({
  form,
  setForm,
  measures,
  filteredSizes,
  onSubmit,
  onCancel,
  saving,
  mode,
}: {
  form: FormData;
  setForm: React.Dispatch<React.SetStateAction<FormData>>;
  measures: MeasureLookup[];
  filteredSizes: SizeLookup[];
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  saving: boolean;
  mode: "add" | "edit";
}) {
  const set =
    (k: keyof FormData) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >
    ) =>
      setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const marginPct = margin(form.costPrice, form.sellPrice);

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label required>Product name</Label>
          <input
            className={S.inputCls}
            placeholder="e.g. Raw Honey 500g"
            value={form.name}
            onChange={set("name")}
            required
          />
        </div>
        <div>
          <Label>Category</Label>
          <select
            className={S.selectCls}
            value={form.category}
            onChange={set("category")}
            style={S.selectChevronStyle}
          >
            <option value="">— Select —</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>Supplier</Label>
          <input
            className={S.inputCls}
            placeholder="Supplier name"
            value={form.supplier}
            onChange={set("supplier")}
          />
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
          <Label>Sell price (Ksh)</Label>
          <input
            className={S.inputCls}
            type="number"
            min="0"
            step="0.01"
            value={form.sellPrice}
            onChange={set("sellPrice")}
          />
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <Label>Unit of measure</Label>
          <select
            className={S.selectCls}
            style={S.selectChevronStyle}
            value={form.unitMeasureId}
            onChange={set("unitMeasureId")}
          >
            {measures.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Unit size</Label>
          <select
            className={S.selectCls}
            style={S.selectChevronStyle}
            value={form.unitSizeId}
            onChange={set("unitSizeId")}
            disabled={!filteredSizes.length}
          >
            {!filteredSizes.length ? (
              <option value="">Select measure first</option>
            ) : (
              filteredSizes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))
            )}
          </select>
        </div>
        <div>
          <Label>Sell status</Label>
          <select
            className={S.selectCls}
            style={S.selectChevronStyle}
            value={form.sellStatus}
            onChange={set("sellStatus") as any}
          >
            <option value="to_be_sold">For sale</option>
            <option value="not_to_be_sold">Not for sale</option>
          </select>
        </div>
      </div>

      <div>
        <Label>Notes</Label>
        <textarea
          rows={3}
          className={`${S.inputCls} resize-none`}
          placeholder="Batch details, storage info, allergies…"
          value={form.notes}
          onChange={set("notes")}
        />
      </div>

      <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
        <button type="button" onClick={onCancel} className={S.btnGhost}>
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !form.name.trim()}
          className={S.btnPrimary}
        >
          {saving ? "Saving…" : mode === "add" ? "Add product" : "Save changes"}
        </button>
      </div>
    </form>
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
              {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
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
  const [sizes, setSizes] = useState<SizeLookup[]>([]);

  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [filterStatus, setFilterStatus] = useState<
    "" | "to_be_sold" | "not_to_be_sold"
  >("");
  const [showArchived, setShowArchived] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);

  const [addForm, setAddForm] = useState<FormData>({ ...BLANK_FORM });
  const [editForm, setEditForm] = useState<FormData>({ ...BLANK_FORM });

  async function refresh(o: string) {
    setItems(await listProducts(o, !showArchived));
  }

  useEffect(() => {
    (async () => {
      try {
        const o = await bootstrapOrg();
        setOrgId(o);

        const [uoms, usizes] = await Promise.all([
          listUnitMeasures(o),
          listUnitSizes(o),
        ]);

        setMeasures(uoms as MeasureLookup[]);
        setSizes(usizes as SizeLookup[]);

        const firstId = uoms?.[0]?.id ?? "";
        const firstAllowed = (uoms?.[0] as MeasureLookup)?.allowed_kinds ?? [];
        const firstSizeId =
          (usizes as SizeLookup[]).find((s) => firstAllowed.includes(s.kind))
            ?.id ?? "";

        setAddForm((f) => ({
          ...f,
          unitMeasureId: firstId,
          unitSizeId: firstSizeId,
        }));

        await refresh(o);
      } catch (e: any) {
        setErr(e.message ?? String(e));
      }
    })();
  }, [showArchived]);

  const addFilteredSizes = useMemo(() => {
    const m = measures.find((m) => m.id === addForm.unitMeasureId);
    if (!m) return sizes;
    return sizes.filter((s) => m.allowed_kinds.includes(s.kind));
  }, [sizes, measures, addForm.unitMeasureId]);

  const editFilteredSizes = useMemo(() => {
    const m = measures.find((m) => m.id === editForm.unitMeasureId);
    if (!m) return sizes;
    return sizes.filter((s) => m.allowed_kinds.includes(s.kind));
  }, [sizes, measures, editForm.unitMeasureId]);

  useEffect(() => {
    if (
      addFilteredSizes.length &&
      !addFilteredSizes.find((s) => s.id === addForm.unitSizeId)
    ) {
      setAddForm((f) => ({ ...f, unitSizeId: addFilteredSizes[0].id }));
    }
  }, [addFilteredSizes, addForm.unitSizeId]);

  useEffect(() => {
    if (
      editFilteredSizes.length &&
      !editFilteredSizes.find((s) => s.id === editForm.unitSizeId)
    ) {
      setEditForm((f) => ({ ...f, unitSizeId: editFilteredSizes[0].id }));
    }
  }, [editFilteredSizes, editForm.unitSizeId]);

  const allCategories = useMemo(() => {
    const fromData = Array.from(
      new Set(items.map((p) => p.category).filter(Boolean))
    ) as string[];
    return Array.from(new Set([...CATEGORIES, ...fromData])).sort();
  }, [items]);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return items.filter((p) => {
      const matchText =
        !t ||
        (p.name ?? "").toLowerCase().includes(t) ||
        (p.barcode ?? "").toLowerCase().includes(t) ||
        (p.supplier ?? "").toLowerCase().includes(t) ||
        (p.category ?? "").toLowerCase().includes(t);

      const matchCat = !filterCat || p.category === filterCat;
      const matchStatus = !filterStatus || p.sell_status === filterStatus;

      return matchText && matchCat && matchStatus;
    });
  }, [items, search, filterCat, filterStatus]);

  const kpis = useMemo(() => {
    const total = items.length;
    const activeSellable = items.filter((p) => p.sell_status !== "not_to_be_sold").length;
    const archived = items.filter((p) => p.active === false).length;
    const margins = items
      .map((p) => margin(p.cost_price, p.unit_price))
      .filter((m) => m !== null) as number[];
    const avgMargin = margins.length
      ? margins.reduce((a, b) => a + b, 0) / margins.length
      : 0;
    const categories = new Set(items.map((p) => p.category).filter(Boolean)).size;

    return { total, activeSellable, archived, avgMargin, categories };
  }, [items]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId) return;

    setSaving(true);
    setErr("");

    try {
      if (!addForm.name.trim()) throw new Error("Product name is required");

      const created = await createProduct(orgId, {
        name: addForm.name.trim(),
        barcode: addForm.barcode.trim() || undefined,
        supplier: addForm.supplier.trim() || undefined,
        notes: addForm.notes.trim() || undefined,
        cost_price: Number(addForm.costPrice || 0),
        unit_price: Number(addForm.sellPrice || 0),
        unit_measure_id: addForm.unitMeasureId || null,
        unit_size_id: addForm.unitSizeId || null,
        sell_status: addForm.sellStatus,
      });

      if (addForm.category && created?.id) {
        await supabase
          .from("products")
          .update({ category: addForm.category })
          .eq("id", created.id);
      }

      setAddForm({
        ...BLANK_FORM,
        unitMeasureId: addForm.unitMeasureId,
        unitSizeId: addForm.unitSizeId,
      });
      setShowAddModal(false);
      await refresh(orgId);
      setToast({ message: "Product added successfully", type: "success" });
    } catch (e: any) {
      setErr(e.message ?? String(e));
      setToast({ message: "Failed to add product", type: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId || !editProduct) return;

    setSaving(true);
    setErr("");

    try {
      const { error } = await supabase
        .from("products")
        .update({
          name: editForm.name.trim(),
          category: editForm.category || null,
          barcode: editForm.barcode.trim() || null,
          supplier: editForm.supplier.trim() || null,
          notes: editForm.notes.trim() || null,
          cost_price: Number(editForm.costPrice || 0),
          unit_price: Number(editForm.sellPrice || 0),
          unit_measure_id: editForm.unitMeasureId || null,
          unit_size_id: editForm.unitSizeId || null,
          sell_status: editForm.sellStatus,
        })
        .eq("org_id", orgId)
        .eq("id", editProduct.id);

      if (error) throw new Error(error.message);

      setEditProduct(null);
      await refresh(orgId);
      setToast({ message: "Product updated", type: "success" });
    } catch (e: any) {
      setErr(e.message ?? String(e));
      setToast({ message: "Failed to update product", type: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (!orgId || !deletingProduct?.id) return;

    setDeleting(true);
    try {
      await archiveProduct(orgId, deletingProduct.id);
      await refresh(orgId);
      setToast({ message: "Product archived", type: "success" });
    } catch (e: any) {
      setErr(e.message ?? String(e));
      setToast({ message: "Failed to archive", type: "error" });
    } finally {
      setDeleting(false);
      setDeletingProduct(null);
    }
  }

  async function handleRestore(id: string) {
    if (!orgId) return;

    try {
      await restoreProduct(orgId, id);
      await refresh(orgId);
      setToast({ message: "Product restored", type: "success" });
    } catch (e: any) {
      setErr(e.message ?? String(e));
      setToast({ message: "Failed to restore", type: "error" });
    }
  }

  function openEdit(p: Product) {
    setEditForm({
      name: p.name ?? "",
      category: p.category ?? "",
      barcode: p.barcode ?? "",
      supplier: p.supplier ?? "",
      notes: p.notes ?? "",
      costPrice: String(p.cost_price ?? "0"),
      sellPrice: String(p.unit_price ?? "0"),
      unitMeasureId: p.unit_measure_id ?? measures[0]?.id ?? "",
      unitSizeId: p.unit_size_id ?? "",
      sellStatus: (p.sell_status as any) ?? "to_be_sold",
    });
    setEditProduct(p);
  }

  function clearFilters() {
    setSearch("");
    setFilterCat("");
    setFilterStatus("");
  }

  const hasFilters = !!(search || filterCat || filterStatus);

  const TABLE_COLS =
    "2fr 1fr 1fr 1fr 0.8fr 0.8fr 0.7fr 1.2fr 88px";
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
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
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
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Product Catalog
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Manage products, pricing, units and availability
          </p>
        </div>
        <button className={S.btnPrimary} onClick={() => setShowAddModal(true)}>
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

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex-1 min-w-[200px] max-w-xs">
          <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
            <IconSearch />
          </div>
          <input
            className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-100 outline-none transition"
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
          className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-100 outline-none transition cursor-pointer"
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
          className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-100 outline-none transition cursor-pointer"
          style={S.selectChevronStyle}
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
        >
          <option value="">All statuses</option>
          <option value="to_be_sold">For sale</option>
          <option value="not_to_be_sold">Inactive</option>
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
          className={`rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition ${
            showArchived
              ? "border-amber-300 bg-amber-50 text-amber-700"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          {showArchived ? "Showing archived too" : "Show archived"}
        </button>

        <span className="ml-auto text-xs text-slate-400 whitespace-nowrap">
          {filtered.length} of {items.length}
        </span>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div
          className="hidden lg:grid items-center gap-3 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-50 border-b border-slate-200"
          style={{ gridTemplateColumns: TABLE_COLS }}
        >
          {HEADERS.map((h, i) => (
            <div key={i} className={i >= 4 && i <= 6 ? "text-right" : ""}>
              {h}
            </div>
          ))}
        </div>

        <div className="divide-y divide-slate-100">
          {filtered.length === 0 ? (
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
            filtered.map((p) => {
              const mgn = margin(p.cost_price, p.unit_price);

              return (
                <div
                  key={p.id}
                  className="transition-colors hover:bg-slate-50/60 group"
                >
                  <div
                    className="hidden lg:grid items-center gap-3 px-5 py-3.5 text-sm"
                    style={{ gridTemplateColumns: TABLE_COLS }}
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate">
                        {p.name || "Unnamed"}
                      </div>
                      {p.notes && (
                        <div className="text-xs text-slate-400 truncate mt-0.5">
                          {p.notes}
                        </div>
                      )}
                    </div>

                    <div>
                      {p.category ? (
                        <span className="inline-block rounded-lg bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 truncate max-w-full">
                          {p.category}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </div>

                    <div className="text-slate-600 truncate">
                      {p.supplier || <span className="text-slate-300">—</span>}
                    </div>

                    <div className="font-mono text-xs text-slate-500 truncate">
                      {p.barcode || <span className="text-slate-300">—</span>}
                    </div>

                    <div className="text-right text-slate-700">
                      {fmt(p.cost_price)}
                    </div>

                    <div className="text-right font-bold text-slate-900">
                      {fmt(p.unit_price)}
                    </div>

                    <div className="text-right">
                      <MarginBadge pct={mgn} />
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <SellBadge status={p.sell_status} />
                      <ArchiveBadge active={p.active} />
                    </div>

                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => openEdit(p)}
                        className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition opacity-0 group-hover:opacity-100"
                        title="Edit"
                      >
                        <IconEdit />
                      </button>

                      {p.active === false ? (
                        <button
                          onClick={() => handleRestore(p.id)}
                          className="rounded-lg bg-green-50 px-3 h-8 text-xs font-semibold text-green-700 hover:bg-green-100 transition opacity-0 group-hover:opacity-100"
                          title="Restore"
                        >
                          Restore
                        </button>
                      ) : (
                        <button
                          onClick={() => setDeletingProduct(p)}
                          className="grid h-8 w-8 place-items-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition opacity-0 group-hover:opacity-100"
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
                          {p.name || "Unnamed"}
                        </div>
                        {p.category && (
                          <span className="mt-1 inline-block rounded-lg bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                            {p.category}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        <SellBadge status={p.sell_status} />
                        <ArchiveBadge active={p.active} />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 rounded-xl bg-slate-50 border border-slate-100 p-3 text-sm">
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

                    {(p.supplier || p.barcode) && (
                      <div className="text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-0.5">
                        {p.supplier && <span>Supplier: {p.supplier}</span>}
                        {p.barcode && (
                          <span className="font-mono">Barcode: {p.barcode}</span>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => openEdit(p)}
                        className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 py-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition"
                      >
                        <IconEdit /> Edit
                      </button>

                      {p.active === false ? (
                        <button
                          onClick={() => handleRestore(p.id)}
                          className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-green-200 bg-green-50 py-2.5 text-xs font-semibold text-green-700 hover:bg-green-100 transition"
                        >
                          Restore
                        </button>
                      ) : (
                        <button
                          onClick={() => setDeletingProduct(p)}
                          className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition"
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

        <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-between bg-slate-50/50">
          <span className="text-xs text-slate-400">
            Showing {filtered.length} of {items.length} product
            {items.length !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-3">
            {showArchived && (
              <span className="text-xs text-slate-500">
                Includes archived products
              </span>
            )}
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="text-xs font-semibold text-amber-600 hover:text-amber-700 transition"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      </div>

      {showAddModal && (
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
            filteredSizes={addFilteredSizes}
            onSubmit={handleAdd}
            onCancel={() => setShowAddModal(false)}
            saving={saving}
            mode="add"
          />
        </Modal>
      )}

      {editProduct && (
        <Modal
          title="Edit product"
          sub={editProduct.name}
          icon={<IconEdit />}
          iconBg="#dbeafe"
          iconColor="#1e40af"
          onClose={() => setEditProduct(null)}
        >
          <ProductForm
            form={editForm}
            setForm={setEditForm}
            measures={measures}
            filteredSizes={editFilteredSizes}
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
    </div>
  );
}