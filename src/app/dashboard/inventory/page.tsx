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

function StatCard({
  title,
  value,
  sub,
  rightIcon,
  accent = "neutral",
}: {
  title: string;
  value: string;
  sub?: string;
  rightIcon?: string;
  accent?: "neutral" | "warning" | "success";
}) {
  const subClass =
    accent === "warning"
      ? "text-rose-600"
      : accent === "success"
      ? "text-emerald-600"
      : "text-zinc-500";

  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">
            {title}
          </div>
          <div className="mt-3 text-4xl font-black text-zinc-900">{value}</div>
          {sub ? (
            <div className={`mt-2 text-sm font-semibold ${subClass}`}>{sub}</div>
          ) : null}
        </div>
        {rightIcon ? (
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-zinc-50 text-lg">
            {rightIcon}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StatusBadge({ qty, reorder }: { qty: number; reorder: number }) {
  if (qty <= 0) {
    return <span className={`${S.badge} bg-rose-50 text-rose-700`}>Out</span>;
  }
  if (qty <= Math.min(3, reorder)) {
    return <span className={`${S.badge} bg-rose-50 text-rose-700`}>Critical</span>;
  }
  if (qty <= reorder) {
    return <span className={`${S.badge} bg-amber-50 text-amber-700`}>Low Stock</span>;
  }
  return <span className={`${S.badge} bg-emerald-50 text-emerald-700`}>Normal</span>;
}

function fmtMoney(v: number) {
  return `Ksh ${Number(v || 0).toFixed(2)}`;
}

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
          <div className="text-lg font-black text-zinc-900">{title}</div>
          <button className="text-zinc-400 hover:text-zinc-700" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className={S.modalBody}>{children}</div>
        {footer ? <div className={S.modalFoot}>{footer}</div> : null}
      </div>
    </div>
  );
}

/**
 * Optional movement log (won’t fail page if table doesn’t exist)
 */
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
    // ignore if table not present / RLS blocks for now
  }
}

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

  async function refresh(o: string) {
    const data = await listInventory(o);
    setRows(data);
  }

  async function loadProducts(o: string) {
    const ps = await listProducts(o);
    // keep only what we need
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

  // products not yet in inventory (for Add Stock)
  const productIdsInInventory = useMemo(() => new Set(rows.map((r) => r.product_id)), [rows]);
  const addCandidates = useMemo(() => {
    return allProducts
      .filter((p) => !productIdsInInventory.has(p.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allProducts, productIdsInInventory]);

  useEffect(() => {
    // default product select in modal
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
      return sum + price * Number(r.qty_on_hand ?? 0);
    }, 0);

    return { totalItems, lowStock, totalValue };
  }, [rows]);

  async function handleAddStock() {
    if (!orgId) return;
    if (!addProductId) {
      setErr("Select a product to add to inventory.");
      return;
    }

    setSavingId(addProductId);
    setErr("");
    try {
      const qty = Number(addQty || 0);
      const reorder = Number(addReorder || 0);

      // Create or update inventory row (upsert-like)
      // If your inventory table has unique(org_id, product_id), this works well.
      const { data: existing, error: e1 } = await supabase
        .from("inventory")
        .select("org_id,product_id,qty_on_hand,reorder_level")
        .eq("org_id", orgId)
        .eq("product_id", addProductId)
        .maybeSingle();

      if (e1) throw new Error(e1.message);

      if (!existing) {
        const { error: e2 } = await supabase.from("inventory").insert([
          {
            org_id: orgId,
            product_id: addProductId,
            qty_on_hand: qty,
            reorder_level: reorder,
          },
        ]);
        if (e2) throw new Error(e2.message);

        await logMovement({
          org_id: orgId,
          product_id: addProductId,
          type: "add",
          qty_delta: qty,
          qty_before: 0,
          qty_after: qty,
          note: "Add stock (created inventory row)",
        });
      } else {
        const before = Number(existing.qty_on_hand ?? 0);
        const after = before + qty;
        const { error: e3 } = await supabase
          .from("inventory")
          .update({ qty_on_hand: after, reorder_level: reorder })
          .eq("org_id", orgId)
          .eq("product_id", addProductId);
        if (e3) throw new Error(e3.message);

        await logMovement({
          org_id: orgId,
          product_id: addProductId,
          type: "add",
          qty_delta: qty,
          qty_before: before,
          qty_after: after,
          note: "Add stock (existing inventory row)",
        });
      }

      await refresh(orgId);
      setAddOpen(false);
      setAddQty("0");
      setAddReorder("5");
      // refresh products list so the added one disappears from candidates
      await loadProducts(orgId);
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally {
      setSavingId(null);
    }
  }

  async function handleQuickRestock(row: InventoryRow, amount = 10) {
    if (!orgId) return;
    setSavingId(row.product_id);
    setErr("");
    try {
      const before = Number(row.qty_on_hand ?? 0);
      const after = before + amount;

      await updateInventory(orgId, row.product_id, {
        qty_on_hand: after,
        reorder_level: row.reorder_level,
      });

      await logMovement({
        org_id: orgId,
        product_id: row.product_id,
        type: "restock",
        qty_delta: amount,
        qty_before: before,
        qty_after: after,
        note: `Quick restock +${amount}`,
      });

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
      await updateInventory(orgId, row.product_id, {
        qty_on_hand: row.qty_on_hand,
        reorder_level: newLevel,
      });
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

      let after = before;
      let delta = 0;
      let type: "add" | "remove" | "set" = adjustMode;

      if (adjustMode === "add") {
        after = before + n;
        delta = n;
      } else if (adjustMode === "remove") {
        after = Math.max(0, before - n);
        delta = -(before - after);
      } else {
        after = Math.max(0, n);
        delta = after - before;
      }

      await updateInventory(orgId, adjustRow.product_id, {
        qty_on_hand: after,
        reorder_level: adjustRow.reorder_level,
      });

      await logMovement({
        org_id: orgId,
        product_id: adjustRow.product_id,
        type,
        qty_delta: delta,
        qty_before: before,
        qty_after: after,
        note: adjustNote || null,
      });

      await refresh(orgId);
      setAdjustOpen(false);
      setAdjustRow(null);
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally {
      setSavingId(null);
    }
  }

  if (!orgId && !err) return <div className="p-6">Loading…</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`${S.card} p-6`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-3xl font-black text-zinc-900">Inventory & Stock</div>
            <div className="mt-1 text-sm text-zinc-500">
              Add stock, adjust quantities, and set reorder alerts per product
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 py-2">
              <span className="text-zinc-400">🔎</span>
              <input
                className="w-[260px] bg-transparent text-sm outline-none"
                placeholder="Search product / category..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            <button className={S.btnPrimary} onClick={() => setAddOpen(true)}>
              + Add Stock
            </button>
          </div>
        </div>
      </div>

      {err ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
          {err}
        </div>
      ) : null}

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard title="Total Items" value={`${kpis.totalItems}`} sub="products tracked" rightIcon="📦" accent="success" />
        <StatCard title="Low Stock Items" value={`${kpis.lowStock}`} sub="below reorder level" rightIcon="⚠️" accent="warning" />
        <StatCard title="Total Value" value={`Ksh ${kpis.totalValue.toFixed(0)}`} sub="qty × sell price" rightIcon="💰" accent="success" />
      </div>

      {/* Table */}
      <div className={`${S.card} overflow-hidden`}>
        <div className="px-6 py-4">
          <div className="grid grid-cols-7 text-[11px] font-black uppercase tracking-wide text-zinc-500">
            <div className="col-span-2">Product</div>
            <div>Category</div>
            <div>On Hand</div>
            <div>Reorder Level</div>
            <div>Status</div>
            <div className="text-left">Actions</div>
          </div>
        </div>

        <div className="divide-y divide-zinc-200">
          {filtered.map((r) => {
            const name = r.products?.name ?? "Unknown Product";
            const sku = r.products?.sku ?? "—";
            const category = r.products?.category ?? "—";
            const price = Number(r.products?.unit_price ?? 0);
            const qty = Number(r.qty_on_hand ?? 0);
            const reorder = Number(r.reorder_level ?? 0);

            return (
              <div key={r.product_id} className="px-6 py-5">
                <div className="grid grid-cols-7 items-center gap-3">
                  {/* Product */}
                  <div className="col-span-2 flex items-center gap-4">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-50 text-xl">
                      📦
                    </div>
                    <div>
                      <div className="text-sm font-black text-zinc-900">{name}</div>
                      <div className="text-xs text-zinc-500">SKU: {sku} · {fmtMoney(price)}</div>
                    </div>
                  </div>

                  {/* Category */}
                  <div>
                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-700">
                      {category}
                    </span>
                  </div>

                  {/* On hand */}
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-500/10 text-amber-600">
                      📦
                    </div>
                    <div>
                      <div className="text-sm font-black text-zinc-900">{qty}</div>
                      <div className="text-xs text-zinc-500">units</div>
                    </div>
                  </div>

                  {/* Reorder level (editable) */}
                  <div className="flex items-center gap-2">
                    <input
                      className={`${S.inputSoft} max-w-[110px]`}
                      type="number"
                      min={0}
                      defaultValue={reorder}
                      onBlur={(e) => {
                        const next = Number(e.target.value || 0);
                        if (next !== reorder) handleSaveReorder(r, next);
                      }}
                    />
                    {savingId === r.product_id ? (
                      <span className="text-xs text-zinc-400">Saving…</span>
                    ) : null}
                  </div>

                  {/* Status */}
                  <div>
                    <StatusBadge qty={qty} reorder={reorder} />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      disabled={savingId === r.product_id}
                      className="rounded-2xl bg-amber-500 px-4 py-2 text-xs font-black text-white hover:bg-amber-600 disabled:opacity-50"
                      onClick={() => handleQuickRestock(r, 10)}
                    >
                      +10 Restock
                    </button>

                    <button
                      className={S.btnIcon}
                      title="Adjust stock"
                      onClick={() => openAdjust(r)}
                    >
                      ✏️
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 ? (
            <div className="px-6 py-10 text-sm text-zinc-500">
              No inventory items found. Add stock from Catalog.
            </div>
          ) : null}
        </div>

        <div className="px-6 py-4 border-t border-zinc-200 text-sm text-zinc-500">
          Showing {filtered.length} of {rows.length} products
        </div>
      </div>

      {/* ADD STOCK MODAL */}
      <Modal
        open={addOpen}
        title="Add Stock (from Product Catalog)"
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
              {savingId === addProductId ? "Saving…" : "Add to Inventory"}
            </button>
          </>
        }
      >
        {addCandidates.length === 0 ? (
          <div className="text-sm text-zinc-600">
            All products are already tracked in inventory ✅
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-500 mb-2">Product</label>
              <select
                className={S.input}
                value={addProductId}
                onChange={(e) => setAddProductId(e.target.value)}
              >
                {addCandidates.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.sku ? ` (SKU: ${p.sku})` : ""}
                  </option>
                ))}
              </select>
              <div className="mt-2 text-xs text-zinc-400">
                Only shows products not yet in inventory.
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-500 mb-2">Initial Stock</label>
              <input
                className={S.input}
                type="number"
                min={0}
                value={addQty}
                onChange={(e) => setAddQty(e.target.value)}
              />

              <label className="block text-xs font-bold text-zinc-500 mb-2 mt-4">Reorder Level (alert at)</label>
              <input
                className={S.input}
                type="number"
                min={0}
                value={addReorder}
                onChange={(e) => setAddReorder(e.target.value)}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* ADJUST MODAL */}
      <Modal
        open={adjustOpen}
        title={`Adjust Stock${adjustRow?.products?.name ? ` — ${adjustRow.products.name}` : ""}`}
        onClose={() => setAdjustOpen(false)}
        footer={
          <>
            <button className={S.btnGhost} onClick={() => setAdjustOpen(false)}>
              Cancel
            </button>
            <button className={S.btnPrimary} onClick={handleAdjustSave} disabled={savingId === adjustRow?.product_id}>
              {savingId === adjustRow?.product_id ? "Saving…" : "Save Adjustment"}
            </button>
          </>
        }
      >
        {!adjustRow ? null : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Current On Hand</div>
              <div className="mt-2 text-3xl font-black text-zinc-900">{Number(adjustRow.qty_on_hand ?? 0)}</div>
              <div className="mt-1 text-sm text-zinc-500">
                Reorder level: <span className="font-bold">{Number(adjustRow.reorder_level ?? 0)}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <button
                className={`${S.btnGhost} ${adjustMode === "add" ? "border-amber-400 ring-2 ring-amber-100" : ""}`}
                onClick={() => setAdjustMode("add")}
              >
                + Add
              </button>
              <button
                className={`${S.btnGhost} ${adjustMode === "remove" ? "border-amber-400 ring-2 ring-amber-100" : ""}`}
                onClick={() => setAdjustMode("remove")}
              >
                − Remove
              </button>
              <button
                className={`${S.btnGhost} ${adjustMode === "set" ? "border-amber-400 ring-2 ring-amber-100" : ""}`}
                onClick={() => setAdjustMode("set")}
              >
                = Set Exact
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-500 mb-2">
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
                <label className="block text-xs font-bold text-zinc-500 mb-2">Reason / Note (optional)</label>
                <input
                  className={S.input}
                  placeholder='e.g. "Damaged", "Count correction", "New delivery"'
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                />
              </div>
            </div>

            <div className="text-xs text-zinc-400">
              Tip: “Remove” will never go below 0.
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
