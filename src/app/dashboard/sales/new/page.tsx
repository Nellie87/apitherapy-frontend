"use client";

import React, { useEffect, useMemo, useState } from "react";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import { listSellable, type SellableRow } from "@/lib/api/sellable";
import { createSaleStrict } from "@/lib/api/sales";
import * as S from "./page.styles";

type CartLine = {
  product_id: string;
  name: string;
  available: number;
  base_price: number;
  qty: number;
  unit_price_override?: number | null;
};

function fmtMoney(v: number) {
  return `Ksh ${Number(v || 0).toFixed(2)}`;
}

function hasProduct(
  r: SellableRow
): r is SellableRow & { products: NonNullable<SellableRow["products"]> } {
  return r.products != null;
}

export default function NewSalePage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [rows, setRows] = useState<SellableRow[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [q, setQ] = useState("");
  const [customer, setCustomer] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function refresh(o: string) {
    const data = await listSellable(o);
    setRows(data);
  }

  useEffect(() => {
    (async () => {
      try {
        const o = await bootstrapOrg();
        setOrgId(o);
        await refresh(o);
      } catch (e: any) {
        setErr(e.message ?? String(e));
      }
    })();
  }, []);

  const productList = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows
      .filter((r) => r.products)
      .filter((r) => {
        if (!t) return true;
        const name = (r.products?.name ?? "").toLowerCase();
        const sku = (r.products?.sku ?? "").toLowerCase();
        const barcode = (r.products?.barcode ?? "").toLowerCase();
        return name.includes(t) || sku.includes(t) || barcode.includes(t);
      })
      .slice(0, 24);
  }, [rows, q]);

  function addToCart(r: SellableRow & { products: NonNullable<SellableRow["products"]> }) {
    setCart((prev) => {
      const existing = prev.find((x) => x.product_id === r.product_id);
      const available = Number(r.qty_on_hand ?? 0);

      if (existing) {
        const nextQty = Math.min(existing.qty + 1, available);
        return prev.map((x) =>
          x.product_id === r.product_id ? { ...x, qty: nextQty, available } : x
        );
      }

      return [
        ...prev,
        {
          product_id: r.product_id,
          name: r.products.name,
          available,
          base_price: Number(r.products.unit_price ?? 0),
          qty: available > 0 ? 1 : 0,
          unit_price_override: null,
        },
      ];
    });
  }

  function updateQty(product_id: string, qty: number) {
    setCart((prev) =>
      prev.map((x) => {
        if (x.product_id !== product_id) return x;
        const safe = Math.max(0, Math.min(qty, x.available));
        return { ...x, qty: safe };
      })
    );
  }

  function updateOverride(product_id: string, price: number | null) {
    setCart((prev) =>
      prev.map((x) => {
        if (x.product_id !== product_id) return x;
        if (price === null) return { ...x, unit_price_override: null };
        return { ...x, unit_price_override: Math.max(0, price) };
      })
    );
  }

  function removeLine(product_id: string) {
    setCart((prev) => prev.filter((x) => x.product_id !== product_id));
  }

  useEffect(() => {
    const map = new Map(rows.map((r) => [r.product_id, Number(r.qty_on_hand ?? 0)]));
    setCart((prev) =>
      prev.map((x) => {
        const available = map.get(x.product_id) ?? x.available;
        const qty = Math.min(x.qty, available);
        return { ...x, available, qty };
      })
    );
  }, [rows]);

  const totals = useMemo(() => {
    let subtotal = 0;
    let total = 0;
    let discountTotal = 0;

    for (const line of cart) {
      const base = Number(line.base_price ?? 0);
      const final = line.unit_price_override == null ? base : Number(line.unit_price_override);
      const qty = Number(line.qty ?? 0);

      subtotal += base * qty;
      total += final * qty;
      discountTotal += Math.max(0, (base - final) * qty);
    }

    return { subtotal, discountTotal, total };
  }, [cart]);

  async function completeSale() {
    if (!orgId) return;

    setErr("");
    const items = cart
      .filter((l) => l.qty > 0)
      .map((l) => ({
        product_id: l.product_id,
        qty: l.qty,
        unit_price_override: l.unit_price_override ?? null,
      }));

    if (items.length === 0) {
      setErr("Cart is empty.");
      return;
    }

    for (const line of cart) {
      if (line.qty > line.available) {
        setErr(`Insufficient stock for ${line.name}. Available: ${line.available}`);
        return;
      }
    }

    setSaving(true);
    try {
      const res = await createSaleStrict(orgId, {
        customer_name: customer.trim() || undefined,
        items,
      });

      await refresh(orgId);
      setCart([]);
      setCustomer("");

      window.location.href = `/dashboard/sales?created=${encodeURIComponent(res.sale_no)}`;
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  if (!orgId && !err) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-sm text-zinc-400">Loading…</div>
      </div>
    );
  }

  const cartItemCount = cart.filter((x) => x.qty > 0).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className={`${S.card} px-6 py-5`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-zinc-900">New Sale</h1>
            <p className="mt-0.5 text-sm text-zinc-500">
              Select products · adjust quantity · complete transaction
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a className={S.btnGhost} href="/dashboard/sales">
              ← Back
            </a>
            <button
              className={S.btnPrimary}
              onClick={completeSale}
              disabled={saving || cartItemCount === 0}
            >
              {saving ? "Processing…" : `Complete Sale${cartItemCount > 0 ? ` (${cartItemCount})` : ""}`}
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Search Products
            </label>
            <input
              className={S.input}
              placeholder="Name, SKU, or barcode…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Customer (optional)
            </label>
            <input
              className={S.input}
              placeholder="Customer name"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Error */}
      {err && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
          <span className="mt-0.5 text-rose-500">⚠</span>
          <p className="text-sm font-medium text-rose-700">{err}</p>
        </div>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* LEFT: product picker */}
        <div className={`${S.card} flex flex-col`}>
          <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
            <h2 className="text-sm font-bold text-zinc-900">Products</h2>
            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-500">
              {productList.length} shown
            </span>
          </div>

          <div className="flex-1 overflow-auto">
            {productList.filter(hasProduct).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="text-2xl">🔍</div>
                <p className="mt-2 text-sm font-medium text-zinc-400">No products match your search</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {productList.filter(hasProduct).map((r) => {
                  const p = r.products;
                  const available = Number(r.qty_on_hand ?? 0);
                  const outOfStock = available <= 0;
                  const inCart = cart.some((x) => x.product_id === r.product_id);

                  return (
                    <button
                      key={r.product_id}
                      className={[
                        "group w-full px-5 py-3.5 text-left transition-colors",
                        outOfStock
                          ? "cursor-not-allowed opacity-40"
                          : inCart
                          ? "bg-amber-50 hover:bg-amber-100"
                          : "hover:bg-zinc-50",
                      ].join(" ")}
                      onClick={() => !outOfStock && addToCart(r)}
                      disabled={outOfStock}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold text-zinc-900">
                              {p.name}
                            </span>
                            {inCart && (
                              <span className={`${S.badge} bg-amber-100 text-amber-700 shrink-0`}>
                                In cart
                              </span>
                            )}
                          </div>
                          {(p.sku || p.barcode) && (
                            <p className="mt-0.5 truncate text-xs text-zinc-400">
                              {[p.sku && `SKU: ${p.sku}`, p.barcode && `Barcode: ${p.barcode}`]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-sm font-bold text-zinc-900">
                            {fmtMoney(Number(p.unit_price ?? 0))}
                          </div>
                          <div
                            className={`text-xs font-semibold ${
                              outOfStock ? "text-rose-500" : "text-zinc-400"
                            }`}
                          >
                            {outOfStock ? "Out of stock" : `${available} avail.`}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: cart */}
        <div className={`${S.card} flex flex-col`}>
          <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
            <h2 className="text-sm font-bold text-zinc-900">
              Cart
              {cart.length > 0 && (
                <span className="ml-2 text-zinc-400 font-normal">({cart.length} item{cart.length !== 1 ? "s" : ""})</span>
              )}
            </h2>
            <button
              className={S.btnDanger}
              onClick={() => setCart([])}
              disabled={cart.length === 0}
            >
              Clear all
            </button>
          </div>

          <div className="flex-1 overflow-auto">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="text-2xl">🛒</div>
                <p className="mt-2 text-sm font-medium text-zinc-400">Cart is empty</p>
                <p className="mt-1 text-xs text-zinc-300">Click a product on the left to add it</p>
              </div>
            ) : (
              <>
                {/* Column headers */}
                <div className="grid items-center gap-2 border-b border-zinc-100 px-5 py-2" style={{ gridTemplateColumns: "1fr 5rem 5rem auto" }}>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Item</div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 text-center">Qty</div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 text-center">Price</div>
                  <div />
                </div>

                <div className="divide-y divide-zinc-100">
                  {cart.map((line) => {
                    const base = Number(line.base_price ?? 0);
                    const final =
                      line.unit_price_override == null ? base : Number(line.unit_price_override);
                    const isDiscounted = line.unit_price_override != null && final !== base;
                    const lineTotal = final * Number(line.qty ?? 0);
                    const overQty = line.qty > line.available;

                    return (
                      <div
                        key={line.product_id}
                        className={`grid items-center gap-2 px-5 py-3 ${overQty ? "bg-rose-50" : ""}`}
                        style={{ gridTemplateColumns: "1fr 5rem 5rem auto" }}
                      >
                        {/* Name + meta */}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-zinc-900">{line.name}</p>
                          <div className="mt-0.5 flex items-center gap-1.5">
                            <span className="text-xs text-zinc-400">Base {fmtMoney(base)}</span>
                            {isDiscounted && (
                              <span className={`${S.badge} bg-amber-50 text-amber-600`}>
                                Discount applied
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs font-semibold text-zinc-500">
                            = {fmtMoney(lineTotal)}
                            {overQty && (
                              <span className="ml-2 text-rose-500">· Exceeds stock ({line.available})</span>
                            )}
                          </p>
                        </div>

                        {/* Qty */}
                        <div>
                          <input
                            className={`${S.inputSoft} text-center ${overQty ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100" : ""}`}
                            type="number"
                            min={0}
                            max={line.available}
                            value={line.qty}
                            onChange={(e) =>
                              updateQty(line.product_id, Number(e.target.value || 0))
                            }
                          />
                          <p className="mt-1 text-center text-[10px] text-zinc-400">{line.available} avail.</p>
                        </div>

                        {/* Price override */}
                        <div>
                          <input
                            className={`${S.inputSoft} text-right ${isDiscounted ? "border-amber-300 bg-amber-50 focus:ring-amber-100" : ""}`}
                            type="number"
                            min={0}
                            step="0.01"
                            value={line.unit_price_override == null ? "" : line.unit_price_override}
                            placeholder={`${base}`}
                            onChange={(e) => {
                              const v = e.target.value;
                              updateOverride(line.product_id, v === "" ? null : Number(v));
                            }}
                            title="Override price (leave blank for default)"
                          />
                          <p className="mt-1 text-center text-[10px] text-zinc-400">override</p>
                        </div>

                        {/* Remove */}
                        <button
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-300 hover:bg-rose-50 hover:text-rose-500 transition-colors"
                          onClick={() => removeLine(line.product_id)}
                          title="Remove"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Totals */}
          {cart.length > 0 && (
            <div className="border-t border-zinc-100 bg-zinc-50/70 px-5 py-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-zinc-500">
                  <span>Subtotal (base)</span>
                  <span className="font-semibold text-zinc-700">{fmtMoney(totals.subtotal)}</span>
                </div>
                {totals.discountTotal > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">Discounts</span>
                    <span className="font-semibold text-amber-600">−{fmtMoney(totals.discountTotal)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-zinc-200 pt-2">
                  <span className="text-base font-bold text-zinc-900">Total</span>
                  <span className="text-lg font-black text-zinc-900">{fmtMoney(totals.total)}</span>
                </div>
              </div>

              <button
                className={`${S.btnPrimary} mt-4 w-full py-3 text-base`}
                onClick={completeSale}
                disabled={saving || cartItemCount === 0}
              >
                {saving ? "Processing…" : "Complete Sale →"}
              </button>

              <p className="mt-2 text-center text-xs text-zinc-400">
                Stock enforced server-side · cannot oversell
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}