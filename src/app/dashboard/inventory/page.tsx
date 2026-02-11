"use client";

import React, { useEffect, useMemo, useState } from "react";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import { listInventory, updateInventory, type InventoryRow } from "@/lib/api/inventory";
import { listProducts } from "@/lib/api/products";
import { supabase } from "@/lib/supabase/client";

import * as S from "./page.styles";

type ProductLite = {
  id: string;
  name: string;
  sku?: string | null;
  category?: string | null;
  unit_price?: number | null;
};

/* ─── Stat Card ─────────────────────────────────────────────── */
function StatCard({
  title,
  value,
  sub,
  icon,
  accent = "neutral",
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  accent?: "neutral" | "warning" | "success";
}) {
  const accentBg =
    accent === "warning"
      ? "bg-rose-50 text-rose-600"
      : accent === "success"
      ? "bg-emerald-50 text-emerald-600"
      : "bg-zinc-100 text-zinc-500";

  const subColor =
    accent === "warning"
      ? "text-rose-500"
      : accent === "success"
      ? "text-emerald-500"
      : "text-zinc-400";

  return (
    <div className={`${S.card} flex items-center gap-4 p-5`}>
      <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl text-xl ${accentBg}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">{title}</div>
        <div className="mt-0.5 text-2xl font-black text-zinc-900 leading-none">{value}</div>
        {sub && <div className={`mt-1 text-xs font-semibold ${subColor}`}>{sub}</div>}
      </div>
    </div>
  );
}

/* ─── Status Badge ───────────────────────────────────────────── */
function StatusBadge({ qty, reorder }: { qty: number; reorder: number }) {
  if (qty <= 0)
    return (
      <span className={`${S.badge} bg-rose-50 text-rose-700`}>
        <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
        Out of stock
      </span>
    );
  if (qty <= Math.min(3, reorder))
    return (
      <span className={`${S.badge} bg-rose-50 text-rose-700`}>
        <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
        Critical
      </span>
    );
  if (qty <= reorder)
    return (
      <span className={`${S.badge} bg-amber-50 text-amber-700`}>
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
        Low stock
      </span>
    );
  return (
    <span className={`${S.badge} bg-emerald-50 text-emerald-700`}>
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
      Normal
    </span>
  );
}

