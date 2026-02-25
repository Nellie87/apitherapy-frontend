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

type StockFilter = "all" | "low" | "out";

/* ─── Helpers ────────────────────────────────────────────────── */
function getStockStatus(qty: number, reorder: number): "out" | "critical" | "low" | "ok" {
  if (qty <= 0) return "out";
  if (qty <= Math.min(3, reorder)) return "critical";
  if (qty <= reorder) return "low";
  return "ok";
}

function fmtMoney(v: number) {
  return `Ksh ${Number(v || 0).toLocaleString("en-KE", { minimumFractionDigits: 0 })}`;
}

/* ─── Stat Card ─────────────────────────────────────────────── */
function StatCard({
  title,
  value,
  sub,
  icon,
  variant = "neutral",
  active = false,
  onClick,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  variant?: "neutral" | "warning" | "danger" | "success";
  active?: boolean;
  onClick?: () => void;
}) {
  const styles = {
    neutral: {
      bg: "#FFFFFF",
      border: active ? "#94a3b8" : "#e2e8f0",
      iconBg: "#f8fafc",
      iconColor: "#475569",
      valueColor: "#0f172a",
      labelColor: "#64748b",
    },
    warning: {
      bg: active ? "#fffbeb" : "#FFFFFF",
      border: active ? "#f59e0b" : "#e2e8f0",
      iconBg: "#fef3c7",
      iconColor: "#92400e",
      valueColor: "#92400e",
      labelColor: "#64748b",
    },
    danger: {
      bg: active ? "#fff1f2" : "#FFFFFF",
      border: active ? "#f43f5e" : "#e2e8f0",
      iconBg: "#fee2e2",
      iconColor: "#991b1b",
      valueColor: "#991b1b",
      labelColor: "#64748b",
    },
    success: {
      bg: "#FFFFFF",
      border: "#e2e8f0",
      iconBg: "#f0fdf4",
      iconColor: "#166534",
      valueColor: "#166534",
      labelColor: "#64748b",
    },
  };

  const s = styles[variant];

  return (
    <div
      onClick={onClick}
      className="rounded-2xl shadow-sm transition-all duration-150"
      style={{
        background: s.bg,
        border: `1.5px solid ${s.border}`,
        cursor: onClick ? "pointer" : "default",
        userSelect: "none",
        transform: active ? "translateY(-1px)" : undefined,
        boxShadow: active ? "0 4px 12px rgba(0,0,0,0.1)" : undefined,
      }}
    >
      <div className="flex items-center gap-4 p-5">
        <div
          className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-xl"
          style={{ background: s.iconBg, color: s.iconColor }}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: s.labelColor }}>
            {title}
          </div>
          <div className="mt-1 text-2xl font-bold leading-none" style={{ color: s.valueColor }}>
            {value}
          </div>
          {sub && (
            <div className="mt-1 text-xs" style={{ color: s.labelColor }}>
              {sub}
            </div>
          )}
        </div>
        {onClick && (
          <div className="ml-auto shrink-0 text-slate-400" style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.05em" }}>
            {active ? "CLEAR ✕" : "FILTER →"}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Status Badge ───────────────────────────────────────────── */
function StatusBadge({ qty, reorder }: { qty: number; reorder: number }) {
  const status = getStockStatus(qty, reorder);

  if (status === "out")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-red-100 text-red-700">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
        Out of stock
      </span>
    );
  if (status === "critical")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-orange-100 text-orange-700">
        <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
        Critical
      </span>
    );
  if (status === "low")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-amber-100 text-amber-700">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Low stock
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-green-100 text-green-700">
      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
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
    <div className={S.overlay} onClick={onClose}>
      <div className={S.modal} onClick={(e) => e.stopPropagation()}>
        <div className={S.modalHead}>
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          <button
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
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
    // silent fail if table missing
  }
}

