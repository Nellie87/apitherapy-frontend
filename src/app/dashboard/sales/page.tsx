"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import { listSales, type SaleRowWithItems } from "@/lib/api/sales";
import * as S from "./page.styles";
import Link from "next/link";

/* Helpers */
function fmtMoney(v: number) {
  return `Ksh ${Number(v || 0).toLocaleString("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
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
  if (key === "cash") return "bg-green-100 text-green-700";
  if (key === "mpesa") return "bg-blue-100 text-blue-700";
  if (key === "card") return "bg-purple-100 text-purple-700";
  if (key === "credit") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

/* Stat card */
function StatCard({
  label,
  value,
  sub,
  icon,
  variant = "neutral",
}: {
  label: string;
  value: string;
  sub: string;
  icon: string;
  variant?: "neutral" | "success" | "warning";
}) {
  const cfg = {
    neutral: {
      border: "#E2E8F0",
      bg: "#FFFFFF",
      iconBg: "#F8FAFC",
      iconColor: "#475569",
      valueColor: "#0F172A",
      subColor: "#64748B",
    },
    success: {
      border: "#BBF7D0",
      bg: "#FFFFFF",
      iconBg: "#F0FDF4",
      iconColor: "#166534",
      valueColor: "#166534",
      subColor: "#16A34A",
    },
    warning: {
      border: "#FDE68A",
      bg: "#FFFFFF",
      iconBg: "#FFFBEB",
      iconColor: "#B45309",
      valueColor: "#92400E",
      subColor: "#B45309",
    },
  }[variant];

  return (
    <div
      className="rounded-[22px] p-4 bg-white transition hover:-translate-y-0.5"
      style={{
        border: `1.5px solid ${cfg.border}`,
        boxShadow: "0 8px 24px rgba(15,23,42,0.05)",
      }}
    >
      <div className="flex items-center gap-4">
        <div
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-lg"
          style={{ background: cfg.iconBg, color: cfg.iconColor }}
        >
          {icon}
        </div>

        <div className="min-w-0">
          <div
            className="text-[11px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: cfg.subColor }}
          >
            {label}
          </div>
          <div
            className="mt-1 text-[26px] font-bold leading-none"
            style={{ color: cfg.valueColor }}
          >
            {value}
          </div>
          <div className="mt-1 text-xs" style={{ color: cfg.subColor }}>
            {sub}
          </div>
        </div>
      </div>
    </div>
  );
}

/* Product preview */
interface ProductPreview {
  list: { name: string; qty: number }[];
  totalQty: number;
}

function saleProductsPreview(sale: any): ProductPreview {
  const items = (sale.sale_items ?? []) as any[];
  const map = new Map<string, { name: string; qty: number }>();

  for (const it of items) {
    const p = Array.isArray(it.products) ? it.products[0] : it.products;
    const name = p?.name ? String(p.name).trim() : "Unknown";
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
            const prod = Array.isArray(item.products) ? item.products[0] : item.products;
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
        <div className="flex items-center gap-3 text-slate-500">
          <svg
            className="h-5 w-5 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" strokeOpacity="0.2" />
            <path d="M12 2a10 10 0 0110 10" />
          </svg>
          <span className="text-sm font-medium">Loading sales…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {err && (
        <div className={S.alert}>
          <span className="shrink-0 mt-0.5">⚠️</span>
          <span>{err}</span>
          <button
            onClick={() => setErr("")}
            className="ml-auto shrink-0 text-red-400 hover:text-red-600"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-600">
            Sales
          </div>
          <h1 className="mt-3 text-[32px] font-bold text-slate-900 tracking-tight">
            Sales History
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Track completed transactions, payments and totals
          </p>
        </div>

        <Link href="/dashboard/sales/new" className={S.btnPrimary}>
          + New Sale
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Sales"
          value={String(kpis.totalSales)}
          sub="all transactions"
          icon="📋"
          variant="neutral"
        />
        <StatCard
          label="Total Revenue"
          value={fmtMoney(kpis.totalRevenue)}
          sub="gross income"
          icon="📈"
          variant="success"
        />
        <StatCard
          label="Average Sale"
          value={fmtMoney(avgSale)}
          sub="per transaction"
          icon="💰"
          variant="neutral"
        />
        <StatCard
          label="Discounts Given"
          value={fmtMoney(kpis.totalDiscounts)}
          sub="total reductions"
          icon="🏷️"
          variant="warning"
        />
      </div>

      {kpis.todaySales > 0 && (
        <div className="flex items-center gap-4 rounded-2xl border border-green-200 bg-green-50 px-5 py-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-green-100 text-xl shrink-0">
            🌟
          </div>
          <div>
            <div className="font-bold text-green-800">Today so far</div>
            <div className="text-sm text-green-700">
              <span className="font-semibold">{kpis.todaySales}</span> sale
              {kpis.todaySales !== 1 ? "s" : ""} ·{" "}
              <span className="font-semibold">{fmtMoney(kpis.todayRevenue)}</span>{" "}
              revenue
            </div>
          </div>
          <button
            onClick={() => setDateFilter("today")}
            className="ml-auto text-xs font-semibold text-green-700 hover:text-green-800 underline underline-offset-2 whitespace-nowrap"
          >
            View today →
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 shadow-sm focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-100 transition flex-1 min-w-[220px]">
          <svg
            width="15"
            height="15"
            viewBox="0 0 20 20"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="2.2"
          >
            <circle cx="9" cy="9" r="5.5" />
            <line x1="13.5" y1="13.5" x2="18" y2="18" />
          </svg>
          <input
            className="flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 min-w-0"
            placeholder="Sale #, customer or product…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && (
            <button
              onClick={() => setQ("")}
              className="text-slate-400 hover:text-slate-600 shrink-0 text-xs"
            >
              ✕
            </button>
          )}
        </label>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-1">
            {DATE_FILTERS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handleFilterChange(key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  dateFilter === key
                    ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                    : "text-slate-500 hover:text-slate-700"
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
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 cursor-pointer hover:border-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100 outline-none"
          />
        </div>

        <span className="ml-auto text-xs text-slate-400 whitespace-nowrap">
          {filtered.length} / {rows.length} sale{rows.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-white shadow-[0_12px_36px_rgba(15,23,42,0.05)] overflow-hidden">
        <div
          className="hidden lg:grid items-center gap-4 px-5 py-3"
          style={{
            gridTemplateColumns: GRID,
            background: "#f8fafc",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          {["Sale No", "Customer & Items", "Date", "Payment", "Items", "Total"].map(
            (h) => (
              <div
                key={h}
                className="text-xs font-semibold uppercase tracking-wider text-slate-500"
              >
                {h}
              </div>
            )
          )}
        </div>

        <div className="divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <div className="py-20 text-center">
              <div className="text-5xl mb-4">🍯</div>
              <p className="font-semibold text-slate-700">
                {rows.length === 0
                  ? "No sales yet"
                  : dateFilter !== "all" || customDate
                  ? "No sales for selected period"
                  : "No matching sales"}
              </p>
              <p className="text-sm text-slate-400 mt-1">
                {rows.length === 0 ? (
                  "Create your first sale to get started"
                ) : dateFilter !== "all" || customDate ? (
                  <button
                    onClick={() => {
                      handleFilterChange("all");
                      setCustomDate("");
                    }}
                    className="text-slate-700 hover:text-slate-900 font-medium"
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
                  className="group block transition-colors hover:bg-slate-50 focus:outline-none focus:bg-slate-50"
                >
                  <div
                    className="hidden lg:grid items-center gap-4 px-5 py-3.5"
                    style={{ gridTemplateColumns: GRID }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
                      <span className="font-semibold text-slate-900 text-sm truncate group-hover:text-slate-700 transition-colors">
                        {s.sale_no}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <div className="text-sm text-slate-600 truncate">
                        {s.customer_name || (
                          <span className="text-slate-400 italic">Walk-in</span>
                        )}
                      </div>
                      {(s.recorded_by?.full_name || s.recorded_by?.email) && (
                        <div className="mt-1 text-[11px] text-slate-400 truncate">
                          Recorded by{" "}
                          {s.recorded_by?.full_name?.trim() ||
                            s.recorded_by?.email}
                        </div>
                      )}
                      {pv.list.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
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
                      <div className="text-sm text-slate-700 font-medium">
                        {fmtDate(s.created_at)}
                      </div>
                      <div className="text-xs text-slate-400">
                        {fmtTime(s.created_at)}
                      </div>
                    </div>

                    <div>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${paymentPill(
                          s.payment_method
                        )}`}
                      >
                        {s.payment_method || "—"}
                      </span>
                    </div>

                    <div className="text-sm text-slate-600">
                      {itemCount !== null ? (
                        <span className="font-medium">{itemCount}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </div>

                    <div className="text-right">
                      <div className="font-bold text-slate-900 text-sm">
                        {fmtMoney(Number(s.total ?? 0))}
                      </div>
                      {Number(s.discount_total ?? 0) > 0 && (
                        <div className="text-xs text-amber-600 font-medium">
                          -{fmtMoney(Number(s.discount_total))} off
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="lg:hidden px-5 py-4 border-b border-slate-100 last:border-b-0">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0 pr-2">
                        <div className="font-semibold text-slate-900 text-sm">
                          {s.sale_no}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {s.customer_name || <span className="italic">Walk-in</span>} ·{" "}
                          {fmtDate(s.created_at)}
                        </div>
                        {(s.recorded_by?.full_name || s.recorded_by?.email) && (
                          <div className="text-[11px] text-slate-400 mt-1">
                            By{" "}
                            {s.recorded_by?.full_name?.trim() ||
                              s.recorded_by?.email}
                          </div>
                        )}

                        {pv.list.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {pv.list.slice(0, 2).map((x) => (
                              <span
                                key={x.name}
                                className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                              >
                                {x.qty}× {x.name}
                              </span>
                            ))}
                            {pv.list.length > 2 && (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                                +{pv.list.length - 2}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-bold text-slate-900">
                          {fmtMoney(Number(s.total ?? 0))}
                        </div>
                        {Number(s.discount_total ?? 0) > 0 && (
                          <div className="text-xs text-amber-600">
                            -{fmtMoney(Number(s.discount_total))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${paymentPill(
                          s.payment_method
                        )}`}
                      >
                        {s.payment_method || "—"}
                      </span>
                      <span className="text-xs text-slate-500">
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
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
            <span className="text-xs text-slate-400">
              Showing {filtered.length} of {rows.length} sale
              {rows.length !== 1 ? "s" : ""}
            </span>
            <span className="text-xs font-semibold text-slate-600">
              Subtotal:{" "}
              <span className="text-slate-900">
                {fmtMoney(filtered.reduce((s, r) => s + Number(r.total ?? 0), 0))}
              </span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}