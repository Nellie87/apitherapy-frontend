"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import { supabase } from "@/lib/supabase/client";
import { listProducts, createProduct, deleteProduct } from "@/lib/api/products";
import { listUnitMeasures, listUnitSizes } from "@/lib/api/lookups";

import * as S from "./page.styles";

/* ─────────────────────────────────────────────
   Types (unchanged)
───────────────────────────────────────────── */
type UnitKind = "mass" | "volume" | "count";

type MeasureLookup = { id: string; name: string; allowed_kinds: UnitKind[] };
type SizeLookup = { id: string; label: string; kind: UnitKind; grams?: number | null; ml?: number | null; count?: number | null };

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
   Helpers (unchanged except toast)
───────────────────────────────────────────── */
const BLANK_FORM: FormData = {
  name: "", category: "", barcode: "", supplier: "", notes: "",
  costPrice: "0", sellPrice: "0", unitMeasureId: "", unitSizeId: "",
  sellStatus: "to_be_sold",
};

function fmt(v: number | string | null | undefined) {
  const n = Number(v || 0);
  return n.toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function margin(cost: number | string | null | undefined, sell: number | string | null | undefined) {
  const c = Number(cost || 0), s = Number(sell || 0);
  if (c <= 0 || s <= 0) return null;
  return ((s - c) / s) * 100;
}

const CATEGORIES = [
  "Raw Honey", "Processed Honey", "Beeswax", "Propolis",
  "Royal Jelly", "Pollen", "Apitherapy", "Equipment", "Packaging", "Other",
];

/* ─────────────────────────────────────────────
   Icons (slightly larger)
───────────────────────────────────────────── */
const IconPlus = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const IconSearch = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const IconTrash = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14zM10 11v6M14 11v6" />
  </svg>
);

const IconEdit = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const IconCheck = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconX = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

