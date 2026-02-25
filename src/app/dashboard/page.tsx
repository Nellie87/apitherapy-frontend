"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import { supabase } from "@/lib/supabase/client";
import { getInventoryValuation, reportPnL, type InventoryValuationRow } from "@/lib/api/reports";

type RangePreset = "today" | "7d" | "30d" | "month";

type RecentSale = {
  id: string;
  sale_no: string;
  customer_name: string | null;
  total: number;
  discount_total: number;
  created_at: string;
};

type RecentExpense = {
  id: string;
  category: string;
  amount: number;
  expense_date: string;
  created_at: string;
};

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function startOfMonth(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function fmtMoney(v: number) {
  return `Ksh ${Number(v || 0).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
}

function fmtDateTime(v: string) {
  try {
    return new Date(v).toLocaleString();
  } catch {
    return v;
  }
}

function statusBadge(status: InventoryValuationRow["status"]) {
  if (status === "out") return "bg-rose-50 text-rose-700 border-rose-200";
  if (status === "critical") return "bg-orange-50 text-orange-700 border-orange-200";
  if (status === "low") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-emerald-50 text-emerald-700 border-emerald-200";
}

export default function DashboardPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [preset, setPreset] = useState<RangePreset>("7d");

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [pnl, setPnl] = useState<Awaited<ReturnType<typeof reportPnL>> | null>(null);
  const [inventory, setInventory] = useState<Awaited<ReturnType<typeof getInventoryValuation>> | null>(null);

  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<RecentExpense[]>([]);
  const [activityTab, setActivityTab] = useState<"sales" | "expenses">("sales");

  const range = useMemo(() => {
    const to = new Date();
    const from = new Date(to);

    if (preset === "today") {
      return { from: iso(to), to: iso(to), label: "Today" };
    }
    if (preset === "7d") {
      from.setDate(to.getDate() - 6);
      return { from: iso(from), to: iso(to), label: "Last 7 days" };
    }
    if (preset === "30d") {
      from.setDate(to.getDate() - 29);
      return { from: iso(from), to: iso(to), label: "Last 30 days" };
    }
    // month
    const m = startOfMonth(to);
    return { from: iso(m), to: iso(to), label: "This month" };
  }, [preset]);

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

  async function loadAll() {
    if (!orgId) return;
    setLoading(true);
    setErr("");

    try {
      // 1) P&L snapshot for chosen range (day granularity is fine)
      const pl = await reportPnL(orgId, {
        from: range.from,
        to: range.to,
        granularity: "day",
      });

      // 2) Inventory valuation (for low/out + total value)
      const inv = await getInventoryValuation(orgId);

      // 3) Recent Sales (last 10)
      const { data: sData, error: sErr } = await supabase
        .from("sales")
        .select("id,sale_no,customer_name,total,discount_total,created_at")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (sErr) throw new Error(sErr.message);

      // 4) Recent Expenses (last 10)
      const { data: eData, error: eErr } = await supabase
        .from("expenses")
        .select("id,category,amount,expense_date,created_at")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (eErr) throw new Error(eErr.message);

      setPnl(pl);
      setInventory(inv);
      setRecentSales((sData ?? []) as any);
      setRecentExpenses((eData ?? []) as any);
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!orgId) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, range.from, range.to]);

  const kpis = useMemo(() => {
    const revenue = Number(pnl?.totals?.revenue ?? 0);
    const discounts = Number(pnl?.totals?.discounts ?? 0);
    const expenses = Number(pnl?.totals?.expenses ?? 0);
    const net = Number(pnl?.totals?.net_profit ?? 0);

    const invValue = Number(inventory?.totals?.total_value ?? 0);
    const lowCount = Number(inventory?.totals?.low_count ?? 0);
    const outCount = Number(inventory?.totals?.out_count ?? 0);

    return { revenue, discounts, expenses, net, invValue, lowCount, outCount };
  }, [pnl, inventory]);

  const lowStockRows = useMemo(() => {
    const rows = inventory?.rows ?? [];
    return rows
      .filter((r) => r.status === "out" || r.status === "low" || r.status === "critical")
      .sort((a, b) => {
        const pr = (x: InventoryValuationRow) => (x.status === "out" ? 0 : x.status === "critical" ? 1 : 2);
        return pr(a) - pr(b);
      })
      .slice(0, 8);
  }, [inventory]);

  const salesTrend = useMemo(() => {
    // we already have pnl.points (day) -> use revenue as "sales total" trend
    const pts = pnl?.points ?? [];
    return pts.slice(-14); // keep it compact
  }, [pnl]);

  if (!orgId && !err) return <div className="p-6">Loading…</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-3xl font-black text-zinc-900">Dashboard</div>
            <div className="mt-1 text-sm text-zinc-500">
              {range.label} · Quick overview and actions
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-1">
              {(["today", "7d", "30d", "month"] as RangePreset[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPreset(p)}
                  className={`rounded-xl px-3 py-2 text-xs font-black transition ${
                    preset === p ? "bg-white shadow-sm border border-zinc-200" : "text-zinc-600 hover:bg-white/60"
                  }`}
                >
                  {p === "today" ? "Today" : p === "7d" ? "7D" : p === "30d" ? "30D" : "Month"}
                </button>
              ))}
            </div>

            <button
              onClick={loadAll}
              disabled={loading}
              className="rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-black text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        {/* Quick actions */}
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Link href="/dashboard/sales/new" className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 font-black hover:bg-zinc-50">
            + New Sale
          </Link>
          <Link href="/dashboard/expenses" className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 font-black hover:bg-zinc-50">
            + Add Expense
          </Link>
          <Link href="/dashboard/inventory" className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 font-black hover:bg-zinc-50">
            Inventory
          </Link>
          <Link href="/dashboard/reports" className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 font-black hover:bg-zinc-50">
            Reports
          </Link>
        </div>
      </div>

      {err ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
          {err}
        </div>
      ) : null}

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 md:col-span-2">
          <div className="text-[11px] font-black uppercase tracking-wide text-zinc-500">Revenue</div>
          <div className="mt-3 text-3xl font-black text-zinc-900">{fmtMoney(kpis.revenue)}</div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 md:col-span-2">
          <div className="text-[11px] font-black uppercase tracking-wide text-zinc-500">Net Profit</div>
          <div className={`mt-3 text-3xl font-black ${kpis.net < 0 ? "text-rose-700" : "text-emerald-700"}`}>
            {fmtMoney(kpis.net)}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6">
          <div className="text-[11px] font-black uppercase tracking-wide text-zinc-500">Discounts</div>
          <div className="mt-3 text-2xl font-black text-zinc-900">{fmtMoney(kpis.discounts)}</div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6">
          <div className="text-[11px] font-black uppercase tracking-wide text-zinc-500">Expenses</div>
          <div className="mt-3 text-2xl font-black text-zinc-900">{fmtMoney(kpis.expenses)}</div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 md:col-span-3">
          <div className="text-[11px] font-black uppercase tracking-wide text-zinc-500">Inventory Value</div>
          <div className="mt-3 text-3xl font-black text-zinc-900">{fmtMoney(kpis.invValue)}</div>
          <div className="mt-2 text-sm text-zinc-500">Based on unit price × qty on hand</div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 md:col-span-3">
          <div className="text-[11px] font-black uppercase tracking-wide text-zinc-500">Stock Alerts</div>
          <div className="mt-3 flex items-end gap-6">
            <div>
              <div className="text-3xl font-black text-zinc-900">{kpis.lowCount}</div>
              <div className="text-sm text-zinc-500">Low/Critical</div>
            </div>
            <div>
              <div className="text-3xl font-black text-rose-700">{kpis.outCount}</div>
              <div className="text-sm text-zinc-500">Out of stock</div>
            </div>
          </div>
        </div>
      </div>

      {/* Trend + Low stock */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Trend */}
        <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
          <div className="px-6 py-4">
            <div className="text-lg font-black text-zinc-900">Sales Trend</div>
            <div className="mt-1 text-sm text-zinc-500">Recent periods (from P&amp;L points)</div>
          </div>

          <div className="divide-y divide-zinc-200">
            {loading ? (
              <div className="px-6 py-10 text-sm text-zinc-500">Loading…</div>
            ) : salesTrend.length === 0 ? (
              <div className="px-6 py-10 text-sm text-zinc-500">No sales in this range.</div>
            ) : (
              salesTrend.map((p) => (
                <div key={p.period} className="grid items-center px-6 py-3 text-sm" style={{ gridTemplateColumns: "1.2fr 1fr" }}>
                  <div className="font-bold text-zinc-600">{p.period}</div>
                  <div className="text-right font-black text-zinc-900">{fmtMoney(Number(p.revenue ?? 0))}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Low stock */}
        <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <div className="text-lg font-black text-zinc-900">Low Stock</div>
              <div className="mt-1 text-sm text-zinc-500">Items needing attention</div>
            </div>
            <Link href="/dashboard/inventory" className="text-sm font-black text-zinc-900 hover:underline">
              View all →
            </Link>
          </div>

          <div className="divide-y divide-zinc-200">
            {loading ? (
              <div className="px-6 py-10 text-sm text-zinc-500">Loading…</div>
            ) : lowStockRows.length === 0 ? (
              <div className="px-6 py-10 text-sm text-zinc-500">All good — no low stock items.</div>
            ) : (
              lowStockRows.map((r) => (
                <div key={r.product_id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-black text-zinc-900 truncate">{r.name}</div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {r.sku ? `SKU: ${r.sku} · ` : ""}{r.category ?? "—"}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-black ${statusBadge(r.status)}`}>
                          {r.status.toUpperCase()}
                        </span>
                        <span className="text-xs text-zinc-500">
                          On hand <span className="font-black text-zinc-900">{r.qty_on_hand}</span> · Reorder{" "}
                          <span className="font-black text-zinc-900">{r.reorder_level}</span>
                        </span>
                      </div>
                    </div>

                    <Link
                      href="/dashboard/inventory"
                      className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs font-black hover:bg-zinc-50"
                    >
                      Restock
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <div className="text-lg font-black text-zinc-900">Recent Activity</div>
            <div className="mt-1 text-sm text-zinc-500">Latest sales and expenses</div>
          </div>

          <div className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-1">
            <button
              onClick={() => setActivityTab("sales")}
              className={`rounded-xl px-3 py-2 text-xs font-black transition ${
                activityTab === "sales" ? "bg-white shadow-sm border border-zinc-200" : "text-zinc-600 hover:bg-white/60"
              }`}
            >
              Sales
            </button>
            <button
              onClick={() => setActivityTab("expenses")}
              className={`rounded-xl px-3 py-2 text-xs font-black transition ${
                activityTab === "expenses" ? "bg-white shadow-sm border border-zinc-200" : "text-zinc-600 hover:bg-white/60"
              }`}
            >
              Expenses
            </button>
          </div>
        </div>

        {activityTab === "sales" ? (
          <div className="divide-y divide-zinc-200">
            {recentSales.length === 0 ? (
              <div className="px-6 py-10 text-sm text-zinc-500">No recent sales.</div>
            ) : (
              recentSales.map((s) => (
                <Link
                  key={s.id}
                  href={`/dashboard/sales/${s.id}`}
                  className="grid items-center px-6 py-4 text-sm hover:bg-zinc-50"
                  style={{ gridTemplateColumns: "1.2fr 1.5fr 1fr 1fr" }}
                >
                  <div className="font-black text-zinc-900">{s.sale_no}</div>
                  <div className="text-zinc-600 truncate">{s.customer_name ?? "—"}</div>
                  <div className="text-zinc-500">{fmtDateTime(s.created_at)}</div>
                  <div className="text-right font-black text-zinc-900">{fmtMoney(Number(s.total ?? 0))}</div>
                </Link>
              ))
            )}
          </div>
        ) : (
          <div className="divide-y divide-zinc-200">
            {recentExpenses.length === 0 ? (
              <div className="px-6 py-10 text-sm text-zinc-500">No recent expenses.</div>
            ) : (
              recentExpenses.map((e) => (
                <div
                  key={e.id}
                  className="grid items-center px-6 py-4 text-sm"
                  style={{ gridTemplateColumns: "1.6fr 1fr 1fr" }}
                >
                  <div className="font-black text-zinc-900">{e.category}</div>
                  <div className="text-zinc-500">{e.expense_date}</div>
                  <div className="text-right font-black text-zinc-900">{fmtMoney(Number(e.amount ?? 0))}</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}