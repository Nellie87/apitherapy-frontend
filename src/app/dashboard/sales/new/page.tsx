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

/* Helpers */
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

function formatProductDisplayName(args: {
  name?: string | null;
  quantity_value?: string | number | null;
  quantity_unit?: string | null;
}) {
  const name = (args.name ?? "").trim();
  const qv = args.quantity_value;
  const qu = (args.quantity_unit ?? "").trim();

  if (!name) return "Unnamed product";

  if (qv !== null && qv !== undefined && String(qv).trim() !== "" && qu) {
    return `${name} ${qv}${qu}`;
  }

  if (qu) {
    return `${name} ${qu}`;
  }

  return name;
}

/**
 * Only show products that are truly sellable.
 * We support both:
 * - nested product flags
 * - top-level row flags if your API returns them there
 */
function isSellableForSales(
  r: SellableRow & { products: NonNullable<SellableRow["products"]> }
) {
  const p = r.products as any;
  const row = r as any;

  const active = p?.active ?? row?.active;
  const isSellable = p?.is_sellable ?? row?.is_sellable;
  const sellStatus = p?.sell_status ?? row?.sell_status;

  if (active === false) return false;
  if (isSellable === false) return false;
  if (typeof sellStatus === "string" && sellStatus !== "" && sellStatus !== "to_be_sold") {
    return false;
  }

  return true;
}

function paymentPill(method?: string | null) {
  const key = (method ?? "").toLowerCase();
  if (key === "cash") return "bg-green-100 text-green-700 border border-green-200";
  if (key === "mpesa") return "bg-blue-100 text-blue-700 border border-blue-200";
  if (key === "card") return "bg-purple-100 text-purple-700 border border-purple-200";
  if (key === "credit") return "bg-stone-100 text-stone-700 border border-stone-200";
  return "bg-slate-100 text-slate-600 border border-slate-200";
}

/* Icons */
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

