// src/app/(dashboard)/sales/new/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import { listSellable, type SellableRow } from "@/lib/api/sellable";
import {
  createSaleStrict,
  formatPaymentMethodLabel,
  listSales,
  type PaymentMethod,
  type SalePaymentMethod,
  type SaleRowWithItems,
} from "@/lib/api/sales";
import { useOrgRole } from "@/contexts/OrgRoleContext";
import * as S from "./page.styles";

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
  payment: SalePaymentMethod;
  cashAmount?: string;
  mpesaAmount?: string;
  saleDate?: string;
  cart: CartLine[];
  updatedAt: string;
};

type ToastState = {
  message: string;
  type: "success" | "error";
} | null;

const CART_STORAGE_KEY = "apitherapy_sale_draft_v1";

const PAYMENT_METHODS: { key: SalePaymentMethod; label: string }[] = [
  { key: "cash", label: "Cash" },
  { key: "mpesa", label: "M-Pesa" },
  { key: "cash+mpesa", label: "Cash + M-Pesa" },
];

function todayInputDate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

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
  if (key === "cash+mpesa" || key === "split")
    return "bg-teal-50 text-teal-700 border-teal-100";
  if (key === "card") return "bg-purple-50 text-purple-700 border-purple-100";
  if (key === "credit") return "bg-amber-50 text-amber-700 border-amber-100";

  return "bg-slate-50 text-slate-600 border-slate-100";
}

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
      className={`fixed bottom-24 right-4 z-[70] flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-2xl px-5 py-3.5 text-sm font-semibold text-white shadow-xl lg:bottom-5 lg:right-5 ${
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
  value: SalePaymentMethod;
  onChange: (v: SalePaymentMethod) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {PAYMENT_METHODS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`${S.paymentChip} min-w-[calc(50%-0.25rem)] flex-1 sm:min-w-[7.5rem] sm:flex-none ${
            value === key ? S.paymentChipActive : S.paymentChipIdle
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
      <span className="rounded-full border border-red-100 bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-600">
        Out
      </span>
    );
  }

  if (available <= 3) {
    return (
      <span className="rounded-full border border-amber-100 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
        {available} left
      </span>
    );
  }

  return (
    <span className="text-[10px] font-semibold text-slate-400">
      {available} avail
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

function CartLineEditor({
  line,
  onUpdateQty,
  onUpdateOverride,
  onRemove,
}: {
  line: CartLine;
  onUpdateQty: (product_id: string, qty: number) => void;
  onUpdateOverride: (product_id: string, price: number | null) => void;
  onRemove: (product_id: string) => void;
}) {
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
      className={`space-y-3 border-b border-slate-100 px-4 py-3 last:border-b-0 ${
        overQty ? "bg-red-50" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-slate-950">
            {line.name}
          </div>
          <div
            className={`mt-0.5 text-xs font-black ${
              isDiscounted ? "text-green-600" : "text-slate-500"
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

        <button
          type="button"
          onClick={() => onRemove(line.product_id)}
          className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold text-red-500 transition hover:bg-red-50"
        >
          Remove
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={S.fieldLabel}>Qty · {line.available} max</label>
          <input
            className={`w-full rounded-xl border py-2 text-center text-sm font-semibold text-slate-900 outline-none transition ${
              overQty
                ? "border-red-400 bg-red-50 focus:ring-2 focus:ring-red-100"
                : "border-[#EADFC2] bg-white focus:border-[#D6A324] focus:ring-2 focus:ring-amber-100"
            }`}
            type="text"
            inputMode="numeric"
            value={line.qty}
            onChange={(e) => {
              const v = e.target.value.replace(/[^\d]/g, "");
              onUpdateQty(line.product_id, Number(v || 0));
            }}
          />
        </div>

        <div>
          <label className={S.fieldLabel}>
            Unit price · {isDiscounted ? "custom" : "default"}
          </label>
          <input
            className={`w-full rounded-xl border px-3 py-2 text-right text-sm text-slate-900 outline-none transition ${
              isDiscounted
                ? "border-slate-400 bg-slate-50 focus:ring-2 focus:ring-slate-100"
                : "border-[#EADFC2] bg-white focus:border-[#D6A324] focus:ring-2 focus:ring-amber-100"
            }`}
            type="text"
            inputMode="numeric"
            value={
              line.unit_price_override == null
                ? ""
                : String(line.unit_price_override)
            }
            placeholder={String(base)}
            onChange={(e) => {
              const v = e.target.value.replace(/[^\d]/g, "");
              onUpdateOverride(
                line.product_id,
                v === "" ? null : Number(v)
              );
            }}
            title="Override unit price"
          />
        </div>
      </div>
    </div>
  );
}

export default function NewSalePage() {
  const { role } = useOrgRole();

  const isAdmin = ["admin", "owner", "manager"].includes(role ?? "");
  const maxSaleDate = todayInputDate();

  const [orgId, setOrgId] = useState<string | null>(null);
  const [rows, setRows] = useState<SellableRow[]>([]);
  const [recentSales, setRecentSales] = useState<SaleRowWithItems[]>([]);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [q, setQ] = useState("");
  const [customer, setCustomer] = useState("");
  const [payment, setPayment] = useState<SalePaymentMethod>("cash");
  const [cashAmount, setCashAmount] = useState("");
  const [mpesaAmount, setMpesaAmount] = useState("");
  const [saleDate, setSaleDate] = useState(maxSaleDate);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState<ToastState>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  async function refresh(o: string) {
    const [sellable, sales] = await Promise.all([
      listSellable(o),
      listSales(o, {
        ownOnly: true,
        limit: 6,
      }),
    ]);

    setRows(sellable);
    setRecentSales(sales);
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
      const restoredPayment = (parsed.payment as SalePaymentMethod) ?? "cash";
      setPayment(
        restoredPayment === "card" || restoredPayment === "credit"
          ? "cash"
          : restoredPayment
      );
      setCashAmount(parsed.cashAmount ?? "");
      setMpesaAmount(parsed.mpesaAmount ?? "");
      setCart(Array.isArray(parsed.cart) ? parsed.cart : []);

      if (parsed.saleDate && parsed.saleDate <= maxSaleDate) {
        setSaleDate(parsed.saleDate);
      }

      setDraftRestored(true);
      setToast({ message: "Saved cart draft restored", type: "success" });
    } catch {
      // Ignore invalid drafts.
    }
  }, [orgId, maxSaleDate]);

  useEffect(() => {
    if (!orgId) return;

    const payload: DraftSaleCart = {
      orgId,
      customer,
      payment,
      cashAmount,
      mpesaAmount,
      saleDate,
      cart,
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(payload));
  }, [orgId, customer, payment, cashAmount, mpesaAmount, saleDate, cart]);

  useEffect(() => {
    if (cart.length === 0) setMobileCartOpen(false);
  }, [cart.length]);

  useEffect(() => {
    if (!mobileCartOpen) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileCartOpen]);

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
    setCashAmount("");
    setMpesaAmount("");
    setSaleDate(maxSaleDate);
    localStorage.removeItem(CART_STORAGE_KEY);
    setToast({ message: "Cart cleared", type: "success" });
  }

  function selectPayment(next: SalePaymentMethod) {
    setPayment(next);
    if (next !== "cash+mpesa") {
      setCashAmount("");
      setMpesaAmount("");
    }
  }

  function updateCashSplit(raw: string) {
    setCashAmount(raw);
    const cash = Number(raw);
    if (!Number.isFinite(cash) || raw.trim() === "") {
      setMpesaAmount("");
      return;
    }
    const remainder = Math.max(0, Math.round(totals.total - cash));
    setMpesaAmount(String(remainder));
  }

  function updateMpesaSplit(raw: string) {
    setMpesaAmount(raw);
    const mpesa = Number(raw);
    if (!Number.isFinite(mpesa) || raw.trim() === "") {
      setCashAmount("");
      return;
    }
    const remainder = Math.max(0, Math.round(totals.total - mpesa));
    setCashAmount(String(remainder));
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
  const splitCash = Number(cashAmount);
  const splitMpesa = Number(mpesaAmount);
  const splitOk =
    payment !== "cash+mpesa" ||
    (Number.isFinite(splitCash) &&
      Number.isFinite(splitMpesa) &&
      splitCash > 0 &&
      splitMpesa > 0 &&
      Math.round(splitCash + splitMpesa) === Math.round(totals.total));
  const canComplete =
    !saving && cartItemCount > 0 && !hasErrors && splitOk;

  async function completeSale() {
    if (!orgId) return;

    setErr("");

    if (isAdmin && saleDate > maxSaleDate) {
      setErr("Sale date cannot be in the future.");
      return;
    }

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

    let payments:
      | { payment_method: PaymentMethod; amount: number }[]
      | undefined;

    if (payment === "cash+mpesa") {
      const cash = Number(cashAmount);
      const mpesa = Number(mpesaAmount);

      if (!Number.isFinite(cash) || cash < 0 || !Number.isFinite(mpesa) || mpesa < 0) {
        setErr("Enter valid cash and M-Pesa amounts.");
        return;
      }
      if (cash <= 0 || mpesa <= 0) {
        setErr("Both cash and M-Pesa amounts must be greater than 0 for a split payment.");
        return;
      }

      const paid = Math.round(cash + mpesa);
      const due = Math.round(totals.total);
      if (paid !== due) {
        setErr(
          `Cash + M-Pesa must equal the sale total (${fmtMoney(due)}). Currently ${fmtMoney(paid)}.`
        );
        return;
      }

      payments = [
        { payment_method: "cash", amount: cash },
        { payment_method: "mpesa", amount: mpesa },
      ];
    }

    setSaving(true);

    try {
      const res = await createSaleStrict(orgId, {
        customer_name: customer.trim() || undefined,
        payment_method: payment,
        items,
        sale_date: isAdmin ? saleDate : null,
        payments,
      });

      localStorage.removeItem(CART_STORAGE_KEY);
      setCart([]);
      setCustomer("");
      setPayment("cash");
      setCashAmount("");
      setMpesaAmount("");
      setSaleDate(maxSaleDate);

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

  function renderSaleDetails() {
    return (
    <div className="grid gap-4">
      {isAdmin && (
        <div>
          <label className={S.fieldLabel}>Sale date</label>
          <input
            type="date"
            value={saleDate}
            max={maxSaleDate}
            onChange={(e) => setSaleDate(e.target.value)}
            className={S.input}
          />
          <p className="mt-1.5 text-xs text-slate-400">
            For backdated sales only. Future dates are not allowed.
          </p>
        </div>
      )}

      <div>
        <label className={S.fieldLabel}>Customer name</label>
        <input
          className={S.input}
          placeholder="Walk-in customer (optional)"
          value={customer}
          onChange={(e) => setCustomer(e.target.value)}
        />
      </div>

      <div>
        <label className={S.fieldLabel}>Payment method</label>
        <PaymentSelector value={payment} onChange={selectPayment} />

        {payment === "cash+mpesa" && (
          <div className="mt-3 space-y-3 rounded-xl border border-[#EADFC2] bg-[#FFFDF8] p-3">
            <p className="text-xs text-slate-500">
              Cash and M-Pesa must add up to {fmtMoney(totals.total)}.
            </p>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={S.fieldLabel}>Cash</label>
                <input
                  className={S.input}
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={cashAmount}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^\d]/g, "");
                    updateCashSplit(v);
                  }}
                />
              </div>
              <div>
                <label className={S.fieldLabel}>M-Pesa</label>
                <input
                  className={S.input}
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={mpesaAmount}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^\d]/g, "");
                    updateMpesaSplit(v);
                  }}
                />
              </div>
            </div>

            {cashAmount !== "" && mpesaAmount !== "" && (
              <div
                className={`text-xs font-semibold ${
                  Math.round(Number(cashAmount) + Number(mpesaAmount)) ===
                  Math.round(totals.total)
                    ? "text-green-600"
                    : "text-red-500"
                }`}
              >
                Split total:{" "}
                {fmtMoney(Number(cashAmount) + Number(mpesaAmount))}
                {Math.round(Number(cashAmount) + Number(mpesaAmount)) !==
                  Math.round(totals.total) &&
                  ` (need ${fmtMoney(totals.total)})`}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
    );
  }

  function renderCartPanel() {
    return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
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
          <button type="button" onClick={clearCart} className={S.btnDanger}>
            Clear all
          </button>
        )}
      </div>

      {cart.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
          <p className="text-sm font-bold text-slate-700">Cart is empty</p>
          <p className="mt-1 text-xs text-slate-400">Tap a product to add it.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {cart.map((line) => (
            <CartLineEditor
              key={line.product_id}
              line={line}
              onUpdateQty={updateQty}
              onUpdateOverride={updateOverride}
              onRemove={removeLine}
            />
          ))}
        </div>
      )}
    </div>
    );
  }

  function renderCheckoutSummary() {
    if (cart.length === 0) return null;

    return (
    <div className="space-y-3">
      {(customer.trim() || isAdmin) && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
          <div className="min-w-0">
            {customer.trim() ? (
              <>
                <div className="text-[11px] font-medium text-slate-500">
                  Sale for
                </div>
                <div className="truncate text-sm font-black text-slate-950">
                  {customer}
                </div>
              </>
            ) : (
              <>
                <div className="text-[11px] font-medium text-slate-500">
                  Sale date
                </div>
                <div className="text-sm font-black text-slate-950">{saleDate}</div>
              </>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {customer.trim() && isAdmin && (
              <span className="text-xs font-semibold text-slate-500">
                {saleDate}
              </span>
            )}
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-bold ${paymentPill(
                payment
              )}`}
            >
              {formatPaymentMethodLabel(payment)}
            </span>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
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

      <div className="flex items-center justify-between rounded-xl bg-[#2F2718] px-4 py-3">
        <span className="text-sm font-bold text-white">Total</span>
        <span className="text-xl font-black text-white">
          {fmtMoney(totals.total)}
        </span>
      </div>

      <button
        type="button"
        className={`${S.btnPrimary} w-full py-3 text-base`}
        onClick={completeSale}
        disabled={!canComplete}
      >
        {saving ? "Processing…" : "Complete sale"}
      </button>

      {hasErrors && (
        <p className="text-center text-xs font-semibold text-red-500">
          Fix stock quantities above before completing.
        </p>
      )}

      {!hasErrors && payment === "cash+mpesa" && !splitOk && (
        <p className="text-center text-xs font-semibold text-red-500">
          Cash and M-Pesa must both be greater than 0 and add up to the total.
        </p>
      )}

      <p className="text-center text-xs text-slate-400">
        Draft cart saved automatically. Stock is checked again before saving.
      </p>
    </div>
    );
  }

  return (
    <div className="relative flex flex-col gap-4 pb-[5.5rem] lg:gap-5 lg:pb-0">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <section className={`${S.card} overflow-hidden`}>
        <div className="h-1 bg-[#D6A324]" />
        <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
              Checkout
            </div>
            <h1 className="mt-0.5 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
              New Sale
            </h1>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Link href="/dashboard/sales" className={`${S.btnGhost} px-3 py-2`}>
              Back
            </Link>
            <button
              type="button"
              className={`${S.btnPrimary} hidden sm:inline-flex`}
              onClick={completeSale}
              disabled={!canComplete}
            >
              {saving
                ? "Processing…"
                : cartItemCount > 0
                  ? `Complete (${cartItemCount})`
                  : "Complete"}
            </button>
          </div>
        </div>
      </section>

      {err && (
        <div className={S.alert}>
          <span className="flex-1">{err}</span>
          <button
            type="button"
            onClick={() => setErr("")}
            className="ml-auto shrink-0 rounded-full px-2 py-1 text-xs font-bold text-red-500 transition hover:bg-red-100 hover:text-red-700"
          >
            Close
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_min(100%,380px)] lg:items-start xl:grid-cols-[minmax(0,1fr)_400px] xl:gap-5">
        <section
          className={`${S.card} flex min-h-[420px] flex-col overflow-hidden lg:min-h-[560px] lg:max-h-[calc(100vh-180px)]`}
        >
          <div className="sticky top-0 z-10 shrink-0 border-b border-slate-100 bg-white/95 p-3 backdrop-blur sm:p-4">
            <label className="block">
              <input
                className={S.input}
                placeholder="Search name, SKU, barcode, or category…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                autoComplete="off"
              />
            </label>

            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-400">
                {productList.length} product
                {productList.length !== 1 ? "s" : ""} shown
              </span>

              <div className="flex items-center gap-2">
                {q && (
                  <button
                    type="button"
                    onClick={() => setQ("")}
                    className="text-xs font-bold text-slate-500 transition hover:text-slate-900"
                  >
                    Clear
                  </button>
                )}

                {cartItemCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setMobileCartOpen(true)}
                    className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700 transition hover:bg-slate-100 lg:pointer-events-none"
                  >
                    {cartItemCount} in cart
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain">
            {productList.length === 0 ? (
              <div className="flex min-h-[240px] flex-col items-center justify-center px-6 py-16 text-center">
                <p className="text-sm font-bold text-slate-700">
                  No products found
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Try another name, SKU, barcode, or category.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {productList.map((r) => {
                  const p = r.products;
                  const available = Number(r.qty_on_hand ?? 0);
                  const outOfStock = available <= 0;
                  const cartLine = cart.find(
                    (x) => x.product_id === r.product_id
                  );
                  const inCart = !!cartLine && !outOfStock;

                  return (
                    <button
                      key={r.product_id}
                      type="button"
                      onClick={() => !outOfStock && addToCart(r)}
                      disabled={outOfStock}
                      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition sm:gap-4 sm:px-4 sm:py-3 ${
                        outOfStock
                          ? "cursor-not-allowed bg-slate-50/80"
                          : inCart
                            ? "bg-[#FFFBF0] hover:bg-[#FFF4CC]/70"
                            : "hover:bg-slate-50 active:bg-slate-100"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`truncate text-sm font-bold ${
                              outOfStock ? "text-slate-500" : "text-slate-950"
                            }`}
                          >
                            {formatProductDisplayName(p)}
                          </span>

                          {outOfStock && (
                            <span className="rounded-full border border-red-100 bg-red-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700">
                              Out
                            </span>
                          )}

                          {inCart && cartLine && (
                            <span className="rounded-full bg-[#2F2718] px-1.5 py-0.5 text-[10px] font-bold text-white">
                              ×{cartLine.qty}
                            </span>
                          )}
                        </div>

                        {(p.sku || p.barcode || (p as any).category) && (
                          <div className="mt-0.5 truncate text-[11px] text-slate-400">
                            {[
                              (p as any).category,
                              p.sku ? `SKU ${p.sku}` : null,
                              p.barcode ? `BC ${p.barcode}` : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                        )}
                      </div>

                      <div className="shrink-0 text-right">
                        <div
                          className={`text-sm font-black tabular-nums ${
                            outOfStock ? "text-slate-400" : "text-slate-950"
                          }`}
                        >
                          {fmtMoney(Number(p.unit_price ?? 0))}
                        </div>
                        {!outOfStock && (
                          <div className="mt-0.5">
                            <StockBadge available={available} />
                          </div>
                        )}
                      </div>

                      {!outOfStock && (
                        <span
                          className={`hidden shrink-0 rounded-lg border px-2.5 py-1.5 text-xs font-bold sm:inline-flex ${
                            inCart
                              ? "border-[#D6A324] bg-[#FFF4CC] text-[#5A4500]"
                              : "border-[#EADFC2] bg-[#FFFDF8] text-slate-700"
                          }`}
                        >
                          {inCart ? "Add +" : "Add"}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <aside className="hidden lg:sticky lg:top-4 lg:flex lg:max-h-[calc(100vh-180px)] lg:flex-col lg:gap-4">
          <section className={`${S.card} shrink-0 p-4`}>{renderSaleDetails()}</section>

          <section
            className={`${S.card} flex min-h-0 flex-1 flex-col overflow-hidden`}
          >
            {renderCartPanel()}
          </section>

          {cart.length > 0 && (
            <section className={`${S.card} shrink-0 p-4`}>
              {renderCheckoutSummary()}
            </section>
          )}
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#EADFC2] bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(92,64,16,0.08)] backdrop-blur lg:hidden">
        {cart.length === 0 ? (
          <div className="flex items-center justify-between gap-3 px-1">
            <p className="text-sm text-slate-500">Select products to start</p>
            <Link href="/dashboard/sales" className={`${S.btnGhost} py-2`}>
              Back
            </Link>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setMobileCartOpen(true)}
            className={`${S.btnPrimary} flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left`}
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-bold text-white">
                {cartItemCount}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-medium text-white/70">
                  View cart & payment
                </span>
                <span className="block text-sm font-black text-white">
                  {fmtMoney(totals.total)}
                </span>
              </span>
            </span>
            <span className="shrink-0 text-sm font-bold text-white/90">
              Continue
            </span>
          </button>
        )}
      </div>

      {mobileCartOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close cart"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileCartOpen(false)}
          />

          <div className="absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col rounded-t-3xl bg-[#FBF7EC] shadow-2xl">
            <div className="flex shrink-0 items-center justify-between rounded-t-3xl border-b border-[#EADFC2] bg-white px-4 py-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                  Checkout
                </div>
                <div className="text-base font-black text-slate-950">
                  Cart · {fmtMoney(totals.total)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileCartOpen(false)}
                className={`${S.btnGhost} px-3 py-2`}
              >
                Done
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <section className={`${S.card} p-4`}>{renderSaleDetails()}</section>

              <section className={`${S.card} overflow-hidden`}>
                {renderCartPanel()}
              </section>

              {cart.length > 0 && (
                <section className={`${S.card} p-4`}>
                  {renderCheckoutSummary()}
                </section>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}