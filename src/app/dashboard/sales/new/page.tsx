"use client";

import React, { useEffect, useMemo, useState } from "react";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import { listSellable, type SellableRow } from "@/lib/api/sellable";
import { createSaleStrict } from "@/lib/api/sales";
import * as S from "./page.styles";
import Link from "next/link";

/* ─── Types ──────────────────────────────────────────────────── */
type CartLine = {
  product_id: string;
  name: string;
  category?: string | null;
  available: number;
  base_price: number;
  qty: number;
  unit_price_override?: number | null;
};

type PaymentMethod = "cash" | "mpesa" | "card" | "credit";

/* ─── Helpers ────────────────────────────────────────────────── */
function fmtMoney(v: number) {
  return `Ksh ${Number(v || 0).toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function hasProduct(
  r: SellableRow
): r is SellableRow & { products: NonNullable<SellableRow["products"]> } {
  return r.products != null;
}

/* ─── Icons ──────────────────────────────────────────────────── */
const IconSearch = () => (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" className="text-slate-400 shrink-0">
    <circle cx="9" cy="9" r="5.5" /><line x1="13.5" y1="13.5" x2="18" y2="18" />
  </svg>
);
const IconTrash = () => (
  <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 6h12M8 6V4a1 1 0 011-1h2a1 1 0 011 1v2m-6 0v10a1 1 0 001 1h6a1 1 0 001-1V6" />
  </svg>
);
const IconPlus = () => (
  <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="10" y1="4" x2="10" y2="16" /><line x1="4" y1="10" x2="16" y2="10" />
  </svg>
);
const IconSpinner = () => (
  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
    <path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
  </svg>
);

/* ─── Payment Method Selector ────────────────────────────────── */
const PAYMENT_METHODS: { key: PaymentMethod; label: string; icon: string }[] = [
  { key: "cash",   label: "Cash",   icon: "💵" },
  { key: "mpesa",  label: "M-Pesa", icon: "📱" },
  { key: "card",   label: "Card",   icon: "💳" },
  { key: "credit", label: "Credit", icon: "📋" },
];

function PaymentSelector({ value, onChange }: { value: PaymentMethod; onChange: (v: PaymentMethod) => void }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {PAYMENT_METHODS.map(({ key, label, icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 text-xs font-semibold transition ${
            value === key
              ? "border-amber-500 bg-amber-50 text-amber-700 shadow-sm"
              : "border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
          }`}
        >
          <span className="text-base">{icon}</span>
          {label}
        </button>
      ))}
    </div>
  );
}

/* ─── Stock Badge ────────────────────────────────────────────── */
function StockBadge({ available }: { available: number }) {
  if (available <= 0)
    return <span className="text-xs font-semibold text-red-500">Out of stock</span>;
  if (available <= 3)
    return <span className="text-xs font-semibold text-amber-600">{available} left</span>;
  return <span className="text-xs text-slate-400">{available} avail.</span>;
}

