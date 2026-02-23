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
  const bg = accent === "warning" ? "#FFF9DC" : accent === "success" ? "#F0FAF0" : "#FFFEF5";
  const textColor = accent === "warning" ? "#926E0A" : accent === "success" ? "#3A7D44" : "#1a1a0a";
  const iconBg = accent === "warning" ? "#FFF2CC" : accent === "success" ? "#E6F4EA" : "#F5F5F0";

  return (
    <div
      className={`${S.card} p-6 shadow-sm hover:shadow-md transition-all duration-200`}
      style={{ background: bg, borderColor: "rgba(245,197,24,0.18)" }}
    >
      <div className="flex items-center gap-5">
        <div
          className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-2xl shadow-sm"
          style={{ background: iconBg, color: textColor }}
        >
          {icon}
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-[#999977]">{title}</div>
          <div className="mt-1.5 text-3xl font-display font-bold text-[#1a1a0a] leading-none">{value}</div>
          {sub && <div className="mt-1.5 text-sm text-[#777766]">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

/* ─── Status Badge ───────────────────────────────────────────── */
function StatusBadge({ qty, reorder }: { qty: number; reorder: number }) {
  if (qty <= 0)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700">
        <span className="h-2 w-2 rounded-full bg-rose-500" />
        Out of stock
      </span>
    );
  if (qty <= Math.min(3, reorder))
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF2CC] px-3 py-1 text-xs font-medium text-[#926E0A]">
        <span className="h-2 w-2 rounded-full bg-[#F5C518]" />
        Critical
      </span>
    );
  if (qty <= reorder)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF9DC] px-3 py-1 text-xs font-medium text-[#926E0A]">
        <span className="h-2 w-2 rounded-full bg-[#F5C518]" />
        Low stock
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E6F4EA] px-3 py-1 text-xs font-medium text-[#3A7D44]">
      <span className="h-2 w-2 rounded-full bg-[#4CAF50]" />
      In stock
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1a1a0a]/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className={`${S.card} w-full max-w-lg overflow-hidden rounded-2xl shadow-2xl`}
        style={{ background: "#FFFEF9" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#F5C518]/20 px-6 py-5">
          <h2 className="font-display text-xl font-bold text-[#1a1a0a]">{title}</h2>
          <button
            className="rounded-lg p-2 text-[#777766] hover:bg-[#FFF9DC] hover:text-[#926E0A] transition"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="p-6">{children}</div>
        {footer && <div className="flex justify-end gap-3 border-t border-[#F5C518]/10 px-6 py-4">{footer}</div>}
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
    // silent fail if table missing
  }
}

function fmtMoney(v: number) {
  return `Ksh ${Number(v || 0).toLocaleString("en-KE", { minimumFractionDigits: 0 })}`;
}

/* ─── Page ───────────────────────────────────────────────────── */
export default function InventoryPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [allProducts, setAllProducts] = useState<ProductLite[]>([]);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  // Add modal
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

  // Quick restock
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
        await logMovement({ org_id: orgId, product_id: addProductId, type: "add", qty_delta: qty, qty_before: 0, qty_after: qty, note: "Initial stock entry" });
      } else {
        const before = Number(existing.qty_on_hand ?? 0);
        const after = before + qty;
        const { error: e3 } = await supabase.from("inventory").update({ qty_on_hand: after, reorder_level: reorder }).eq("org_id", orgId).eq("product_id", addProductId);
        if (e3) throw new Error(e3.message);
        await logMovement({ org_id: orgId, product_id: addProductId, type: "add", qty_delta: qty, qty_before: before, qty_after: after, note: "Stock added" });
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
      await logMovement({ org_id: orgId, product_id: row.product_id, type: "restock", qty_delta: amount, qty_before: before, qty_after: after, note: `Quick restock +${amount}` });
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
      else if (adjustMode === "remove") { after = Math.max(0, before - n); delta = before - after; }
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
        <div className="flex items-center gap-3 text-[#777766]">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" strokeOpacity="0.2" />
            <path d="M12 2a10 10 0 0110 10" />
          </svg>
          <span className="text-sm font-medium">Loading hive inventory…</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=DM+Sans:wght@300;400;500;700&display=swap');

        .inventory-page * {
          font-family: 'DM Sans', system-ui, sans-serif;
        }
        .inventory-page .font-display {
          font-family: 'Playfair Display', serif;
        }

        .item-row {
          transition: background 0.16s ease;
        }
        .item-row:hover {
          background: #FFFBEA;
        }

        .btn-amber {
          background: #F5C518;
          color: #1a1a0a;
        }
        .btn-amber:hover {
          background: #E5B50F;
        }
      `}</style>

      <div className="inventory-page space-y-6 px-4 py-6 sm:px-6 lg:px-8 max-w-screen-xl mx-auto">

        {/* Error */}
        {err && (
          <div className="rounded-xl border border-rose-200 bg-rose-50/80 px-5 py-3 text-sm text-rose-700 flex items-start gap-3">
            <span className="mt-0.5">⚠️</span>
            <span className="flex-1">{err}</span>
            <button onClick={() => setErr("")} className="text-rose-400 hover:text-rose-600">✕</button>
          </div>
        )}

        {/* Header with gradient */}
        <div className={`${S.card} overflow-hidden shadow-sm`}>
          <div style={{ height: 4, background: "linear-gradient(90deg, #F5C518, #FFE566, #F5C518)" }} />
          <div className="px-6 py-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-[#999977]">
                  Hive Management
                </div>
                <h1 className="font-display mt-1 text-3xl sm:text-4xl font-bold text-[#1a1a0a]">
                  Inventory <em style={{ color: "#3a7d44", fontStyle: "italic" }}>Dashboard</em>
                </h1>
                <p className="mt-2 text-sm text-[#777766]">
                  Monitor stock levels, reorder alerts & total value
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2.5 rounded-xl border border-[#E5E5D5] bg-white px-4 py-2.5 shadow-sm focus-within:border-[#F5C518]/60 focus-within:ring-2 focus-within:ring-[#FFF9DC] transition">
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="#777766" strokeWidth="2.2">
                    <circle cx="9" cy="9" r="5.5" />
                    <line x1="13.5" y1="13.5" x2="18" y2="18" />
                  </svg>
                  <input
                    className="w-48 bg-transparent text-sm outline-none placeholder:text-[#aaa995]"
                    placeholder="Search product or SKU…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                </label>

                <button
                  className="btn-amber px-5 py-2.5 rounded-xl font-medium shadow-sm hover:shadow transition"
                  onClick={() => setAddOpen(true)}
                >
                  + Add Stock
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <StatCard
            title="Total Products"
            value={String(kpis.totalItems)}
            sub="items tracked"
            icon="📦"
            accent="neutral"
          />
          <StatCard
            title="Low / Critical"
            value={String(kpis.lowStock)}
            sub="require attention"
            icon="⚠️"
            accent={kpis.lowStock > 0 ? "warning" : "success"}
          />
          <StatCard
            title="Stock Value"
            value={fmtMoney(kpis.totalValue)}
            sub="current worth"
            icon="🍯"
            accent="success"
          />
        </div>

        {/* Inventory Table */}
        <div className={`${S.card} overflow-hidden shadow-sm`}>
          <div style={{ padding: "1.1rem 1.5rem", borderBottom: "1.5px solid rgba(245,197,24,0.15)", background: "#FFFEF5" }}>
            <div className="font-display text-xl font-bold text-[#1a1a0a]">Current Stock</div>
          </div>

          {/* Desktop header */}
          <div
            className="hidden lg:grid items-center gap-5 px-6 py-3 text-xs font-medium uppercase tracking-wider text-[#777766]"
            style={{ gridTemplateColumns: "2.2fr 1fr 1fr 1fr 1.3fr 1.4fr", background: "#FAFAF5", borderBottom: "1px solid rgba(245,197,24,0.1)" }}
          >
            <div>Product</div>
            <div>Category</div>
            <div>On Hand</div>
            <div>Reorder At</div>
            <div>Status</div>
            <div>Actions</div>
          </div>

          <div className="divide-y divide-[#F5C518]/10">
            {filtered.length === 0 ? (
              <div className="py-16 text-center text-[#777766]">
                <div className="text-5xl mb-4">🍯</div>
                <p className="font-medium">{rows.length === 0 ? "No products in inventory yet" : "No matching products"}</p>
                <p className="text-sm mt-2">
                  {rows.length === 0 ? 'Click "Add Stock" to begin' : "Try adjusting your search"}
                </p>
              </div>
            ) : (
              filtered.map((r) => {
                const p = r.products;
                const name = p?.name ?? "Unknown";
                const sku = p?.sku ?? "—";
                const category = p?.category ?? "—";
                const price = Number(p?.unit_price ?? 0);
                const qty = Number(r.qty_on_hand ?? 0);
                const reorder = Number(r.reorder_level ?? 0);
                const isSaving = savingId === r.product_id;

                return (
                  <div key={r.product_id} className="item-row">
                    {/* Desktop */}
                    <div className="hidden lg:grid items-center gap-5 px-6 py-4" style={{ gridTemplateColumns: "2.2fr 1fr 1fr 1fr 1.3fr 1.4fr" }}>
                      <div className="flex items-center gap-4">
                        <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#FFF9DC]/60 text-xl">🍯</div>
                        <div className="min-w-0">
                          <div className="font-medium text-[#1a1a0a] truncate">{name}</div>
                          <div className="text-xs text-[#777766] mt-0.5">SKU {sku} · {fmtMoney(price)}</div>
                        </div>
                      </div>
                      <div>
                        <span className="rounded-lg bg-[#F5F5F0] px-2.5 py-1 text-xs font-medium text-[#555540]">
                          {category}
                        </span>
                      </div>
                      <div className="text-lg font-bold text-[#1a1a0a]">{qty}</div>
                      <div>
                        <input
                          type="number"
                          min={0}
                          defaultValue={reorder}
                          onBlur={(e) => {
                            const v = Number(e.target.value);
                            if (v !== reorder) handleSaveReorder(r, v);
                          }}
                          className="w-20 text-center rounded-lg border border-[#E5E5D5] py-1.5 text-sm focus:border-[#F5C518]/60 focus:ring-2 focus:ring-[#FFF9DC] outline-none"
                        />
                        {isSaving && <span className="ml-2 text-xs text-[#999977] animate-pulse">saving…</span>}
                      </div>
                      <div>
                        <StatusBadge qty={qty} reorder={reorder} />
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min={1}
                          placeholder="Qty"
                          value={restockQty[r.product_id] ?? ""}
                          onChange={(e) => setRestockQty((p) => ({ ...p, [r.product_id]: e.target.value }))}
                          className="w-20 text-center rounded-lg border border-[#E5E5D5] py-1.5 text-sm focus:border-[#F5C518]/60 focus:ring-2 focus:ring-[#FFF9DC] outline-none"
                        />
                        <button
                          disabled={isSaving || !Number(restockQty[r.product_id])}
                          className="btn-amber px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 transition"
                          onClick={() => handleQuickRestock(r, Number(restockQty[r.product_id] || 0))}
                        >
                          Restock
                        </button>
                        <button
                          className="p-2 text-[#777766] hover:text-[#926E0A] hover:bg-[#FFF9DC] rounded-lg transition"
                          onClick={() => openAdjust(r)}
                        >
                          Adjust
                        </button>
                      </div>
                    </div>

                    {/* Mobile stacked */}
                    <div className="lg:hidden px-5 py-5 space-y-4 border-b border-[#F5C518]/10">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#FFF9DC]/60 text-2xl shrink-0">🍯</div>
                          <div className="min-w-0">
                            <div className="font-medium text-[#1a1a0a] truncate">{name}</div>
                            <div className="text-xs text-[#777766] mt-0.5">SKU {sku}</div>
                          </div>
                        </div>
                        <StatusBadge qty={qty} reorder={reorder} />
                      </div>

                      <div className="grid grid-cols-3 gap-3 bg-[#FAFAF5] rounded-xl p-4">
                        <div className="text-center">
                          <div className="text-[10px] uppercase tracking-wide text-[#999977] font-medium">On Hand</div>
                          <div className="mt-1 text-xl font-bold text-[#1a1a0a]">{qty}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-[10px] uppercase tracking-wide text-[#999977] font-medium">Reorder</div>
                          <input
                            type="number"
                            min={0}
                            defaultValue={reorder}
                            onBlur={(e) => {
                              const v = Number(e.target.value);
                              if (v !== reorder) handleSaveReorder(r, v);
                            }}
                            className="mt-1 w-full text-center rounded-lg border border-[#E5E5D5] py-1 text-sm focus:border-[#F5C518]/60 focus:ring-1 focus:ring-[#FFF9DC] outline-none"
                          />
                        </div>
                        <div className="text-center">
                          <div className="text-[10px] uppercase tracking-wide text-[#999977] font-medium">Price</div>
                          <div className="mt-1 text-sm font-medium text-[#555540]">{fmtMoney(price)}</div>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <input
                          type="number"
                          min={1}
                          placeholder="Qty to add"
                          value={restockQty[r.product_id] ?? ""}
                          onChange={(e) => setRestockQty((p) => ({ ...p, [r.product_id]: e.target.value }))}
                          className="flex-1 text-center rounded-lg border border-[#E5E5D5] py-2.5 text-sm focus:border-[#F5C518]/60 focus:ring-2 focus:ring-[#FFF9DC] outline-none"
                        />
                        <button
                          disabled={isSaving || !Number(restockQty[r.product_id])}
                          className="btn-amber px-5 rounded-lg font-medium disabled:opacity-50 transition"
                          onClick={() => handleQuickRestock(r, Number(restockQty[r.product_id] || 0))}
                        >
                          Restock
                        </button>
                        <button
                          className="px-4 rounded-lg border border-[#E5E5D5] text-[#777766] hover:bg-[#FFF9DC] transition"
                          onClick={() => openAdjust(r)}
                        >
                          Adjust
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="px-6 py-3 text-xs text-[#999977] border-t border-[#F5C518]/10">
            Showing {filtered.length} of {rows.length} product{rows.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Add Stock Modal */}
        <Modal
          open={addOpen}
          title="Add New Stock Item"
          onClose={() => setAddOpen(false)}
          footer={
            <>
              <button className="px-5 py-2.5 rounded-lg border border-[#E5E5D5] text-[#777766] hover:bg-[#F5F5F0] transition" onClick={() => setAddOpen(false)}>
                Cancel
              </button>
              <button
                className="btn-amber px-6 py-2.5 rounded-lg font-medium disabled:opacity-50 transition"
                onClick={handleAddStock}
                disabled={savingId === addProductId}
              >
                {savingId === addProductId ? "Saving…" : "Add to Inventory"}
              </button>
            </>
          }
        >
          {addCandidates.length === 0 ? (
            <div className="py-10 text-center text-[#777766]">
              <div className="text-5xl mb-4">✅</div>
              <p className="font-medium">All catalog products are already tracked</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-[#999977] mb-2">Select Product</label>
                <select
                  className="w-full rounded-lg border border-[#E5E5D5] px-4 py-2.5 text-sm focus:border-[#F5C518]/60 focus:ring-2 focus:ring-[#FFF9DC] outline-none"
                  value={addProductId}
                  onChange={(e) => setAddProductId(e.target.value)}
                >
                  {addCandidates.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}{p.sku ? ` — ${p.sku}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-[#999977] mb-2">Initial Quantity</label>
                  <input
                    className="w-full rounded-lg border border-[#E5E5D5] px-4 py-2.5 text-sm focus:border-[#F5C518]/60 focus:ring-2 focus:ring-[#FFF9DC] outline-none"
                    type="number"
                    min={0}
                    value={addQty}
                    onChange={(e) => setAddQty(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-[#999977] mb-2">Reorder Level</label>
                  <input
                    className="w-full rounded-lg border border-[#E5E5D5] px-4 py-2.5 text-sm focus:border-[#F5C518]/60 focus:ring-2 focus:ring-[#FFF9DC] outline-none"
                    type="number"
                    min={0}
                    value={addReorder}
                    onChange={(e) => setAddReorder(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
        </Modal>

        {/* Adjust Modal */}
        <Modal
          open={adjustOpen}
          title={adjustRow ? `Adjust — ${adjustRow.products?.name || "Product"}` : "Adjust Stock"}
          onClose={() => setAdjustOpen(false)}
          footer={
            <>
              <button className="px-5 py-2.5 rounded-lg border border-[#E5E5D5] text-[#777766] hover:bg-[#F5F5F0] transition" onClick={() => setAdjustOpen(false)}>
                Cancel
              </button>
              <button
                className="btn-amber px-6 py-2.5 rounded-lg font-medium disabled:opacity-50 transition"
                onClick={handleAdjustSave}
                disabled={savingId === adjustRow?.product_id}
              >
                {savingId === adjustRow?.product_id ? "Saving…" : "Confirm Adjustment"}
              </button>
            </>
          }
        >
          {adjustRow && (
            <div className="space-y-6">
              <div className="rounded-xl bg-[#FAFAF5] p-5 border border-[#F5C518]/15 flex items-center gap-6">
                <div>
                  <div className="text-xs uppercase tracking-wider text-[#999977]">Current Stock</div>
                  <div className="text-4xl font-display font-bold text-[#1a1a0a] mt-1">
                    {Number(adjustRow.qty_on_hand ?? 0)}
                  </div>
                  <div className="text-sm text-[#777766] mt-1">
                    Reorder at <span className="font-medium">{Number(adjustRow.reorder_level ?? 0)}</span>
                  </div>
                </div>
                <div className="ml-auto">
                  <StatusBadge qty={Number(adjustRow.qty_on_hand ?? 0)} reorder={Number(adjustRow.reorder_level ?? 0)} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {(["add", "remove", "set"] as const).map((m) => (
                  <button
                    key={m}
                    className={`py-3 rounded-xl border text-sm font-medium transition ${
                      adjustMode === m
                        ? "border-[#F5C518] bg-[#FFF9DC] text-[#926E0A] shadow-sm"
                        : "border-[#E5E5D5] text-[#777766] hover:bg-[#F5F5F0]"
                    }`}
                    onClick={() => setAdjustMode(m)}
                  >
                    {m === "add" ? "+ Add" : m === "remove" ? "− Remove" : "= Set"}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-[#999977] mb-2">
                    {adjustMode === "set" ? "New Quantity" : "Amount"}
                  </label>
                  <input
                    className="w-full rounded-lg border border-[#E5E5D5] px-4 py-2.5 text-sm focus:border-[#F5C518]/60 focus:ring-2 focus:ring-[#FFF9DC] outline-none"
                    type="number"
                    min={0}
                    value={adjustValue}
                    onChange={(e) => setAdjustValue(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-[#999977] mb-2">Note (optional)</label>
                  <input
                    className="w-full rounded-lg border border-[#E5E5D5] px-4 py-2.5 text-sm focus:border-[#F5C518]/60 focus:ring-2 focus:ring-[#FFF9DC] outline-none"
                    placeholder="Reason for adjustment…"
                    value={adjustNote}
                    onChange={(e) => setAdjustNote(e.target.value)}
                  />
                </div>
              </div>

              <p className="text-xs text-[#999977]">Removing stock will never go below zero.</p>
            </div>
          )}
        </Modal>
      </div>
    </>
  );
}