"use client";

import React, { useEffect, useMemo, useState } from "react";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import { listProducts, createProduct, deleteProduct } from "@/lib/api/products";
import { listUnitMeasures, listUnitSizes } from "@/lib/api/lookups";

import {
  inputCls,
  selectCls,
  tableGridCols,
  selectChevronStyle,
  cardCls,
  softCardCls,
  btnPrimary,
} from "./page.styles";

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

  // IMPORTANT: these are aliases coming from listProducts() join
  unit_measure?: { id?: string; name?: string } | null;
  unit_size?: { id?: string; label?: string; kind?: UnitKind } | null;

  sell_status?: "to_be_sold" | "not_to_be_sold" | string;
};

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */
function fmt(v: number | string | null | undefined) {
  return Number(v || 0).toFixed(2);
}

/* ─────────────────────────────────────────────
   Icons (inline SVGs – no deps)
───────────────────────────────────────────── */
const IconSearch = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="9" cy="9" r="5.5" />
    <line x1="13.5" y1="13.5" x2="18" y2="18" />
  </svg>
);

const IconPlus = () => (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="10" y1="4" x2="10" y2="16" />
    <line x1="4" y1="10" x2="16" y2="10" />
  </svg>
);

const IconTrash = () => (
  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 6h12M8 6V4a1 1 0 011-1h2a1 1 0 011 1v2m-6 0v10a1 1 0 001 1h6a1 1 0 001-1V6M9 10v3M11 10v3" />
  </svg>
);

const IconChevron = ({ open }: { open: boolean }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    style={{ transition: "transform .25s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
  >
    <polyline points="5,7 10,12 15,7" />
  </svg>
);

const IconBox = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 8l-9-5-9 5v8l9 5 9-5z" />
    <polyline points="3,8 12,13 21,8" />
    <line x1="12" y1="23" x2="12" y2="13" />
  </svg>
);

const IconTrendUp = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23,6 13.5,15.5 8.5,10.5 1,18" />
    <polyline points="17,6 23,6 23,12" />
  </svg>
);

const IconDollar = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
  </svg>
);

