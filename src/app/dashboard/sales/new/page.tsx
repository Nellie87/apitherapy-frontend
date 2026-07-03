// src/app/(dashboard)/sales/new/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import { listSellable, type SellableRow } from "@/lib/api/sellable";
import { createSaleStrict, type PaymentMethod } from "@/lib/api/sales";
import { useOrgRole } from "@/contexts/OrgRoleContext";
import * as S from "./page.styles";

type ProductUnitSaleType = "retail" | "wholesale" | "stock_only";

type SellableProductUnit = {
  id: string;
  label: string;
  base_quantity: number;
  selling_price: number;
  cost_price: number;
  can_sell: boolean;
  is_default: boolean;
  active: boolean;
  sale_type?: ProductUnitSaleType;
  barcode?: string | null;
  sort_order?: number | null;
};

type CartLine = {
  line_id: string;
  product_id: string;
  product_unit_id: string | null;
  name: string;
  category?: string | null;
  unit_label: string;
  unit_sale_type: ProductUnitSaleType;
  unit_base_quantity: number;
  available_base_qty: number;
  available_units: number;
  base_price: number;
  qty: number;
  unit_price_override?: number | null;
};

type DraftSaleCart = {
  orgId: string;
  customer: string;
  payment: PaymentMethod;
  saleDate?: string;
  cart: CartLine[];
  selectedUnitByProduct?: Record<string, string>;
  updatedAt: string;
};

type ToastState = {
  message: string;
  type: "success" | "error";
} | null;

const CART_STORAGE_KEY = "apitherapy_sale_draft_v5";

const PAYMENT_METHODS: { key: PaymentMethod; label: string }[] = [
  { key: "cash", label: "Cash" },
  { key: "mpesa", label: "M-Pesa" },
  { key: "card", label: "Card" },
  { key: "credit", label: "Credit" },
];

const SALE_TYPE_LABELS: Record<ProductUnitSaleType, string> = {
  retail: "Retail",
  wholesale: "Wholesale",
  stock_only: "Stock only",
};

