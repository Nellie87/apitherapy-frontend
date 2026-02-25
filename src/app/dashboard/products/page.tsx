"use client";

import React, { useEffect, useMemo, useState } from "react";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import { listProducts, createProduct, deleteProduct } from "@/lib/api/products";
import { listUnitMeasures, listUnitSizes } from "@/lib/api/lookups";
import { supabase } from "@/lib/supabase/client";

import * as S from "./page.styles";

/* ─────────────────────────────────────────────
   Types
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
   Helpers
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
  const pct = ((s - c) / s) * 100;
  return pct;
}

const CATEGORIES = [
  "Raw Honey", "Processed Honey", "Beeswax", "Propolis",
  "Royal Jelly", "Pollen", "Apitherapy", "Equipment", "Packaging", "Other",
];

/* ─────────────────────────────────────────────
   Icons
───────────────────────────────────────────── */
const IconPlus = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="10" y1="4" x2="10" y2="16" /><line x1="4" y1="10" x2="16" y2="10" />
  </svg>
);
const IconSearch = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2">
    <circle cx="9" cy="9" r="5.5" /><line x1="13.5" y1="13.5" x2="18" y2="18" />
  </svg>
);
const IconTrash = () => (
  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 6h12M8 6V4a1 1 0 011-1h2a1 1 0 011 1v2m-6 0v10a1 1 0 001 1h6a1 1 0 001-1V6M9 10v3M11 10v3" />
  </svg>
);
const IconEdit = () => (
  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M13.5 3.5L16.5 6.5L8 15H5v-3L13.5 3.5z" />
  </svg>
);
const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="4,10 8,14 16,6" />
  </svg>
);
const IconX = () => (
  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="5" y1="5" x2="15" y2="15" /><line x1="15" y1="5" x2="5" y2="15" />
  </svg>
);

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
    <div className="rounded-2xl p-5 transition-all hover:shadow-md"
      style={{ background: cfg.bg, border: `1.5px solid ${cfg.border}` }}>
      <div className="flex items-start gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-lg"
          style={{ background: cfg.iconBg, color: cfg.iconColor }}>{icon}</div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: cfg.subColor }}>{label}</div>
          <div className="mt-1 text-2xl font-bold leading-none" style={{ color: cfg.valueColor }}>{value}</div>
          {sub && <div className="mt-1 text-xs font-medium" style={{ color: cfg.subColor }}>{sub}</div>}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Margin Badge
