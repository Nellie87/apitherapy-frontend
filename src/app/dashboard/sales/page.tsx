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
  if (key === "cash") return "bg-emerald-50 text-emerald-700 border border-emerald-200";
  if (key === "mpesa") return "bg-sky-50 text-sky-700 border border-sky-200";
  if (key === "card") return "bg-violet-50 text-violet-700 border border-violet-200";
  if (key === "credit") return "bg-amber-50 text-amber-700 border border-amber-200";
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
    className="text-slate-400"
  >
    <circle cx="9" cy="9" r="5.5" />
    <line x1="13.5" y1="13.5" x2="18" y2="18" />
  </svg>
);

const IconTrend = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 17 9 11 13 15 21 7" />
    <polyline points="14 7 21 7 21 14" />
  </svg>
);

const IconReceipt = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M8 3h8l3 3v15l-3-2-2 2-2-2-2 2-2-2-3 2V6l3-3z" />
    <path d="M9 9h6" />
    <path d="M9 13h6" />
  </svg>
);

const IconTag = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 10 10 20l-8-8 10-10h8v8z" />
    <circle cx="16" cy="8" r="1.5" />
  </svg>
);

const IconCoin = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <ellipse cx="12" cy="12" rx="7" ry="9" />
    <path d="M12 7v10" />
    <path d="M9.5 9.5c.7-.8 1.6-1.2 2.7-1.2 1.7 0 2.8.9 2.8 2.2 0 1.2-.7 1.8-2.5 2.2-1.7.4-2.5.9-2.5 2.1 0 1.3 1.2 2.2 2.9 2.2 1.2 0 2.2-.4 3-1.3" />
  </svg>
);

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
  icon: React.ReactNode;
  variant?: "neutral" | "success" | "warning";
}) {
  const cfg = {
    neutral: {
      border: "#E7E5E4",
      bg: "linear-gradient(180deg, #FFFFFF 0%, #FFFCF7 100%)",
      iconBg: "#F8FAFC",
      iconColor: "#475569",
      valueColor: "#0F172A",
      subColor: "#78716C",
      glow: "0 12px 30px rgba(15,23,42,0.05)",
    },
    success: {
      border: "#D1FAE5",
      bg: "linear-gradient(180deg, #FFFFFF 0%, #F7FEFB 100%)",
      iconBg: "#ECFDF5",
      iconColor: "#047857",
      valueColor: "#065F46",
      subColor: "#059669",
      glow: "0 12px 30px rgba(5,150,105,0.08)",
    },
    warning: {
      border: "#FDE68A",
      bg: "linear-gradient(180deg, #FFFFFF 0%, #FFFCF5 100%)",
      iconBg: "#FFFBEB",
      iconColor: "#B45309",
      valueColor: "#92400E",
      subColor: "#B45309",
      glow: "0 12px 30px rgba(217,119,6,0.08)",
    },
  }[variant];

  return (
    <div
      className="rounded-[24px] p-4 transition duration-200 hover:-translate-y-0.5"
      style={{
        border: `1px solid ${cfg.border}`,
        background: cfg.bg,
        boxShadow: cfg.glow,
      }}
    >
      <div className="flex items-start gap-4">
        <div
          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl"
          style={{ background: cfg.iconBg, color: cfg.iconColor }}
        >
          {icon}
        </div>

        <div className="min-w-0">
          <div
            className="text-[11px] font-bold uppercase tracking-[0.18em]"
            style={{ color: cfg.subColor }}
          >
            {label}
          </div>
          <div
            className="mt-2 text-[28px] font-bold leading-none tracking-tight"
            style={{ color: cfg.valueColor }}
          >
            {value}
          </div>
          <div className="mt-2 text-xs font-medium" style={{ color: cfg.subColor }}>
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

  const GRID = "1.12fr 1.9fr 1.08fr 0.95fr 0.72fr 0.9fr";

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
    <div
      className="flex flex-col gap-6"
      style={{
        fontFamily:
          'Inter, "DM Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
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

      {/* Header */}
      <div className="overflow-hidden rounded-[28px] border border-amber-100 bg-[linear-gradient(180deg,#FFFDF8_0%,#FFF8EC_100%)] shadow-[0_18px_40px_rgba(217,119,6,0.06)]">
        <div className="h-1 bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300" />
        <div className="flex flex-col gap-4 px-6 py-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white/80 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Sales
            </div>
            <h1
              className="mt-3 text-[34px] font-bold tracking-tight text-slate-900"
              style={{ fontFamily: '"DM Serif Display", Georgia, serif' }}
            >
              Sales History
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Track completed transactions, customer purchases, payments and totals
            </p>
          </div>

          <Link
            href="/dashboard/sales/new"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(15,23,42,0.14)] transition hover:bg-slate-800"
          >
            <span className="text-base leading-none">＋</span>
            New Sale
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Sales"
          value={String(kpis.totalSales)}
          sub="all transactions"
          icon={<IconReceipt />}
          variant="neutral"
        />
        <StatCard
          label="Total Revenue"
          value={fmtMoney(kpis.totalRevenue)}
          sub="gross income"
          icon={<IconTrend />}
          variant="success"
        />
        <StatCard
          label="Average Sale"
          value={fmtMoney(avgSale)}
          sub="per transaction"
          icon={<IconCoin />}
          variant="neutral"
        />
        <StatCard
          label="Discounts Given"
          value={fmtMoney(kpis.totalDiscounts)}
          sub="total reductions"
          icon={<IconTag />}
          variant="warning"
        />
      </div>

      {/* Today Banner */}
      {kpis.todaySales > 0 && (
        <div className="flex items-center gap-4 rounded-[24px] border border-emerald-200 bg-[linear-gradient(180deg,#F7FEFB_0%,#ECFDF5_100%)] px-5 py-4 shadow-[0_12px_26px_rgba(5,150,105,0.06)]">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-100 text-xl shrink-0">
            🌟
          </div>
          <div>
            <div className="font-semibold text-emerald-900">Today so far</div>
            <div className="text-sm text-emerald-700">
              <span className="font-bold">{kpis.todaySales}</span> sale
              {kpis.todaySales !== 1 ? "s" : ""} ·{" "}
              <span className="font-bold">{fmtMoney(kpis.todayRevenue)}</span> revenue
            </div>
          </div>
          <button
            onClick={() => setDateFilter("today")}
            className="ml-auto whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm transition hover:text-emerald-800"
          >
            View today →
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <label className="flex min-w-[220px] flex-1 items-center gap-2.5 rounded-2xl border border-slate-300 bg-slate-50 px-3.5 py-3 transition focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-100">
            <IconSearch />
            <input
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
              placeholder="Sale #, customer or product…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q && (
              <button
                onClick={() => setQ("")}
                className="shrink-0 text-xs text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 p-1">
              {DATE_FILTERS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => handleFilterChange(key)}
                  className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                    dateFilter === key
                      ? "border border-slate-200 bg-white text-slate-900 shadow-sm"
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
              className="rounded-2xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-700 outline-none transition hover:border-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
          </div>

          <span className="ml-auto text-xs font-medium text-slate-400 whitespace-nowrap">
            {filtered.length} / {rows.length} sale{rows.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Table/Card block */}
      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
        <div className="h-1 bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-200" />

        <div
          className="hidden lg:grid items-center gap-4 px-5 py-4"
          style={{
            gridTemplateColumns: GRID,
            background:
              "linear-gradient(180deg, rgba(248,250,252,0.95) 0%, rgba(248,250,252,0.8) 100%)",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          {["Sale No", "Customer & Items", "Date", "Payment", "Items", "Total"].map(
            (h) => (
              <div
                key={h}
                className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500"
              >
                {h}
              </div>
            )
          )}
        </div>

        <div className="divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <div className="py-24 text-center">
              <div className="mb-4 text-5xl">🍯</div>
              <p className="font-semibold text-slate-700">
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
                    className="font-medium text-slate-700 hover:text-slate-900"
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
                  className="group block transition-colors hover:bg-[#FFFCF7] focus:bg-[#FFFCF7] focus:outline-none"
                >
                  {/* Desktop row */}
                  <div
                    className="hidden lg:grid items-center gap-4 px-5 py-4"
                    style={{ gridTemplateColumns: GRID }}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="h-2 w-2 shrink-0 rounded-full bg-amber-400 shadow-[0_0_0_6px_rgba(251,191,36,0.10)]" />
                      <span className="truncate text-sm font-semibold text-slate-900 transition group-hover:text-slate-700">
                        {s.sale_no}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-700 truncate">
                        {s.customer_name || (
                          <span className="italic text-slate-400">Walk-in customer</span>
                        )}
                      </div>

                      {pv.list.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {pv.list.slice(0, 3).map((x) => (
                            <span
                              key={x.name}
                              className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600"
                            >
                              {x.qty}× {x.name}
                            </span>
                          ))}
                          {pv.list.length > 3 && (
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                              +{pv.list.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="text-sm font-medium text-slate-700">
                        {fmtDate(s.created_at)}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-400">
                        {fmtTime(s.created_at)}
                      </div>
                    </div>

                    <div>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${paymentPill(
                          s.payment_method
                        )}`}
                      >
                        {s.payment_method || "—"}
                      </span>
                    </div>

                    <div className="text-sm text-slate-600">
                      {itemCount !== null ? (
                        <span className="font-semibold text-slate-800">{itemCount}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-bold text-slate-900">
                        {fmtMoney(Number(s.total ?? 0))}
                      </div>
                      {Number(s.discount_total ?? 0) > 0 && (
                        <div className="mt-0.5 text-xs font-medium text-amber-600">
                          -{fmtMoney(Number(s.discount_total))} off
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Mobile card */}
                  <div className="lg:hidden px-4 py-4">
                    <div className="rounded-[22px] border border-slate-200 bg-[linear-gradient(180deg,#FFFFFF_0%,#FFFCF8_100%)] p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-amber-400" />
                            <div className="font-semibold text-slate-900 text-sm truncate">
                              {s.sale_no}
                            </div>
                          </div>

                          <div className="mt-1 text-xs text-slate-500">
                            {s.customer_name || <span className="italic">Walk-in customer</span>}
                          </div>

                          <div className="mt-1 text-xs text-slate-400">
                            {fmtDate(s.created_at)} · {fmtTime(s.created_at)}
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
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

                      {pv.list.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {pv.list.slice(0, 2).map((x) => (
                            <span
                              key={x.name}
                              className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600"
                            >
                              {x.qty}× {x.name}
                            </span>
                          ))}
                          {pv.list.length > 2 && (
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                              +{pv.list.length - 2}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="mt-3 flex items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${paymentPill(
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
                  </div>
                </Link>
              );
            })
          )}
        </div>

        {filtered.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-4 text-xs sm:flex-row sm:items-center sm:justify-between">
            <span className="text-slate-400">
              Showing {filtered.length} of {rows.length} sale
              {rows.length !== 1 ? "s" : ""}
            </span>
            <span className="font-semibold text-slate-600">
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