/* ─── Page ───────────────────────────────────────────────────── */
export default function InventoryPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [allProducts, setAllProducts] = useState<ProductLite[]>([]);
  const [q, setQ] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
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

  const kpis = useMemo(() => {
    const totalItems = rows.length;
    const outOfStock = rows.filter((r) => Number(r.qty_on_hand ?? 0) <= 0).length;
    const lowStock = rows.filter((r) => {
      const qty = Number(r.qty_on_hand ?? 0);
      const reorder = Number(r.reorder_level ?? 0);
      return qty > 0 && qty <= reorder;
    }).length;
    const totalValue = rows.reduce((sum, r) => {
      const price = Number(r.products?.unit_price ?? 0);
      const qty = Number(r.qty_on_hand ?? 0);
      return sum + price * qty;
    }, 0);
    return { totalItems, outOfStock, lowStock, totalValue };
  }, [rows]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();

    return rows.filter((r) => {
      // Text search
      const name = (r.products?.name ?? "").toLowerCase();
      const cat = (r.products?.category ?? "").toLowerCase();
      const matchesText = !term || name.includes(term) || cat.includes(term);

      // Status filter
      const qty = Number(r.qty_on_hand ?? 0);
      const reorder = Number(r.reorder_level ?? 0);
      const status = getStockStatus(qty, reorder);
      const matchesFilter =
        stockFilter === "all" ||
        (stockFilter === "out" && status === "out") ||
        (stockFilter === "low" && (status === "low" || status === "critical"));

      return matchesText && matchesFilter;
    });
  }, [rows, q, stockFilter]);

  function toggleFilter(f: StockFilter) {
    setStockFilter((prev) => (prev === f ? "all" : f));
  }

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
        <div className="flex items-center gap-3 text-slate-500">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" strokeOpacity="0.2" />
            <path d="M12 2a10 10 0 0110 10" />
          </svg>
          <span className="text-sm font-medium">Loading inventory…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Error banner */}
      {err && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
          <span className="mt-0.5 shrink-0">⚠️</span>
          <span className="flex-1">{err}</span>
          <button onClick={() => setErr("")} className="shrink-0 text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventory</h1>
          <p className="mt-1 text-sm text-slate-500">
            Track stock levels, reorder points, and total value
          </p>
        </div>
        {/* <button
          className={S.btnPrimary}
          onClick={() => setAddOpen(true)}
        >
          + Add Stock
        </button> */}
      </div>

      {/* KPI cards — clicking low/out filters the table */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
  title="Total Products"
  value={String(kpis.totalItems)}
  sub="items tracked"
  icon="📦"
  variant="neutral"
  active={stockFilter !== "all"}
  onClick={() => setStockFilter("all")}
/>
        <StatCard
          title="Low Stock"
          value={String(kpis.lowStock)}
          sub="below reorder point"
          icon="📉"
          variant="warning"
          active={stockFilter === "low"}
          onClick={() => toggleFilter("low")}
        />
        <StatCard
          title="Out of Stock"
          value={String(kpis.outOfStock)}
          sub="zero quantity"
          icon="🚫"
          variant="danger"
          active={stockFilter === "out"}
          onClick={() => toggleFilter("out")}
        />
        <StatCard
          title="Total Value"
          value={fmtMoney(kpis.totalValue)}
          sub="current stock worth"
          icon="💰"
          variant="success"
        />
      </div>

      {/* Active filter pill */}
      {stockFilter !== "all" && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">Showing:</span>
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
              stockFilter === "out"
                ? "bg-red-100 text-red-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {stockFilter === "out" ? "Out of stock items" : "Low stock items"}
            <button
              onClick={() => setStockFilter("all")}
              className="ml-1 opacity-70 hover:opacity-100"
            >
              ✕
            </button>
          </span>
          <span className="text-sm text-slate-400">({filtered.length} result{filtered.length !== 1 ? "s" : ""})</span>
        </div>
      )}

      {/* Search */}
      <label className="flex items-center gap-2.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 shadow-sm focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-100 transition w-full sm:w-80">
        <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="#94a3b8" strokeWidth="2.2">
          <circle cx="9" cy="9" r="5.5" />
          <line x1="13.5" y1="13.5" x2="18" y2="18" />
        </svg>
        <input
          className="flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
          placeholder="Search product or category…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {q && (
          <button onClick={() => setQ("")} className="text-slate-400 hover:text-slate-600">✕</button>
        )}
      </label>

      {/* Table */}
      <div className={`${S.card} overflow-hidden`}>

        {/* Desktop header — must match row grid exactly */}
        <div
          className={`hidden lg:grid ${S.tableGrid} items-center gap-4 px-6 py-3`}
          style={{
            background: "#f8fafc",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          {["Product", "Category", "On Hand", "Reorder At", "Status", "Actions"].map((h) => (
            <div
              key={h}
              className="text-xs font-semibold uppercase tracking-wider text-slate-500"
            >
              {h}
            </div>
          ))}
        </div>

        {/* Rows */}
        <div className="divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <div className="text-5xl mb-4">🍯</div>
              <p className="font-semibold text-slate-700">
                {rows.length === 0
                  ? "No products in inventory yet"
                  : stockFilter !== "all"
                  ? `No ${stockFilter === "out" ? "out-of-stock" : "low-stock"} items`
                  : "No matching products"}
              </p>
              <p className="text-sm text-slate-400 mt-1">
                {rows.length === 0
                  ? 'Click "Add Stock" to begin'
                  : stockFilter !== "all"
                  ? "Great! All products are well stocked."
                  : "Try adjusting your search"}
              </p>
              {stockFilter !== "all" && (
                <button
                  onClick={() => setStockFilter("all")}
                  className="mt-4 text-sm text-amber-600 hover:text-amber-700 font-medium"
                >
                  Clear filter
                </button>
              )}
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
                <div
                  key={r.product_id}
                  className="transition-colors duration-100 hover:bg-slate-50"
                >
                  {/* ── Desktop row — grid must match header ── */}
                  <div
                    className={`hidden lg:grid ${S.tableGrid} items-center gap-4 px-6 py-4`}
                  >
                    {/* Product */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-lg">
                        🍯
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate">{name}</div>
                        <div className="text-xs text-slate-400 mt-0.5 truncate">
                          SKU {sku} · {fmtMoney(price)}
                        </div>
                      </div>
                    </div>

                    {/* Category */}
                    <div>
                      <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                        {category}
                      </span>
                    </div>

                    {/* On Hand */}
                    <div className="text-xl font-bold text-slate-900">{qty}</div>

                    {/* Reorder At */}
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        defaultValue={reorder}
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (v !== reorder) handleSaveReorder(r, v);
                        }}
                        className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-center text-sm text-slate-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-100 outline-none"
                      />
                      {isSaving && (
                        <span className="text-xs text-slate-400 animate-pulse">saving…</span>
                      )}
                    </div>

                    {/* Status */}
                    <div>
                      <StatusBadge qty={qty} reorder={reorder} />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        placeholder="Qty"
                        value={restockQty[r.product_id] ?? ""}
                        onChange={(e) =>
                          setRestockQty((prev) => ({ ...prev, [r.product_id]: e.target.value }))
                        }
                        className="w-16 rounded-lg border border-slate-300 px-2 py-1.5 text-center text-sm text-slate-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-100 outline-none"
                      />
                      <button
                        disabled={isSaving || !Number(restockQty[r.product_id])}
                        className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-40 transition"
                        onClick={() =>
                          handleQuickRestock(r, Number(restockQty[r.product_id] || 0))
                        }
                      >
                        Restock
                      </button>
                      <button
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                        onClick={() => openAdjust(r)}
                      >
                        Adjust
                      </button>
                    </div>
                  </div>

                  {/* ── Mobile card ── */}
                  <div className="lg:hidden px-5 py-5 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-50 text-xl">
                          🍯
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 truncate">{name}</div>
                          <div className="text-xs text-slate-400 mt-0.5">SKU {sku}</div>
                        </div>
                      </div>
                      <StatusBadge qty={qty} reorder={reorder} />
                    </div>

                    <div className="grid grid-cols-3 gap-3 rounded-xl bg-slate-50 p-4">
                      <div className="text-center">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">On Hand</div>
                        <div className="mt-1 text-xl font-bold text-slate-900">{qty}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reorder</div>
                        <input
                          type="number"
                          min={0}
                          defaultValue={reorder}
                          onBlur={(e) => {
                            const v = Number(e.target.value);
                            if (v !== reorder) handleSaveReorder(r, v);
                          }}
                          className="mt-1 w-full rounded-lg border border-slate-300 py-1 text-center text-sm text-slate-800 outline-none focus:border-amber-500"
                        />
                      </div>
                      <div className="text-center">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Price</div>
                        <div className="mt-1 text-sm font-semibold text-slate-700">{fmtMoney(price)}</div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={1}
                        placeholder="Qty to add"
                        value={restockQty[r.product_id] ?? ""}
                        onChange={(e) =>
                          setRestockQty((prev) => ({ ...prev, [r.product_id]: e.target.value }))
                        }
                        className="flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-center text-sm text-slate-800 outline-none focus:border-amber-500"
                      />
                      <button
                        disabled={isSaving || !Number(restockQty[r.product_id])}
                        className="rounded-lg bg-amber-500 px-4 font-bold text-white text-sm hover:bg-amber-600 disabled:opacity-40 transition"
                        onClick={() =>
                          handleQuickRestock(r, Number(restockQty[r.product_id] || 0))
                        }
                      >
                        Restock
                      </button>
                      <button
                        className="rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
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

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3">
          <span className="text-xs text-slate-400">
            Showing {filtered.length} of {rows.length} product{rows.length !== 1 ? "s" : ""}
          </span>
          {stockFilter !== "all" && (
            <button
              onClick={() => setStockFilter("all")}
              className="text-xs font-medium text-amber-600 hover:text-amber-700"
            >
              Clear filter
            </button>
          )}
        </div>
      </div>

      {/* ── Add Stock Modal ── */}
      <Modal
        open={addOpen}
        title="Add New Stock Item"
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
          <div className="py-10 text-center">
            <div className="text-5xl mb-4">✅</div>
            <p className="font-semibold text-slate-700">All catalog products are already tracked</p>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Select Product</label>
              <select
                className={S.input}
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Initial Quantity</label>
                <input
                  className={S.input}
                  type="number"
                  min={0}
                  value={addQty}
                  onChange={(e) => setAddQty(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Reorder Level</label>
                <input
                  className={S.input}
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

      {/* ── Adjust Modal ── */}
      <Modal
        open={adjustOpen}
        title={adjustRow ? `Adjust — ${adjustRow.products?.name || "Product"}` : "Adjust Stock"}
        onClose={() => setAdjustOpen(false)}
        footer={
          <>
            <button className={S.btnGhost} onClick={() => setAdjustOpen(false)}>
              Cancel
            </button>
            <button
              className={S.btnPrimary}
              onClick={handleAdjustSave}
              disabled={savingId === adjustRow?.product_id}
            >
              {savingId === adjustRow?.product_id ? "Saving…" : "Confirm Adjustment"}
            </button>
          </>
        }
      >
        {adjustRow && (
          <div className="space-y-5">
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Current Stock</div>
                <div className="mt-1 text-3xl font-bold text-slate-900">
                  {Number(adjustRow.qty_on_hand ?? 0)}
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  Reorder at <span className="font-semibold">{Number(adjustRow.reorder_level ?? 0)}</span>
                </div>
              </div>
              <StatusBadge qty={Number(adjustRow.qty_on_hand ?? 0)} reorder={Number(adjustRow.reorder_level ?? 0)} />
            </div>

            <div className="grid grid-cols-3 gap-2">
              {(["add", "remove", "set"] as const).map((m) => (
                <button
                  key={m}
                  className={`rounded-xl border py-2.5 text-sm font-semibold transition ${
                    adjustMode === m
                      ? "border-amber-500 bg-amber-50 text-amber-700 shadow-sm"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                  onClick={() => setAdjustMode(m)}
                >
                  {m === "add" ? "+ Add" : m === "remove" ? "− Remove" : "= Set"}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  {adjustMode === "set" ? "New Quantity" : "Amount"}
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
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Note (optional)</label>
                <input
                  className={S.input}
                  placeholder="Reason…"
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                />
              </div>
            </div>

            <p className="text-xs text-slate-400">Removing stock will never go below zero.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}