/* ─────────────────────────────────────────────
   Toast
───────────────────────────────────────────── */
function Toast({ message, type = "success", onClose }: {
  message: string;
  type?: "success" | "error";
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl px-6 py-4 shadow-2xl text-white text-base font-medium transition-all duration-300 ${
      type === "success" ? "bg-green-600" : "bg-red-600"
    }`}>
      {type === "success" ? <IconCheck /> : <IconX />}
      <span>{message}</span>
      <button onClick={onClose} className="ml-2 text-white/80 hover:text-white">
        <IconX />
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────
   KPI Card
───────────────────────────────────────────── */
function KpiCard({ icon, label, value, sub, variant = "neutral" }: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
  variant?: "neutral" | "success" | "warning" | "info";
}) {
  const cfg = {
    neutral: { bg: "#ffffff", border: "#e2e8f0", iconBg: "#f8fafc", iconColor: "#475569", valueColor: "#0f172a", subColor: "#64748b" },
    success: { bg: "#f0fdf4", border: "#bbf7d0", iconBg: "#dcfce7", iconColor: "#166534", valueColor: "#166534", subColor: "#4ade80" },
    warning: { bg: "#fffbeb", border: "#fde68a", iconBg: "#fef3c7", iconColor: "#92400e", valueColor: "#92400e", subColor: "#d97706" },
    info:    { bg: "#eff6ff", border: "#bfdbfe", iconBg: "#dbeafe", iconColor: "#1e40af", valueColor: "#1e40af", subColor: "#3b82f6" },
  }[variant];

  return (
    <div className="rounded-2xl p-6 transition-all hover:shadow-lg" style={{ background: cfg.bg, border: `1.5px solid ${cfg.border}` }}>
      <div className="flex items-center gap-5">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl text-2xl" style={{ background: cfg.iconBg, color: cfg.iconColor }}>
          {icon}
        </div>
        <div>
          <div className="text-base font-semibold uppercase tracking-wider" style={{ color: cfg.subColor }}>{label}</div>
          <div className="mt-1 text-4xl font-bold leading-none" style={{ color: cfg.valueColor }}>{value}</div>
          {sub && <div className="mt-2 text-base" style={{ color: cfg.subColor }}>{sub}</div>}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Margin & Sell Badges (larger)
───────────────────────────────────────────── */
function MarginBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-base text-slate-400">—</span>;
  const good = pct >= 30;
  const ok = pct >= 10;
  return (
    <span className={`inline-flex items-center rounded-full px-4 py-1.5 text-base font-bold ${
      good ? "bg-green-100 text-green-700" : ok ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
    }`}>
      {pct.toFixed(0)}%
    </span>
  );
}

function SellBadge({ status }: { status?: string }) {
  const forSale = status !== "not_to_be_sold";
  return forSale
    ? <span className="inline-flex items-center gap-2 rounded-full bg-green-100 px-4 py-1.5 text-base font-semibold text-green-700">
        <span className="h-3 w-3 rounded-full bg-green-500" />For sale
      </span>
    : <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-1.5 text-base font-semibold text-slate-500">
        <span className="h-3 w-3 rounded-full bg-slate-400" />Inactive
      </span>;
}

/* ─────────────────────────────────────────────
   Delete Modal
───────────────────────────────────────────── */
function DeleteModal({ product, onConfirm, onCancel, loading }: {
  product: Product; onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onCancel}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl p-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-5 mb-6">
          <div className="grid h-16 w-16 place-items-center rounded-xl bg-red-100 text-red-600 text-4xl">🗑️</div>
          <div>
            <div className="text-2xl font-bold text-slate-900">Delete Product?</div>
            <div className="text-base text-slate-600 mt-1">This cannot be undone.</div>
          </div>
        </div>
        <div className="rounded-xl bg-slate-50 px-5 py-4 mb-8 text-lg font-medium text-slate-800">
          {product.name}
        </div>
        <div className="flex gap-4">
          <button onClick={onCancel} className="flex-1 rounded-xl border border-slate-300 py-4 text-slate-700 text-lg font-semibold hover:bg-slate-50 transition">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 rounded-xl bg-red-600 py-4 text-white text-lg font-semibold hover:bg-red-700 disabled:opacity-50 transition">
            {loading ? "Deleting…" : "Yes, Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Product Form (now used in modal)
───────────────────────────────────────────── */
function ProductForm({
  form, setForm, measures, filteredSizes, onSubmit, onCancel, saving, mode,
}: {
  form: FormData; setForm: React.Dispatch<React.SetStateAction<FormData>>;
  measures: MeasureLookup[]; filteredSizes: SizeLookup[];
  onSubmit: (e: React.FormEvent) => void; onCancel: () => void;
  saving: boolean; mode: "add" | "edit";
}) {
  const set = (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const marginPct = margin(form.costPrice, form.sellPrice);

  return (
    <form onSubmit={onSubmit} className="space-y-6 text-base">
      {/* Name + Category */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="mb-2 block text-base font-semibold text-slate-700">
            Product Name <span className="text-red-500 text-lg">*</span>
          </label>
          <input
            className={`${S.inputCls} text-base py-3 px-4`}
            placeholder="e.g. Raw Honey 500g"
            value={form.name}
            onChange={set("name")}
            required
          />
        </div>
        <div>
          <label className="mb-2 block text-base font-semibold text-slate-700">Category</label>
          <select className={`${S.selectCls} text-base py-3 px-4`} value={form.category} onChange={set("category")}>
            <option value="">— Select category —</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Supplier + Barcode */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="mb-2 block text-base font-semibold text-slate-700">Supplier</label>
          <input className={`${S.inputCls} text-base py-3 px-4`} placeholder="Supplier name" value={form.supplier} onChange={set("supplier")} />
        </div>
        <div>
          <label className="mb-2 block text-base font-semibold text-slate-700">Barcode</label>
          <input className={`${S.inputCls} text-base py-3 px-4 font-mono`} placeholder="EAN / UPC (optional)" value={form.barcode} onChange={set("barcode")} />
        </div>
      </div>

      {/* Cost + Sell + Margin */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="mb-2 block text-base font-semibold text-slate-700">Cost Price (Ksh)</label>
          <input className={`${S.inputCls} text-base py-3 px-4`} type="number" min="0" step="0.01" value={form.costPrice} onChange={set("costPrice")} />
        </div>
        <div>
          <label className="mb-2 block text-base font-semibold text-slate-700">Sell Price (Ksh)</label>
          <input className={`${S.inputCls} text-base py-3 px-4`} type="number" min="0" step="0.01" value={form.sellPrice} onChange={set("sellPrice")} />
        </div>
        <div>
          <label className="mb-2 block text-base font-semibold text-slate-700">Margin</label>
          <div className="flex h-14 items-center rounded-xl border border-slate-200 bg-slate-50 px-5 text-xl font-bold">
            {marginPct !== null ? (
              <span className={marginPct >= 30 ? "text-green-600" : marginPct >= 10 ? "text-amber-600" : "text-red-600"}>
                {marginPct.toFixed(1)}%
              </span>
            ) : (
              <span className="text-slate-400 text-xl">—</span>
            )}
          </div>
        </div>
      </div>

      {/* Unit Measure + Size + Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="mb-2 block text-base font-semibold text-slate-700">Unit of Measure</label>
          <select className={`${S.selectCls} text-base py-3 px-4`} value={form.unitMeasureId} onChange={set("unitMeasureId")}>
            {measures.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-2 block text-base font-semibold text-slate-700">Unit Size</label>
          <select className={`${S.selectCls} text-base py-3 px-4`} value={form.unitSizeId} onChange={set("unitSizeId")} disabled={!filteredSizes.length}>
            {!filteredSizes.length ? <option value="">Select measure first</option> : filteredSizes.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-2 block text-base font-semibold text-slate-700">Sell Status</label>
          <select className={`${S.selectCls} text-base py-3 px-4`} value={form.sellStatus} onChange={set("sellStatus") as any}>
            <option value="to_be_sold">For sale</option>
            <option value="not_to_be_sold">Not for sale</option>
          </select>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="mb-2 block text-base font-semibold text-slate-700">Notes</label>
        <textarea
          rows={4}
          className={`${S.inputCls} text-base py-3 px-4 resize-none`}
          placeholder="Batch details, allergies, storage info, etc."
          value={form.notes}
          onChange={set("notes")}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-4 pt-6">
        <button type="button" onClick={onCancel} className="px-8 py-4 rounded-xl border border-slate-300 text-slate-700 text-lg font-semibold hover:bg-slate-50 transition">
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !form.name.trim()}
          className="px-8 py-4 rounded-xl bg-amber-500 text-white text-lg font-semibold hover:bg-amber-600 disabled:opacity-50 transition flex items-center gap-3"
        >
          {saving ? "Saving…" : mode === "add" ? "Add Product" : "Save Changes"}
        </button>
      </div>
    </form>
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
  const [sizes, setSizes] = useState<SizeLookup[]>([]);

  // UI state
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [filterStatus, setFilterStatus] = useState<"" | "to_be_sold" | "not_to_be_sold">("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);

  // Forms
  const [addForm, setAddForm] = useState<FormData>({ ...BLANK_FORM });
  const [editForm, setEditForm] = useState<FormData>({ ...BLANK_FORM });

  async function refresh(o: string) {
    setItems(await listProducts(o));
  }

  useEffect(() => {
    (async () => {
      try {
        const o = await bootstrapOrg();
        setOrgId(o);
        const [uoms, usizes] = await Promise.all([listUnitMeasures(o), listUnitSizes(o)]);
        setMeasures(uoms as MeasureLookup[]);
        setSizes(usizes as SizeLookup[]);
        const firstId = uoms?.[0]?.id ?? "";
        const firstAllowed = (uoms?.[0] as MeasureLookup)?.allowed_kinds ?? [];
        const firstSizeId = (usizes as SizeLookup[]).find((s) => firstAllowed.includes(s.kind))?.id ?? "";
        setAddForm((f) => ({ ...f, unitMeasureId: firstId, unitSizeId: firstSizeId }));
        await refresh(o);
      } catch (e: any) {
        setErr(e.message ?? String(e));
      }
    })();
  }, []);

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
    if (addFilteredSizes.length && !addFilteredSizes.find((s) => s.id === addForm.unitSizeId)) {
      setAddForm((f) => ({ ...f, unitSizeId: addFilteredSizes[0].id }));
    }
  }, [addFilteredSizes]);

  useEffect(() => {
    if (editFilteredSizes.length && !editFilteredSizes.find((s) => s.id === editForm.unitSizeId)) {
      setEditForm((f) => ({ ...f, unitSizeId: editFilteredSizes[0].id }));
    }
  }, [editFilteredSizes]);

  const allCategories = useMemo(() => {
    const fromData = Array.from(new Set(items.map((p) => p.category).filter(Boolean))) as string[];
    return Array.from(new Set([...CATEGORIES, ...fromData])).sort();
  }, [items]);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return items.filter((p) => {
      const matchText = !t || 
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
    const active = items.filter((p) => p.sell_status !== "not_to_be_sold").length;
    const avgMargin = items.reduce((sum, p) => {
      const m = margin(p.cost_price, p.unit_price);
      return sum + (m ?? 0);
    }, 0) / (items.length || 1);
    const categories = new Set(items.map((p) => p.category).filter(Boolean)).size;
    return { total, active, avgMargin, categories };
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
        await supabase.from("products").update({ category: addForm.category }).eq("id", created.id);
      }
      setAddForm({ ...BLANK_FORM, unitMeasureId: addForm.unitMeasureId, unitSizeId: addForm.unitSizeId });
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
      setToast({ message: "Product updated successfully", type: "success" });
    } catch (e: any) {
      setErr(e.message ?? String(e));
      setToast({ message: "Failed to update product", type: "error" });
    } finally {
      setSaving(false);
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

  async function confirmDelete() {
    if (!orgId || !deletingProduct) return;
    setDeleting(true);
    try {
      await deleteProduct(orgId, deletingProduct.id);
      setDeletingProduct(null);
      await refresh(orgId);
      setToast({ message: "Product deleted successfully", type: "success" });
    } catch (e: any) {
      setErr(e.message ?? String(e));
      setToast({ message: "Failed to delete product", type: "error" });
    } finally {
      setDeleting(false);
    }
  }

  const HEADERS = ["Product", "Category", "Supplier", "Barcode", "Cost", "Sell", "Margin", "Status", "Actions"];

  if (!orgId && !err) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-4 text-slate-500 text-lg">
          <svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" strokeOpacity="0.2" />
            <path d="M12 2a10 10 0 0110 10" />
          </svg>
          <span className="font-medium">Loading catalog…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Error */}
      {err && (
        <div className="flex items-start gap-4 rounded-xl border border-red-200 bg-red-50 px-6 py-4 text-lg text-red-700">
          <span className="mt-1 text-2xl">⚠️</span>
          <span className="flex-1">{err}</span>
          <button onClick={() => setErr("")} className="shrink-0 text-red-400 hover:text-red-600 text-3xl leading-none">×</button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Product Catalog</h1>
          <p className="mt-3 text-xl text-slate-600">
            Manage products, pricing, units and availability
          </p>
        </div>
        <button
          className="inline-flex items-center gap-3 rounded-xl bg-amber-500 px-8 py-4 text-xl font-semibold text-white hover:bg-amber-600 transition shadow-md"
          onClick={() => setShowAddModal(true)}
        >
          <IconPlus />
          Add New Product
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-6 lg:grid-cols-5">
        <KpiCard icon="📦" label="Total Products" value={String(kpis.total)} sub="in catalog" variant="neutral" />
        <KpiCard icon="✅" label="Active" value={String(kpis.active)} sub="for sale" variant="success" />
        <KpiCard icon="🏷️" label="Categories" value={String(kpis.categories)} sub="product groups" variant="info" />
        <KpiCard icon="📈" label="Avg Margin" value={`${kpis.avgMargin.toFixed(0)}%`} sub="gross margin" variant={kpis.avgMargin >= 30 ? "success" : kpis.avgMargin >= 10 ? "warning" : "neutral"} />
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap gap-4 items-end">
        <label className="flex-1 min-w-[320px] relative">
          <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400">
            <IconSearch />
          </div>
          <input
            className="w-full rounded-xl border border-slate-300 bg-white pl-14 pr-5 py-4 text-lg focus:border-amber-500 focus:ring-2 focus:ring-amber-100 outline-none transition"
            placeholder="Search by name, supplier, barcode…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>

        <select
          className="rounded-xl border border-slate-300 bg-white px-5 py-4 text-lg text-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-100 outline-none transition"
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
        >
          <option value="">All categories</option>
          {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <select
          className="rounded-xl border border-slate-300 bg-white px-5 py-4 text-lg text-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-100 outline-none transition"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
        >
          <option value="">All statuses</option>
          <option value="to_be_sold">For sale</option>
          <option value="not_to_be_sold">Inactive</option>
        </select>

        {(search || filterCat || filterStatus) && (
          <button
            onClick={() => {
              setSearch("");
              setFilterCat("");
              setFilterStatus("");
            }}
            className="text-lg font-semibold text-amber-600 hover:text-amber-700 transition"
          >
            Clear filters
          </button>
        )}

        <span className="ml-auto text-lg text-slate-500 whitespace-nowrap">
          {filtered.length} / {items.length} products
        </span>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Desktop Header – centered */}
        <div
          className="hidden lg:grid items-center gap-4 px-6 py-5 text-base font-semibold uppercase tracking-wider text-slate-600 bg-slate-50 border-b border-slate-200"
          style={{ gridTemplateColumns: "2fr 1fr 1.2fr 1fr 0.9fr 0.9fr 0.8fr 1fr 140px" }}
        >
          {HEADERS.map((h) => (
            <div key={h} className="text-center">{h}</div>
          ))}
        </div>

        <div className="divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <div className="py-24 text-center">
              <div className="text-6xl mb-5">🍯</div>
              <p className="text-2xl font-semibold text-slate-700">
                {items.length === 0 ? "No products yet" : "No matching products"}
              </p>
              <p className="text-lg text-slate-500 mt-3">
                {items.length === 0 ? 'Click "Add New Product" to get started' : "Try adjusting your filters"}
              </p>
            </div>
          ) : (
            filtered.map((p) => {
              const mgn = margin(p.cost_price, p.unit_price);

              return (
                <div key={p.id} className="transition-colors hover:bg-slate-50/70">
                  {/* Desktop Row – centered text */}
                  <div
                    className="hidden lg:grid items-center gap-4 px-6 py-5 text-base"
                    style={{ gridTemplateColumns: "2fr 1fr 1.2fr 1fr 0.9fr 0.9fr 0.8fr 1fr 140px" }}
                  >
                    <div className="text-center font-medium text-slate-900">{p.name || "Unnamed"}</div>
                    <div className="text-center">
                      {p.category ? <span className="rounded-lg bg-blue-50 px-4 py-1.5 text-base text-blue-700">{p.category}</span> : "—"}
                    </div>
                    <div className="text-center text-slate-600">{p.supplier || "—"}</div>
                    <div className="text-center font-mono text-slate-500">{p.barcode || "—"}</div>
                    <div className="text-center text-slate-700 font-medium">{fmt(p.cost_price)}</div>
                    <div className="text-center font-bold text-slate-900">{fmt(p.unit_price)}</div>
                    <div className="text-center"><MarginBadge pct={mgn} /></div>
                    <div className="text-center"><SellBadge status={p.sell_status} /></div>
                    <div className="flex items-center justify-center gap-4">
                      <button
                        onClick={() => openEdit(p)}
                        className="grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition text-xl"
                        title="Edit product"
                      >
                        <IconEdit />
                      </button>
                      <button
                        onClick={() => setDeletingProduct(p)}
                        className="grid h-12 w-12 place-items-center rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition text-xl"
                        title="Delete product"
                      >
                        <IconTrash />
                      </button>
                    </div>
                  </div>

                  {/* Mobile Card */}
                  <div className="lg:hidden px-6 py-6 space-y-5 border-b border-slate-100 last:border-b-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="text-xl font-semibold text-slate-900">{p.name || "Unnamed"}</div>
                        {p.category && <div className="mt-2 inline-block rounded-lg bg-blue-50 px-4 py-1.5 text-base text-blue-700">{p.category}</div>}
                      </div>
                      <SellBadge status={p.sell_status} />
                    </div>

                    <div className="grid grid-cols-2 gap-5 rounded-xl bg-slate-50 p-5 text-base">
                      <div>
                        <div className="text-sm text-slate-500 font-semibold">Cost</div>
                        <div className="font-medium text-slate-800 mt-1 text-lg">{fmt(p.cost_price)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-slate-500 font-semibold">Sell</div>
                        <div className="font-bold text-slate-900 mt-1 text-lg">{fmt(p.unit_price)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-slate-500 font-semibold">Margin</div>
                        <div className="mt-1"><MarginBadge pct={mgn} /></div>
                      </div>
                    </div>

                    {(p.supplier || p.barcode) && (
                      <div className="text-base text-slate-500">
                        {p.supplier && <span>Supplier: {p.supplier}</span>}
                        {p.supplier && p.barcode && <span className="mx-4">•</span>}
                        {p.barcode && <span className="font-mono">Barcode: {p.barcode}</span>}
                      </div>
                    )}

                    <div className="flex gap-4 pt-3">
                      <button
                        onClick={() => openEdit(p)}
                        className="flex-1 flex items-center justify-center gap-3 rounded-xl border border-blue-200 bg-blue-50 py-4 text-blue-700 text-lg font-semibold hover:bg-blue-100 transition"
                      >
                        <IconEdit /> Edit
                      </button>
                      <button
                        onClick={() => setDeletingProduct(p)}
                        className="flex-1 flex items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50 py-4 text-red-700 text-lg font-semibold hover:bg-red-100 transition"
                      >
                        <IconTrash /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-6 py-5 flex items-center justify-between bg-slate-50">
          <span className="text-lg text-slate-500">
            Showing {filtered.length} of {items.length} product{items.length !== 1 ? "s" : ""}
          </span>
          {(search || filterCat || filterStatus) && (
            <button
              onClick={() => {
                setSearch("");
                setFilterCat("");
                setFilterStatus("");
              }}
              className="text-lg font-semibold text-amber-600 hover:text-amber-700 transition"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Add Modal (Popup) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowAddModal(false)}>
          <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-8 py-6 shrink-0">
              <div className="flex items-center gap-5">
                <div className="grid h-16 w-16 place-items-center rounded-xl bg-amber-100 text-amber-600 text-3xl">
                  <IconPlus />
                </div>
                <div>
                  <div className="text-3xl font-bold text-slate-900">Add New Product</div>
                  <div className="text-lg text-slate-600 mt-1">Fill in the product details below</div>
                </div>
              </div>
              <button onClick={() => setShowAddModal(false)} className="grid h-14 w-14 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 transition text-2xl">
                <IconX />
              </button>
            </div>
            <div className="overflow-y-auto p-8">
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
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setEditProduct(null)}>
          <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-8 py-6 shrink-0">
              <div className="flex items-center gap-5">
                <div className="grid h-16 w-16 place-items-center rounded-xl bg-blue-100 text-blue-600 text-3xl">
                  <IconEdit />
                </div>
                <div>
                  <div className="text-3xl font-bold text-slate-900">Edit Product</div>
                  <div className="text-lg text-slate-600 mt-1 truncate max-w-2xl">{editProduct.name}</div>
                </div>
              </div>
              <button onClick={() => setEditProduct(null)} className="grid h-14 w-14 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 transition text-2xl">
                <IconX />
              </button>
            </div>
            <div className="overflow-y-auto p-8">
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
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deletingProduct && (
        <DeleteModal
          product={deletingProduct}
          onConfirm={confirmDelete}
          onCancel={() => setDeletingProduct(null)}
          loading={deleting}
        />
      )}
    </div>
  );
}