"use client";

import { useParams } from "next/navigation";
import React, { useEffect, useState } from "react";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import { getSale, listSaleItems } from "@/lib/api/sales";

function fmtMoney(v: number) {
  return `Ksh ${Number(v || 0).toFixed(2)}`;
}

function fmtDate(val: string) {
  if (!val) return "—";
  return new Date(val).toLocaleString("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function SaleDetailsPage() {
  const params = useParams<{ saleId: string }>();
  const saleId = params?.saleId;

  const [orgId, setOrgId] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [sale, setSale] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const o = await bootstrapOrg();
        setOrgId(o);
      } catch (e: any) {
        setErr(e.message ?? String(e));
      }
    })();
  }, []);

  useEffect(() => {
    if (!orgId || !saleId) return;
    (async () => {
      try {
        const s = await getSale(orgId, saleId);
        const its = await listSaleItems(orgId, saleId);
        setSale(s);
        setItems(its);
      } catch (e: any) {
        setErr(e.message ?? String(e));
      }
    })();
  }, [orgId, saleId]);

  if (err) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-5 py-4">
          <span className="text-rose-400">⚠</span>
          <p className="text-sm font-medium text-rose-700">{err}</p>
        </div>
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-zinc-400">Loading…</p>
      </div>
    );
  }

  // Compute totals from items
  const subtotal = items.reduce((acc, i) => {
    const base = Number(i.products?.unit_price ?? i.unit_price ?? 0);
    return acc + base * Number(i.qty ?? 0);
  }, 0);

  const total = items.reduce((acc, i) => {
    const price = Number(i.unit_price_override ?? i.products?.unit_price ?? i.unit_price ?? 0);
    return acc + price * Number(i.qty ?? 0);
  }, 0);

  const discount = subtotal - total;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black tracking-tight text-zinc-900">
                {sale.sale_no}
              </h1>
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
                Completed
              </span>
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              {fmtDate(sale.created_at ?? sale.date)}
            </p>
          </div>

          <a
            href="/dashboard/sales"
            className="inline-flex items-center rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors self-start"
          >
            ← Back to Sales
          </a>
        </div>

        {/* Meta row */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetaCell label="Customer" value={sale.customer_name || "Walk-in"} />
          <MetaCell label="Items" value={`${items.length} line${items.length !== 1 ? "s" : ""}`} />
          <MetaCell label="Total" value={fmtMoney(total)} highlight />
          {discount > 0 && (
            <MetaCell label="Savings" value={`−${fmtMoney(discount)}`} amber />
          )}
        </div>
      </div>

      {/* Items table */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-zinc-100 px-5 py-4">
          <h2 className="text-sm font-bold text-zinc-900">Line Items</h2>
        </div>

        {/* Table header */}
        <div
          className="grid gap-3 border-b border-zinc-100 px-5 py-2.5"
          style={{ gridTemplateColumns: "1fr 5rem 7rem 7rem" }}
        >
          {["Product", "Qty", "Unit Price", "Total"].map((h) => (
            <div
              key={h}
              className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 last:text-right"
            >
              {h}
            </div>
          ))}
        </div>

        {/* Rows */}
        <div className="divide-y divide-zinc-100">
          {items.map((item) => {
            const basePrice = Number(
              item.products?.unit_price ?? item.unit_price ?? 0
            );
            const finalPrice = Number(
              item.unit_price_override ?? item.products?.unit_price ?? item.unit_price ?? 0
            );
            const qty = Number(item.qty ?? 0);
            const lineTotal = finalPrice * qty;
            const isDiscounted =
              item.unit_price_override != null && finalPrice !== basePrice;

            return (
              <div
                key={item.id}
                className="grid items-center gap-3 px-5 py-4"
                style={{ gridTemplateColumns: "1fr 5rem 7rem 7rem" }}
              >
                {/* Product name */}
                <div>
                  <p className="text-sm font-semibold text-zinc-900">
                    {item.products?.name ?? "Unknown product"}
                  </p>
                  {item.products?.sku && (
                    <p className="mt-0.5 text-xs text-zinc-400">
                      SKU: {item.products.sku}
                    </p>
                  )}
                </div>

                {/* Qty */}
                <div className="text-sm font-semibold text-zinc-700">{qty}</div>

                {/* Unit price */}
                <div>
                  <p className="text-sm font-semibold text-zinc-900">
                    {fmtMoney(finalPrice)}
                  </p>
                  {isDiscounted && (
                    <p className="mt-0.5 text-xs text-zinc-400 line-through">
                      {fmtMoney(basePrice)}
                    </p>
                  )}
                </div>

                {/* Line total */}
                <div className="text-right">
                  <p className="text-sm font-bold text-zinc-900">
                    {fmtMoney(lineTotal)}
                  </p>
                  {isDiscounted && (
                    <p className="mt-0.5 text-xs font-semibold text-amber-600">
                      −{fmtMoney((basePrice - finalPrice) * qty)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}

          {items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-zinc-400">No items found for this sale.</p>
            </div>
          )}
        </div>

        {/* Footer totals */}
        <div className="border-t border-zinc-200 bg-zinc-50/70 px-5 py-4">
          <div className="ml-auto max-w-xs space-y-2">
            <div className="flex justify-between text-sm text-zinc-500">
              <span>Subtotal</span>
              <span className="font-semibold text-zinc-700">{fmtMoney(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Discounts</span>
                <span className="font-semibold text-amber-600">−{fmtMoney(discount)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-zinc-200 pt-2">
              <span className="text-base font-bold text-zinc-900">Total</span>
              <span className="text-lg font-black text-zinc-900">{fmtMoney(total)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetaCell({
  label,
  value,
  highlight,
  amber,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  amber?: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{label}</p>
      <p
        className={`mt-1 text-sm font-bold truncate ${
          highlight
            ? "text-zinc-900"
            : amber
            ? "text-amber-600"
            : "text-zinc-700"
        }`}
      >
        {value}
      </p>
    </div>
  );
}