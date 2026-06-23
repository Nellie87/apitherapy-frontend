// src/app/(dashboard)/sales/new/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import { listSellable, type SellableRow } from "@/lib/api/sellable";
import {
  createSaleStrict,
  listSales,
  type PaymentMethod,
  type SaleRowWithItems,
} from "@/lib/api/sales";
import * as S from "./page.styles";

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

const PAYMENT_METHODS: { key: PaymentMethod; label: string }[] = [
  { key: "cash", label: "Cash" },
  { key: "mpesa", label: "M-Pesa" },
  { key: "card", label: "Card" },
  { key: "credit", label: "Credit" },
];

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */
function fmtMoney(v: number) {
  return `Ksh ${Number(v || 0).toLocaleString("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function formatQuantity(value?: number | string | null, unit?: string | null) {
  if (value === null || value === undefined || value === "") return "";
  if (!unit) return "";

  const n = Number(value);
  if (!Number.isFinite(n)) return "";

  const formatted = Number.isInteger(n)
    ? String(n)
    : n.toLocaleString("en-KE", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3,
      });

  return `${formatted} ${unit}`;
}

function formatProductDisplayName(product: {
  name?: string | null;
  quantity_value?: number | string | null;
  quantity_unit?: string | null;
}) {
  const base = (product.name ?? "").trim();
  const qty = formatQuantity(product.quantity_value, product.quantity_unit);

  if (!base) return qty || "Unnamed product";
  if (!qty) return base;
  return `${base} ${qty}`;
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

  if (key === "cash") return "bg-green-50 text-green-700 border-green-100";
  if (key === "mpesa") return "bg-blue-50 text-blue-700 border-blue-100";
  if (key === "card") return "bg-purple-50 text-purple-700 border-purple-100";
  if (key === "credit") return "bg-amber-50 text-amber-700 border-amber-100";

  return "bg-slate-50 text-slate-600 border-slate-100";
}

/* ─────────────────────────────────────────────
   UI
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
      className={`fixed bottom-5 right-5 z-[70] flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-2xl px-5 py-3.5 text-sm font-semibold text-white shadow-xl ${
        type === "success" ? "bg-green-600" : "bg-red-600"
      }`}
    >
      <span className="min-w-0 flex-1">{message}</span>
      <button
        onClick={onClose}
        className="shrink-0 rounded-full px-2 py-1 text-xs font-bold text-white/80 transition hover:bg-white/10 hover:text-white"
      >
        Close
      </button>
    </div>
  );
}

function PaymentSelector({
  value,
  onChange,
}: {
  value: PaymentMethod;
  onChange: (v: PaymentMethod) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
      {PAYMENT_METHODS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`rounded-2xl border px-3 py-3 text-sm font-bold transition ${
            value === key
              ? "border-[#D6A324] bg-[#FFF4CC] text-[#5A4500]"
              : "border-[#EADFC2] bg-[#FFFDF8] text-slate-600 hover:border-slate-300 hover:bg-slate-50"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function StockBadge({ available }: { available: number }) {
  if (available <= 0) {
    return (
      <span className="rounded-full border border-red-100 bg-red-50 px-2 py-0.5 text-xs font-bold text-red-600">
        Out of stock
      </span>
    );
  }

  if (available <= 3) {
    return (
      <span className="rounded-full border border-amber-100 bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">
        {available} left
      </span>
    );
  }

  return (
    <span className="rounded-full border border-slate-100 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-500">
      {available} available
    </span>
  );
}

function LoadingState() {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-sm font-semibold text-slate-400">
        Preparing sale…
      </div>
    </div>
  );
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
      // Ignore invalid drafts.
    }
  }, [orgId]);

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
            activeName: formatProductDisplayName(r.products),
          },
        ])
    );

    let removed = false;

    setCart((prev) => {
      const next: CartLine[] = [];

      for (const line of prev) {
        const live = map.get(line.product_id);

        if (!live || live.available <= 0) {
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
        message:
          "Some saved cart items were removed because they are no longer available",
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

        const name = formatProductDisplayName(r.products).toLowerCase();
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
      .sort((a, b) => {
        const aIn = Number(a.qty_on_hand ?? 0) > 0 ? 1 : 0;
        const bIn = Number(b.qty_on_hand ?? 0) > 0 ? 1 : 0;

        if (aIn !== bIn) return bIn - aIn;

        return formatProductDisplayName(a.products).localeCompare(
          formatProductDisplayName(b.products)
        );
      })
      .slice(0, 30);
  }, [rows, q]);

  function addToCart(
    r: SellableRow & { products: NonNullable<SellableRow["products"]> }
  ) {
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
          name: formatProductDisplayName(r.products),
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
  if (!Number.isFinite(qty)) return;

  setCart((prev) =>
    prev.map((x) =>
      x.product_id !== product_id
        ? x
        : {
            ...x,
            qty: Math.max(1, Math.min(qty, x.available)),
          }
    )
  );
}

  function updateOverride(product_id: string, price: number | null) {
    setCart((prev) =>
      prev.map((x) =>
        x.product_id !== product_id
          ? x
          : {
              ...x,
              unit_price_override: price === null ? null : Math.max(0, price),
            }
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
      const final =
        line.unit_price_override == null
          ? base
          : Number(line.unit_price_override);
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
      setErr("Cart is empty. Add at least one product.");
      return;
    }

    for (const line of cart) {
      if (line.qty > line.available) {
        setErr(
          `Insufficient stock for "${line.name}". Only ${line.available} available.`
        );
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

      window.location.href = `/dashboard/sales?created=${encodeURIComponent(
        res.sale_no
      )}`;
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  if (!orgId && !err) return <LoadingState />;

  return (
    <div className="flex flex-col gap-5">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <section className={`${S.card} overflow-hidden`}>
<div className="h-1 bg-[#D6A324]" />
        <div className="flex flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              Checkout
            </div>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
              New Sale
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Select products, adjust quantities, and confirm the sale.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Link href="/dashboard/sales" className={S.btnGhost}>
              Back to sales
            </Link>

            <button
              className={S.btnPrimary}
              onClick={completeSale}
              disabled={saving || cartItemCount === 0 || hasErrors}
            >
              {saving
                ? "Processing…"
                : cartItemCount > 0
                  ? `Complete sale (${cartItemCount})`
                  : "Complete sale"}
            </button>
          </div>
        </div>
      </section>

      {err && (
        <div className={S.alert}>
          <span className="flex-1">{err}</span>
          <button
            onClick={() => setErr("")}
            className="ml-auto shrink-0 rounded-full px-2 py-1 text-xs font-bold text-red-500 transition hover:bg-red-100 hover:text-red-700"
          >
            Close
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
        <section
          className={`${S.card} flex min-h-[520px] flex-col overflow-hidden xl:max-h-[calc(100vh-220px)]`}
        >
          <div className="shrink-0 border-b border-slate-100 p-4">
            <label className="block">
              <input
                className={S.input}
                placeholder="Search by product name, SKU, barcode, or category..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                autoComplete="off"
              />
            </label>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-400">
                {productList.length} product{productList.length !== 1 ? "s" : ""} shown
              </span>

              {q && (
                <button
                  onClick={() => setQ("")}
                  className="text-xs font-bold text-slate-500 transition hover:text-slate-900"
                >
                  Clear search
                </button>
              )}

              {cartItemCount > 0 && (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700">
                  {cartItemCount} in cart
                </span>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {productList.length === 0 ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center px-6 py-20 text-center">
                <p className="text-sm font-bold text-slate-700">
                  No products found
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Try another product name, SKU, barcode, or category.
                </p>
              </div>
            ) : (
              productList.map((r) => {
                const p = r.products;
                const available = Number(r.qty_on_hand ?? 0);
                const outOfStock = available <= 0;
                const cartLine = cart.find((x) => x.product_id === r.product_id);
                const inCart = !!cartLine && !outOfStock;

                return (
                  <button
                    key={r.product_id}
                    type="button"
                    onClick={() => !outOfStock && addToCart(r)}
                    disabled={outOfStock}
                    className={`grid w-full gap-3 px-4 py-4 text-left transition sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${
                      outOfStock
                        ? "cursor-not-allowed bg-slate-50/80"
                        : inCart
                          ? "bg-slate-50 hover:bg-slate-100"
                          : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`truncate text-sm font-bold ${
                            outOfStock ? "text-slate-500" : "text-slate-950"
                          }`}
                        >
                          {formatProductDisplayName(p)}
                        </span>

                        {outOfStock && (
                          <span className="rounded-full border border-red-100 bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700">
                            Out of stock
                          </span>
                        )}

                        {inCart && cartLine && (
                          <span className="rounded-full bg-[#2F2718] px-2 py-0.5 text-xs font-bold text-white">
                            In cart: {cartLine.qty}
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {(p as any).category && (
                          <span className="text-xs font-semibold text-slate-500">
                            {(p as any).category}
                          </span>
                        )}
                        {p.sku && (
                          <span className="text-xs text-slate-400">
                            SKU {p.sku}
                          </span>
                        )}
                        {p.barcode && (
                          <span className="text-xs text-slate-400">
                            Barcode {p.barcode}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 sm:justify-end">
                      <div className="text-left sm:text-right">
                        <div
                          className={`text-sm font-black ${
                            outOfStock ? "text-slate-400" : "text-slate-950"
                          }`}
                        >
                          {fmtMoney(Number(p.unit_price ?? 0))}
                        </div>
                        {!outOfStock && <StockBadge available={available} />}
                      </div>

                      {!outOfStock && !inCart && (
                        <span className="rounded-xl border border-[#EADFC2] bg-[#FFFDF8] px-3 py-2 text-xs font-bold text-slate-700 shadow-sm">
                          Add
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        <aside className="flex flex-col gap-4">
          <section className={`${S.card} p-4`}>
            <div className="grid gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Customer name
                </label>
                <input
                  className={S.input}
                  placeholder="Walk-in customer (optional)"
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Payment method
                </label>
                <PaymentSelector value={payment} onChange={setPayment} />
              </div>
            </div>

            {recentSales.length > 0 && (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Recent sales
                </div>

                <div className="space-y-2">
                  {recentSales.slice(0, 3).map((sale) => (
                    <div
                      key={sale.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[#F1E6C9] bg-[#FFFDF8] px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-xs font-black text-slate-950">
                          {sale.sale_no}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {fmtDateTime(sale.created_at)}
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <div className="text-xs font-black text-slate-950">
                          {fmtMoney(sale.total)}
                        </div>
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${paymentPill(
                            sale.payment_method
                          )}`}
                        >
                          {sale.payment_method || "—"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <Link
                  href="/dashboard/sales"
                  className="mt-3 inline-flex text-xs font-bold text-slate-700 transition hover:text-slate-950"
                >
                  View full sales history
                </Link>
              </div>
            )}
          </section>

          <section className={`${S.card} flex min-h-[260px] flex-col overflow-hidden`}>
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-slate-950">Cart</span>
                {cart.length > 0 && (
                  <span className="rounded-full bg-[#2F2718] px-2 py-0.5 text-xs font-bold text-white">
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
              <div className="flex min-h-[220px] flex-col items-center justify-center px-6 py-12 text-center">
                <p className="text-sm font-bold text-slate-700">Cart is empty</p>
                <p className="mt-1 text-xs text-slate-400">
                  Select a product from the list to add it.
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                <div className="hidden grid-cols-[1fr_64px_76px_58px] gap-2 bg-slate-50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-500 sm:grid">
                  <div>Item</div>
                  <div className="text-center">Qty</div>
                  <div className="text-center">Price</div>
                  <div />
                </div>

                {cart.map((line) => {
                  const base = Number(line.base_price ?? 0);
                  const final =
                    line.unit_price_override == null
                      ? base
                      : Number(line.unit_price_override);
                  const isDiscounted =
                    line.unit_price_override != null && final !== base;
                  const lineTotal = final * Number(line.qty ?? 0);
                  const overQty = line.qty > line.available;

                  return (
                    <div
                      key={line.product_id}
                      className={`grid gap-3 px-4 py-3 transition sm:grid-cols-[1fr_64px_76px_58px] sm:items-start ${
                        overQty ? "bg-red-50" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-xs font-bold leading-tight text-slate-950">
                          {line.name}
                        </div>
                        <div
                          className={`mt-1 text-xs font-black ${
                            isDiscounted ? "text-green-600" : "text-slate-600"
                          }`}
                        >
                          {fmtMoney(lineTotal)}
                          {isDiscounted && (
                            <span className="ml-1 font-medium text-green-500">
                              custom price
                            </span>
                          )}
                        </div>

                        {overQty && (
                          <div className="mt-1 text-xs font-semibold text-red-500">
                            Maximum available: {line.available}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:hidden">
                          Qty
                        </label>
                        <input
                          className={`w-full rounded-lg border py-1.5 text-center text-sm font-semibold text-slate-900 outline-none transition ${
                            overQty
                              ? "border-red-400 bg-red-50 focus:ring-2 focus:ring-red-100"
                              : "border-slate-300 bg-white focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                          }`}
                          type="number"
                          min={1}
                          max={line.available}
                          value={line.qty}
                          onChange={(e) =>
                            updateQty(
                              line.product_id,
                              Number(e.target.value || 0)
                            )
                          }
                        />
                        <div className="mt-0.5 text-center text-[10px] text-slate-400">
                          {line.available} max
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:hidden">
                          Price
                        </label>
                        <input
                          className={`w-full rounded-lg border px-2 py-1.5 text-right text-sm text-slate-900 outline-none transition ${
                            isDiscounted
                              ? "border-slate-400 bg-slate-50 focus:ring-2 focus:ring-slate-100"
                              : "border-slate-300 bg-white focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                          }`}
                          type="number"
                          min={0}
                          step="1"
                          value={
                            line.unit_price_override == null
                              ? ""
                              : line.unit_price_override
                          }
                          placeholder={String(base)}
                          onChange={(e) => {
                            const v = e.target.value;
                            updateOverride(
                              line.product_id,
                              v === "" ? null : Number(v)
                            );
                          }}
                          title="Override unit price"
                        />
                        <div className="mt-0.5 text-center text-[10px] text-slate-400">
                          {isDiscounted ? "custom" : "default"}
                        </div>
                      </div>

                      <button
                        onClick={() => removeLine(line.product_id)}
                        className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-100 sm:mt-0.5"
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {cart.length > 0 && (
            <section className={`${S.card} p-4`}>
              {customer.trim() && (
                <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-500">
                      Sale for
                    </div>
                    <div className="truncate text-sm font-black text-slate-950">
                      {customer}
                    </div>
                  </div>

                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-bold ${paymentPill(
                      payment
                    )}`}
                  >
                    {PAYMENT_METHODS.find((m) => m.key === payment)?.label}
                  </span>
                </div>
              )}

              <div className="mb-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="font-semibold text-slate-700">
                    {fmtMoney(totals.subtotal)}
                  </span>
                </div>

                {totals.discountTotal > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Discounts</span>
                    <span className="font-semibold text-green-600">
                      -{fmtMoney(totals.discountTotal)}
                    </span>
                  </div>
                )}
              </div>

              <div className="mb-4 flex items-center justify-between rounded-xl bg-[#2F2718] px-4 py-3">
                <span className="text-sm font-bold text-white">Total</span>
                <span className="text-xl font-black text-white">
                  {fmtMoney(totals.total)}
                </span>
              </div>

              <button
                className={`${S.btnPrimary} w-full py-3 text-base`}
                onClick={completeSale}
                disabled={saving || cartItemCount === 0 || hasErrors}
              >
                {saving ? "Processing…" : "Complete sale"}
              </button>

              {hasErrors && (
                <p className="mt-2 text-center text-xs font-semibold text-red-500">
                  Fix stock quantities above before completing.
                </p>
              )}

              <p className="mt-2 text-center text-xs text-slate-400">
                Draft cart saved automatically. Stock is checked again before saving.
              </p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
