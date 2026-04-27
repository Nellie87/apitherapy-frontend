"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import { listSellable, type SellableRow } from "@/lib/api/sellable";
import { createSaleStrict, type PaymentMethod } from "@/lib/api/sales";

type CartLine = {
  product_id: string;
  name: string;
  display_name: string;
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

function formatQuantity(
  value?: number | string | null,
  unit?: string | null
) {
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

function paymentPill(method?: string | null) {
  const key = (method ?? "").toLowerCase();
  if (key === "cash") return "bg-green-100 text-green-700 border-green-200";
  if (key === "mpesa") return "bg-blue-100 text-blue-700 border-blue-200";
  if (key === "card") return "bg-purple-100 text-purple-700 border-purple-200";
  if (key === "credit") return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

/* ─────────────────────────────────────────────
   Icons
───────────────────────────────────────────── */
const IconSearch = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const IconPlus = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const IconMinus = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
  >
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const IconTrash = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M4 6h12M8 6V4a1 1 0 011-1h2a1 1 0 011 1v2m-6 0v10a1 1 0 001 1h6a1 1 0 001-1V6" />
  </svg>
);

const IconX = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconCheck = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconSpinner = () => (
  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
    <path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
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
   Modal
───────────────────────────────────────────── */
function Modal({
  open,
  title,
  sub,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  sub?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <div className="text-base font-bold text-slate-900">{title}</div>
            {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <IconX />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">{children}</div>

        {footer && (
          <div className="border-t border-slate-100 px-6 py-4 flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Payment Selector
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
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {PAYMENT_METHODS.map(({ key, label, icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 text-xs font-semibold transition ${
            value === key
              ? "border-amber-300 bg-amber-50 text-amber-700 shadow-sm"
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
   Review Modal
───────────────────────────────────────────── */
function ReviewSaleModal({
  open,
  onClose,
  onConfirm,
  customer,
  payment,
  cart,
  totals,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  customer: string;
  payment: PaymentMethod;
  cart: CartLine[];
  totals: { subtotal: number; discountTotal: number; total: number };
  saving: boolean;
}) {
  return (
    <Modal
      open={open}
      title="Review sale"
      sub="Confirm the items, payment method and total before completing"
      onClose={onClose}
      footer={
        <>
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
          >
            {saving ? (
              <>
                <IconSpinner />
                Processing…
              </>
            ) : (
              "Confirm Sale"
            )}
          </button>
        </>
      }
    >
      <div className="grid gap-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
              Customer
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-900">
              {customer.trim() || "Walk-in customer"}
            </div>
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">
              Payment
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-900 capitalize">
              {payment}
            </div>
          </div>

          <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-green-700">
              Items
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-900">
              {cart.reduce((sum, x) => sum + x.qty, 0)}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 overflow-hidden">
          <div className="hidden sm:grid grid-cols-[1fr_90px_120px] gap-4 px-4 py-3 bg-slate-50 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            <div>Item</div>
            <div className="text-center">Qty</div>
            <div className="text-right">Line Total</div>
          </div>

          <div className="divide-y divide-slate-100">
            {cart.map((line) => {
              const base = Number(line.base_price ?? 0);
              const final = line.unit_price_override == null ? base : Number(line.unit_price_override);
              const lineTotal = final * line.qty;

              return (
                <div
                  key={line.product_id}
                  className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-[1fr_90px_120px] sm:gap-4 sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-slate-900">{line.display_name}</div>
                    {line.unit_price_override != null && (
                      <div className="text-xs text-amber-700 mt-0.5">
                        Custom unit price: {fmtMoney(final)}
                      </div>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-slate-700 sm:text-center">
                     {line.qty}
                  </div>
                  <div className="text-sm font-bold text-slate-900 sm:text-right">
                    {fmtMoney(lineTotal)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="ml-auto w-full max-w-sm space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">Subtotal</span>
            <span className="font-medium text-slate-800">{fmtMoney(totals.subtotal)}</span>
          </div>

          {totals.discountTotal > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Discounts</span>
              <span className="font-semibold text-green-600">−{fmtMoney(totals.discountTotal)}</span>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-amber-200 pt-3">
            <span className="text-sm font-semibold text-slate-800">Total</span>
            <span className="text-2xl font-bold text-amber-700">{fmtMoney(totals.total)}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ─────────────────────────────────────────────
   Page
───────────────────────────────────────────── */
export default function NewSalePage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [rows, setRows] = useState<SellableRow[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [q, setQ] = useState("");
  const [customer, setCustomer] = useState("");
  const [payment, setPayment] = useState<PaymentMethod>("cash");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState<ToastState>(null);
  const [lastSynced, setLastSynced] = useState<string>("");
  const [showReview, setShowReview] = useState(false);

  async function refresh(o: string) {
    const sellable = await listSellable(o);
    setRows(sellable ?? []);
    setLastSynced(
      new Date().toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      })
    );
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
    const interval = setInterval(() => {
      refresh(orgId).catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, [orgId]);

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
    } catch {
      // ignore
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
        .map((r) => {
          const p = r.products as any;
          return [
            r.product_id,
            {
              available: Number(r.qty_on_hand ?? 0),
              base_price: Number(p.unit_price ?? 0),
              activeName: p.name,
              display_name: formatProductDisplayName({
                name: p?.name,
                quantity_value: p?.quantity_value,
                quantity_unit: p?.quantity_unit,
              }),
              category: p.category ?? null,
            },
          ];
        })
    );

    setCart((prev) => {
      const next: CartLine[] = [];

      for (const line of prev) {
        const live = map.get(line.product_id);
        if (!live) continue;

        next.push({
          ...line,
          name: live.activeName,
          display_name: live.display_name,
          category: live.category,
          available: live.available,
          base_price: live.base_price,
          qty: Math.min(line.qty, live.available),
        });
      }

      return next;
    });
  }, [rows]);

  const productList = useMemo(() => {
    const t = q.trim().toLowerCase();

    return rows
      .filter(hasProduct)
      .filter((r) => {
        const p = r.products as any;
        const displayName = formatProductDisplayName({
          name: p?.name,
          quantity_value: p?.quantity_value,
          quantity_unit: p?.quantity_unit,
        }).toLowerCase();

        if (!t) return true;

        const name = (p.name ?? "").toLowerCase();
        const sku = (p.sku ?? "").toLowerCase();
        const barcode = (p.barcode ?? "").toLowerCase();
        const cat = ((p.category ?? "") as string).toLowerCase();

        return (
          displayName.includes(t) ||
          name.includes(t) ||
          sku.includes(t) ||
          barcode.includes(t) ||
          cat.includes(t)
        );
      })
      .slice(0, 30);
  }, [rows, q]);

  function addToCart(r: SellableRow & { products: NonNullable<SellableRow["products"]> }) {
    const p = r.products as any;
    const available = Number(r.qty_on_hand ?? 0);
    if (available <= 0) return;

    const displayName = formatProductDisplayName({
      name: p?.name,
      quantity_value: p?.quantity_value,
      quantity_unit: p?.quantity_unit,
    });

    setCart((prev) => {
      const existing = prev.find((x) => x.product_id === r.product_id);

      // only add first time; quantity changes only from cart side
      if (existing) return prev;

      return [
        ...prev,
        {
          product_id: r.product_id,
          name: p.name,
          display_name: displayName,
          category: p.category ?? null,
          available,
          base_price: Number(p.unit_price ?? 0),
          qty: 1,
          unit_price_override: null,
        },
      ];
    });
  }

  function incrementQty(product_id: string) {
    setCart((prev) =>
      prev.map((x) =>
        x.product_id !== product_id
          ? x
          : { ...x, qty: Math.min(x.qty + 1, x.available) }
      )
    );
  }

  function decrementQty(product_id: string) {
    setCart((prev) =>
      prev
        .map((x) =>
          x.product_id !== product_id
            ? x
            : { ...x, qty: Math.max(x.qty - 1, 0) }
        )
        .filter((x) => x.qty > 0)
    );
  }

  function updateQty(product_id: string, qty: number) {
    setCart((prev) =>
      prev
        .map((x) =>
          x.product_id !== product_id
            ? x
            : { ...x, qty: Math.max(0, Math.min(Number.isNaN(qty) ? 0 : qty, x.available)) }
        )
        .filter((x) => x.qty > 0)
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
    let discountTotal = 0;
    let total = 0;

    for (const line of cart) {
      const qty = Number(line.qty ?? 0);
      const base = Number(line.base_price ?? 0);
      const finalUnit =
        line.unit_price_override == null ? base : Number(line.unit_price_override ?? 0);

      const lineSubtotal = base * qty;
      const lineFinalTotal = finalUnit * qty;
      const lineDiscount = Math.max(0, lineSubtotal - lineFinalTotal);

      subtotal += lineSubtotal;
      discountTotal += lineDiscount;
      total += lineFinalTotal;
    }

    return { subtotal, discountTotal, total };
  }, [cart]);

  const cartItemCount = cart.reduce((sum, x) => sum + Number(x.qty || 0), 0);
  const hasErrors = cart.some((x) => x.qty > x.available);

  async function completeSale() {
    if (!orgId) return;

    if (cartItemCount === 0) {
      setErr("Cart is empty — add at least one product.");
      return;
    }

    const items = cart
      .filter((l) => l.qty > 0)
      .map((l) => ({
        product_id: l.product_id,
        qty: l.qty,
        unit_price_override: l.unit_price_override ?? null,
      }));

    setErr("");
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
      setShowReview(false);

      setToast({
        message: `Sale ${res.sale_no} completed. Total paid: ${fmtMoney(res.total)}`,
        type: "success",
      });

      await refresh(orgId);
    } catch (e: any) {
      setErr(
        e?.message ||
          "Failed to complete sale. Stock may have changed while the cart was open."
      );
      await refresh(orgId);
      setShowReview(false);
    } finally {
      setSaving(false);
    }
  }

  if (!orgId && !err) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400 text-sm">
          <svg
            className="h-4 w-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" strokeOpacity="0.2" />
            <path d="M12 2a10 10 0 0110 10" />
          </svg>
          Loading sales checkout…
        </div>
      </div>
    );
  }

  return (
    <>
      <ReviewSaleModal
        open={showReview}
        onClose={() => setShowReview(false)}
        onConfirm={completeSale}
        customer={customer}
        payment={payment}
        cart={cart}
        totals={totals}
        saving={saving}
      />

      <div className="flex flex-col gap-6">
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}

        {err && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span className="shrink-0 mt-0.5">⚠️</span>
            <span className="flex-1">{err}</span>
            <button
              onClick={() => setErr("")}
              className="shrink-0 text-red-400 hover:text-red-600 text-lg leading-none"
            >
              ×
            </button>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="mt-1 text-[32px] font-bold text-slate-900 tracking-tight">
              Sales Checkout
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Select sellable products, prepare the cart, then review before confirming
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/sales"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              ← Back
            </Link>
            <button
              onClick={() => {
                if (cartItemCount === 0) {
                  setErr("Cart is empty — add at least one product.");
                  return;
                }
                if (hasErrors) {
                  setErr("Fix stock quantities above before continuing.");
                  return;
                }
                setErr("");
                setShowReview(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={saving || cartItemCount === 0 || hasErrors}
            >
              Review Sale →
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_460px]">
          {/* PRODUCTS PANEL */}
          <div className="rounded-[24px] border border-slate-200 bg-white shadow-[0_12px_36px_rgba(15,23,42,0.05)] overflow-hidden">
            <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-4 lg:px-6">
              <div className="flex flex-wrap items-center gap-2">
                <label className="relative flex-1 min-w-[220px] max-w-sm">
                  <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <IconSearch />
                  </div>
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100 outline-none transition"
                    placeholder="Search by product, pack size, SKU or category…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                  {q && (
                    <button
                      onClick={() => setQ("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <IconX />
                    </button>
                  )}
                </label>

                <span className="ml-auto text-xs text-slate-500 whitespace-nowrap">
                  {productList.length} shown · synced {lastSynced || "—"}
                </span>
              </div>
            </div>

            <div className="space-y-4 px-3 py-3 sm:px-4 sm:py-4">
              {productList.length === 0 ? (
                <div className="py-20 text-center">
                  <div className="text-5xl mb-4">📦</div>
                  <p className="text-lg font-semibold text-slate-700">
                    No sellable products found
                  </p>
                  <p className="text-sm text-slate-400 mt-1">
                    Try adjusting your search or confirm product sellable flags
                  </p>
                </div>
              ) : (
                productList.map((r) => {
                  const p = r.products as any;
                  const available = Number(r.qty_on_hand ?? 0);
                  const outOfStock = available <= 0;
                  const cartLine = cart.find((x) => x.product_id === r.product_id);
                  const inCart = !!cartLine;

                  const displayName = formatProductDisplayName({
                    name: p?.name,
                    quantity_value: p?.quantity_value,
                    quantity_unit: p?.quantity_unit,
                  });

                  return (
                    <button
                      key={r.product_id}
                      type="button"
                      onClick={() => !outOfStock && addToCart(r)}
                      disabled={outOfStock}
                      className={`w-full rounded-[28px] border bg-white px-4 py-4 text-left shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition-all duration-200 ${
                        outOfStock
                          ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-45 grayscale"
                          : "border-slate-200 hover:border-slate-300 hover:shadow-[0_14px_30px_rgba(15,23,42,0.06)]"
                      }`}
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                        <div className="flex items-center gap-4 min-w-0 flex-1">
                          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[18px] bg-slate-100 text-lg text-slate-600">
                            🍯
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="truncate text-[15px] font-semibold text-slate-900">
                                {displayName}
                              </span>

                              {inCart && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white">
                                  ✓ {cartLine?.qty}
                                </span>
                              )}
                            </div>

                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                              {p?.sku && <span>SKU {p.sku}</span>}
                              {p?.category && (
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                                  {p.category}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-4 sm:justify-end sm:shrink-0">
                          <div className="text-left sm:text-right">
                            <div className="text-[15px] font-semibold text-slate-900">
                              {fmtMoney(Number(p?.unit_price ?? 0))}
                            </div>

                            <div className="mt-2">
                              {available <= 0 ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">
                                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                                  Out of stock
                                </span>
                              ) : (
                                <div className="text-xs text-slate-500">
                                  <span className="font-semibold text-slate-700">{available}</span> in stock
                                </div>
                              )}
                            </div>
                          </div>

                          {/* {!outOfStock && (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                              Tap to add
                            </div>
                          )} */}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT SIDE */}
          <div className="flex flex-col gap-4">
            <div className="rounded-[24px] border border-slate-200 bg-white shadow-[0_12px_36px_rgba(15,23,42,0.05)] overflow-hidden">
              <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-4">
                <div className="text-sm font-semibold text-slate-900">Sale details</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Teller-side sale details before confirmation
                </div>
              </div>

              <div className="space-y-4 p-5">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Customer name
                  </label>
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100 outline-none transition"
                    placeholder="Walk-in customer (optional)"
                    value={customer}
                    onChange={(e) => setCustomer(e.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Payment method
                  </label>
                  <PaymentSelector value={payment} onChange={setPayment} />
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white shadow-[0_12px_36px_rgba(15,23,42,0.05)] overflow-hidden flex-1">
              <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Cart</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Current sale items
                    </div>
                  </div>

                  {cart.length > 0 && (
                    <button
                      onClick={clearCart}
                      className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 transition"
                    >
                      Clear all
                    </button>
                  )}
                </div>
              </div>

              {cart.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <div className="text-4xl mb-3">🛒</div>
                  <div className="text-sm font-semibold text-slate-700">Cart is empty</div>
                  <div className="text-xs text-slate-400 mt-1">
                    Click a product card on the left to add it
                  </div>
                </div>
              ) : (
                <div className="max-h-[420px] overflow-y-auto">
                  <div
                    className="hidden sm:grid gap-2 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500"
                    style={{ gridTemplateColumns: "minmax(0,1fr) 120px 90px 28px" }}
                  >
                    <div>Item</div>
                    <div className="text-center">Qty</div>
                    <div className="text-center">Price</div>
                    <div />
                  </div>

                  <div className="divide-y divide-slate-100">
                    {cart.map((line) => {
                      const base = Number(line.base_price ?? 0);
                      const final =
                        line.unit_price_override == null
                          ? base
                          : Number(line.unit_price_override);
                      const lineSubtotal = base * line.qty;
                      const lineTotal = final * line.qty;
                      const lineDiscount = Math.max(0, lineSubtotal - lineTotal);
                      const isDiscounted = line.unit_price_override != null && final < base;
                      const isCustomHigher = line.unit_price_override != null && final > base;
                      const overQty = line.qty > line.available;

                      return (
                        <div
                          key={line.product_id}
                          className={`grid grid-cols-1 gap-3 px-4 py-3 transition-colors sm:grid-cols-[minmax(0,1fr)_120px_90px_28px] sm:items-start sm:gap-2 ${
                            overQty ? "bg-red-50" : "hover:bg-slate-50"
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="truncate text-xs font-semibold leading-tight text-slate-900">
                              {line.display_name}
                            </div>

                            <div className="mt-0.5 flex flex-wrap items-center gap-2">
                              <span className="text-xs font-bold text-slate-700">
                                {fmtMoney(lineTotal)}
                              </span>

                              {isDiscounted && lineDiscount > 0 && (
                                <span className="text-xs font-semibold text-green-600">
                                  {fmtMoney(lineDiscount)} disc.
                                </span>
                              )}

                              {isCustomHigher && (
                                <span className="text-xs font-semibold text-amber-600">
                                  custom
                                </span>
                              )}
                            </div>

                            {overQty && (
                              <div className="mt-0.5 text-xs font-semibold text-red-500">
                                ⚠ Max {line.available}
                              </div>
                            )}
                          </div>

                          <div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => decrementQty(line.product_id)}
                                className="grid h-8 w-8 place-items-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition"
                              >
                                <IconMinus />
                              </button>

                              <input
                                className={`w-full rounded-lg border py-1.5 text-center text-sm font-semibold text-slate-900 outline-none transition ${
                                  overQty
                                    ? "border-red-400 bg-red-50 focus:ring-2 focus:ring-red-100"
                                    : "border-slate-300 bg-white focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                                }`}
                                type="number"
                                min={0}
                                max={line.available}
                                value={line.qty}
                                onChange={(e) =>
                                  updateQty(line.product_id, Number(e.target.value || 0))
                                }
                              />

                              <button
                                type="button"
                                onClick={() => incrementQty(line.product_id)}
                                className="grid h-8 w-8 place-items-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition"
                              >
                                <IconPlus />
                              </button>
                            </div>

                            <div className="mt-0.5 text-center text-[10px] text-slate-400">
                              {line.available} max
                            </div>
                          </div>

                          <div>
                            <input
                              className={`w-full rounded-lg border px-2 py-1.5 text-right text-sm text-slate-900 outline-none transition ${
                                line.unit_price_override != null
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
                              {line.unit_price_override != null ? (
                                <span className="text-green-500">custom</span>
                              ) : (
                                "default"
                              )}
                            </div>
                          </div>

                          <button
                            onClick={() => removeLine(line.product_id)}
                            className="mt-0.5 grid h-7 w-7 place-items-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                          >
                            <IconTrash />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
                {customer.trim() && (
                  <div className="mb-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <span className="text-base">👤</span>
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-slate-500">Sale for</div>
                      <div className="truncate text-sm font-bold text-slate-900">
                        {customer}
                      </div>
                    </div>
                    <div className="ml-auto shrink-0">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold border ${paymentPill(
                          payment
                        )}`}
                      >
                        {PAYMENT_METHODS.find((m) => m.key === payment)?.label}
                      </span>
                    </div>
                  </div>
                )}

                <div className="mb-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Subtotal</span>
                    <span className="font-medium text-slate-700">
                      {fmtMoney(totals.subtotal)}
                    </span>
                  </div>

                  {totals.discountTotal > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Discounts</span>
                      <span className="font-semibold text-green-600">
                        −{fmtMoney(totals.discountTotal)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mb-4 flex items-center justify-between rounded-2xl bg-slate-950 px-4 py-4">
                  <span className="text-sm font-semibold text-white">Total</span>
                  <span className="text-3xl font-bold text-white">
                    {fmtMoney(totals.total)}
                  </span>
                </div>

                <button
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => {
                    if (cartItemCount === 0) {
                      setErr("Cart is empty — add at least one product.");
                      return;
                    }
                    if (hasErrors) {
                      setErr("Fix stock quantities above before continuing.");
                      return;
                    }
                    setErr("");
                    setShowReview(true);
                  }}
                  disabled={saving || cartItemCount === 0 || hasErrors}
                >
                  Review Sale →
                </button>

                {hasErrors && (
                  <p className="mt-2 text-center text-xs font-medium text-red-500">
                    Fix stock quantities above before continuing
                  </p>
                )}

                <p className="mt-2 text-center text-xs text-slate-400">
                  Draft cart saved automatically · final stock enforced server-side
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}