/* ─── Page ───────────────────────────────────────────────────── */
export default function NewSalePage() {
  const [orgId,    setOrgId]    = useState<string | null>(null);
  const [rows,     setRows]     = useState<SellableRow[]>([]);
  const [cart,     setCart]     = useState<CartLine[]>([]);
  const [q,        setQ]        = useState("");
  const [customer, setCustomer] = useState("");
  const [payment,  setPayment]  = useState<PaymentMethod>("cash");
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState("");
  const [success,  setSuccess]  = useState("");

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
      } catch (e: any) { setErr(e.message ?? String(e)); }
    })();
  }, []);

  // Sync cart availability with fresh stock data
  useEffect(() => {
    const map = new Map(rows.map((r) => [r.product_id, Number(r.qty_on_hand ?? 0)]));
    setCart((prev) =>
      prev.map((x) => {
        const available = map.get(x.product_id) ?? x.available;
        return { ...x, available, qty: Math.min(x.qty, available) };
      })
    );
  }, [rows]);

  const productList = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows
      .filter(hasProduct)
      .filter((r) => {
        if (!t) return true;
        const name    = (r.products.name    ?? "").toLowerCase();
        const sku     = (r.products.sku     ?? "").toLowerCase();
        const barcode = (r.products.barcode ?? "").toLowerCase();
        const cat     = ((r.products as any).category ?? "").toLowerCase();
        return name.includes(t) || sku.includes(t) || barcode.includes(t) || cat.includes(t);
      })
      .slice(0, 30);
  }, [rows, q]);

  function addToCart(r: SellableRow & { products: NonNullable<SellableRow["products"]> }) {
    const available = Number(r.qty_on_hand ?? 0);
    if (available <= 0) return;
    setCart((prev) => {
      const existing = prev.find((x) => x.product_id === r.product_id);
      if (existing) {
        return prev.map((x) =>
          x.product_id === r.product_id
            ? { ...x, qty: Math.min(x.qty + 1, available), available }
            : x
        );
      }
      return [...prev, {
        product_id: r.product_id,
        name: r.products.name,
        category: (r.products as any).category ?? null,
        available,
        base_price: Number(r.products.unit_price ?? 0),
        qty: 1,
        unit_price_override: null,
      }];
    });
  }

  function updateQty(product_id: string, qty: number) {
    setCart((prev) =>
      prev.map((x) =>
        x.product_id !== product_id ? x
          : { ...x, qty: Math.max(0, Math.min(qty, x.available)) }
      )
    );
  }

  function updateOverride(product_id: string, price: number | null) {
    setCart((prev) =>
      prev.map((x) =>
        x.product_id !== product_id ? x
          : { ...x, unit_price_override: price === null ? null : Math.max(0, price) }
      )
    );
  }

  function removeLine(product_id: string) {
    setCart((prev) => prev.filter((x) => x.product_id !== product_id));
  }

  const totals = useMemo(() => {
    let subtotal = 0, total = 0, discountTotal = 0;
    for (const line of cart) {
      const base  = Number(line.base_price ?? 0);
      const final = line.unit_price_override == null ? base : Number(line.unit_price_override);
      const qty   = Number(line.qty ?? 0);
      subtotal      += base  * qty;
      total         += final * qty;
      discountTotal += Math.max(0, (base - final) * qty);
    }
    return { subtotal, discountTotal, total };
  }, [cart]);

  const cartItemCount = cart.filter((x) => x.qty > 0).length;
  const hasErrors = cart.some((x) => x.qty > x.available);

  async function completeSale() {
    if (!orgId) return;
    setErr(""); setSuccess("");

    const items = cart
      .filter((l) => l.qty > 0)
      .map((l) => ({
        product_id: l.product_id,
        qty: l.qty,
        unit_price_override: l.unit_price_override ?? null,
      }));

    if (items.length === 0) { setErr("Cart is empty — add at least one product."); return; }
    for (const line of cart) {
      if (line.qty > line.available) {
        setErr(`Insufficient stock for "${line.name}". Only ${line.available} available.`);
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
        <div className="flex items-center gap-3 text-slate-500">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" strokeOpacity="0.2" />
            <path d="M12 2a10 10 0 0110 10" />
          </svg>
          <span className="text-sm font-medium">Preparing sale…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">New Sale</h1>
          <p className="mt-1 text-sm text-slate-500">Select products, set quantities, complete transaction</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/dashboard/sales" className={S.btnGhost}>← Back</Link>
          <button
            className={S.btnPrimary}
            onClick={completeSale}
            disabled={saving || cartItemCount === 0 || hasErrors}
          >
            {saving ? <><IconSpinner /> Processing…</> : <>Complete{cartItemCount > 0 ? ` (${cartItemCount})` : ""} →</>}
          </button>
        </div>
      </div>

      {/* ── Error / Success ── */}
      {err && (
        <div className={S.alert}>
          <span className="shrink-0 mt-0.5">⚠️</span>
          <span className="flex-1">{err}</span>
          <button onClick={() => setErr("")} className="ml-auto shrink-0 text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* ── Main layout: left products | right order panel ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_420px]">

        {/* ════ LEFT: PRODUCT BROWSER ════ */}
        <div className={`${S.card} flex flex-col overflow-hidden`} style={{ minHeight: 0, maxHeight: "calc(100vh - 220px)" }}>

          {/* Search header */}
          <div className="border-b border-slate-100 p-4 shrink-0">
            <label className="flex items-center gap-2.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-100 transition">
              <IconSearch />
              <input
                className="flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                placeholder="Search by name, SKU, barcode or category…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                autoComplete="off"
              />
              {q && <button onClick={() => setQ("")} className="text-slate-400 hover:text-slate-600 text-xs shrink-0">✕</button>}
            </label>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-slate-400">{productList.length} product{productList.length !== 1 ? "s" : ""} shown</span>
              {cartItemCount > 0 && (
                <span className="text-xs font-semibold text-amber-600">{cartItemCount} in cart</span>
              )}
            </div>
          </div>

          {/* Product list */}
          <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
            {productList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="text-4xl mb-3">🔍</div>
                <p className="text-sm font-semibold text-slate-600">No products found</p>
                <p className="text-xs text-slate-400 mt-1">Try a different search term</p>
              </div>
            ) : productList.map((r) => {
              const p = r.products;
              const available = Number(r.qty_on_hand ?? 0);
              const outOfStock = available <= 0;
              const cartLine = cart.find((x) => x.product_id === r.product_id);
              const inCart = !!cartLine;

              return (
                <button
                  key={r.product_id}
                  type="button"
                  onClick={() => !outOfStock && addToCart(r)}
                  disabled={outOfStock}
                  className={`w-full text-left px-4 py-3.5 transition-colors flex items-center gap-4 group ${
                    outOfStock ? "opacity-40 cursor-not-allowed" :
                    inCart ? "bg-amber-50 hover:bg-amber-100" : "hover:bg-slate-50"
                  }`}
                >
                  {/* Product icon */}
                  <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg ${
                    inCart ? "bg-amber-200" : "bg-slate-100"
                  }`}>
                    🍯
                  </div>

                  {/* Name + meta */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900 truncate">{p.name}</span>
                      {inCart && (
                        <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">
                          ✓ {cartLine.qty}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {(p as any).category && (
                        <span className="text-xs text-blue-600 font-medium">{(p as any).category}</span>
                      )}
                      {p.sku && <span className="text-xs text-slate-400">SKU {p.sku}</span>}
                    </div>
                  </div>

                  {/* Price + stock */}
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-slate-900">{fmtMoney(Number(p.unit_price ?? 0))}</div>
                    <StockBadge available={available} />
                  </div>

                  {/* Add indicator */}
                  {!outOfStock && !inCart && (
                    <div className="shrink-0 grid h-7 w-7 place-items-center rounded-lg bg-slate-100 text-slate-400 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                      <IconPlus />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ════ RIGHT: ORDER PANEL ════ */}
        <div className="flex flex-col gap-4">

          {/* Customer + Payment */}
          <div className={`${S.card} p-4 space-y-4`}>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Customer Name
              </label>
              <input
                className={S.input}
                placeholder="Walk-in customer (optional)"
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Payment Method
              </label>
              <PaymentSelector value={payment} onChange={setPayment} />
            </div>
          </div>

          {/* Cart */}
          <div className={`${S.card} flex flex-col overflow-hidden flex-1`} style={{ minHeight: "200px", maxHeight: "calc(100vh - 520px)" }}>
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900">Cart</span>
                {cart.length > 0 && (
                  <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">
                    {cartItemCount}
                  </span>
                )}
              </div>
              {cart.length > 0 && (
                <button onClick={() => setCart([])} className={S.btnDanger}>
                  Clear all
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <div className="text-4xl mb-3">🛒</div>
                <p className="text-sm font-semibold text-slate-600">Cart is empty</p>
                <p className="text-xs text-slate-400 mt-1">Click a product on the left to add it</p>
              </div>
            ) : (
              <div className="overflow-y-auto flex-1 divide-y divide-slate-100">

                {/* Cart column headers */}
                <div className="grid gap-2 px-4 py-2 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500"
                  style={{ gridTemplateColumns: "1fr 64px 72px 28px" }}>
                  <div>Item</div>
                  <div className="text-center">Qty</div>
                  <div className="text-center">Price</div>
                  <div />
                </div>

                {cart.map((line) => {
                  const base = Number(line.base_price ?? 0);
                  const final = line.unit_price_override == null ? base : Number(line.unit_price_override);
                  const isDiscounted = line.unit_price_override != null && final !== base;
                  const lineTotal = final * Number(line.qty ?? 0);
                  const overQty = line.qty > line.available;

                  return (
                    <div
                      key={line.product_id}
                      className={`grid gap-2 items-start px-4 py-3 transition-colors ${overQty ? "bg-red-50" : "hover:bg-slate-50"}`}
                      style={{ gridTemplateColumns: "1fr 64px 72px 28px" }}
                    >
                      {/* Name + total */}
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-900 truncate leading-tight">{line.name}</div>
                        <div className={`text-xs font-bold mt-0.5 ${isDiscounted ? "text-green-600" : "text-slate-600"}`}>
                          {fmtMoney(lineTotal)}
                          {isDiscounted && <span className="ml-1 font-normal text-green-500">disc.</span>}
                        </div>
                        {overQty && (
                          <div className="text-xs text-red-500 font-semibold mt-0.5">
                            ⚠ Max {line.available}
                          </div>
                        )}
                      </div>

                      {/* Qty */}
                      <div>
                        <input
                          className={`w-full rounded-lg border text-center text-sm font-semibold py-1.5 outline-none transition text-slate-900 ${
                            overQty
                              ? "border-red-400 bg-red-50 focus:ring-2 focus:ring-red-100"
                              : "border-slate-300 bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                          }`}
                          type="number" min={0} max={line.available}
                          value={line.qty}
                          onChange={(e) => updateQty(line.product_id, Number(e.target.value || 0))}
                        />
                        <div className="text-center text-[10px] text-slate-400 mt-0.5">{line.available} max</div>
                      </div>

                      {/* Price override */}
                      <div>
                        <input
                          className={`w-full rounded-lg border text-right text-sm py-1.5 px-2 outline-none transition text-slate-900 ${
                            isDiscounted
                              ? "border-amber-400 bg-amber-50 focus:ring-2 focus:ring-amber-100"
                              : "border-slate-300 bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                          }`}
                          type="number" min={0} step="1"
                          value={line.unit_price_override == null ? "" : line.unit_price_override}
                          placeholder={String(base)}
                          onChange={(e) => {
                            const v = e.target.value;
                            updateOverride(line.product_id, v === "" ? null : Number(v));
                          }}
                          title="Override unit price — leave blank to use default"
                        />
                        <div className="text-center text-[10px] text-slate-400 mt-0.5">
                          {isDiscounted ? <span className="text-green-500">custom</span> : "default"}
                        </div>
                      </div>

                      {/* Remove */}
                      <button
                        onClick={() => removeLine(line.product_id)}
                        className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition mt-0.5"
                      >
                        <IconTrash />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Totals + Complete */}
          {cart.length > 0 && (
            <div className={`${S.card} p-4`}>
              {/* Customer confirm */}
              {customer.trim() && (
                <div className="flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 mb-4">
                  <span className="text-base">👤</span>
                  <div className="min-w-0">
                    <div className="text-xs text-slate-500 font-medium">Sale for</div>
                    <div className="text-sm font-bold text-slate-900 truncate">{customer}</div>
                  </div>
                  <div className="ml-auto shrink-0">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${
                      payment === "cash" ? "bg-green-100 text-green-700" :
                      payment === "mpesa" ? "bg-blue-100 text-blue-700" :
                      payment === "card" ? "bg-purple-100 text-purple-700" :
                      "bg-amber-100 text-amber-700"
                    }`}>
                      {PAYMENT_METHODS.find((m) => m.key === payment)?.label}
                    </span>
                  </div>
                </div>
              )}

              {/* Line items */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="text-slate-700 font-medium">{fmtMoney(totals.subtotal)}</span>
                </div>
                {totals.discountTotal > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Discounts</span>
                    <span className="text-green-600 font-semibold">−{fmtMoney(totals.discountTotal)}</span>
                  </div>
                )}
              </div>

              {/* Total */}
              <div className="flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3 mb-4">
                <span className="text-sm font-semibold text-white">Total</span>
                <span className="text-xl font-bold text-amber-400">{fmtMoney(totals.total)}</span>
              </div>

              {/* Complete button */}
              <button
                className={S.btnPrimary + " w-full py-3 text-base"}
                onClick={completeSale}
                disabled={saving || cartItemCount === 0 || hasErrors}
              >
                {saving ? <><IconSpinner /> Processing…</> : "Complete Sale →"}
              </button>

              {hasErrors && (
                <p className="mt-2 text-center text-xs text-red-500 font-medium">
                  Fix stock quantities above before completing
                </p>
              )}

              <p className="mt-2 text-center text-xs text-slate-400">
                Stock enforced server-side · cannot oversell
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}