───────────────────────────────────────────── */
function MarginBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-xs text-slate-400">—</span>;
  const good = pct >= 30;
  const ok = pct >= 10;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${
      good ? "bg-green-100 text-green-700" : ok ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
    }`}>
      {pct.toFixed(0)}%
    </span>
  );
}

/* ─────────────────────────────────────────────
   Status Badge
───────────────────────────────────────────── */
function SellBadge({ status }: { status?: string }) {
  const forSale = status !== "not_to_be_sold";
  return forSale
    ? <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700"><span className="h-1.5 w-1.5 rounded-full bg-green-500" />For sale</span>
    : <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500"><span className="h-1.5 w-1.5 rounded-full bg-slate-400" />Inactive</span>;
}

/* ─────────────────────────────────────────────
   Delete Confirm Modal
───────────────────────────────────────────── */
function DeleteModal({ product, onConfirm, onCancel, loading }: {
  product: Product; onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-4 mb-4">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-red-100 text-red-600 text-2xl">🗑️</div>
          <div>
            <div className="font-bold text-slate-900">Delete Product?</div>
            <div className="text-sm text-slate-500 mt-0.5">This cannot be undone.</div>
          </div>
        </div>
        <div className="rounded-xl bg-slate-50 px-4 py-3 mb-5 text-sm font-semibold text-slate-800">
          {product.name}
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className={S.btnGhost + " flex-1 justify-center"}>Cancel</button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 justify-center inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-50 transition">
            {loading ? "Deleting…" : "Yes, delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Product Form (shared for Add + Edit modal)
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
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Row 1: Name + Category */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Product Name *</label>
          <input className={S.inputCls} placeholder="e.g. Raw Honey 500g" value={form.name} onChange={set("name")} required />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Category</label>
          <select className={S.selectCls} style={S.selectChevronStyle} value={form.category} onChange={set("category")}>
            <option value="">— Uncategorised —</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Row 2: Supplier + Barcode */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Supplier</label>
          <input className={S.inputCls} placeholder="Supplier name" value={form.supplier} onChange={set("supplier")} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Barcode</label>
          <input className={S.inputCls} placeholder="EAN / UPC (optional)" value={form.barcode} onChange={set("barcode")} />
        </div>
      </div>

      {/* Row 3: Cost + Sell + live margin */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Cost Price (Ksh)</label>
          <input className={S.inputCls} type="number" min="0" step="0.01" value={form.costPrice} onChange={set("costPrice")} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Sell Price (Ksh)</label>
          <input className={S.inputCls} type="number" min="0" step="0.01" value={form.sellPrice} onChange={set("sellPrice")} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Margin</label>
          <div className="flex h-9 items-center rounded-xl border border-slate-200 bg-slate-50 px-3.5">
            {marginPct !== null
              ? <span className={`text-sm font-bold ${marginPct >= 30 ? "text-green-600" : marginPct >= 10 ? "text-amber-600" : "text-red-600"}`}>{marginPct.toFixed(1)}%</span>
              : <span className="text-sm text-slate-400">—</span>}
          </div>
        </div>
      </div>

      {/* Row 4: UOM + Size + Status */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Unit of Measure</label>
          <select className={S.selectCls} style={S.selectChevronStyle} value={form.unitMeasureId} onChange={set("unitMeasureId")}>
            {measures.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Unit Size</label>
          <select className={S.selectCls} style={S.selectChevronStyle} value={form.unitSizeId} onChange={set("unitSizeId")} disabled={!filteredSizes.length}>
            {!filteredSizes.length ? <option value="">Select measure first</option> : filteredSizes.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Sell Status</label>
          <select className={S.selectCls} style={S.selectChevronStyle} value={form.sellStatus} onChange={set("sellStatus") as any}>
            <option value="to_be_sold">For sale</option>
            <option value="not_to_be_sold">Not for sale</option>
          </select>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Notes</label>
        <textarea rows={2} className={S.inputCls + " resize-none"} placeholder="Batch details, allergies, etc." value={form.notes} onChange={set("notes")} />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className={S.btnGhost}>Cancel</button>
        <button type="submit" disabled={saving || !form.name.trim()} className={S.btnPrimary}>
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
  const [measures, setMeasures] = useState<MeasureLookup[]>([]);
  const [sizes, setSizes] = useState<SizeLookup[]>([]);

  // UI state
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [filterStatus, setFilterStatus] = useState<"" | "to_be_sold" | "not_to_be_sold">("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);

  // Forms
  const [addForm, setAddForm] = useState<FormData>({ ...BLANK_FORM });
  const [editForm, setEditForm] = useState<FormData>({ ...BLANK_FORM });

  async function refresh(o: string) { setItems(await listProducts(o)); }

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
      } catch (e: any) { setErr(e.message ?? String(e)); }
    })();
  }, []);

  // Filtered sizes for add form
  const addFilteredSizes = useMemo(() => {
    const m = measures.find((m) => m.id === addForm.unitMeasureId);
    if (!m) return sizes;
    return sizes.filter((s) => m.allowed_kinds.includes(s.kind));
  }, [sizes, measures, addForm.unitMeasureId]);

  // Filtered sizes for edit form
  const editFilteredSizes = useMemo(() => {
    const m = measures.find((m) => m.id === editForm.unitMeasureId);
    if (!m) return sizes;
    return sizes.filter((s) => m.allowed_kinds.includes(s.kind));
  }, [sizes, measures, editForm.unitMeasureId]);

  // Auto-pick first size when measure changes
  useEffect(() => {
    if (addFilteredSizes.length && !addFilteredSizes.find((s) => s.id === addForm.unitSizeId))
      setAddForm((f) => ({ ...f, unitSizeId: addFilteredSizes[0].id }));
  }, [addFilteredSizes]);

  useEffect(() => {
    if (editFilteredSizes.length && !editFilteredSizes.find((s) => s.id === editForm.unitSizeId))
      setEditForm((f) => ({ ...f, unitSizeId: editFilteredSizes[0].id }));
  }, [editFilteredSizes]);

  // Categories derived from data (+ preset list)
  const allCategories = useMemo(() => {
    const fromData = Array.from(new Set(items.map((p) => p.category).filter(Boolean))) as string[];
    return Array.from(new Set([...CATEGORIES, ...fromData])).sort();
  }, [items]);

  // Filtered rows
  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return items.filter((p) => {
      const matchText = !t || (p.name ?? "").toLowerCase().includes(t) || (p.barcode ?? "").toLowerCase().includes(t) || (p.supplier ?? "").toLowerCase().includes(t) || (p.category ?? "").toLowerCase().includes(t);
      const matchCat = !filterCat || p.category === filterCat;
      const matchStatus = !filterStatus || p.sell_status === filterStatus;
      return matchText && matchCat && matchStatus;
    });
  }, [items, search, filterCat, filterStatus]);

  // KPIs
  const kpis = useMemo(() => {
    const total = items.length;
    const active = items.filter((p) => p.sell_status !== "not_to_be_sold").length;
    const avgMargin = items.reduce((sum, p) => {
      const m = margin(p.cost_price, p.unit_price);
      return sum + (m ?? 0);
    }, 0) / (items.length || 1);
    const catalogValue = items.reduce((s, p) => s + Number(p.unit_price ?? 0), 0);
    const categories = new Set(items.map((p) => p.category).filter(Boolean)).size;
    return { total, active, avgMargin, catalogValue, categories };
  }, [items]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    setSaving(true); setErr("");
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
      // Patch category separately since it may not be in createProduct's type
      if (addForm.category && created?.id) {
        await supabase.from("products").update({ category: addForm.category }).eq("id", created.id);
      }
      setAddForm({ ...BLANK_FORM, unitMeasureId: addForm.unitMeasureId, unitSizeId: addForm.unitSizeId });
      setShowAddForm(false);
      await refresh(orgId);
    } catch (e: any) { setErr(e.message ?? String(e)); } finally { setSaving(false); }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId || !editProduct) return;
    setSaving(true); setErr("");
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
    } catch (e: any) { setErr(e.message ?? String(e)); } finally { setSaving(false); }
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
    } catch (e: any) { setErr(e.message ?? String(e)); } finally { setDeleting(false); }
  }

  // ── Table headers: 9 columns matching tableGridCols ──
  const HEADERS = ["Product", "Category", "Supplier", "Barcode", "Cost", "Sell", "Margin", "Status", ""];

  if (!orgId && !err) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" strokeOpacity="0.2" /><path d="M12 2a10 10 0 0110 10" />
          </svg>
          <span className="text-sm font-medium">Loading catalog…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 h-full">

      {/* ── Error ── */}
      {err && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
          <span className="mt-0.5 shrink-0">⚠️</span>
          <span className="flex-1">{err}</span>
          <button onClick={() => setErr("")} className="shrink-0 text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* ── Page header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Product Catalog</h1>
          <p className="mt-1 text-sm text-slate-500">Manage products, pricing, units and availability</p>
        </div>
        <button className={S.btnPrimary} onClick={() => { setShowAddForm((v) => !v); }}>
          <IconPlus />
          {showAddForm ? "Cancel" : "Add Product"}
        </button>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiCard icon="📦" label="Total Products" value={String(kpis.total)} sub="in catalog" variant="neutral" />
        <KpiCard icon="✅" label="Active" value={String(kpis.active)} sub="for sale" variant="success" />
        <KpiCard icon="🏷️" label="Categories" value={String(kpis.categories)} sub="product groups" variant="info" />
        <KpiCard icon="📈" label="Avg Margin" value={`${kpis.avgMargin.toFixed(0)}%`} sub="gross margin" variant={kpis.avgMargin >= 30 ? "success" : kpis.avgMargin >= 10 ? "warning" : "neutral"} />
        <KpiCard icon="💰" label="Catalog Value" value={`Ksh ${fmt(kpis.catalogValue)}`} sub="total sell prices" variant="neutral" />
      </div>

      {/* ── Add Form (collapsible) ── */}
      {showAddForm && (
        <div className={`${S.cardCls} p-6`}>
          <div className="flex items-center gap-3 mb-5">
            <div className={S.iconChip}><IconPlus /></div>
            <div>
              <div className="font-bold text-slate-900">New Product</div>
              <div className="text-xs text-slate-500">Fill in the details below</div>
            </div>
          </div>
          <ProductForm
            form={addForm} setForm={setAddForm}
            measures={measures} filteredSizes={addFilteredSizes}
            onSubmit={handleAdd} onCancel={() => setShowAddForm(false)}
            saving={saving} mode="add"
          />
        </div>
      )}

      {/* ── Search + Filters ── */}
      <div className="flex flex-wrap gap-3 items-center">
        <label className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 shadow-sm focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-100 transition flex-1 min-w-[200px] max-w-xs">
          <IconSearch />
          <input className="flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 min-w-0"
            placeholder="Search name, supplier, barcode…" value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && <button onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600 shrink-0"><IconX /></button>}
        </label>

        <select className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-100 outline-none"
          value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
          <option value="">All categories</option>
          {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <select className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-100 outline-none"
          value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)}>
          <option value="">All statuses</option>
          <option value="to_be_sold">For sale</option>
          <option value="not_to_be_sold">Inactive</option>
        </select>

        {(search || filterCat || filterStatus) && (
          <button onClick={() => { setSearch(""); setFilterCat(""); setFilterStatus(""); }}
            className="text-sm font-medium text-amber-600 hover:text-amber-700">
            Clear filters
          </button>
        )}

        <span className="ml-auto text-xs text-slate-400 whitespace-nowrap">
          {filtered.length} / {items.length} product{items.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Table ── */}
      <div className={`${S.cardCls} overflow-hidden flex-1`}>

        {/* Desktop header */}
        <div className="hidden lg:grid items-center gap-4 px-5 py-3"
          style={{ gridTemplateColumns: S.tableGridCols, background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
          {HEADERS.map((h, i) => (
            <div key={i} className="text-xs font-semibold uppercase tracking-wider text-slate-500">{h}</div>
          ))}
        </div>

        <div className="divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <div className="py-20 text-center">
              <div className="text-5xl mb-4">🍯</div>
              <p className="font-semibold text-slate-700">
                {items.length === 0 ? "No products yet" : "No matching products"}
              </p>
              <p className="text-sm text-slate-400 mt-1">
                {items.length === 0 ? 'Click "Add Product" to get started' : "Try adjusting your filters"}
              </p>
            </div>
          ) : (
            filtered.map((p) => {
              const mgn = margin(p.cost_price, p.unit_price);

              return (
                <div key={p.id} className="transition-colors hover:bg-slate-50 group">

                  {/* Desktop row: 9 cells */}
                  <div className="hidden lg:grid items-center gap-4 px-5 py-3.5"
                    style={{ gridTemplateColumns: S.tableGridCols }}>

                    {/* 1. Product */}
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate text-sm">{p.name || "Unnamed"}</div>
                      {p.notes && <div className="text-xs text-slate-400 truncate mt-0.5">{p.notes}</div>}
                    </div>

                    {/* 2. Category */}
                    <div>
                      {p.category
                        ? <span className="rounded-lg bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{p.category}</span>
                        : <span className="text-xs text-slate-400">—</span>}
                    </div>

                    {/* 3. Supplier */}
                    <div className="text-sm text-slate-600 truncate">{p.supplier || <span className="text-slate-400">—</span>}</div>

                    {/* 4. Barcode */}
                    <div className="font-mono text-xs text-slate-500 truncate">{p.barcode || <span className="text-slate-400">—</span>}</div>

                    {/* 5. Cost */}
                    <div className="text-sm text-slate-600 font-medium">{fmt(p.cost_price)}</div>

                    {/* 6. Sell */}
                    <div className="text-sm font-bold text-slate-900">{fmt(p.unit_price)}</div>

                    {/* 7. Margin */}
                    <div><MarginBadge pct={mgn} /></div>

                    {/* 8. Status */}
                    <div><SellBadge status={p.sell_status} /></div>

                    {/* 9. Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(p)}
                        className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-amber-50 hover:text-amber-600 transition"
                        title="Edit">
                        <IconEdit />
                      </button>
                      <button onClick={() => setDeletingProduct(p)}
                        className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition"
                        title="Delete">
                        <IconTrash />
                      </button>
                    </div>
                  </div>

                  {/* Mobile card */}
                  <div className="lg:hidden px-5 py-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-slate-900">{p.name || "Unnamed"}</div>
                        {p.category && <span className="mt-1 inline-block rounded-lg bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{p.category}</span>}
                      </div>
                      <SellBadge status={p.sell_status} />
                    </div>

                    <div className="grid grid-cols-3 gap-3 rounded-xl bg-slate-50 p-3 text-sm">
                      <div>
                        <div className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Cost</div>
                        <div className="font-medium text-slate-700 mt-0.5">{fmt(p.cost_price)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Sell</div>
                        <div className="font-bold text-slate-900 mt-0.5">{fmt(p.unit_price)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Margin</div>
                        <div className="mt-0.5"><MarginBadge pct={mgn} /></div>
                      </div>
                    </div>

                    {(p.supplier || p.barcode) && (
                      <div className="text-xs text-slate-400">
                        {p.supplier && <span>Supplier: {p.supplier}</span>}
                        {p.supplier && p.barcode && <span className="mx-2">·</span>}
                        {p.barcode && <span className="font-mono">{p.barcode}</span>}
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      <button onClick={() => openEdit(p)} className={S.btnGhost + " text-xs py-1.5 px-3"}>
                        <IconEdit /> Edit
                      </button>
                      <button onClick={() => setDeletingProduct(p)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition">
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
        <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Showing {filtered.length} of {items.length} product{items.length !== 1 ? "s" : ""}
          </span>
          {(filterCat || filterStatus || search) && (
            <button onClick={() => { setSearch(""); setFilterCat(""); setFilterStatus(""); }}
              className="text-xs font-medium text-amber-600 hover:text-amber-700">
              Clear all filters
            </button>
          )}
        </div>
      </div>

      {/* ── Edit Modal ── */}
      {editProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setEditProduct(null)}>
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className={S.iconChip}><IconEdit /></div>
                <div>
                  <div className="font-bold text-slate-900">Edit Product</div>
                  <div className="text-xs text-slate-500 truncate max-w-xs">{editProduct.name}</div>
                </div>
              </div>
              <button onClick={() => setEditProduct(null)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100">
                <IconX />
              </button>
            </div>
            <div className="overflow-y-auto p-6">
              <ProductForm
                form={editForm} setForm={setEditForm}
                measures={measures} filteredSizes={editFilteredSizes}
                onSubmit={handleEdit} onCancel={() => setEditProduct(null)}
                saving={saving} mode="edit"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
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