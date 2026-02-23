"use client";

import React, { useEffect, useMemo, useState } from "react";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import { listProducts, createProduct, deleteProduct } from "@/lib/api/products";
import { listUnitMeasures, listUnitSizes } from "@/lib/api/lookups";

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

/* ─────────────────────────────────────────────
   Helpers & Icons
───────────────────────────────────────────── */
function fmt(v: number | string | null | undefined) {
  return Number(v || 0).toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

const IconPlus = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="10" y1="4" x2="10" y2="16" />
    <line x1="4" y1="10" x2="16" y2="10" />
  </svg>
);

const IconSearch = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2">
    <circle cx="9" cy="9" r="5.5" />
    <line x1="13.5" y1="13.5" x2="18" y2="18" />
  </svg>
);

const IconTrash = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 6h12M8 6V4a1 1 0 011-1h2a1 1 0 011 1v2m-6 0v10a1 1 0 001 1h6a1 1 0 001-1V6M9 10v3M11 10v3" />
  </svg>
);

const IconBox = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M21 8l-9-5-9 5v8l9 5 9-5z" />
    <polyline points="3,8 12,13 21,8" />
    <line x1="12" y1="23" x2="12" y2="13" />
  </svg>
);

const IconDollar = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
  </svg>
);

/* ─────────────────────────────────────────────
   KPI Card
───────────────────────────────────────────── */
function KpiCard({
  icon,
  label,
  value,
  sub,
  accent = "neutral",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: "neutral" | "success" | "warning";
}) {
  const bg = accent === "success" ? "#F0FAF0" : accent === "warning" ? "#FFF9DC" : "#FFFEF5";
  const textColor = accent === "success" ? "#3A7D44" : accent === "warning" ? "#926E0A" : "#1a1a0a";
  const iconBg = accent === "success" ? "#E6F4EA" : accent === "warning" ? "#FFF2CC" : "#F5F5F0";

  return (
    <div
      className="p-6 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200"
      style={{ background: bg, border: "1px solid rgba(245,197,24,0.18)" }}
    >
      <div className="flex items-center gap-5">
        <div
          className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-xl shadow-sm"
          style={{ background: iconBg, color: textColor }}
        >
          {icon}
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-[#999977]">{label}</div>
          <div className="mt-1 text-2xl sm:text-3xl font-display font-bold text-[#1a1a0a] leading-none">{value}</div>
          {sub && <div className="mt-1.5 text-sm text-[#777766]">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Collapsible Form Panel
───────────────────────────────────────────── */
function FormPanel({
  open,
  onToggle,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: "#FFFEF9", border: "1px solid rgba(245,197,24,0.15)" }}>
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-6 py-5 text-left hover:bg-[#FFF9DC]/40 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#FFF9DC] text-[#926E0A] text-xl">
            <IconPlus />
          </div>
          <div>
            <div className="font-display text-lg font-bold text-[#1a1a0a]">Add New Product</div>
            <div className="text-sm text-[#777766] mt-0.5">Define product details & pricing</div>
          </div>
        </div>
        <svg
          width="18"
          height="18"
          viewBox="0 0 20 20"
          fill="none"
          stroke="#777766"
          strokeWidth="2"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.3s" }}
        >
          <polyline points="5,7 10,12 15,7" />
        </svg>
      </button>

      <div
        className="overflow-hidden transition-all duration-400"
        style={{ maxHeight: open ? "1200px" : "0px" }}
      >
        <div className="px-6 pb-6 pt-2 border-t border-[#F5C518]/10">{children}</div>
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

  const [measures, setMeasures] = useState<MeasureLookup[]>([]);
  const [sizes, setSizes] = useState<SizeLookup[]>([]);

  // Form
  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [supplier, setSupplier] = useState("");
  const [notes, setNotes] = useState("");
  const [costPrice, setCostPrice] = useState("0");
  const [sellPrice, setSellPrice] = useState("0");
  const [unitMeasureId, setUnitMeasureId] = useState("");
  const [unitSizeId, setUnitSizeId] = useState("");
  const [sellStatus, setSellStatus] = useState<"to_be_sold" | "not_to_be_sold">("to_be_sold");

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

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

        if (uoms?.[0]?.id) setUnitMeasureId(uoms[0].id);

        const firstMeasure = uoms?.[0];
        const allowed = firstMeasure?.allowed_kinds ?? [];
        const firstSizes = usizes.filter((s) => allowed.includes(s.kind as any));
        if (firstSizes?.[0]?.id) setUnitSizeId(firstSizes[0].id);

        await refresh(o);
      } catch (e: any) {
        setErr(e.message ?? String(e));
      }
    })();
  }, []);

  const selectedMeasure = useMemo(
    () => measures.find((m) => m.id === unitMeasureId) ?? null,
    [measures, unitMeasureId]
  );

  const filteredSizes = useMemo(() => {
    if (!selectedMeasure) return sizes;
    const allowed = selectedMeasure.allowed_kinds ?? [];
    return sizes.filter((s) => allowed.includes(s.kind));
  }, [sizes, selectedMeasure]);

  useEffect(() => {
    if (!filteredSizes.length) {
      setUnitSizeId("");
      return;
    }
    if (!filteredSizes.some((s) => s.id === unitSizeId)) {
      setUnitSizeId(filteredSizes[0].id);
    }
  }, [filteredSizes, unitSizeId]);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return items;
    return items.filter((p) => {
      return (
        (p.name ?? "").toLowerCase().includes(t) ||
        (p.barcode ?? "").toLowerCase().includes(t) ||
        (p.supplier ?? "").toLowerCase().includes(t)
      );
    });
  }, [items, search]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    try {
      setErr("");
      if (!name.trim()) throw new Error("Product name is required");

      await createProduct(orgId, {
        name: name.trim(),
        barcode: barcode.trim() || undefined,
        supplier: supplier.trim() || undefined,
        notes: notes.trim() || undefined,
        cost_price: Number(costPrice || 0),
        unit_price: Number(sellPrice || 0),
        unit_measure_id: unitMeasureId || null,
        unit_size_id: unitSizeId || null,
        sell_status: sellStatus,
      });

      setName("");
      setBarcode("");
      setSupplier("");
      setNotes("");
      setCostPrice("0");
      setSellPrice("0");
      setSellStatus("to_be_sold");
      setFormOpen(false);

      await refresh(orgId);
    } catch (e: any) {
      setErr(e.message ?? String(e));
    }
  }

  async function handleDelete(id: string) {
    if (!orgId) return;
    setDeleting(id);
    try {
      await deleteProduct(orgId, id);
      await refresh(orgId);
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally {
      setDeleting(null);
    }
  }

  if (!orgId && !err) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-3 text-[#777766]">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" strokeOpacity="0.2" />
            <path d="M12 2a10 10 0 0110 10" />
          </svg>
          <span className="text-sm font-medium">Loading product catalog…</span>
        </div>
      </div>
    );
  }

  const total = items.length;
  const active = items.filter((p) => p.sell_status !== "not_to_be_sold").length;
  const catalogValue = items.reduce((sum, p) => sum + Number(p.unit_price ?? 0), 0);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=DM+Sans:wght@300;400;500;700&display=swap');

        .products-page * {
          font-family: 'DM Sans', system-ui, sans-serif;
        }
        .products-page .font-display {
          font-family: 'Playfair Display', serif;
        }

        .row-hover:hover {
          background: #FFFBEA;
          transition: background 0.16s;
        }

        .btn-amber {
          background: #F5C518;
          color: #1a1a0a;
        }
        .btn-amber:hover {
          background: #E5B50F;
        }
      `}</style>

      <div className="products-page space-y-6 px-4 py-6 sm:px-6 lg:px-8 max-w-screen-xl mx-auto">

        {/* Error banner */}
        {err && (
          <div className="rounded-xl border border-rose-200 bg-rose-50/80 px-5 py-3 text-sm text-rose-700 flex items-start gap-3">
            <span className="mt-0.5">⚠️</span>
            <span className="flex-1">{err}</span>
            <button onClick={() => setErr("")} className="text-rose-400 hover:text-rose-600">✕</button>
          </div>
        )}

        {/* Header with gradient */}
        <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: "#FFFEF9", border: "1px solid rgba(245,197,24,0.15)" }}>
          <div style={{ height: 4, background: "linear-gradient(90deg, #F5C518, #FFE566, #F5C518)" }} />
          <div className="px-6 py-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-[#999977]">Product Management</div>
                <h1 className="font-display mt-1 text-3xl sm:text-4xl font-bold text-[#1a1a0a]">
                  Catalog <em style={{ color: "#3a7d44", fontStyle: "italic" }}>Overview</em>
                </h1>
                <p className="mt-2 text-sm text-[#777766]">Manage products, pricing, units and availability</p>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2.5 rounded-xl border border-[#E5E5D5] bg-white px-4 py-2.5 shadow-sm focus-within:border-[#F5C518]/60 focus-within:ring-2 focus-within:ring-[#FFF9DC] transition">
                  <IconSearch />
                  <input
                    className="w-56 bg-transparent text-sm outline-none placeholder:text-[#aaa995]"
                    placeholder="Search name, barcode, supplier…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <KpiCard
            icon={<IconBox />}
            label="Total Products"
            value={String(total)}
            sub="in catalog"
            accent="neutral"
          />
          <KpiCard
            icon={<IconDollar />}
            label="Active Items"
            value={String(active)}
            sub="currently for sale"
            accent={active === total ? "success" : "warning"}
          />
          <KpiCard
            icon="🍯"
            label="Catalog Value"
            value={`Ksh ${fmt(catalogValue)}`}
            sub="total sell price sum"
            accent="success"
          />
        </div>

        {/* Add Form */}
        <FormPanel open={formOpen} onToggle={() => setFormOpen((v) => !v)}>
          <form onSubmit={handleCreate} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-[#999977] mb-2">
                  Product Name *
                </label>
                <input
                  className="w-full rounded-lg border border-[#E5E5D5] px-4 py-2.5 text-sm focus:border-[#F5C518]/60 focus:ring-2 focus:ring-[#FFF9DC] outline-none"
                  placeholder="e.g. Raw Honey 500g"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-[#999977] mb-2">Barcode</label>
                <input
                  className="w-full rounded-lg border border-[#E5E5D5] px-4 py-2.5 text-sm focus:border-[#F5C518]/60 focus:ring-2 focus:ring-[#FFF9DC] outline-none"
                  placeholder="EAN / UPC (optional)"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-[#999977] mb-2">Supplier</label>
                <input
                  className="w-full rounded-lg border border-[#E5E5D5] px-4 py-2.5 text-sm focus:border-[#F5C518]/60 focus:ring-2 focus:ring-[#FFF9DC] outline-none"
                  placeholder="Supplier name (optional)"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-[#999977] mb-2">Sell Status</label>
                <select
                  className="w-full rounded-lg border border-[#E5E5D5] px-4 py-2.5 text-sm focus:border-[#F5C518]/60 focus:ring-2 focus:ring-[#FFF9DC] outline-none appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iMTIiIHZpZXdCb3g9IjAgMCAxMiAxMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMi41IDQuNUw2IDhsMy41LTQuNSIgc3Ryb2tlPSIjNzc3NzY2IiBzdHJva2Utd2lkdGg9IjEiLz48L3N2Zz4=')] bg-no-repeat bg-right-3 bg-center"
                  value={sellStatus}
                  onChange={(e) => setSellStatus(e.target.value as any)}
                >
                  <option value="to_be_sold">To be sold</option>
                  <option value="not_to_be_sold">Not to be sold</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-[#999977] mb-2">Cost Price (Ksh)</label>
                <input
                  className="w-full rounded-lg border border-[#E5E5D5] px-4 py-2.5 text-sm focus:border-[#F5C518]/60 focus:ring-2 focus:ring-[#FFF9DC] outline-none"
                  type="number"
                  min="0"
                  step="0.01"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-[#999977] mb-2">Sell Price (Ksh)</label>
                <input
                  className="w-full rounded-lg border border-[#E5E5D5] px-4 py-2.5 text-sm focus:border-[#F5C518]/60 focus:ring-2 focus:ring-[#FFF9DC] outline-none"
                  type="number"
                  min="0"
                  step="0.01"
                  value={sellPrice}
                  onChange={(e) => setSellPrice(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-[#999977] mb-2">Unit of Measure</label>
                <select
                  className="w-full rounded-lg border border-[#E5E5D5] px-4 py-2.5 text-sm focus:border-[#F5C518]/60 focus:ring-2 focus:ring-[#FFF9DC] outline-none appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iMTIiIHZpZXdCb3g9IjAgMCAxMiAxMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMi41IDQuNUw2IDhsMy41LTQuNSIgc3Ryb2tlPSIjNzc3NzY2IiBzdHJva2Utd2lkdGg9IjEiLz48L3N2Zz4=')] bg-no-repeat bg-right-3 bg-center"
                  value={unitMeasureId}
                  onChange={(e) => setUnitMeasureId(e.target.value)}
                >
                  {measures.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-[#999977] mb-2">Unit Size</label>
                <select
                  className="w-full rounded-lg border border-[#E5E5D5] px-4 py-2.5 text-sm focus:border-[#F5C518]/60 focus:ring-2 focus:ring-[#FFF9DC] outline-none appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iMTIiIHZpZXdCb3g9IjAgMCAxMiAxMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMi41IDQuNUw2IDhsMy41LTQuNSIgc3Ryb2tlPSIjNzc3NzY2IiBzdHJva2Utd2lkdGg9IjEiLz48L3N2Zz4=')] bg-no-repeat bg-right-3 bg-center"
                  value={unitSizeId}
                  onChange={(e) => setUnitSizeId(e.target.value)}
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
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-[#999977] mb-2">Notes</label>
              <textarea
                rows={2}
                className="w-full rounded-lg border border-[#E5E5D5] px-4 py-2.5 text-sm focus:border-[#F5C518]/60 focus:ring-2 focus:ring-[#FFF9DC] outline-none resize-none"
                placeholder="Additional information, batch details, etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="btn-amber px-6 py-2.5 rounded-xl font-medium shadow-sm hover:shadow transition disabled:opacity-50"
                disabled={!name.trim()}
              >
                Add Product
              </button>
            </div>
          </form>
        </FormPanel>

        {/* Product Table */}
        <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: "#FFFEF9", border: "1px solid rgba(245,197,24,0.15)" }}>
          <div style={{ padding: "1.1rem 1.5rem", borderBottom: "1.5px solid rgba(245,197,24,0.15)", background: "#FFFEF5" }}>
            <div className="font-display text-xl font-bold text-[#1a1a0a]">Product Catalog</div>
          </div>

          {/* Desktop Table Header */}
          <div
            className="hidden lg:grid items-center gap-5 px-6 py-3 text-xs font-medium uppercase tracking-wider text-[#777766]"
            style={{
              gridTemplateColumns: "2.5fr 1.2fr 1fr 1fr 1fr 1fr 1.3fr 0.8fr",
              background: "#FAFAF5",
              borderBottom: "1px solid rgba(245,197,24,0.1)",
            }}
          >
            <div>Product</div>
            <div>Barcode</div>
            <div>Cost (Ksh)</div>
            <div>Sell (Ksh)</div>
            <div>Measure</div>
            <div>Size</div>
            <div>Status</div>
            <div></div>
          </div>

          <div className="divide-y divide-[#F5C518]/10">
            {filtered.length === 0 ? (
              <div className="py-16 text-center text-[#777766]">
                <div className="text-5xl mb-4">🍯</div>
                <p className="font-medium text-lg">
                  {items.length === 0 ? "No products in catalog yet" : "No matching products"}
                </p>
                <p className="text-sm mt-2">
                  {items.length === 0 ? "Click the panel above to add your first product" : "Try a different search term"}
                </p>
              </div>
            ) : (
              filtered.map((p) => {
                const isDeleting = deleting === p.id;
                const isForSale = p.sell_status !== "not_to_be_sold";

                return (
                  <div key={p.id} className="row-hover">
                    {/* Desktop row */}
                    <div
                      className="hidden lg:grid items-center gap-5 px-6 py-4 text-sm"
                      style={{ gridTemplateColumns: "2.5fr 1.2fr 1fr 1fr 1fr 1fr 1.3fr 0.8fr" }}
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-[#1a1a0a] truncate">{p.name || "Unnamed"}</div>
                        {(p.supplier || p.notes) && (
                          <div className="text-xs text-[#777766] mt-0.5 truncate">
                            {[p.supplier, p.notes].filter(Boolean).join(" · ")}
                          </div>
                        )}
                      </div>

                      <div className="font-mono text-xs text-[#777766]">{p.barcode || "—"}</div>
                      <div className="font-medium text-[#555540]">{fmt(p.cost_price)}</div>
                      <div className="font-medium text-[#1a1a0a]">{fmt(p.unit_price)}</div>
                      <div className="text-[#777766]">{p.unit_measure?.name || "—"}</div>
                      <div className="text-[#777766]">{p.unit_size?.label || "—"}</div>

                      <div>
                        {isForSale ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E6F4EA] px-3 py-1 text-xs font-medium text-[#3A7D44]">
                            <span className="h-2 w-2 rounded-full bg-[#4CAF50]" />
                            For sale
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF2CC] px-3 py-1 text-xs font-medium text-[#926E0A]">
                            <span className="h-2 w-2 rounded-full bg-[#F5C518]" />
                            Not for sale
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => handleDelete(p.id)}
                        disabled={isDeleting}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-[#777766] hover:bg-[#FFF9DC] hover:text-[#926E0A] transition disabled:opacity-40"
                        aria-label="Delete product"
                      >
                        {isDeleting ? (
                          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                            <path d="M12 4a8 8 0 018 8" />
                          </svg>
                        ) : (
                          <IconTrash />
                        )}
                      </button>
                    </div>

                    {/* Mobile stacked view */}
                    <div className="lg:hidden px-5 py-5 space-y-4 border-b border-[#F5C518]/10">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-[#1a1a0a]">{p.name || "Unnamed"}</div>
                          <div className="text-xs text-[#777766] mt-1">
                            {p.barcode ? `Barcode: ${p.barcode}` : ""}
                            {p.barcode && p.supplier ? " · " : ""}
                            {p.supplier || ""}
                          </div>
                        </div>
                        <div>
                          {isForSale ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E6F4EA] px-3 py-1 text-xs font-medium text-[#3A7D44]">
                              For sale
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF2CC] px-3 py-1 text-xs font-medium text-[#926E0A]">
                              Not for sale
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 bg-[#FAFAF5] rounded-xl p-4 text-sm">
                        <div>
                          <div className="text-xs text-[#999977]">Cost</div>
                          <div className="font-medium">{fmt(p.cost_price)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-[#999977]">Sell</div>
                          <div className="font-medium text-[#1a1a0a]">{fmt(p.unit_price)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-[#999977]">Measure</div>
                          <div>{p.unit_measure?.name || "—"}</div>
                        </div>
                        <div>
                          <div className="text-xs text-[#999977]">Size</div>
                          <div>{p.unit_size?.label || "—"}</div>
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <button
                          onClick={() => handleDelete(p.id)}
                          disabled={isDeleting}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[#777766] hover:bg-[#FFF9DC] hover:text-[#926E0A] transition disabled:opacity-40"
                        >
                          {isDeleting ? "Deleting…" : "Delete"}
                          {!isDeleting && <IconTrash />}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {filtered.length > 0 && (
            <div className="px-6 py-3 text-xs text-[#999977] border-t border-[#F5C518]/10 text-center">
              Showing {filtered.length} of {items.length} product{items.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      </div>
    </>
  );
}