function todayInputDate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fmtMoney(value: number | string | null | undefined) {
  return `Ksh ${Number(value || 0).toLocaleString("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function fmtNumber(value: number | string | null | undefined) {
  return Number(value || 0).toLocaleString("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

/** Stop mouse-wheel from incrementing/decrementing number inputs while scrolling. */
function blockScrollWheelOnNumberInput(
  event: React.WheelEvent<HTMLInputElement>,
) {
  event.preventDefault();
  event.currentTarget.blur();
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

function normalizeSaleType(value: unknown): ProductUnitSaleType {
  if (value === "retail" || value === "wholesale" || value === "stock_only") {
    return value;
  }

  return "retail";
}

function hasProduct(
  row: SellableRow,
): row is SellableRow & { products: NonNullable<SellableRow["products"]> } {
  return row.products != null;
}

function getProductUnits(
  row: SellableRow & { products: NonNullable<SellableRow["products"]> },
): SellableProductUnit[] {
  const rawUnits = ((row.products as any).product_units ?? []) as any[];

  const units = rawUnits
    .filter((unit) => unit.active !== false && unit.can_sell !== false)
    .map(
      (unit): SellableProductUnit => ({
        id: String(unit.id ?? ""),
        label: String(unit.label ?? "Unit"),
        base_quantity: Number(unit.base_quantity ?? 1),
        selling_price: Number(unit.selling_price ?? 0),
        cost_price: Number(unit.cost_price ?? 0),
        can_sell: unit.can_sell !== false,
        is_default: Boolean(unit.is_default),
        active: unit.active !== false,
        sale_type: normalizeSaleType(unit.sale_type),
        barcode: unit.barcode ?? null,
        sort_order:
          unit.sort_order === null || unit.sort_order === undefined
            ? null
            : Number(unit.sort_order),
      }),
    )
    .filter((unit) => unit.base_quantity > 0 && unit.selling_price >= 0)
    .sort((a, b) => {
      if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;

      const orderA = a.sort_order ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.sort_order ?? Number.MAX_SAFE_INTEGER;

      if (orderA !== orderB) return orderA - orderB;
      return a.base_quantity - b.base_quantity;
    });

  if (units.length > 0) return units;

  return [
    {
      id: "",
      label: "Retail",
      base_quantity: 1,
      selling_price: Number(row.products.unit_price ?? 0),
      cost_price: Number((row.products as any).cost_price ?? 0),
      can_sell: true,
      is_default: true,
      active: true,
      sale_type: "retail",
      barcode: row.products.barcode ?? null,
      sort_order: 0,
    },
  ];
}

function getBaseUnitLabel(
  row: SellableRow & { products: NonNullable<SellableRow["products"]> },
) {
  const units = getProductUnits(row);
  return units.find((unit) => unit.is_default)?.label ?? units[0]?.label ?? "units";
}

function getAvailableUnits(availableBaseQty: number, unitBaseQty: number) {
  if (unitBaseQty <= 0) return 0;
  return Math.floor(Number(availableBaseQty || 0) / unitBaseQty);
}

function getUnitLineId(productId: string, unitId: string | null) {
  return `${productId}::${unitId || "base"}`;
}

function getUnitSubText(unit: SellableProductUnit, baseUnitLabel: string) {
  const type = normalizeSaleType(unit.sale_type);

  if (unit.base_quantity > 1) {
    return `${SALE_TYPE_LABELS[type]} · ${fmtNumber(unit.base_quantity)} ${baseUnitLabel}`;
  }

  return SALE_TYPE_LABELS[type];
}

function paymentPill(method?: string | null) {
  const key = (method ?? "").toLowerCase();

  if (key === "cash") return "bg-green-50 text-green-700 border-green-100";
  if (key === "mpesa") return "bg-blue-50 text-blue-700 border-blue-100";
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
    const timer = setTimeout(onClose, 3500);
    return () => clearTimeout(timer);
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

function LoadingState() {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-sm font-semibold text-slate-400">Preparing sale…</div>
    </div>
  );
}

function PaymentSelector({
  value,
  onChange,
}: {
  value: PaymentMethod;
  onChange: (value: PaymentMethod) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2">
      {PAYMENT_METHODS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`rounded-2xl border px-3 py-2.5 text-sm font-bold transition ${
            value === key
              ? "border-[#D6A324] bg-[#FFF4CC] text-[#5A4500] shadow-[0_8px_18px_rgba(214,163,36,0.16)]"
              : "border-[#EADFC2] bg-white text-slate-600 hover:bg-[#FFF8E6]"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function ProductCard({
  row,
  selectedUnitId,
  cartQty,
  onSelectUnit,
  onAdd,
}: {
  row: SellableRow & { products: NonNullable<SellableRow["products"]> };
  selectedUnitId: string;
  cartQty: number;
  onSelectUnit: (unitId: string) => void;
  onAdd: () => void;
}) {
  const product = row.products;
  const units = getProductUnits(row);
  const availableBaseQty = Number(row.qty_on_hand ?? 0);
  const baseUnitLabel = getBaseUnitLabel(row);

  const selectedUnit =
    units.find((unit) => unit.id === selectedUnitId) ??
    units.find((unit) => unit.is_default) ??
    units[0];

  const availableSelectedUnits = selectedUnit
    ? getAvailableUnits(availableBaseQty, selectedUnit.base_quantity)
    : 0;

  const outOfStock = availableSelectedUnits <= 0;
  const category = (product as any).category ?? null;

  return (
    <div
      className={`rounded-[24px] border bg-white p-5 shadow-[0_8px_28px_rgba(92,64,16,0.045)] transition sm:p-6 ${
        outOfStock
          ? "border-slate-200 opacity-70"
          : "border-[#EFE4C6] hover:-translate-y-0.5 hover:border-[#E5D28D] hover:shadow-[0_16px_34px_rgba(92,64,16,0.08)]"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-base font-black leading-snug text-slate-950 sm:text-lg">
            {formatProductDisplayName(product)}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            {category && <span className="font-semibold text-slate-600">{category}</span>}
            {product.sku && <span>SKU {product.sku}</span>}
            {product.barcode && <span>Barcode {product.barcode}</span>}
          </div>
        </div>

        <div className="shrink-0 rounded-xl border border-[#F1E6C9] bg-[#FFFDF8] px-3 py-2 text-right">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
            Stock
          </div>
          <div className="mt-0.5 text-base font-black text-slate-900">
            {fmtNumber(availableBaseQty)}
          </div>
          <div className="text-[11px] text-slate-500">{baseUnitLabel}</div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-[#F1E6C9] bg-[#FFFDF8] p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className={S.sectionTitle}>Sell as</div>

          {cartQty > 0 && <span className={S.badgeAccent}>In cart: {fmtNumber(cartQty)}</span>}
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {units.map((unit) => {
            const selected = selectedUnit?.id === unit.id;
            const availableUnits = getAvailableUnits(availableBaseQty, unit.base_quantity);
            const disabled = availableUnits <= 0;

            return (
              <button
                key={unit.id || "base"}
                type="button"
                disabled={disabled}
                onClick={() => onSelectUnit(unit.id)}
                className={`rounded-2xl border px-4 py-3 text-left transition ${
                  selected
                    ? "border-[#2F2718] bg-white shadow-[0_8px_20px_rgba(47,39,24,0.10)] ring-1 ring-[#E8C84A]"
                    : "border-transparent bg-white/70 hover:border-[#EADFC2] hover:bg-white"
                } ${disabled ? "cursor-not-allowed opacity-45" : ""}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-black text-slate-950 sm:text-base">
                      {unit.label}
                    </div>
                    <div className="mt-0.5 text-xs font-medium text-slate-500">
                      {getUnitSubText(unit, baseUnitLabel)}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className={S.priceTag}>{fmtMoney(unit.selling_price)}</div>
                    <div className="mt-0.5 text-[11px] text-slate-500">
                      {disabled ? "Out of stock" : `${fmtNumber(availableUnits)} available`}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <button type="button" disabled={outOfStock} onClick={onAdd} className={`mt-4 ${S.btnAdd}`}>
        {outOfStock
          ? "Out of stock"
          : `Add ${selectedUnit?.label ?? "item"} · ${fmtMoney(selectedUnit?.selling_price ?? 0)}`}
      </button>
    </div>
  );
}

function CartLineRow({
  line,
  onQtyChange,
  onPriceChange,
  onRemove,
}: {
  line: CartLine;
  onQtyChange: (qty: number) => void;
  onPriceChange: (price: number | null) => void;
  onRemove: () => void;
}) {
  const originalUnitPrice = Number(line.base_price ?? 0);
  const currentUnitPrice =
    line.unit_price_override == null
      ? originalUnitPrice
      : Number(line.unit_price_override);
  const lineTotal = currentUnitPrice * Number(line.qty ?? 0);
  const overQty = line.qty > line.available_units;

  return (
    <div className={`${S.cartRow} ${overQty ? S.cartRowError : S.cartRowNormal}`}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-black leading-snug text-slate-950">
            {line.name}
          </div>
          <div className="mt-0.5 truncate text-xs font-semibold text-slate-500">
            {line.unit_label}
          </div>
        </div>

        <div
          className={`flex shrink-0 items-center rounded-xl border bg-white ${
            overQty ? "border-red-300" : "border-[#EADFC2]"
          }`}
        >
          <button
            type="button"
            onClick={() => onQtyChange(line.qty - 1)}
            disabled={line.qty <= 1}
            className="px-2.5 py-2 text-base font-bold text-slate-600 disabled:opacity-30"
            aria-label="Decrease quantity"
          >
            −
          </button>
          <span className="w-9 text-center text-base font-black tabular-nums text-slate-900">
            {line.qty}
          </span>
          <button
            type="button"
            onClick={() => onQtyChange(line.qty + 1)}
            disabled={line.qty >= line.available_units}
            className="px-2.5 py-2 text-base font-bold text-slate-600 disabled:opacity-30"
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>

        <input
          className="w-[5.5rem] shrink-0 rounded-xl border border-[#EADFC2] bg-white px-2 py-2 text-right text-sm font-bold tabular-nums text-slate-900 outline-none focus:border-[#D6A324] focus:ring-2 focus:ring-amber-100"
          type="number"
          min={0}
          step="1"
          value={line.unit_price_override == null ? "" : line.unit_price_override}
          placeholder={String(originalUnitPrice)}
          title={`Default: ${fmtMoney(originalUnitPrice)}`}
          onChange={(event) => {
            const value = event.target.value;
            onPriceChange(value === "" ? null : Number(value));
          }}
          onWheel={blockScrollWheelOnNumberInput}
        />

        <div className={`w-[5.5rem] shrink-0 text-right ${S.cartLineTotal}`}>
          {fmtMoney(lineTotal)}
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 rounded-xl p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
          aria-label="Remove item"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {overQty && (
        <p className="mt-2 text-xs font-semibold text-red-600">
          Only {line.available_units} {line.unit_label} available.
        </p>
      )}
    </div>
  );
}

export default function NewSalePage() {
  const { role } = useOrgRole();

  const isAdmin = ["admin", "owner", "manager"].includes(role ?? "");
  const maxSaleDate = todayInputDate();

  const [orgId, setOrgId] = useState<string | null>(null);
  const [rows, setRows] = useState<SellableRow[]>([]);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedUnitByProduct, setSelectedUnitByProduct] = useState<Record<string, string>>({});

  const [query, setQuery] = useState("");
  const [customer, setCustomer] = useState("");
  const [payment, setPayment] = useState<PaymentMethod>("cash");
  const [saleDate, setSaleDate] = useState(maxSaleDate);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState<ToastState>(null);
  const [draftRestored, setDraftRestored] = useState(false);

  async function refresh(o: string) {
    const sellable = await listSellable(o);
    setRows(sellable);
  }

  useEffect(() => {
    (async () => {
      try {
        const o = await bootstrapOrg();
        setOrgId(o);
        await refresh(o);
      } catch (error: any) {
        setErr(error.message ?? String(error));
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
      setSelectedUnitByProduct(parsed.selectedUnitByProduct ?? {});

      if (parsed.saleDate && parsed.saleDate <= maxSaleDate) {
        setSaleDate(parsed.saleDate);
      }

      setDraftRestored(true);
      setToast({ message: "Saved cart restored", type: "success" });
    } catch {
      // Ignore invalid local drafts.
    }
  }, [orgId, maxSaleDate]);

  useEffect(() => {
    if (!orgId) return;

    const payload: DraftSaleCart = {
      orgId,
      customer,
      payment,
      saleDate,
      cart,
      selectedUnitByProduct,
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(payload));
  }, [orgId, customer, payment, saleDate, cart, selectedUnitByProduct]);

  useEffect(() => {
    if (!rows.length) return;

    const liveMap = new Map<
      string,
      {
        availableBaseQty: number;
        productName: string;
        category: string | null;
        units: SellableProductUnit[];
      }
    >();

    rows.filter(hasProduct).forEach((row) => {
      liveMap.set(row.product_id, {
        availableBaseQty: Number(row.qty_on_hand ?? 0),
        productName: formatProductDisplayName(row.products),
        category: (row.products as any).category ?? null,
        units: getProductUnits(row),
      });
    });

    let removed = false;

    setCart((previous) => {
      const next: CartLine[] = [];

      for (const line of previous) {
        const live = liveMap.get(line.product_id);

        if (!live || live.availableBaseQty <= 0) {
          removed = true;
          continue;
        }

        const liveUnit =
          live.units.find((unit) => unit.id === (line.product_unit_id ?? "")) ??
          live.units.find((unit) => unit.is_default) ??
          live.units[0];

        if (!liveUnit) {
          removed = true;
          continue;
        }

        const availableUnits = getAvailableUnits(
          live.availableBaseQty,
          liveUnit.base_quantity,
        );

        if (availableUnits <= 0) {
          removed = true;
          continue;
        }

        next.push({
          ...line,
          name: live.productName,
          category: live.category,
          product_unit_id: liveUnit.id || null,
          unit_label: liveUnit.label,
          unit_sale_type: normalizeSaleType(liveUnit.sale_type),
          unit_base_quantity: liveUnit.base_quantity,
          available_base_qty: live.availableBaseQty,
          available_units: availableUnits,
          base_price: Number(liveUnit.selling_price ?? 0),
          qty: Math.min(line.qty, availableUnits),
        });
      }

      return next;
    });

    if (draftRestored && removed) {
      setToast({
        message: "Some saved cart items were removed because stock changed",
        type: "error",
      });
    }
  }, [rows, draftRestored]);

  const productList = useMemo(() => {
    const term = query.trim().toLowerCase();

    return rows
      .filter(hasProduct)
      .filter((row) => {
        if (!term) return true;

        const product = row.products;
        const name = formatProductDisplayName(product).toLowerCase();
        const sku = (product.sku ?? "").toLowerCase();
        const barcode = (product.barcode ?? "").toLowerCase();
        const category = ((product as any).category ?? "").toLowerCase();
        const unitText = getProductUnits(row)
          .map((unit) => `${unit.label} ${unit.barcode ?? ""}`)
          .join(" ")
          .toLowerCase();

        return (
          name.includes(term) ||
          sku.includes(term) ||
          barcode.includes(term) ||
          category.includes(term) ||
          unitText.includes(term)
        );
      })
      .sort((a, b) => {
        const aInStock = Number(a.qty_on_hand ?? 0) > 0 ? 1 : 0;
        const bInStock = Number(b.qty_on_hand ?? 0) > 0 ? 1 : 0;

        if (aInStock !== bInStock) return bInStock - aInStock;

        return formatProductDisplayName(a.products).localeCompare(
          formatProductDisplayName(b.products),
        );
      });
  }, [rows, query]);

  function getSelectedUnit(
    row: SellableRow & { products: NonNullable<SellableRow["products"]> },
  ) {
    const units = getProductUnits(row);
    const selectedUnitId = selectedUnitByProduct[row.product_id];

    return (
      units.find((unit) => unit.id === selectedUnitId) ??
      units.find((unit) => unit.is_default) ??
      units[0]
    );
  }

  function addToCart(
    row: SellableRow & { products: NonNullable<SellableRow["products"]> },
  ) {
    const unit = getSelectedUnit(row);
    if (!unit) return;

    const availableBaseQty = Number(row.qty_on_hand ?? 0);
    const availableUnits = getAvailableUnits(availableBaseQty, unit.base_quantity);

    if (availableUnits <= 0) return;

    const lineId = getUnitLineId(row.product_id, unit.id || null);

    setCart((previous) => {
      const existing = previous.find((line) => line.line_id === lineId);

      if (existing) {
        return previous.map((line) =>
          line.line_id === lineId
            ? {
                ...line,
                qty: Math.min(line.qty + 1, availableUnits),
                available_base_qty: availableBaseQty,
                available_units: availableUnits,
              }
            : line,
        );
      }

      return [
        ...previous,
        {
          line_id: lineId,
          product_id: row.product_id,
          product_unit_id: unit.id || null,
          name: formatProductDisplayName(row.products),
          category: (row.products as any).category ?? null,
          unit_label: unit.label,
          unit_sale_type: normalizeSaleType(unit.sale_type),
          unit_base_quantity: Number(unit.base_quantity ?? 1),
          available_base_qty: availableBaseQty,
          available_units: availableUnits,
          base_price: Number(unit.selling_price ?? 0),
          qty: 1,
          unit_price_override: null,
        },
      ];
    });
  }

  function updateQty(lineId: string, qty: number) {
    if (!Number.isFinite(qty)) return;

    setCart((previous) =>
      previous.map((line) =>
        line.line_id !== lineId
          ? line
          : {
              ...line,
              qty: Math.max(1, Math.min(qty, line.available_units)),
            },
      ),
    );
  }

  function updateOverride(lineId: string, price: number | null) {
    setCart((previous) =>
      previous.map((line) =>
        line.line_id !== lineId
          ? line
          : {
              ...line,
              unit_price_override: price === null ? null : Math.max(0, price),
            },
      ),
    );
  }

  function removeLine(lineId: string) {
    setCart((previous) => previous.filter((line) => line.line_id !== lineId));
  }

  function clearCart() {
    setCart([]);
    setCustomer("");
    setPayment("cash");
    setSaleDate(maxSaleDate);
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

  const cartItemCount = cart.filter((line) => line.qty > 0).length;
  const hasErrors = cart.some((line) => line.qty > line.available_units);

  async function completeSale() {
    if (!orgId) return;

    setErr("");

    if (isAdmin && saleDate > maxSaleDate) {
      setErr("Sale date cannot be in the future.");
      return;
    }

    const items = cart
      .filter((line) => line.qty > 0)
      .map((line) => ({
        product_id: line.product_id,
        qty: line.qty,
        unit_price_override: line.unit_price_override ?? null,
        product_unit_id: line.product_unit_id,
        unit_label: line.unit_label,
        unit_base_quantity: line.unit_base_quantity,
        base_qty: line.qty * line.unit_base_quantity,
      }));

    if (items.length === 0) {
      setErr("Cart is empty. Add at least one product.");
      return;
    }

    for (const line of cart) {
      if (line.qty > line.available_units) {
        setErr(
          `Insufficient stock for "${line.name}" as ${line.unit_label}. Only ${line.available_units} available.`,
        );
        return;
      }
    }

    setSaving(true);

    try {
      const res = await createSaleStrict(orgId, {
        customer_name: customer.trim() || undefined,
        payment_method: payment,
        items: items as any,
        sale_date: isAdmin ? saleDate : null,
      } as any);

      localStorage.removeItem(CART_STORAGE_KEY);
      setCart([]);
      setCustomer("");
      setPayment("cash");
      setSaleDate(maxSaleDate);

      window.location.href = `/dashboard/sales?created=${encodeURIComponent(
        res.sale_no,
      )}`;
    } catch (error: any) {
      setErr(error.message ?? String(error));
    } finally {
      setSaving(false);
    }
  }

  const canComplete = !saving && cartItemCount > 0 && !hasErrors;

  if (!orgId && !err) return <LoadingState />;

  return (
    <div className="flex flex-col gap-5 pb-28 xl:pb-5">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <section className={`${S.card} overflow-hidden`}>
        <div className="h-1 bg-[#D6A324]" />
        <div className="flex flex-col gap-4 px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#9A7A18]">
              Point of sale
            </div>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
              New Sale
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Select a product, choose retail or wholesale, then add it to cart.
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
                  ? `Complete sale · ${fmtMoney(totals.total)}`
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

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(480px,520px)] 2xl:grid-cols-[minmax(0,1.5fr)_520px]">
        <section className={`${S.card} flex min-h-[620px] min-w-0 flex-col overflow-hidden`}>
          <div className="border-b border-[#F1E6C9] bg-[linear-gradient(180deg,#FFFDF8_0%,#FFF9EC_100%)] px-5 py-5 sm:px-6">
            <input
              className={S.input}
              placeholder="Search product, SKU, barcode, or unit..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoComplete="off"
            />

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-400">
                {productList.length} product{productList.length !== 1 ? "s" : ""} available
              </span>

              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="text-xs font-bold text-[#9A7A18] transition hover:text-[#5A4500]"
                >
                  Clear search
                </button>
              )}

              {cartItemCount > 0 && (
                <span className="rounded-full border border-[#EADFC2] bg-white px-3 py-1 text-xs font-bold text-slate-700">
                  {cartItemCount} in cart
                </span>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 sm:p-6">
            {productList.length === 0 ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center rounded-[24px] border border-dashed border-[#EADFC2] bg-[#FFFDF8] px-6 py-16 text-center">
                <p className="text-sm font-black text-slate-700">No products found</p>
                <p className="mt-1 text-xs text-slate-400">
                  Try another name, SKU, barcode, category, or unit.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {productList.map((row) => {
                  const selectedUnit = getSelectedUnit(row);
                  const lineId = getUnitLineId(row.product_id, selectedUnit?.id || null);

                  const cartQty =
                    cart.find((line) => line.line_id === lineId)?.qty ?? 0;

                  return (
                    <ProductCard
                      key={row.product_id}
                      row={row}
                      selectedUnitId={
                        selectedUnitByProduct[row.product_id] ??
                        selectedUnit?.id ??
                        ""
                      }
                      cartQty={cartQty}
                      onSelectUnit={(unitId) =>
                        setSelectedUnitByProduct((previous) => ({
                          ...previous,
                          [row.product_id]: unitId,
                        }))
                      }
                      onAdd={() => addToCart(row)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <aside className="flex flex-col gap-4 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:self-start">
          <section className={`${S.card} shrink-0 p-4 sm:p-5`}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {isAdmin && (
                <div className="sm:col-span-2">
                  <label className={`mb-1.5 block ${S.sectionTitle}`}>Sale date</label>
                  <input
                    type="date"
                    value={saleDate}
                    max={maxSaleDate}
                    onChange={(event) => setSaleDate(event.target.value)}
                    className={S.input}
                  />
                </div>
              )}

              <div className={isAdmin ? "" : "sm:col-span-1"}>
                <label className={`mb-1.5 block ${S.sectionTitle}`}>Customer</label>
                <input
                  className={S.input}
                  placeholder="Walk-in customer"
                  value={customer}
                  onChange={(event) => setCustomer(event.target.value)}
                />
              </div>

              <div>
                <label className={`mb-1.5 block ${S.sectionTitle}`}>Payment</label>
                <PaymentSelector value={payment} onChange={setPayment} />
              </div>
            </div>
          </section>

          <section className={`${S.card} flex min-h-[320px] flex-1 flex-col overflow-hidden`}>
            <div className="flex shrink-0 items-center justify-between border-b border-[#F1E6C9] bg-[linear-gradient(180deg,#FFFDF8_0%,#FFF9EC_100%)] px-5 py-5">
              <div>
                <div className="text-lg font-black text-slate-950">
                  Cart
                  {cartItemCount > 0 && <span className={`ml-2 ${S.badgeAccent}`}>{cartItemCount}</span>}
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  {cartItemCount > 0
                    ? `${fmtMoney(totals.total)} total`
                    : "Retail and wholesale lines are tracked separately"}
                </div>
              </div>

              {cart.length > 0 && (
                <button type="button" onClick={clearCart} className={S.btnDanger}>
                  Clear all
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-8 py-16 text-center">
                <p className="text-lg font-black text-slate-700">Cart is empty</p>
                <p className="mt-2 text-sm text-slate-400">Pick a product and tap Add.</p>
              </div>
            ) : (
              <>
                <div className="hidden shrink-0 grid-cols-[minmax(0,1fr)_96px_96px_100px_36px] gap-3 border-b border-[#F1E6C9] bg-[#F7F3EA] px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#8A7A55] sm:grid">
                  <div>Item</div>
                  <div className="text-center">Qty</div>
                  <div className="text-right">Price</div>
                  <div className="text-right">Total</div>
                  <div />
                </div>
                <div className="space-y-2.5 p-4 sm:p-5">
                  {cart.map((line) => (
                    <CartLineRow
                      key={line.line_id}
                      line={line}
                      onQtyChange={(qty) => updateQty(line.line_id, qty)}
                      onPriceChange={(price) => updateOverride(line.line_id, price)}
                      onRemove={() => removeLine(line.line_id)}
                    />
                  ))}
                </div>
              </>
            )}

            <div className="shrink-0 border-t border-[#F1E6C9] bg-[#FFFDF8] p-5 sm:p-6">
              {customer.trim() && (
                <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-[#EADFC2] bg-white px-4 py-3">
                  <div className="min-w-0">
                    <div className={`${S.sectionTitle} mb-1`}>Sale for</div>
                    <div className="truncate text-base font-black text-slate-950">
                      {customer}
                    </div>
                  </div>

                  <span
                    className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${paymentPill(
                      payment,
                    )}`}
                  >
                    {PAYMENT_METHODS.find((method) => method.key === payment)?.label}
                  </span>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-500">Subtotal</span>
                  <span className={S.cartValue}>{fmtMoney(totals.subtotal)}</span>
                </div>

                {totals.discountTotal > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-500">Discounts</span>
                    <span className="text-lg font-black tabular-nums text-green-600">
                      -{fmtMoney(totals.discountTotal)}
                    </span>
                  </div>
                )}
              </div>

              <div className={`${S.totalBar} mt-4`}>
                <span className="text-base font-bold text-white">Total</span>
                <span className="text-2xl font-black tabular-nums text-white sm:text-3xl">
                  {fmtMoney(totals.total)}
                </span>
              </div>

              <button
                className={`${S.btnPrimary} mt-4 w-full py-3.5 text-base`}
                onClick={completeSale}
                disabled={saving || cartItemCount === 0 || hasErrors}
              >
                {saving ? "Processing…" : "Complete sale"}
              </button>

              {hasErrors && (
                <p className="mt-2 text-center text-sm font-semibold text-red-500">
                  Fix stock quantities before completing.
                </p>
              )}

              <p className="mt-2 text-center text-xs text-slate-400">
                Cart saves automatically.
              </p>
            </div>
          </section>
        </aside>
      </div>

      {/* Mobile: keep checkout within reach */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[#EADFC2] bg-white/95 px-4 py-3 shadow-[0_-8px_32px_rgba(47,39,24,0.12)] backdrop-blur-sm xl:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-slate-500">
              {cartItemCount > 0
                ? `${cartItemCount} item${cartItemCount !== 1 ? "s" : ""}`
                : "No items yet"}
            </div>
            <div className="text-xl font-black tabular-nums text-slate-950">
              {fmtMoney(totals.total)}
            </div>
          </div>
          <button
            className={`${S.btnPrimary} shrink-0 px-6 py-3`}
            onClick={completeSale}
            disabled={!canComplete}
          >
            {saving ? "…" : "Complete sale"}
          </button>
        </div>
      </div>
    </div>
  );
}