/* ─────────────────────────────────────────────
   Components
───────────────────────────────────────────── */
function KpiCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent: string;
}) {
  return (
    <div className={`flex items-start gap-4 ${softCardCls} px-5 py-4`}>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accent} text-amber-700`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{label}</p>
        <p className="mt-0.5 text-xl font-black text-zinc-800">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-zinc-400">{sub}</p>}
      </div>
    </div>
  );
}

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
    <div className={cardCls}>
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between rounded-2xl px-5 py-3.5 text-left hover:bg-zinc-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-500">
            <IconPlus />
          </div>
          <div>
            <div className="text-sm font-black text-zinc-800">Add New Product</div>
            <div className="mt-0.5 text-xs text-zinc-400">Uses lookup dropdowns for Unit Measure & Unit Size</div>
          </div>
        </div>
        <IconChevron open={open} />
      </button>

      <div
        className="overflow-hidden"
        style={{ maxHeight: open ? "700px" : "0px", transition: "max-height .35s cubic-bezier(.4,0,.2,1)" }}
      >
        <div className="border-t border-zinc-100 px-5 pb-5 pt-4">{children}</div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Page
───────────────────────────────────────────── */
export default function ProductsPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [items, setItems] = useState<Product[]>([]);
  const [err, setErr] = useState("");

  const [measures, setMeasures] = useState<MeasureLookup[]>([]);
  const [sizes, setSizes] = useState<SizeLookup[]>([]);

  // form state
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

        const [uoms, usizes] = await Promise.all([
          listUnitMeasures(o) as Promise<MeasureLookup[]>,
          listUnitSizes(o) as Promise<SizeLookup[]>,
        ]);

        setMeasures(uoms);
        setSizes(usizes);

        // default selections
        if (uoms?.[0]?.id) setUnitMeasureId(uoms[0].id);

        // set default size AFTER measure chosen
        const firstMeasure = uoms?.[0];
        const allowed = (firstMeasure?.allowed_kinds ?? []) as UnitKind[];
        const firstSizes = usizes.filter((s) => allowed.includes(s.kind));
        if (firstSizes?.[0]?.id) setUnitSizeId(firstSizes[0].id);

        await refresh(o);
      } catch (e: any) {
        setErr(e.message ?? String(e));
      }
    })();
  }, []);

  // dependent dropdown: measure -> filter sizes
  const selectedMeasure = useMemo(() => {
    return measures.find((m) => m.id === unitMeasureId) ?? null;
  }, [measures, unitMeasureId]);

  const filteredSizes = useMemo(() => {
    if (!selectedMeasure) return sizes;
    const allowed = (selectedMeasure.allowed_kinds ?? []) as UnitKind[];
    return sizes.filter((s) => allowed.includes(s.kind));
  }, [sizes, selectedMeasure]);

  // keep selected size valid
  useEffect(() => {
    if (!filteredSizes.length) {
      setUnitSizeId("");
      return;
    }
    const stillValid = filteredSizes.some((s) => s.id === unitSizeId);
    if (!stillValid) setUnitSizeId(filteredSizes[0].id);
  }, [filteredSizes, unitSizeId]);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return items;
    return items.filter((p) => {
      const n = (p.name ?? "").toLowerCase();
      const b = (p.barcode ?? "").toLowerCase();
      const s = (p.supplier ?? "").toLowerCase();
      return n.includes(t) || b.includes(t) || s.includes(t);
    });
  }, [items, search]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      setErr("");
      if (!name.trim()) throw new Error("Product name is required");

      await createProduct(orgId!, {
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

      // reset
      setName("");
      setBarcode("");
      setSupplier("");
      setNotes("");
      setCostPrice("0");
      setSellPrice("0");
      setSellStatus("to_be_sold");
      setFormOpen(false);

      await refresh(orgId!);
    } catch (e: any) {
      setErr(e.message ?? String(e));
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      await deleteProduct(orgId!, id);
      await refresh(orgId!);
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally {
      setDeleting(null);
    }
  }

  if (!orgId) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-3 text-zinc-400">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
            <path d="M12 2a10 10 0 0110 10" />
          </svg>
          <span className="text-sm font-semibold">Loading…</span>
        </div>
      </div>
    );
  }

  const total = items.length;
  const active = items.filter((p) => p.sell_status !== "not_to_be_sold").length;
  const catalogValue = items.reduce((sum, p) => sum + Number(p.unit_price ?? 0), 0);

  return (
    <div className="space-y-5">
      {/* Error */}
      {err && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <circle cx="10" cy="10" r="9" />
            <path d="M10 6v4M10 12v.01" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none" />
          </svg>
          <span>{err}</span>
          <button onClick={() => setErr("")} className="ml-auto text-red-400 hover:text-red-600 transition-colors">
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Inventory</p>
          <h1 className="mt-0.5 text-2xl font-black text-zinc-800">Product Catalog</h1>
        </div>

        <div className="relative w-72">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400">
            <IconSearch />
          </span>
          <input
            type="text"
            placeholder="Search name / barcode / supplier…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={inputCls}
            style={{ paddingLeft: "2.25rem" }}
          />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <KpiCard icon={<IconBox />} label="Total Products" value={String(total)} sub="in catalog" accent="bg-amber-50" />
        <KpiCard icon={<IconTrendUp />} label="Active (For Sale)" value={String(active)} sub="currently listed" accent="bg-emerald-50" />
        <KpiCard icon={<IconDollar />} label="Catalog Value" value={`Ksh ${catalogValue.toFixed(2)}`} sub="sum of sell prices" accent="bg-sky-50" />
      </div>

      {/* Create Form */}
      <FormPanel open={formOpen} onToggle={() => setFormOpen((v) => !v)}>
        <form onSubmit={handleCreate} noValidate>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-500">Product Name *</label>
              <input className={inputCls} placeholder="e.g. Raw Honey 500g" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-500">Barcode</label>
              <input className={inputCls} placeholder="EAN / UPC" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-500">Supplier</label>
              <input className={inputCls} placeholder="Supplier name" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-500">Sell Status</label>
              <select
                className={selectCls}
                value={sellStatus}
                onChange={(e) => setSellStatus(e.target.value as any)}
                style={selectChevronStyle}
              >
                <option value="to_be_sold">To be sold</option>
                <option value="not_to_be_sold">Not to be sold</option>
              </select>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
a              <label className="mb-1 block text-xs font-semibold text-zinc-500">Cost Price (Kshs)</label>
              <input className={inputCls} type="number" min="0" step="0.01" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-500">Sell Price (Kshs)</label>
              <input className={inputCls} type="number" min="0" step="0.01" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} />
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-500">Unit of Measure</label>
              <select
                className={selectCls}
                value={unitMeasureId}
                onChange={(e) => setUnitMeasureId(e.target.value)}
                style={selectChevronStyle}
              >
                {measures.length === 0 ? (
                  <option disabled>No unit measures</option>
                ) : (
                  measures.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-500">Unit Size</label>
              <select
                className={selectCls}
                value={unitSizeId}
                onChange={(e) => setUnitSizeId(e.target.value)}
                style={selectChevronStyle}
                disabled={!filteredSizes.length}
              >
                {!filteredSizes.length ? (
                  <option value="">No sizes for this measure</option>
                ) : (
                  filteredSizes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))
                )}
              </select>
              {selectedMeasure?.name ? (
                <p className="mt-1 text-[11px] text-zinc-400">
                  {selectedMeasure.name} allows:{" "}
                  <span className="font-mono">{(selectedMeasure.allowed_kinds ?? []).join(", ")}</span>
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-3">
            <label className="mb-1 block text-xs font-semibold text-zinc-500">Notes</label>
            <textarea
              rows={2}
              className={`${inputCls} resize-none`}
              placeholder="Any additional info…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <button type="submit" className={btnPrimary}>
            <IconPlus /> Add Product
          </button>
        </form>
      </FormPanel>

      {/* Table */}
      <div className={cardCls}>
        <div
          className="grid items-center border-b border-zinc-100 px-5 py-3 text-xs font-black uppercase tracking-wider text-zinc-400"
          style={{ gridTemplateColumns: tableGridCols }}
        >
          <span>Name</span>
          <span>Barcode</span>
          <span>Cost <p>(Kshs)</p> </span>
          <span>Sell <p>(Kshs)</p>  </span>
          <span>UoM</span>
          <span>Size</span>
          <span>Status</span>
          <span />
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-zinc-400">
            <IconBox />
            <p className="text-sm font-semibold">{items.length === 0 ? "No products yet." : "No results match your search."}</p>
            <p className="text-xs">{items.length === 0 ? 'Click "Add New Product" above to get started.' : "Try a different search term."}</p>
          </div>
        ) : (
          filtered.map((p) => (
            <div
              key={p.id}
              className="grid items-center border-b border-zinc-50 px-5 py-2.5 text-sm text-zinc-700 last:border-0 hover:bg-amber-50/40 transition-colors"
              style={{ gridTemplateColumns: tableGridCols }}
            >
              <div className="min-w-0 pr-3">
                <p className="font-black text-zinc-800 truncate">{p.name}</p>
                {(p.supplier || p.notes) && (
                  <p className="text-xs text-zinc-400 truncate">{[p.supplier, p.notes].filter(Boolean).join(" · ")}</p>
                )}
              </div>

              <span className="font-mono text-xs text-zinc-500">{p.barcode ?? "—"}</span>
              <span className="font-semibold">{fmt(p.cost_price)}</span>
              <span className="font-semibold">{fmt(p.unit_price)}</span>

              {/* IMPORTANT: uses joined aliases from listProducts() */}
              <span className="text-zinc-500">{p.unit_measure?.name ?? "—"}</span>
              <span className="text-zinc-500">{p.unit_size?.label ?? "—"}</span>

              <span>
                {p.sell_status === "not_to_be_sold" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
                    Not for sale
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    For sale
                  </span>
                )}
              </span>

              <button
                onClick={() => handleDelete(p.id)}
                disabled={deleting === p.id}
                className="ml-2 flex h-7 w-7 items-center justify-center rounded-lg text-zinc-300 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-40"
                aria-label="Delete product"
              >
                {deleting === p.id ? (
                  <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="8" strokeOpacity="0.25" />
                    <path d="M12 4a8 8 0 018 8" />
                  </svg>
                ) : (
                  <IconTrash />
                )}
              </button>
            </div>
          ))
        )}
      </div>

      {filtered.length > 0 && (
        <p className="text-center text-xs text-zinc-400">
          Showing {filtered.length} of {items.length} product{items.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