/* ─── Modal ──────────────────────────────────────────────────── */
function Modal({
  open,
  title,
  children,
  onClose,
  footer,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className={S.overlay} onMouseDown={onClose}>
      <div className={S.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div className={S.modalHead}>
          <div className="text-base font-black text-zinc-900">{title}</div>
          <button
            className="grid h-8 w-8 place-items-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className={S.modalBody}>{children}</div>
        {footer && <div className={S.modalFoot}>{footer}</div>}
      </div>
    </div>
  );
}

/* ─── Movement log ───────────────────────────────────────────── */
async function logMovement(payload: {
  org_id: string;
  product_id: string;
  type: "add" | "remove" | "set" | "restock";
  qty_delta: number;
  qty_before: number;
  qty_after: number;
  note?: string | null;
}) {
  try {
    await supabase.from("inventory_movements").insert([payload]);
  } catch {
    // ignore if table not present
  }
}

function fmtMoney(v: number) {
  return `Ksh ${Number(v || 0).toFixed(2)}`;
}

/* ─── Page ───────────────────────────────────────────────────── */
export default function InventoryPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [allProducts, setAllProducts] = useState<ProductLite[]>([]);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  // Add Stock modal
  const [addOpen, setAddOpen] = useState(false);
  const [addProductId, setAddProductId] = useState("");
  const [addQty, setAddQty] = useState("0");
  const [addReorder, setAddReorder] = useState("5");

  // Adjust modal
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustRow, setAdjustRow] = useState<InventoryRow | null>(null);
  const [adjustMode, setAdjustMode] = useState<"add" | "remove" | "set">("add");
  const [adjustValue, setAdjustValue] = useState("0");
  const [adjustNote, setAdjustNote] = useState("");

  // Inline restock
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
        category: p.category ?? null,
        unit_price: Number(p.unit_price ?? 0),
      }))
    );
  }

  useEffect(() => {
    (async () => {
      try {
        const o = await bootstrapOrg();
        setOrgId(o);
        await Promise.all([refresh(o), loadProducts(o)]);
      } catch (e: any) {
        setErr(e.message ?? String(e));
      }
    })();
  }, []);

  const productIdsInInventory = useMemo(() => new Set(rows.map((r) => r.product_id)), [rows]);
  const addCandidates = useMemo(
    () =>
      allProducts
        .filter((p) => !productIdsInInventory.has(p.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [allProducts, productIdsInInventory]
  );

  useEffect(() => {
    if (!addProductId && addCandidates.length) setAddProductId(addCandidates[0].id);
  }, [addCandidates, addProductId]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      const name = (r.products?.name ?? "").toLowerCase();
      const cat = (r.products?.category ?? "").toLowerCase();
      return !term || name.includes(term) || cat.includes(term);
    });
  }, [rows, q]);

  const kpis = useMemo(() => {
    const totalItems = rows.length;
    const lowStock = rows.filter((r) => Number(r.qty_on_hand ?? 0) <= Number(r.reorder_level ?? 0)).length;
    const totalValue = rows.reduce((sum, r) => {
      const price = Number(r.products?.unit_price ?? 0);
      const qty = Number(r.qty_on_hand ?? 0);
      return sum + price * qty;
    }, 0);
    return { totalItems, lowStock, totalValue };
  }, [rows]);

  async function handleAddStock() {
    if (!orgId || !addProductId) { setErr("Select a product."); return; }
    setSavingId(addProductId);
    setErr("");
    try {
      const qty = Number(addQty || 0);
      const reorder = Number(addReorder || 0);

      const { data: existing, error: e1 } = await supabase
        .from("inventory")
        .select("org_id,product_id,qty_on_hand,reorder_level")
        .eq("org_id", orgId)
        .eq("product_id", addProductId)
        .maybeSingle();

      if (e1) throw new Error(e1.message);

      if (!existing) {
        const { error: e2 } = await supabase.from("inventory").insert([{ org_id: orgId, product_id: addProductId, qty_on_hand: qty, reorder_level: reorder }]);
        if (e2) throw new Error(e2.message);
        await logMovement({ org_id: orgId, product_id: addProductId, type: "add", qty_delta: qty, qty_before: 0, qty_after: qty, note: "Created inventory row" });
      } else {
        const before = Number(existing.qty_on_hand ?? 0);
        const after = before + qty;
        const { error: e3 } = await supabase.from("inventory").update({ qty_on_hand: after, reorder_level: reorder }).eq("org_id", orgId).eq("product_id", addProductId);
        if (e3) throw new Error(e3.message);
        await logMovement({ org_id: orgId, product_id: addProductId, type: "add", qty_delta: qty, qty_before: before, qty_after: after, note: "Updated existing row" });
      }

      await refresh(orgId);
      await loadProducts(orgId);
      setAddOpen(false);
      setAddQty("0");
      setAddReorder("5");
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally {
      setSavingId(null);
    }
  }

  async function handleQuickRestock(row: InventoryRow, amount: number) {
    if (!orgId || amount <= 0) { setErr("Enter a valid restock quantity."); return; }
    setSavingId(row.product_id);
    setErr("");
    try {
      const before = Number(row.qty_on_hand ?? 0);
      const after = before + amount;
      await updateInventory(orgId, row.product_id, { qty_on_hand: after, reorder_level: row.reorder_level });
      await logMovement({ org_id: orgId, product_id: row.product_id, type: "restock", qty_delta: amount, qty_before: before, qty_after: after, note: `Restock +${amount}` });
      setRestockQty((prev) => ({ ...prev, [row.product_id]: "" }));
      await refresh(orgId);
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally {
      setSavingId(null);
    }
  }

  async function handleSaveReorder(row: InventoryRow, newLevel: number) {
    if (!orgId) return;
    setSavingId(row.product_id);
    setErr("");
    try {
      await updateInventory(orgId, row.product_id, { qty_on_hand: row.qty_on_hand, reorder_level: newLevel });
      await refresh(orgId);
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally {
      setSavingId(null);
    }
  }

  function openAdjust(row: InventoryRow) {
    setAdjustRow(row);
    setAdjustMode("add");
    setAdjustValue("0");
    setAdjustNote("");
    setAdjustOpen(true);
  }

  async function handleAdjustSave() {
    if (!orgId || !adjustRow) return;
    setSavingId(adjustRow.product_id);
    setErr("");
    try {
      const before = Number(adjustRow.qty_on_hand ?? 0);
      const n = Number(adjustValue || 0);
      let after = before, delta = 0;
      const type = adjustMode;
      if (adjustMode === "add") { after = before + n; delta = n; }
      else if (adjustMode === "remove") { after = Math.max(0, before - n); delta = -(before - after); }
      else { after = Math.max(0, n); delta = after - before; }

      await updateInventory(orgId, adjustRow.product_id, { qty_on_hand: after, reorder_level: adjustRow.reorder_level });
      await logMovement({ org_id: orgId, product_id: adjustRow.product_id, type, qty_delta: delta, qty_before: before, qty_after: after, note: adjustNote || null });
      await refresh(orgId);
      setAdjustOpen(false);
      setAdjustRow(null);
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally {
      setSavingId(null);
    }
  }

  if (!orgId && !err) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-3 text-zinc-400">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" strokeOpacity="0.2" />
            <path d="M12 2a10 10 0 0110 10" />
          </svg>
          <span className="text-sm font-semibold">Loading inventory…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 px-4 py-6 sm:px-6 lg:px-8 max-w-screen-xl mx-auto">

      {/* ── Error banner ── */}
      {err && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span className="mt-0.5 shrink-0">⚠️</span>
          <span className="flex-1">{err}</span>
          <button onClick={() => setErr("")} className="shrink-0 text-rose-400 hover:text-rose-600 transition">✕</button>
        </div>
      )}

      {/* ── Page header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Stock management</p>
          <h1 className="mt-0.5 text-2xl font-black text-zinc-900 sm:text-3xl">Inventory & Stock</h1>
          <p className="mt-1 text-sm text-zinc-500">Track quantities, set reorder alerts, and restock products</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <label className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 shadow-sm focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-100 transition">
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-zinc-400">
              <circle cx="9" cy="9" r="5.5" /><line x1="13.5" y1="13.5" x2="18" y2="18" />
            </svg>
            <input
              className="w-44 bg-transparent text-sm outline-none placeholder:text-zinc-400 sm:w-56"
              placeholder="Search product…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          <button className={S.btnPrimary} onClick={() => setAddOpen(true)}>
            <span className="text-base leading-none">+</span> Add Stock
          </button>
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard title="Total Items" value={String(kpis.totalItems)} sub="products tracked" icon="📦" accent="neutral" />
        <StatCard title="Low / Out of Stock" value={String(kpis.lowStock)} sub="need attention" icon="⚠️" accent={kpis.lowStock > 0 ? "warning" : "success"} />
        <StatCard title="Total Stock Value" value={`Ksh ${kpis.totalValue.toLocaleString("en-KE", { minimumFractionDigits: 0 })}`} sub="qty × sell price" icon="💰" accent="success" />
      </div>

      {/* ── Inventory table ── */}
      <div className={`${S.card} overflow-hidden`}>

        {/* Desktop table header — hidden on mobile */}
        <div className={`hidden lg:grid ${S.tableGrid} items-center gap-4 border-b border-zinc-100 px-6 py-3 text-[11px] font-bold uppercase tracking-widest text-zinc-400`}>
          <div className="col-span-1">Product</div>
          <div>Category</div>
          <div>On Hand</div>
          <div>Reorder Alert</div>
          <div>Status</div>
          <div>Restock</div>
        </div>

        <div className="divide-y divide-zinc-100">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-zinc-400">
              <span className="text-4xl">📦</span>
              <p className="text-sm font-semibold">
                {rows.length === 0 ? "No inventory yet." : "No results match your search."}
              </p>
              <p className="text-xs text-zinc-400">
                {rows.length === 0 ? 'Click "Add Stock" to get started.' : "Try a different term."}
              </p>
            </div>
          ) : (
            filtered.map((r) => {
              const p = r.products;
              const name = p?.name ?? "Unknown Product";
              const sku = p?.sku ?? "—";
              const category = p?.category ?? "—";
              const price = Number(p?.unit_price ?? 0);
              const qty = Number(r.qty_on_hand ?? 0);
              const reorder = Number(r.reorder_level ?? 0);
              const isSaving = savingId === r.product_id;

              return (
                <div key={r.product_id} className="px-4 py-4 sm:px-6 hover:bg-zinc-50/70 transition-colors">

                  {/* Desktop row */}
                  <div className={`hidden lg:grid ${S.tableGrid} items-center gap-4`}>

                    {/* Product */}
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-lg">📦</div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-zinc-900">{name}</p>
                        <p className="truncate text-xs text-zinc-400">SKU: {sku} · {fmtMoney(price)}</p>
                      </div>
                    </div>

                    {/* Category */}
                    <div>
                      <span className="rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600">
                        {category}
                      </span>
                    </div>

                    {/* On hand */}
                    <div>
                      <span className="text-lg font-black text-zinc-900">{qty}</span>
                      <span className="ml-1 text-xs text-zinc-400">units</span>
                    </div>

                    {/* Reorder level */}
                    <div className="flex items-center gap-2">
                      <input
                        className={`${S.inputSoft} max-w-[90px]`}
                        type="number"
                        min={0}
                        defaultValue={reorder}
                        onBlur={(e) => {
                          const next = Number(e.target.value || 0);
                          if (next !== reorder) handleSaveReorder(r, next);
                        }}
                      />
                      {isSaving && <span className="text-[11px] text-zinc-400 animate-pulse">Saving…</span>}
                    </div>

                    {/* Status */}
                    <div>
                      <StatusBadge qty={qty} reorder={reorder} />
                    </div>

                    {/* Restock */}
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        placeholder="Qty"
                        value={restockQty[r.product_id] ?? ""}
                        onChange={(e) => setRestockQty((prev) => ({ ...prev, [r.product_id]: e.target.value }))}
                        className={`${S.inputSoft} w-20 text-center`}
                      />
                      <button
                        disabled={isSaving || !Number(restockQty[r.product_id])}
                        className="rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-40 transition"
                        onClick={() => handleQuickRestock(r, Number(restockQty[r.product_id]))}
                      >
                        {isSaving ? "…" : "Restock"}
                      </button>
                      <button
                        className={S.btnIcon}
                        title="Adjust stock"
                        onClick={() => openAdjust(r)}
                      >
                        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M12 4l4 4-9 9-5 1 1-5z" /><line x1="15" y1="5" x2="16" y2="6" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Mobile row — stacked card layout */}
                  <div className="lg:hidden space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-lg">📦</div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-zinc-900">{name}</p>
                          <p className="text-xs text-zinc-400">SKU: {sku}</p>
                        </div>
                      </div>
                      <StatusBadge qty={qty} reorder={reorder} />
                    </div>

                    <div className="grid grid-cols-3 gap-2 rounded-xl bg-zinc-50 p-3">
                      <div className="text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">On Hand</p>
                        <p className="mt-0.5 text-lg font-black text-zinc-900">{qty}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">Reorder At</p>
                        <input
                          className="mt-0.5 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-center text-sm font-bold outline-none focus:border-amber-400"
                          type="number"
                          min={0}
                          defaultValue={reorder}
                          onBlur={(e) => {
                            const next = Number(e.target.value || 0);
                            if (next !== reorder) handleSaveReorder(r, next);
                          }}
                        />
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">Price</p>
                        <p className="mt-0.5 text-sm font-bold text-zinc-700">{fmtMoney(price)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        placeholder="Qty to add"
                        value={restockQty[r.product_id] ?? ""}
                        onChange={(e) => setRestockQty((prev) => ({ ...prev, [r.product_id]: e.target.value }))}
                        className={`${S.inputSoft} flex-1 text-center`}
                      />
                      <button
                        disabled={isSaving || !Number(restockQty[r.product_id])}
                        className="rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-40 transition"
                        onClick={() => handleQuickRestock(r, Number(restockQty[r.product_id]))}
                      >
                        {isSaving ? "Saving…" : "Restock"}
                      </button>
                      <button className={S.btnGhost} onClick={() => openAdjust(r)}>
                        Adjust
                      </button>
                    </div>
                  </div>

                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-zinc-100 px-6 py-3 text-xs font-semibold text-zinc-400">
          Showing {filtered.length} of {rows.length} product{rows.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* ── ADD STOCK MODAL ── */}
      <Modal
        open={addOpen}
        title="Add Stock from Catalog"
        onClose={() => setAddOpen(false)}
        footer={
          <>
            <button className={S.btnGhost} onClick={() => setAddOpen(false)}>Cancel</button>
            <button className={S.btnPrimary} onClick={handleAddStock} disabled={savingId === addProductId}>
              {savingId === addProductId ? "Saving…" : "Add to Inventory"}
            </button>
          </>
        }
      >
        {addCandidates.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-zinc-500">
            <span className="text-3xl">✅</span>
            <p className="text-sm font-semibold">All products are already tracked in inventory.</p>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-zinc-500">Select Product</label>
              <select
                className={S.input}
                value={addProductId}
                onChange={(e) => setAddProductId(e.target.value)}
              >
                {addCandidates.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.sku ? ` — SKU: ${p.sku}` : ""}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-zinc-400">Only products not yet tracked are shown.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-zinc-500">Initial Stock (units)</label>
                <input className={S.input} type="number" min={0} value={addQty} onChange={(e) => setAddQty(e.target.value)} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-zinc-500">Reorder Alert (at qty)</label>
                <input className={S.input} type="number" min={0} value={addReorder} onChange={(e) => setAddReorder(e.target.value)} />
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ── ADJUST MODAL ── */}
      <Modal
        open={adjustOpen}
        title={`Adjust Stock${adjustRow?.products?.name ? ` — ${adjustRow.products.name}` : ""}`}
        onClose={() => setAdjustOpen(false)}
        footer={
          <>
            <button className={S.btnGhost} onClick={() => setAdjustOpen(false)}>Cancel</button>
            <button className={S.btnPrimary} onClick={handleAdjustSave} disabled={savingId === adjustRow?.product_id}>
              {savingId === adjustRow?.product_id ? "Saving…" : "Save Adjustment"}
            </button>
          </>
        }
      >
        {adjustRow && (
          <div className="space-y-5">
            {/* Current state */}
            <div className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Current On Hand</p>
                <p className="mt-0.5 text-3xl font-black text-zinc-900">{Number(adjustRow.qty_on_hand ?? 0)}</p>
                <p className="mt-0.5 text-xs text-zinc-500">Reorder alert at <span className="font-bold">{Number(adjustRow.reorder_level ?? 0)}</span></p>
              </div>
              <div className="ml-auto">
                <StatusBadge qty={Number(adjustRow.qty_on_hand ?? 0)} reorder={Number(adjustRow.reorder_level ?? 0)} />
              </div>
            </div>

            {/* Mode selector */}
            <div className="grid grid-cols-3 gap-2">
              {(["add", "remove", "set"] as const).map((m) => (
                <button
                  key={m}
                  className={[
                    "rounded-xl border py-2.5 text-sm font-bold transition",
                    adjustMode === m
                      ? "border-amber-400 bg-amber-50 text-amber-700 ring-2 ring-amber-100"
                      : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50",
                  ].join(" ")}
                  onClick={() => setAdjustMode(m)}
                >
                  {m === "add" ? "+ Add" : m === "remove" ? "− Remove" : "= Set"}
                </button>
              ))}
            </div>

            {/* Value + note */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-zinc-500">
                  {adjustMode === "set" ? "Set to (units)" : "Quantity (units)"}
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
                <label className="mb-1.5 block text-xs font-bold text-zinc-500">Note (optional)</label>
                <input
                  className={S.input}
                  placeholder="Damaged, correction…"
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                />
              </div>
            </div>

            <p className="text-xs text-zinc-400">Remove will never push stock below 0.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}