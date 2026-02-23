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
  base_price: number;         // products.unit_price
  qty: number;
  unit_price_override?: number | null; // optional override (discount)
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

  // keep cart availability fresh if inventory changes
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

    return {
      subtotal,
      discountTotal,
      total,
    };
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

    // client-side strict guard (server also enforces)
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

      // refresh inventory, clear cart
      await refresh(orgId);
      setCart([]);
      setCustomer("");

      // quick redirect to sales list
      window.location.href = `/dashboard/sales?created=${encodeURIComponent(res.sale_no)}`;
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  if (!orgId && !err) return <div className="p-6">Loading…</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`${S.card} p-6`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-3xl font-black text-zinc-900">New Sale</div>
            <div className="mt-1 text-sm text-zinc-500">
              Strict stock enforcement · default product price · optional discount override
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <a className={S.btnGhost} href="/dashboard/sales">← Back</a>
            <button className={S.btnPrimary} onClick={completeSale} disabled={saving}>
              {saving ? "Completing…" : "Complete Sale"}
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="md:col-span-2">
            <input
              className={S.input}
              placeholder="Search product name / SKU / barcode..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div>
            <input
              className={S.input}
              placeholder="Customer name (optional)"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
            />
          </div>
        </div>
      </div>

      {err ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
          {err}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* LEFT: product picker */}
        <div className={`${S.card} p-6`}>
          <div className="flex items-center justify-between">
            <div className="text-lg font-black text-zinc-900">Products</div>
            <div className="text-xs text-zinc-500">{productList.length} shown</div>
          </div>

          <div className="mt-4 divide-y divide-zinc-200 rounded-2xl border border-zinc-200 overflow-hidden">
            {productList.filter(hasProduct).map((r) => {
  const p = r.products; // ✅ now guaranteed not null
  const available = Number(r.qty_on_hand ?? 0);

  return (
    <button
      key={r.product_id}
      className="w-full text-left px-4 py-3 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed"
      onClick={() => addToCart(r)}
      disabled={available <= 0}
      title={available <= 0 ? "Out of stock" : "Add to cart"}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-black text-zinc-900 truncate">{p.name}</div>
          <div className="text-xs text-zinc-500">
            {p.sku ? `SKU: ${p.sku} · ` : ""}
            {p.barcode ? `Barcode: ${p.barcode}` : "—"}
          </div>
        </div>
        <div className="text-right">
          <div className="font-black text-zinc-900">
            {fmtMoney(Number(p.unit_price ?? 0))}
          </div>
          <div className="text-xs text-zinc-500">
            Avail: {available}
          </div>
        </div>
      </div>
    </button>
  );
})}

            {productList.length === 0 ? (
              <div className="px-4 py-8 text-sm text-zinc-500">
                No products match your search.
              </div>
            ) : null}
          </div>
        </div>

        {/* RIGHT: cart */}
        <div className={`${S.card} p-6`}>
          <div className="flex items-center justify-between">
            <div className="text-lg font-black text-zinc-900">Cart</div>
            <button className={S.btnDanger} onClick={() => setCart([])} disabled={cart.length === 0}>
              Clear
            </button>
          </div>

          <div className="mt-4">
            <div className={`${S.tableHead} px-2`} style={{ gridTemplateColumns: "2fr .8fr 1fr 1fr auto" }}>
              <div>Item</div>
              <div>Avail</div>
              <div>Qty</div>
              <div>Price</div>
              <div />
            </div>

            <div className="mt-2 divide-y divide-zinc-200 rounded-2xl border border-zinc-200 overflow-hidden">
              {cart.map((line) => {
                const base = Number(line.base_price ?? 0);
                const final = line.unit_price_override == null ? base : Number(line.unit_price_override);
                const lineTotal = final * Number(line.qty ?? 0);

                return (
                  <div
                    key={line.product_id}
                    className="grid items-center gap-2 px-3 py-3"
                    style={{ gridTemplateColumns: "2fr .8fr 1fr 1fr auto" }}
                  >
                    <div className="min-w-0">
                      <div className="font-black text-zinc-900 truncate">{line.name}</div>
                      <div className="text-xs text-zinc-500">
                        Base: {fmtMoney(base)}{" "}
                        {final !== base ? (
                          <span className={`${S.badge} bg-amber-50 text-amber-700 ml-2`}>
                            Discounted
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="text-sm font-black text-zinc-700">{line.available}</div>

                    <input
                      className={`${S.inputSoft} text-center`}
                      type="number"
                      min={0}
                      max={line.available}
                      value={line.qty}
                      onChange={(e) => updateQty(line.product_id, Number(e.target.value || 0))}
                    />

                    <div className="space-y-1">
                      <input
                        className={S.inputSoft}
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.unit_price_override == null ? "" : line.unit_price_override}
                        placeholder={`${base}`}
                        onChange={(e) => {
                          const v = e.target.value;
                          updateOverride(line.product_id, v === "" ? null : Number(v));
                        }}
                        title="Leave blank to use default product price"
                      />
                      <div className="text-xs font-bold text-zinc-500 text-right">
                        {fmtMoney(lineTotal)}
                      </div>
                    </div>

                    <button
                      className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm font-black hover:bg-zinc-50"
                      onClick={() => removeLine(line.product_id)}
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}

              {cart.length === 0 ? (
                <div className="px-4 py-8 text-sm text-zinc-500">
                  Cart is empty. Click a product to add.
                </div>
              ) : null}
            </div>

            {/* totals */}
            <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="flex items-center justify-between text-sm text-zinc-600">
                <span>Subtotal (base prices)</span>
                <span className="font-black text-zinc-900">{fmtMoney(totals.subtotal)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm text-zinc-600">
                <span>Discounts</span>
                <span className="font-black text-amber-700">-{fmtMoney(totals.discountTotal)}</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-lg">
                <span className="font-black text-zinc-900">Total</span>
                <span className="font-black text-zinc-900">{fmtMoney(totals.total)}</span>
              </div>

              <button
                className={`${S.btnPrimary} mt-4 w-full`}
                onClick={completeSale}
                disabled={saving || cart.filter((x) => x.qty > 0).length === 0}
              >
                {saving ? "Completing…" : "Complete Sale"}
              </button>

              <div className="mt-2 text-xs text-zinc-500">
                Strict mode: cannot sell more than available stock (enforced in DB).
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