const IconMinus = () => (
  <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5">
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

/* Toast */
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
    const t = setTimeout(onClose, 3200);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className={`fixed bottom-5 right-5 z-[80] flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-xl text-white text-sm font-semibold ${
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

/* Payment selector */
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
          className={`flex flex-col items-center gap-1 rounded-2xl border py-2.5 text-xs font-semibold transition ${
            value === key
              ? "border-slate-900 bg-slate-900 text-white shadow-sm"
              : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50"
          }`}
        >
          <span className="text-base">{icon}</span>
          {label}
        </button>
      ))}
    </div>
  );
}

function StockBadge({ available }: { available: number }) {
  if (available <= 0) {
    return (
      <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">
        Out of stock
      </span>
    );
  }
  if (available <= 3) {
    return (
      <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
        {available} left
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-500">
      {available} avail.
    </span>
  );
}

/* Review modal */
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
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-2xl rounded-[28px] border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Review Sale Summary</h2>
            <p className="text-sm text-slate-500">Confirm everything before completing the sale</p>
          </div>
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <IconX />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Customer</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {customer.trim() || "Walk-in customer"}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Payment Method</div>
              <div className="mt-1 text-sm font-semibold text-slate-900 capitalize">{payment}</div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid grid-cols-[1fr_70px_110px] bg-slate-50 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
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
                    className="grid grid-cols-[1fr_70px_110px] items-center px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">
                        {line.display_name}
                      </div>
                      {line.unit_price_override != null && (
                        <div className="text-xs text-slate-500">
                          Custom price: {fmtMoney(final)}
                        </div>
                      )}
                    </div>
                    <div className="text-center text-sm font-medium text-slate-700">{line.qty}</div>
                    <div className="text-right text-sm font-bold text-slate-900">{fmtMoney(lineTotal)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 ml-auto max-w-sm space-y-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-medium text-slate-800">{fmtMoney(totals.subtotal)}</span>
            </div>
            {totals.discountTotal > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Discounts</span>
                <span className="font-semibold text-green-600">−{fmtMoney(totals.discountTotal)}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-slate-200 pt-2">
              <span className="text-sm font-semibold text-slate-800">Total</span>
              <span className="text-xl font-bold text-slate-900">{fmtMoney(totals.total)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
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
        </div>
      </div>
    </div>
  );
}

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
      // ignore bad draft
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
        .filter(isSellableForSales)
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
      .filter(isSellableForSales)
      .filter((r) => {
        if (!t) return true;

        const p = r.products as any;
        const displayName = formatProductDisplayName({
          name: p?.name,
          quantity_value: p?.quantity_value,
          quantity_unit: p?.quantity_unit,
        }).toLowerCase();

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

      <div
        className="flex flex-col gap-5 p-4 md:p-6"
        style={{
          color: "#111827",
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}

        <div
          className="overflow-hidden rounded-[28px] border bg-white shadow-sm"
          style={{
            borderColor: "#E5E7EB",
          }}
        >
          <div className="h-1 bg-slate-900" />
          <div className="flex items-center justify-between gap-4 px-6 py-5">
            <div>
              <div
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em]"
                style={{
                  background: "#FFFFFF",
                  color: "#6B7280",
                  borderColor: "#E5E7EB",
                }}
              >
                Checkout
              </div>
              <h1 className="mt-3 text-[30px] font-bold tracking-tight text-slate-900">
                New Sale
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Select products, build the cart, review the summary, then complete payment
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/dashboard/sales"
                className="inline-flex items-center gap-2 rounded-2xl border bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                style={{ borderColor: "#E5E7EB" }}
              >
                ← Back
              </Link>
              <button
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
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
            </div>
          </div>
        </div>

        {err && (
          <div
            className="flex items-start gap-3 rounded-[22px] border bg-red-50 px-4 py-3 text-sm text-red-700"
            style={{ borderColor: "#FECACA" }}
          >
            <span className="mt-0.5 shrink-0">⚠️</span>
            <span className="flex-1">{err}</span>
            <button onClick={() => setErr("")} className="ml-auto shrink-0 text-red-400 hover:text-red-600">
              ✕
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_390px] xl:grid-cols-[1fr_430px]">
          {/* Left panel */}
          <div
            className="flex max-h-[calc(100vh-220px)] min-h-0 flex-col overflow-hidden rounded-[28px] border bg-white shadow-sm"
            style={{ borderColor: "#E5E7EB" }}
          >
            <div className="shrink-0 border-b p-4" style={{ borderColor: "#F1F5F9" }}>
              <label
                className="flex items-center gap-2.5 rounded-2xl border bg-white px-3.5 py-2.5 transition"
                style={{ borderColor: "#E5E7EB" }}
              >
                <IconSearch />
                <input
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                  placeholder="Search by name, SKU, barcode or category…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  autoComplete="off"
                  style={{ color: "#111827" }}
                />
                {q && (
                  <button onClick={() => setQ("")} className="shrink-0 text-xs text-slate-400 hover:text-slate-600">
                    ✕
                  </button>
                )}
              </label>

              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  {productList.length} product{productList.length !== 1 ? "s" : ""} shown
                </span>
                <span className="text-xs font-semibold text-slate-600">
                  Synced {lastSynced || "—"}
                </span>
              </div>
            </div>

            <div className="flex-1 divide-y overflow-y-auto" style={{ borderColor: "#F1F5F9" }}>
              {productList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="mb-3 text-4xl">📦</div>
                  <p className="text-sm font-semibold text-slate-700">
                    No sellable products found
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Check `listSellable()` and product sellable flags
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
                      className={`group flex w-full items-center gap-4 px-4 py-4 text-left transition-colors ${
                        outOfStock
                          ? "cursor-not-allowed opacity-45"
                          : inCart
                          ? "bg-slate-50"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      <div
                        className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-lg ${
                          inCart ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        🍯
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-slate-900">
                            {displayName}
                          </span>
                          {inCart && (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-900 px-2 py-0.5 text-xs font-bold text-white">
                              ✓ {cartLine?.qty}
                            </span>
                          )}
                        </div>

                        <div className="mt-1 flex items-center gap-2 flex-wrap">
                          {p.category && (
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                              {p.category}
                            </span>
                          )}
                          {p.sku && (
                            <span className="text-xs text-slate-400">
                              SKU {p.sku}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <div className="text-sm font-bold text-slate-900">
                          {fmtMoney(Number(p.unit_price ?? 0))}
                        </div>
                        <div className="mt-1">
                          <StockBadge available={available} />
                        </div>
                      </div>

                      {!outOfStock && !inCart && (
                        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500 transition-colors group-hover:bg-slate-900 group-hover:text-white">
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
            <div
              className="space-y-4 rounded-[28px] border bg-white p-4 shadow-sm"
              style={{ borderColor: "#E5E7EB" }}
            >
              <div>
                <div className="text-sm font-bold text-slate-900">Sale Details</div>
                <div className="text-xs text-slate-400">
                  Customer and payment selection
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Customer Name
                </label>
                <input
                  className="w-full rounded-2xl border bg-white px-3.5 py-2.5 text-sm outline-none placeholder:text-slate-400"
                  style={{
                    borderColor: "#E5E7EB",
                    color: "#111827",
                  }}
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

            <div
              className="flex min-h-[220px] flex-1 flex-col overflow-hidden rounded-[28px] border bg-white shadow-sm"
              style={{
                borderColor: "#E5E7EB",
                maxHeight: "calc(100vh - 520px)",
              }}
            >
              <div className="shrink-0 border-b px-4 py-3" style={{ borderColor: "#F1F5F9" }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">Cart</span>
                    {cart.length > 0 && (
                      <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs font-bold text-white">
                        {cartItemCount}
                      </span>
                    )}
                  </div>

                  {cart.length > 0 && (
                    <button
                      onClick={clearCart}
                      className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-500 transition hover:bg-red-100"
                    >
                      Clear all
                    </button>
                  )}
                </div>
              </div>

              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
                  <div className="mb-3 text-4xl">🛒</div>
                  <p className="text-sm font-semibold text-slate-700">Cart is empty</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Click a product on the left to add it
                  </p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto">
                  <div
                    className="grid gap-2 bg-slate-50 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500"
                    style={{ gridTemplateColumns: "1fr 110px 80px 28px" }}
                  >
                    <div>Item</div>
                    <div className="text-center">Qty</div>
                    <div className="text-center">Price</div>
                    <div />
                  </div>

                  <div className="divide-y" style={{ borderColor: "#F1F5F9" }}>
                    {cart.map((line) => {
                      const base = Number(line.base_price ?? 0);
                      const final = line.unit_price_override == null ? base : Number(line.unit_price_override);
                      const lineSubtotal = base * line.qty;
                      const lineTotal = final * line.qty;
                      const lineDiscount = Math.max(0, lineSubtotal - lineTotal);
                      const isDiscounted = line.unit_price_override != null && final < base;
                      const isCustomHigher = line.unit_price_override != null && final > base;
                      const overQty = line.qty > line.available;

                      return (
                        <div
                          key={line.product_id}
                          className={`grid items-start gap-2 px-4 py-3 transition-colors ${
                            overQty ? "bg-red-50" : "hover:bg-slate-50"
                          }`}
                          style={{ gridTemplateColumns: "1fr 110px 80px 28px" }}
                        >
                          <div className="min-w-0">
                            <div className="truncate text-xs font-semibold leading-tight text-slate-900">
                              {line.display_name}
                            </div>

                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <span className="text-xs font-bold text-slate-700">
                                {fmtMoney(lineTotal)}
                              </span>

                              {isDiscounted && lineDiscount > 0 && (
                                <span className="text-xs font-semibold text-green-600">
                                  {fmtMoney(lineDiscount)} disc.
                                </span>
                              )}

                              {isCustomHigher && (
                                <span className="text-xs font-semibold text-slate-600">
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
                                className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                              >
                                <IconMinus />
                              </button>

                              <input
                                className={`w-full rounded-xl border py-1.5 text-center text-sm font-semibold outline-none transition ${
                                  overQty
                                    ? "border-red-400 bg-red-50 focus:ring-2 focus:ring-red-100"
                                    : "border-slate-200 bg-white text-slate-900 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                                }`}
                                type="number"
                                min={0}
                                max={line.available}
                                value={line.qty}
                                onChange={(e) => updateQty(line.product_id, Number(e.target.value || 0))}
                              />

                              <button
                                type="button"
                                onClick={() => incrementQty(line.product_id)}
                                className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
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
                              className={`w-full rounded-xl border px-2 py-1.5 text-right text-sm outline-none transition ${
                                line.unit_price_override != null
                                  ? "border-slate-300 bg-slate-50 text-slate-900 focus:ring-2 focus:ring-slate-100"
                                  : "border-slate-200 bg-white text-slate-900 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
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
                            <div className="mt-0.5 text-center text-[10px] text-slate-400">
                              {line.unit_price_override != null ? (
                                <span className="text-green-600">custom</span>
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
              <div
                className="rounded-[28px] border bg-white p-4 shadow-sm"
                style={{ borderColor: "#E5E7EB" }}
              >
                {customer.trim() && (
                  <div className="mb-4 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <span className="text-base">👤</span>
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-slate-500">Sale for</div>
                      <div className="truncate text-sm font-bold text-slate-900">
                        {customer}
                      </div>
                    </div>
                    <div className="ml-auto shrink-0">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${paymentPill(payment)}`}>
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

                <div className="mb-4 flex items-center justify-between rounded-[22px] bg-slate-950 px-4 py-4">
                  <span className="text-sm font-semibold text-white">Total</span>
                  <span className="text-3xl font-bold text-white">{fmtMoney(totals.total)}</span>
                </div>

                <button
                  className="inline-flex w-full items-center justify-center gap-2 rounded-[22px] bg-slate-900 px-4 py-3.5 text-base font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
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
                  Review the summary before final confirmation. Final stock is still enforced server-side.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}