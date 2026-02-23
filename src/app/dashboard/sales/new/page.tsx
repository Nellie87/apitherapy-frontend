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
  const [orgId,    setOrgId]    = useState<string | null>(null);
  const [rows,     setRows]     = useState<SellableRow[]>([]);
  const [cart,     setCart]     = useState<CartLine[]>([]);
  const [q,        setQ]        = useState("");
  const [customer, setCustomer] = useState("");
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState("");

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
        const name    = (r.products?.name    ?? "").toLowerCase();
        const sku     = (r.products?.sku     ?? "").toLowerCase();
        const barcode = (r.products?.barcode ?? "").toLowerCase();
        return name.includes(t) || sku.includes(t) || barcode.includes(t);
      })
      .slice(0, 24);
  }, [rows, q]);

  function addToCart(r: SellableRow & { products: NonNullable<SellableRow["products"]> }) {
    setCart((prev) => {
      const existing  = prev.find((x) => x.product_id === r.product_id);
      const available = Number(r.qty_on_hand ?? 0);
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

  useEffect(() => {
    const map = new Map(rows.map((r) => [r.product_id, Number(r.qty_on_hand ?? 0)]));
    setCart((prev) =>
      prev.map((x) => {
        const available = map.get(x.product_id) ?? x.available;
        return { ...x, available, qty: Math.min(x.qty, available) };
      })
    );
  }, [rows]);

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

    if (items.length === 0) { setErr("Cart is empty."); return; }
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
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem", padding: "6rem 0", fontFamily: "'DM Sans', sans-serif" }}>
        <span style={{ fontSize: "2.5rem", animation: "floatBee 3s ease-in-out infinite" }}>🐝</span>
        <p style={{ fontSize: "0.82rem", color: "#999977", letterSpacing: "0.06em" }}>Preparing your hive…</p>
      </div>
    );
  }

  const cartItemCount  = cart.filter((x) => x.qty > 0).length;
  const hasCustomer    = customer.trim().length > 0;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=DM+Sans:wght@300;400;500&display=swap');

        .new-sale-page * { font-family: 'DM Sans', sans-serif; }

        /* ── customer banner ── */
        .customer-banner {
          display: flex; align-items: center; gap: 1.1rem;
          padding: 1rem 1.5rem;
          border-radius: 2px;
          border: 1.5px solid;
          transition: background 0.35s, border-color 0.35s;
          cursor: text;
        }
        .customer-banner.empty {
          background: #FFFBEA;
          border-color: rgba(245,197,24,0.45);
        }
        .customer-banner.filled {
          background: #1a1a0a;
          border-color: #1a1a0a;
        }
        .customer-avatar {
          width: 44px; height: 44px; flex-shrink: 0;
          border-radius: 2px;
          display: grid; place-items: center;
          font-size: 1.2rem;
          transition: background 0.35s, border-color 0.35s;
          border: 2px solid;
        }
        .customer-banner.empty .customer-avatar  { background: rgba(245,197,24,0.18); border-color: rgba(245,197,24,0.35); }
        .customer-banner.filled .customer-avatar { background: #F5C518; border-color: #F5C518; box-shadow: 2px 2px 0 rgba(255,255,255,0.12); }
        .customer-label {
          font-size: 0.6rem; font-weight: 500; letter-spacing: 0.22em;
          text-transform: uppercase; margin-bottom: 0.25rem;
          transition: color 0.35s;
        }
        .customer-banner.empty  .customer-label { color: #999977; }
        .customer-banner.filled .customer-label { color: rgba(245,197,24,0.55); }
        .customer-input {
          width: 100%; background: transparent; border: none; outline: none;
          font-family: 'Playfair Display', serif;
          font-size: 1.2rem; font-weight: 700;
          transition: color 0.35s, caret-color 0.35s;
        }
        .customer-banner.empty  .customer-input { color: #92700a; caret-color: #92700a; }
        .customer-banner.filled .customer-input { color: #F5C518; caret-color: #F5C518; }
        .customer-input::placeholder { color: #c9a84c; opacity: 1; }
        .customer-banner.filled .customer-input::placeholder { color: rgba(245,197,24,0.3); }
        .customer-chip {
          flex-shrink: 0; font-size: 0.66rem; font-weight: 500;
          letter-spacing: 0.1em; text-transform: uppercase;
          padding: 0.28rem 0.85rem; border-radius: 50px;
          transition: background 0.35s, color 0.35s;
        }
        .customer-banner.empty  .customer-chip { background: rgba(26,26,10,0.07); color: #bbb; }
        .customer-banner.filled .customer-chip { background: rgba(245,197,24,0.14); color: #F5C518; }

        /* ── product rows ── */
        .prod-row { width: 100%; text-align: left; border: none; background: none; cursor: pointer; transition: background 0.15s; }
        .prod-row:hover:not(:disabled) { background: #FFFBEA; }
        .prod-row.in-cart { background: #FFF9DC; }
        .prod-row.in-cart:hover { background: #FFF3B0; }
        .prod-row:disabled { opacity: 0.38; cursor: not-allowed; }

        /* ── cart rows ── */
        .cart-row { transition: background 0.15s; }
        .cart-row:hover { background: #FFFBEA; }
        .cart-row.over-qty { background: #fff5f5; }

        /* ── remove btn ── */
        .remove-btn { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 2px; border: none; background: none; color: #ccc; cursor: pointer; transition: all 0.15s; font-size: 0.75rem; }
        .remove-btn:hover { background: #fff0f0; color: #e05050; }

        /* ── customer echo in cart footer ── */
        .sale-for-chip {
          display: flex; align-items: center; gap: 0.5rem;
          padding: 0.45rem 0.75rem; margin-bottom: 0.85rem;
          background: rgba(26,26,10,0.05); border-radius: 2px;
          border: 1px solid rgba(26,26,10,0.08);
        }

        @keyframes floatBee {
          0%, 100% { transform: translateY(0) rotate(-4deg); }
          50%       { transform: translateY(-10px) rotate(4deg); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner { animation: spin 0.7s linear infinite; }

        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>

      <div className="new-sale-page space-y-4">

        {/* ══ CUSTOMER BANNER — full width, first thing you see ══ */}
        <div
          className={`customer-banner ${hasCustomer ? "filled" : "empty"}`}
          onClick={() => (document.getElementById("customer-input") as HTMLInputElement)?.focus()}
        >
          <div className="customer-avatar">👤</div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="customer-label">Selling to</div>
            <input
              id="customer-input"
              className="customer-input"
              placeholder="Customer name…"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
            />
          </div>

          <div className="customer-chip">
            {hasCustomer ? "✓ Set" : "Optional"}
          </div>
        </div>

        {/* ══ HEADER — title + search + actions ══ */}
        <div className={`${S.card} px-6 py-5`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.5rem", fontWeight: 700, color: "#1a1a0a", lineHeight: 1.2 }}>
                New <em style={{ fontStyle: "italic", color: "#3a7d44" }}>sale</em>
              </h1>
              <p style={{ fontSize: "0.78rem", color: "#999977", marginTop: "0.25rem" }}>
                Select products · set quantities · complete transaction
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
              <a className={S.btnGhost} href="/dashboard/sales">← Back</a>
              <button
                className={S.btnPrimary}
                onClick={completeSale}
                disabled={saving || cartItemCount === 0}
              >
                {saving ? (
                  <>
                    <svg className="spinner" width="13" height="13" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                      <path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Processing…
                  </>
                ) : <>Complete{cartItemCount > 0 ? ` (${cartItemCount})` : ""} →</>}
              </button>
            </div>
          </div>

          {/* Search — full width, customer is already above */}
          <div style={{ marginTop: "1rem" }}>
            <label style={{ display: "block", fontSize: "0.62rem", fontWeight: 500, letterSpacing: "0.2em", color: "#999977", textTransform: "uppercase", marginBottom: "0.4rem" }}>
              Search Products
            </label>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: "0.85rem", top: "50%", transform: "translateY(-50%)", opacity: 0.35, fontSize: "0.85rem", pointerEvents: "none" }}>🔍</span>
              <input
                className={S.input}
                style={{ paddingLeft: "2.2rem" }}
                placeholder="Name, SKU, or barcode…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>
        </div>

        {/* ══ ERROR ══ */}
        {err && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", borderRadius: 2, border: "1px solid #fecaca", background: "#fff5f5", padding: "0.85rem 1rem" }}>
            <span style={{ color: "#e05050", flexShrink: 0 }}>⚠</span>
            <p style={{ fontSize: "0.85rem", color: "#c0392b" }}>{err}</p>
          </div>
        )}

        {/* ══ SPLIT PANEL ══ */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.2rem" }}>

          {/* ── LEFT: PRODUCTS ── */}
          <div className={`${S.card} overflow-hidden`} style={{ display: "flex", flexDirection: "column", maxHeight: "66vh" }}>
            <div style={{ padding: "0.9rem 1.25rem", borderBottom: "1.5px solid rgba(245,197,24,0.2)", background: "#FFFEF5", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1rem", fontWeight: 700, color: "#1a1a0a" }}>Products</div>
              <span className={`${S.badge} bg-[#FFF9DC] text-[#92700a]`} style={{ fontSize: "0.66rem" }}>
                {productList.length} shown
              </span>
            </div>

            <div style={{ overflowY: "auto", flex: 1 }}>
              {productList.filter(hasProduct).length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "4rem 1.5rem", textAlign: "center", gap: "0.6rem" }}>
                  <span style={{ fontSize: "2rem" }}>🔍</span>
                  <p style={{ fontSize: "0.82rem", color: "#999977" }}>No products match your search</p>
                </div>
              ) : productList.filter(hasProduct).map((r) => {
                const p          = r.products;
                const available  = Number(r.qty_on_hand ?? 0);
                const outOfStock = available <= 0;
                const inCart     = cart.some((x) => x.product_id === r.product_id);

                return (
                  <button
                    key={r.product_id}
                    className={`prod-row ${inCart ? "in-cart" : ""}`}
                    style={{ padding: "0.85rem 1.25rem", borderBottom: "1px solid rgba(26,26,10,0.05)" }}
                    onClick={() => !outOfStock && addToCart(r)}
                    disabled={outOfStock}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span style={{ fontSize: "0.88rem", fontWeight: 500, color: "#1a1a0a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {p.name}
                          </span>
                          {inCart && (
                            <span className={`${S.badge} bg-[#FFF9DC] text-[#92700a]`} style={{ flexShrink: 0, fontSize: "0.62rem" }}>
                              ✓ In cart
                            </span>
                          )}
                        </div>
                        {(p.sku || p.barcode) && (
                          <p style={{ fontSize: "0.72rem", color: "#bbb", marginTop: "0.15rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {[p.sku && `SKU: ${p.sku}`, p.barcode && `# ${p.barcode}`].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "0.95rem", fontWeight: 700, color: "#1a1a0a" }}>
                          {fmtMoney(Number(p.unit_price ?? 0))}
                        </div>
                        <div style={{ fontSize: "0.7rem", color: outOfStock ? "#e05050" : "#999977", marginTop: "0.1rem" }}>
                          {outOfStock ? "Out of stock" : `${available} avail.`}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── RIGHT: CART ── */}
          <div className={`${S.card} overflow-hidden`} style={{ display: "flex", flexDirection: "column", maxHeight: "66vh" }}>
            <div style={{ padding: "0.9rem 1.25rem", borderBottom: "1.5px solid rgba(245,197,24,0.2)", background: "#FFFEF5", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1rem", fontWeight: 700, color: "#1a1a0a" }}>
                Cart
                {cart.length > 0 && (
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.78rem", fontWeight: 300, color: "#999977", marginLeft: "0.5rem" }}>
                    {cart.length} item{cart.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <button
                className={S.btnDanger}
                onClick={() => setCart([])}
                disabled={cart.length === 0}
                style={{ padding: "0.3rem 0.8rem", fontSize: "0.75rem" }}
              >
                Clear all
              </button>
            </div>

            <div style={{ overflowY: "auto", flex: 1 }}>
              {cart.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "4rem 1.5rem", textAlign: "center", gap: "0.6rem" }}>
                  <span style={{ fontSize: "2rem" }}>🛒</span>
                  <p style={{ fontSize: "0.85rem", color: "#999977" }}>Cart is empty</p>
                  <p style={{ fontSize: "0.75rem", color: "#bbb" }}>Click a product on the left to add it</p>
                </div>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 72px 72px 32px", gap: "0.5rem", padding: "0.5rem 1.25rem", background: "#FAFAF5", borderBottom: "1px solid rgba(26,26,10,0.05)", fontSize: "0.62rem", fontWeight: 500, letterSpacing: "0.18em", color: "#bbb", textTransform: "uppercase" }}>
                    <div>Item</div>
                    <div style={{ textAlign: "center" }}>Qty</div>
                    <div style={{ textAlign: "center" }}>Price</div>
                    <div />
                  </div>

                  {cart.map((line) => {
                    const base         = Number(line.base_price ?? 0);
                    const final        = line.unit_price_override == null ? base : Number(line.unit_price_override);
                    const isDiscounted = line.unit_price_override != null && final !== base;
                    const lineTotal    = final * Number(line.qty ?? 0);
                    const overQty      = line.qty > line.available;

                    return (
                      <div
                        key={line.product_id}
                        className={`cart-row ${overQty ? "over-qty" : ""}`}
                        style={{ display: "grid", gridTemplateColumns: "1fr 72px 72px 32px", gap: "0.5rem", alignItems: "start", padding: "0.85rem 1.25rem", borderBottom: "1px solid rgba(26,26,10,0.05)" }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: "0.85rem", fontWeight: 500, color: "#1a1a0a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{line.name}</p>
                          <p style={{ fontSize: "0.7rem", color: "#999977", marginTop: "0.15rem" }}>Base {fmtMoney(base)}</p>
                          <p style={{ fontSize: "0.75rem", color: isDiscounted ? "#3a7d44" : "#555540", fontWeight: isDiscounted ? 500 : 300, marginTop: "0.2rem" }}>
                            = {fmtMoney(lineTotal)}
                            {isDiscounted && <span style={{ marginLeft: "0.3rem", fontSize: "0.65rem", color: "#3a7d44" }}>✓ discount</span>}
                          </p>
                          {overQty && <p style={{ fontSize: "0.68rem", color: "#e05050", marginTop: "0.15rem" }}>⚠ Exceeds stock ({line.available})</p>}
                        </div>

                        <div>
                          <input
                            className={S.inputSoft}
                            style={{ textAlign: "center", padding: "0.4rem 0.3rem", ...(overQty ? { borderColor: "#fca5a5", background: "#fff5f5" } : {}) }}
                            type="number" min={0} max={line.available} value={line.qty}
                            onChange={(e) => updateQty(line.product_id, Number(e.target.value || 0))}
                          />
                          <p style={{ fontSize: "0.62rem", color: "#bbb", textAlign: "center", marginTop: "0.2rem" }}>{line.available} max</p>
                        </div>

                        <div>
                          <input
                            className={S.inputSoft}
                            style={{ textAlign: "right", padding: "0.4rem 0.5rem", ...(isDiscounted ? { borderColor: "#fcd34d", background: "#FFFBEA" } : {}) }}
                            type="number" min={0} step="0.01"
                            value={line.unit_price_override == null ? "" : line.unit_price_override}
                            placeholder={`${base}`}
                            onChange={(e) => {
                              const v = e.target.value;
                              updateOverride(line.product_id, v === "" ? null : Number(v));
                            }}
                            title="Override unit price (leave blank for default)"
                          />
                          <p style={{ fontSize: "0.62rem", color: "#bbb", textAlign: "center", marginTop: "0.2rem" }}>override</p>
                        </div>

                        <button className="remove-btn" onClick={() => removeLine(line.product_id)} title="Remove">✕</button>
                      </div>
                    );
                  })}
                </>
              )}
            </div>

            {/* ── TOTALS FOOTER ── */}
            {cart.length > 0 && (
              <div style={{ borderTop: "1.5px solid rgba(245,197,24,0.25)", background: "#FFFBEA", padding: "1rem 1.25rem", flexShrink: 0 }}>

                {/* Customer echo — confirms who the sale belongs to */}
                {hasCustomer && (
                  <div className="sale-for-chip">
                    <span style={{ fontSize: "0.78rem" }}>👤</span>
                    <span style={{ fontSize: "0.75rem", color: "#999977" }}>Sale for</span>
                    <span style={{ fontSize: "0.82rem", fontWeight: 500, color: "#1a1a0a" }}>{customer}</span>
                  </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", marginBottom: "0.9rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
                    <span style={{ color: "#999977" }}>Subtotal</span>
                    <span style={{ color: "#555540" }}>{fmtMoney(totals.subtotal)}</span>
                  </div>
                  {totals.discountTotal > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
                      <span style={{ color: "#999977" }}>Discounts</span>
                      <span style={{ color: "#3a7d44", fontWeight: 500 }}>−{fmtMoney(totals.discountTotal)}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "0.55rem", borderTop: "1.5px solid #F5C518", marginTop: "0.2rem" }}>
                    <span style={{ fontSize: "0.9rem", fontWeight: 500, color: "#1a1a0a" }}>Total</span>
                    <span style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.4rem", fontWeight: 700, color: "#1a1a0a" }}>
                      {fmtMoney(totals.total)}
                    </span>
                  </div>
                </div>

                <button
                  className={S.btnPrimary}
                  style={{ width: "100%", padding: "0.85rem", fontSize: "0.9rem", justifyContent: "center" }}
                  onClick={completeSale}
                  disabled={saving || cartItemCount === 0}
                >
                  {saving ? (
                    <>
                      <svg className="spinner" width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                        <path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                      Processing…
                    </>
                  ) : "Complete Sale →"}
                </button>

                <p style={{ textAlign: "center", fontSize: "0.68rem", color: "#bbb", marginTop: "0.6rem" }}>
                  Stock is enforced server-side · cannot oversell
                </p>
              </div>
            )}
          </div>
        </div>

      </div>
    </>
  );
}