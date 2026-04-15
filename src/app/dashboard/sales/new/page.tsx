"use client";

import React, { useEffect, useMemo, useState } from "react";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import { listSellable, type SellableRow } from "@/lib/api/sellable";
import {
  createSaleStrict,
  listSales,
  type PaymentMethod,
  type SaleRowWithItems,
} from "@/lib/api/sales";
import * as S from "./page.styles";
import Link from "next/link";

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */
type CartLine = {
  product_id: string;
  name: string;
  category?: string | null;
  available: number;
  base_price: number;
  qty: number;
  unit_price_override?: number | null;
};

type DraftSaleCart = {
  orgId: string;
  customer: string;
  payment: PaymentMethod;
  cart: CartLine[];
  updatedAt: string;
};

type ToastState = {
  message: string;
  type: "success" | "error";
} | null;

/* ─────────────────────────────────────────────
   Constants
───────────────────────────────────────────── */
const CART_STORAGE_KEY = "apitherapy_sale_draft_v1";

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */
function fmtMoney(v: number) {
  return `Ksh ${Number(v || 0).toLocaleString("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function hasProduct(
  r: SellableRow
): r is SellableRow & { products: NonNullable<SellableRow["products"]> } {
  return r.products != null;
}

function fmtDateTime(d?: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return d;
  }
}

function paymentPill(method?: string | null) {
  const key = (method ?? "").toLowerCase();
  if (key === "cash") return "bg-green-100 text-green-700";
  if (key === "mpesa") return "bg-blue-100 text-blue-700";
  if (key === "card") return "bg-purple-100 text-purple-700";
  if (key === "credit") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

/* ─────────────────────────────────────────────
   Icons
───────────────────────────────────────────── */
const IconSearch = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    className="text-slate-400 shrink-0"
  >
    <circle cx="9" cy="9" r="5.5" />
    <line x1="13.5" y1="13.5" x2="18" y2="18" />
  </svg>
);

const IconTrash = () => (
  <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 6h12M8 6V4a1 1 0 011-1h2a1 1 0 011 1v2m-6 0v10a1 1 0 001 1h6a1 1 0 001-1V6" />
  </svg>
);

const IconPlus = () => (
  <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="10" y1="4" x2="10" y2="16" />
    <line x1="4" y1="10" x2="16" y2="10" />
  </svg>
);

const IconSpinner = () => (
  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
    <path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
  </svg>
);

const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconX = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

/* ─────────────────────────────────────────────
   Toast
───────────────────────────────────────────── */
function Toast({
  message,
  type = "success",
  onClose,
}: {
  message: string;
  type?: "success" | "error";
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className={`fixed bottom-5 right-5 z-[70] flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-xl text-white text-sm font-semibold ${
        type === "success" ? "bg-green-600" : "bg-red-600"
      }`}
    >
      <span>{type === "success" ? <IconCheck /> : <IconX />}</span>
      <span>{message}</span>
      <button onClick={onClose} className="text-white/70 hover:text-white">
        <IconX />
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Payment selector
───────────────────────────────────────────── */
const PAYMENT_METHODS: { key: PaymentMethod; label: string; icon: string }[] = [
  { key: "cash", label: "Cash", icon: "💵" },
  { key: "mpesa", label: "M-Pesa", icon: "📱" },
  { key: "card", label: "Card", icon: "💳" },
  { key: "credit", label: "Credit", icon: "📋" },
];

function PaymentSelector({
  value,
  onChange,
}: {
  value: PaymentMethod;
  onChange: (v: PaymentMethod) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {PAYMENT_METHODS.map(({ key, label, icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 text-xs font-semibold transition ${
            value === key
              ? "border-slate-900 bg-slate-900 text-white shadow-sm"
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

/* ─────────────────────────────────────────────
   Stock badge
───────────────────────────────────────────── */
function StockBadge({ available }: { available: number }) {
  if (available <= 0) {
    return <span className="text-xs font-semibold text-red-500">Out of stock</span>;
  }
  if (available <= 3) {
    return <span className="text-xs font-semibold text-amber-600">{available} left</span>;
  }
  return <span className="text-xs text-slate-400">{available} avail.</span>;
}

/* ─────────────────────────────────────────────
   Page
───────────────────────────────────────────── */
export default function NewSalePage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [rows, setRows] = useState<SellableRow[]>([]);
  const [recentSales, setRecentSales] = useState<SaleRowWithItems[]>([]);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [q, setQ] = useState("");
  const [customer, setCustomer] = useState("");
  const [payment, setPayment] = useState<PaymentMethod>("cash");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState<ToastState>(null);
  const [draftRestored, setDraftRestored] = useState(false);

  async function refresh(o: string) {
    const [sellable, sales] = await Promise.all([listSellable(o), listSales(o)]);
    setRows(sellable);
    setRecentSales(sales.slice(0, 6));
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

  /* Restore draft */
  useEffect(() => {
    if (!orgId) return;

    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as DraftSaleCart;
      if (parsed.orgId !== orgId) return;

      setCustomer(parsed.customer ?? "");
      setPayment((parsed.payment as PaymentMethod) ?? "cash");
      setCart(Array.isArray(parsed.cart) ? parsed.cart : []);
      setDraftRestored(true);
      setToast({ message: "Saved cart draft restored", type: "success" });
    } catch {
      // ignore bad draft
    }
  }, [orgId]);

  /* Save draft */
  useEffect(() => {
    if (!orgId) return;

    const payload: DraftSaleCart = {
      orgId,
      customer,
      payment,
      cart,
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(payload));
  }, [orgId, customer, payment, cart]);

  /* Sync cart availability with live stock */
  useEffect(() => {
    if (!rows.length) return;

    const map = new Map(
      rows
        .filter(hasProduct)
        .map((r) => [
          r.product_id,
          {
            available: Number(r.qty_on_hand ?? 0),
            base_price: Number(r.products.unit_price ?? 0),
            activeName: r.products.name,
          },
        ])
    );

    let removed = false;

    setCart((prev) => {
      const next: CartLine[] = [];

      for (const line of prev) {
        const live = map.get(line.product_id);
        if (!live) {
          removed = true;
          continue;
        }

        next.push({
          ...line,
          name: live.activeName,
          available: live.available,
          base_price: live.base_price,
          qty: Math.min(line.qty, live.available),
        });
      }

      return next;
    });

    if (draftRestored && removed) {
      setToast({
        message: "Some saved cart items were removed because they are no longer available",
        type: "error",
      });
    }
  }, [rows, draftRestored]);

  const productList = useMemo(() => {
    const t = q.trim().toLowerCase();

    return rows
      .filter(hasProduct)
      .filter((r) => {
        if (!t) return true;

        const name = (r.products.name ?? "").toLowerCase();
        const sku = (r.products.sku ?? "").toLowerCase();
        const barcode = (r.products.barcode ?? "").toLowerCase();
        const cat = ((r.products as any).category ?? "").toLowerCase();

        return (
          name.includes(t) ||
          sku.includes(t) ||
          barcode.includes(t) ||
          cat.includes(t)
        );
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

      return [
        ...prev,
        {
          product_id: r.product_id,
          name: r.products.name,
          category: (r.products as any).category ?? null,
          available,
          base_price: Number(r.products.unit_price ?? 0),
          qty: 1,
          unit_price_override: null,
        },
      ];
    });
  }

  function updateQty(product_id: string, qty: number) {
    setCart((prev) =>
      prev.map((x) =>
        x.product_id !== product_id
          ? x
          : { ...x, qty: Math.max(0, Math.min(qty, x.available)) }
      )
    );
  }

  function updateOverride(product_id: string, price: number | null) {
    setCart((prev) =>
      prev.map((x) =>
        x.product_id !== product_id
          ? x
          : { ...x, unit_price_override: price === null ? null : Math.max(0, price) }
      )
    );
  }

  function removeLine(product_id: string) {
    setCart((prev) => prev.filter((x) => x.product_id !== product_id));
  }

  function clearCart() {
    setCart([]);
    setCustomer("");
    setPayment("cash");
    localStorage.removeItem(CART_STORAGE_KEY);
    setToast({ message: "Cart cleared", type: "success" });
  }

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

  const cartItemCount = cart.filter((x) => x.qty > 0).length;
  const hasErrors = cart.some((x) => x.qty > x.available);

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
      setErr("Cart is empty — add at least one product.");
      return;
    }

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
        payment_method: payment,
        items,
      });

      localStorage.removeItem(CART_STORAGE_KEY);
      setCart([]);
      setCustomer("");
      setPayment("cash");

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
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Header */}
      <div className="rounded-[24px] border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400" />
        <div className="flex items-center justify-between gap-4 px-6 py-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Checkout
            </div>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">New Sale</h1>
            <p className="mt-1 text-sm text-slate-500">
              Select products, set quantities, confirm totals
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link href="/dashboard/sales" className={S.btnGhost}>
              ← Back
            </Link>
            <button
              className={S.btnPrimary}
              onClick={completeSale}
              disabled={saving || cartItemCount === 0 || hasErrors}
            >
              {saving ? (
                <>
                  <IconSpinner />
                  Processing…
                </>
              ) : (
                <>Complete{cartItemCount > 0 ? ` (${cartItemCount})` : ""} →</>
              )}
            </button>
          </div>
        </div>
      </div>

      {err && (
        <div className={S.alert}>
          <span className="shrink-0 mt-0.5">⚠️</span>
          <span className="flex-1">{err}</span>
          <button onClick={() => setErr("")} className="ml-auto shrink-0 text-red-400 hover:text-red-600">
            ✕
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_390px] xl:grid-cols-[1fr_430px]">
        {/* Left panel */}
        <div className={`${S.card} flex flex-col overflow-hidden`} style={{ minHeight: 0, maxHeight: "calc(100vh - 220px)" }}>
          <div className="border-b border-slate-100 p-4 shrink-0">
            <label className="flex items-center gap-2.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-100 transition">
              <IconSearch />
              <input
                className="flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                placeholder="Search by name, SKU, barcode or category…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                autoComplete="off"
              />
              {q && (
                <button onClick={() => setQ("")} className="text-slate-400 hover:text-slate-600 text-xs shrink-0">
                  ✕
                </button>
              )}
            </label>

            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {productList.length} product{productList.length !== 1 ? "s" : ""} shown
              </span>
              {cartItemCount > 0 && (
                <span className="text-xs font-semibold text-slate-700">
                  {cartItemCount} in cart
                </span>
              )}
            </div>
          </div>

          <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
            {productList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="text-4xl mb-3">🔍</div>
                <p className="text-sm font-semibold text-slate-600">No products found</p>
                <p className="text-xs text-slate-400 mt-1">Try a different search term</p>
              </div>
            ) : (
              productList.map((r) => {
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
                      outOfStock
                        ? "opacity-40 cursor-not-allowed"
                        : inCart
                        ? "bg-slate-50 hover:bg-slate-100"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <div
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg ${
                        inCart ? "bg-slate-900 text-white" : "bg-slate-100"
                      }`}
                    >
                      🍯
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900 truncate">
                          {p.name}
                        </span>
                        {inCart && (
                          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-slate-900 px-2 py-0.5 text-xs font-bold text-white">
                            ✓ {cartLine.qty}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-0.5">
                        {(p as any).category && (
                          <span className="text-xs text-blue-600 font-medium">
                            {(p as any).category}
                          </span>
                        )}
                        {p.sku && <span className="text-xs text-slate-400">SKU {p.sku}</span>}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-slate-900">
                        {fmtMoney(Number(p.unit_price ?? 0))}
                      </div>
                      <StockBadge available={available} />
                    </div>

                    {!outOfStock && !inCart && (
                      <div className="shrink-0 grid h-7 w-7 place-items-center rounded-lg bg-slate-100 text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                        <IconPlus />
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="flex flex-col gap-4">
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

            {recentSales.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  Recent Sales
                </div>

                <div className="space-y-2">
                  {recentSales.slice(0, 3).map((sale) => (
                    <div
                      key={sale.id}
                      className="flex items-center justify-between gap-3 rounded-xl bg-white border border-slate-100 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {sale.sale_no}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {fmtDateTime(sale.created_at)}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xs font-bold text-slate-900">
                          {fmtMoney(sale.total)}
                        </div>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${paymentPill(
                            sale.payment_method
                          )}`}
                        >
                          {sale.payment_method || "—"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3">
                  <Link href="/dashboard/sales" className="text-xs font-semibold text-slate-700 hover:text-slate-900">
                    View full sales history →
                  </Link>
                </div>
              </div>
            )}
          </div>

          <div
            className={`${S.card} flex flex-col overflow-hidden flex-1`}
            style={{ minHeight: "200px", maxHeight: "calc(100vh - 520px)" }}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900">Cart</span>
                {cart.length > 0 && (
                  <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs font-bold text-white">
                    {cartItemCount}
                  </span>
                )}
              </div>

              {cart.length > 0 && (
                <button onClick={clearCart} className={S.btnDanger}>
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
                <div
                  className="grid gap-2 px-4 py-2 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500"
                  style={{ gridTemplateColumns: "1fr 64px 72px 28px" }}
                >
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
                      className={`grid gap-2 items-start px-4 py-3 transition-colors ${
                        overQty ? "bg-red-50" : "hover:bg-slate-50"
                      }`}
                      style={{ gridTemplateColumns: "1fr 64px 72px 28px" }}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-900 truncate leading-tight">
                          {line.name}
                        </div>
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

                      <div>
                        <input
                          className={`w-full rounded-lg border text-center text-sm font-semibold py-1.5 outline-none transition text-slate-900 ${
                            overQty
                              ? "border-red-400 bg-red-50 focus:ring-2 focus:ring-red-100"
                              : "border-slate-300 bg-white focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                          }`}
                          type="number"
                          min={0}
                          max={line.available}
                          value={line.qty}
                          onChange={(e) => updateQty(line.product_id, Number(e.target.value || 0))}
                        />
                        <div className="text-center text-[10px] text-slate-400 mt-0.5">
                          {line.available} max
                        </div>
                      </div>

                      <div>
                        <input
                          className={`w-full rounded-lg border text-right text-sm py-1.5 px-2 outline-none transition text-slate-900 ${
                            isDiscounted
                              ? "border-slate-400 bg-slate-50 focus:ring-2 focus:ring-slate-100"
                              : "border-slate-300 bg-white focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                          }`}
                          type="number"
                          min={0}
                          step="1"
                          value={line.unit_price_override == null ? "" : line.unit_price_override}
                          placeholder={String(base)}
                          onChange={(e) => {
                            const v = e.target.value;
                            updateOverride(line.product_id, v === "" ? null : Number(v));
                          }}
                          title="Override unit price"
                        />
                        <div className="text-center text-[10px] text-slate-400 mt-0.5">
                          {isDiscounted ? <span className="text-green-500">custom</span> : "default"}
                        </div>
                      </div>

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

          {cart.length > 0 && (
            <div className={`${S.card} p-4`}>
              {customer.trim() && (
                <div className="flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 mb-4">
                  <span className="text-base">👤</span>
                  <div className="min-w-0">
                    <div className="text-xs text-slate-500 font-medium">Sale for</div>
                    <div className="text-sm font-bold text-slate-900 truncate">{customer}</div>
                  </div>
                  <div className="ml-auto shrink-0">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${paymentPill(payment)}`}>
                      {PAYMENT_METHODS.find((m) => m.key === payment)?.label}
                    </span>
                  </div>
                </div>
              )}

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

              <div className="flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3 mb-4">
                <span className="text-sm font-semibold text-white">Total</span>
                <span className="text-xl font-bold text-amber-400">{fmtMoney(totals.total)}</span>
              </div>

              <button
                className={S.btnPrimary + " w-full py-3 text-base"}
                onClick={completeSale}
                disabled={saving || cartItemCount === 0 || hasErrors}
              >
                {saving ? (
                  <>
                    <IconSpinner />
                    Processing…
                  </>
                ) : (
                  "Complete Sale →"
                )}
              </button>

              {hasErrors && (
                <p className="mt-2 text-center text-xs text-red-500 font-medium">
                  Fix stock quantities above before completing
                </p>
              )}

              <p className="mt-2 text-center text-xs text-slate-400">
                Draft cart saved automatically · stock enforced server-side
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}