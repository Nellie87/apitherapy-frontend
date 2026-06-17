"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import { listSales, type SaleRowWithItems } from "@/lib/api/sales";
import * as S from "./page.styles";

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

  if (!base) return qty || "Unknown";
  if (!qty) return base;
  return `${base} ${qty}`;
}

function fmtDate(d: string) {
  try {
    return new Date(d).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

function fmtTime(d: string) {
  try {
    return new Date(d).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function isToday(d: string) {
  const date = new Date(d);
  const now = new Date();
  return date.toDateString() === now.toDateString();
}

function isThisWeek(d: string) {
  const date = new Date(d);
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return date >= weekAgo;
}

function isThisMonth(d: string) {
  const date = new Date(d);
  const now = new Date();

  return (
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
}

function paymentPill(method?: string | null) {
  const key = (method ?? "").toLowerCase();

  if (key === "cash") {
    return "border-green-200 bg-green-50 text-green-700";
  }

  if (key === "mpesa") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (key === "card") {
    return "border-purple-200 bg-purple-50 text-purple-700";
  }

  if (key === "credit") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

/* ─────────────────────────────────────────────
   Components
───────────────────────────────────────────── */
function StatCard({
  label,
  value,
  sub,
  variant = "neutral",
}: {
  label: string;
  value: string;
  sub: string;
  variant?: "neutral" | "success" | "warning";
}) {
  const cfg = {
    neutral: {
      border: "#EADFC2",
      bg: "#FFFFFF",
      valueColor: "#1F2937",
      subColor: "#64748B",
    },
    success: {
      border: "#BBF7D0",
      bg: "#FBFEFC",
      valueColor: "#166534",
      subColor: "#16A34A",
    },
    warning: {
      border: "#FDE68A",
      bg: "#FFFDF5",
      valueColor: "#92400E",
      subColor: "#B45309",
    },
  }[variant];

  return (
    <div
      className="rounded-[24px] p-5 transition hover:-translate-y-0.5"
      style={{
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        boxShadow: "0 12px 30px rgba(92,64,16,0.055)",
      }}
    >
      <div
        className="text-[11px] font-black uppercase tracking-[0.18em]"
        style={{ color: cfg.subColor }}
      >
        {label}
      </div>

      <div
        className="mt-3 text-[28px] font-black leading-none tracking-tight"
        style={{ color: cfg.valueColor }}
      >
        {value}
      </div>

      <div className="mt-2 text-xs font-medium" style={{ color: cfg.subColor }}>
        {sub}
      </div>
    </div>
  );
}

interface ProductPreview {
  list: { name: string; qty: number }[];
  totalQty: number;
}

function saleProductsPreview(sale: any): ProductPreview {
  const items = (sale.sale_items ?? []) as any[];
  const map = new Map<string, { name: string; qty: number }>();

  for (const it of items) {
    const p = Array.isArray(it.products) ? it.products[0] : it.products;
    const name = p ? formatProductDisplayName(p) : "Unknown";
    const qty = Number(it.qty ?? 0);

    if (qty <= 0 || name === "Unknown") continue;

    const prev = map.get(name);
    if (prev) prev.qty += qty;
    else map.set(name, { name, qty });
  }

  const list = Array.from(map.values());
  const totalQty = list.reduce((s, x) => s + x.qty, 0);

  return { list, totalQty };
}

type DateFilter = "all" | "today" | "week" | "month" | "custom";

/* ─────────────────────────────────────────────
   Page
───────────────────────────────────────────── */
export default function SalesPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [rows, setRows] = useState<SaleRowWithItems[]>([]);
  const [q, setQ] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [customDate, setCustomDate] = useState<string>("");
  const [err, setErr] = useState("");

  async function refresh(o: string) {
    try {
      const data = await listSales(o);
      setRows(data || []);
    } catch (e: any) {
      setErr(e.message ?? "Failed to load sales.");
      console.error(e);
    }
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

  const handleFilterChange = useCallback((newFilter: DateFilter) => {
    setDateFilter(newFilter);
    if (newFilter !== "custom") setCustomDate("");
  }, []);

  const handleDatePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomDate(val);
    if (val) setDateFilter("custom");
  };

  const filtered = useMemo(() => {
    let result = rows;

    if (dateFilter === "today") {
      result = result.filter((s) => isToday(s.created_at));
    } else if (dateFilter === "week") {
      result = result.filter((s) => isThisWeek(s.created_at));
    } else if (dateFilter === "month") {
      result = result.filter((s) => isThisMonth(s.created_at));
    } else if (dateFilter === "custom" && customDate) {
      const target = new Date(customDate);
      target.setHours(0, 0, 0, 0);

      const nextDay = new Date(target);
      nextDay.setDate(nextDay.getDate() + 1);

      result = result.filter((s) => {
        const d = new Date(s.created_at);
        return d >= target && d < nextDay;
      });
    }

    const t = q.trim().toLowerCase();

    if (t) {
      result = result.filter((s) => {
        const saleNoMatch = s.sale_no.toLowerCase().includes(t);
        const customerMatch = (s.customer_name ?? "").toLowerCase().includes(t);

        let productMatch = false;

        if (Array.isArray((s as any).sale_items)) {
          productMatch = (s as any).sale_items.some((item: any) => {
            const prod = Array.isArray(item.products)
              ? item.products[0]
              : item.products;

            return prod?.name && String(prod.name).toLowerCase().includes(t);
          });
        }

        return saleNoMatch || customerMatch || productMatch;
      });
    }

    return result;
  }, [rows, q, dateFilter, customDate]);

  const kpis = useMemo(
    () => ({
      totalSales: rows.length,
      totalRevenue: rows.reduce((sum, r) => sum + Number(r.total ?? 0), 0),
      totalDiscounts: rows.reduce(
        (sum, r) => sum + Number(r.discount_total ?? 0),
        0
      ),
      todaySales: rows.filter((r) => isToday(r.created_at)).length,
      todayRevenue: rows
        .filter((r) => isToday(r.created_at))
        .reduce((sum, r) => sum + Number(r.total ?? 0), 0),
    }),
    [rows]
  );

  const avgSale = kpis.totalSales > 0 ? kpis.totalRevenue / kpis.totalSales : 0;

  const DATE_FILTERS: { key: DateFilter; label: string }[] = [
    { key: "all", label: "All time" },
    { key: "today", label: "Today" },
    { key: "week", label: "This week" },
    { key: "month", label: "This month" },
  ];

  const GRID = "1.2fr 1.7fr 1.1fr 0.9fr 0.7fr 0.9fr";

  if (!orgId && !err) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-sm font-semibold text-slate-400">
          Loading sales...
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {err && (
        <div className={S.alert}>
          <span className="flex-1">{err}</span>
          <button
            onClick={() => setErr("")}
            className="ml-auto shrink-0 text-xs font-bold text-red-500 hover:text-red-700"
          >
            Close
          </button>
        </div>
      )}

      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
     

        <Link href="/dashboard/sales/new" className={S.btnPrimary}>
          New Sale
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Sales"
          value={String(kpis.totalSales)}
          sub="all transactions"
        />
        <StatCard
          label="Total Revenue"
          value={fmtMoney(kpis.totalRevenue)}
          sub="gross income"
          variant="success"
        />
        <StatCard
          label="Average Sale"
          value={fmtMoney(avgSale)}
          sub="per transaction"
        />
        <StatCard
          label="Discounts Given"
          value={fmtMoney(kpis.totalDiscounts)}
          sub="total reductions"
          variant="warning"
        />
      </div>

      {kpis.todaySales > 0 && (
        <div className="flex flex-col gap-3 rounded-[24px] border border-green-200 bg-green-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-black text-green-800">Today so far</div>
            <div className="mt-1 text-sm text-green-700">
              <span className="font-bold">{kpis.todaySales}</span> sale
              {kpis.todaySales !== 1 ? "s" : ""} ·{" "}
              <span className="font-bold">{fmtMoney(kpis.todayRevenue)}</span>{" "}
              revenue
            </div>
          </div>

          <button
            onClick={() => setDateFilter("today")}
            className="w-fit rounded-full border border-green-200 bg-white px-3 py-1.5 text-xs font-bold text-green-700 transition hover:bg-green-100"
          >
            View today
          </button>
        </div>
      )}

      <div className={S.card}>
        <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <label className="relative min-w-[220px] flex-1">
              <input
                className={S.input}
                placeholder="Search sale number, customer, or product..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />

              {q && (
                <button
                  onClick={() => setQ("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-700"
                >
                  Clear
                </button>
              )}
            </label>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center xl:justify-end">
              <div className="flex w-full gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1 sm:w-auto">
                {DATE_FILTERS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => handleFilterChange(key)}
                    className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold transition ${
                      dateFilter === key
                        ? "bg-slate-950 text-white shadow-sm"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <input
                type="date"
                value={customDate}
                onChange={handleDatePick}
                className="rounded-2xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-700 outline-none transition hover:border-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />

              <span className="text-xs font-semibold text-slate-400">
                {filtered.length} / {rows.length} sale
                {rows.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>

        <div
          className="hidden items-center gap-4 px-5 py-3 lg:grid"
          style={{ gridTemplateColumns: GRID }}
        >
          {["Sale No", "Customer & Items", "Date", "Payment", "Items", "Total"].map(
            (h) => (
              <div
                key={h}
                className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400"
              >
                {h}
              </div>
            )
          )}
        </div>

        <div className="divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <div className="px-5 py-20 text-center">
              <p className="font-bold text-slate-700">
                {rows.length === 0
                  ? "No sales yet"
                  : dateFilter !== "all" || customDate
                    ? "No sales for selected period"
                    : "No matching sales"}
              </p>

              <p className="mt-1 text-sm text-slate-400">
                {rows.length === 0 ? (
                  "Create your first sale to get started"
                ) : dateFilter !== "all" || customDate ? (
                  <button
                    onClick={() => {
                      handleFilterChange("all");
                      setCustomDate("");
                    }}
                    className="font-semibold text-slate-700 hover:text-slate-950"
                  >
                    View all sales
                  </button>
                ) : (
                  "Try adjusting your search"
                )}
              </p>
            </div>
          ) : (
            filtered.map((s) => {
              const pv = saleProductsPreview(s);
              const itemCount = (s as any).sale_items?.length ?? null;

              return (
                <Link
                  key={s.id}
                  href={`/dashboard/sales/${s.id}`}
                  className="group block transition-colors hover:bg-[#FFFDF8] focus:bg-[#FFFDF8] focus:outline-none"
                >
                  <div
                    className="hidden items-center gap-4 px-5 py-4 lg:grid"
                    style={{ gridTemplateColumns: GRID }}
                  >
                    <div className="min-w-0">
                      <span className="font-bold text-slate-950 text-sm truncate group-hover:text-slate-700">
                        {s.sale_no}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <div className="truncate text-sm text-slate-600">
                        {s.customer_name || (
                          <span className="italic text-slate-400">Walk-in</span>
                        )}
                      </div>

                      {s.recorded_by_name?.trim() && (
                        <div className="mt-1 truncate text-[11px] text-slate-400">
                          Recorded by {s.recorded_by_name.trim()}
                        </div>
                      )}

                      {pv.list.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {pv.list.slice(0, 3).map((x) => (
                            <span
                              key={x.name}
                              className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600"
                            >
                              {x.qty}× {x.name}
                            </span>
                          ))}

                          {pv.list.length > 3 && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                              +{pv.list.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="text-sm font-semibold text-slate-700">
                        {fmtDate(s.created_at)}
                      </div>
                      <div className="text-xs text-slate-400">
                        {fmtTime(s.created_at)}
                      </div>
                    </div>

                    <div>
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${paymentPill(
                          s.payment_method
                        )}`}
                      >
                        {s.payment_method || "—"}
                      </span>
                    </div>

                    <div className="text-sm text-slate-600">
                      {itemCount !== null ? (
                        <span className="font-semibold">{itemCount}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-black text-slate-950">
                        {fmtMoney(Number(s.total ?? 0))}
                      </div>

                      {Number(s.discount_total ?? 0) > 0 && (
                        <div className="text-xs font-semibold text-amber-600">
                          -{fmtMoney(Number(s.discount_total))} off
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="px-5 py-4 lg:hidden">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-black text-slate-950">
                          {s.sale_no}
                        </div>

                        <div className="mt-0.5 text-xs text-slate-500">
                          {s.customer_name || <span className="italic">Walk-in</span>} ·{" "}
                          {fmtDate(s.created_at)}
                        </div>

                        {s.recorded_by_name?.trim() && (
                          <div className="mt-1 text-[11px] text-slate-400">
                            By {s.recorded_by_name.trim()}
                          </div>
                        )}
                      </div>

                      <div className="shrink-0 text-right">
                        <div className="font-black text-slate-950">
                          {fmtMoney(Number(s.total ?? 0))}
                        </div>

                        {Number(s.discount_total ?? 0) > 0 && (
                          <div className="text-xs font-semibold text-amber-600">
                            -{fmtMoney(Number(s.discount_total))}
                          </div>
                        )}
                      </div>
                    </div>

                    {pv.list.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {pv.list.slice(0, 2).map((x) => (
                          <span
                            key={x.name}
                            className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600"
                          >
                            {x.qty}× {x.name}
                          </span>
                        ))}

                        {pv.list.length > 2 && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                            +{pv.list.length - 2} more
                          </span>
                        )}
                      </div>
                    )}

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${paymentPill(
                          s.payment_method
                        )}`}
                      >
                        {s.payment_method || "—"}
                      </span>

                      <span className="text-xs font-semibold text-slate-500">
                        {itemCount !== null
                          ? `${itemCount} item${itemCount !== 1 ? "s" : ""}`
                          : "—"}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>

        {filtered.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs text-slate-400">
              Showing {filtered.length} of {rows.length} sale
              {rows.length !== 1 ? "s" : ""}
            </span>

            <span className="text-xs font-semibold text-slate-600">
              Subtotal:{" "}
              <span className="text-slate-950">
                {fmtMoney(filtered.reduce((s, r) => s + Number(r.total ?? 0), 0))}
              </span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
