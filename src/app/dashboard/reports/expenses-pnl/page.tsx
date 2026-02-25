"use client";

import React, { useEffect, useMemo, useState } from "react";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import { reportExpenses, reportPnL, type Granularity, type DateRange } from "@/lib/api/reports";
import * as S from "../page.styles"; // ✅ reports/page.styles.ts (shared)

function fmtMoney(v: number) {
  return `Ksh ${Number(v || 0).toLocaleString("en-KE")}`;
}

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function defaultRange(): DateRange {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 29);
  return { from: iso(from), to: iso(to) };
}

type TopCategoryRow = { category: string; amount: number };

export default function ExpensesPnLReportPage() {
  const [orgId, setOrgId] = useState<string | null>(null);

  const [range, setRange] = useState<DateRange>(() => defaultRange());
  const [g, setG] = useState<Granularity>("day");

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [expenses, setExpenses] = useState<Awaited<ReturnType<typeof reportExpenses>> | null>(null);
  const [pnl, setPnl] = useState<Awaited<ReturnType<typeof reportPnL>> | null>(null);

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

  async function load() {
    if (!orgId) return;
    setLoading(true);
    setErr("");

    try {
      const [ex, pl] = await Promise.all([
        reportExpenses(orgId, {
          from: range.from,
          to: range.to,
          granularity: g,
        }),
        reportPnL(orgId, {
          from: range.from,
          to: range.to,
          granularity: g,
        }),
      ]);

      setExpenses(ex);
      setPnl(pl);
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!orgId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, range.from, range.to, g]);

  const topCats: TopCategoryRow[] = useMemo(() => {
    const rows = (expenses?.top_categories ?? []) as TopCategoryRow[];
    return rows.slice(0, 8);
  }, [expenses]);

  const totals = pnl?.totals ?? {
    revenue: 0,
    discounts: 0,
    cogs: 0,
    expenses: 0,
    gross_profit: 0,
    net_profit: 0,
  };

  if (!orgId && !err) return <div className="p-6">Loading…</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`${S.card} p-6`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-3xl font-black text-zinc-900">Expenses + P&L</div>
            <div className="mt-1 text-sm text-zinc-500">
              Expense trends, category breakdown, and profit snapshot
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-zinc-500">From</label>
              <input
                className={S.input}
                type="date"
                value={range.from}
                onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-zinc-500">To</label>
              <input
                className={S.input}
                type="date"
                value={range.to}
                onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
              />
            </div>

            <select className={S.input} value={g} onChange={(e) => setG(e.target.value as Granularity)}>
              <option value="day">Daily</option>
              <option value="month">Monthly</option>
            </select>

            <button className={S.btnPrimary} onClick={load} disabled={loading}>
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      {err ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
          {err}
        </div>
      ) : null}

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className={`${S.card} p-6`}>
          <div className="text-[11px] font-black uppercase tracking-wide text-zinc-500">Revenue</div>
          <div className="mt-3 text-3xl font-black text-zinc-900">{fmtMoney(Number(totals.revenue ?? 0))}</div>
        </div>

        <div className={`${S.card} p-6`}>
          <div className="text-[11px] font-black uppercase tracking-wide text-zinc-500">Discounts</div>
          <div className="mt-3 text-3xl font-black text-zinc-900">{fmtMoney(Number(totals.discounts ?? 0))}</div>
        </div>

        <div className={`${S.card} p-6`}>
          <div className="text-[11px] font-black uppercase tracking-wide text-zinc-500">Expenses</div>
          <div className="mt-3 text-3xl font-black text-zinc-900">{fmtMoney(Number(totals.expenses ?? 0))}</div>
        </div>

        <div className={`${S.card} p-6`}>
          <div className="text-[11px] font-black uppercase tracking-wide text-zinc-500">Net Profit</div>
          <div
            className={`mt-3 text-3xl font-black ${
              Number(totals.net_profit ?? 0) < 0 ? "text-rose-700" : "text-emerald-700"
            }`}
          >
            {fmtMoney(Number(totals.net_profit ?? 0))}
          </div>
        </div>
      </div>

      {/* Expenses trend list */}
      <div className={`${S.card} overflow-hidden`}>
        <div className="px-6 py-4">
          <div className="text-lg font-black text-zinc-900">Expense Trend</div>
          <div className="mt-1 text-sm text-zinc-500">
            {g === "day" ? "Daily totals" : "Monthly totals"} for the selected period
          </div>
        </div>

        <div className="divide-y divide-zinc-200">
          {loading ? (
            <div className="px-6 py-10 text-sm text-zinc-500">Loading…</div>
          ) : (expenses?.trend?.length ?? 0) === 0 ? (
            <div className="px-6 py-10 text-sm text-zinc-500">No expenses in this period.</div>
          ) : (
            expenses!.trend.map((t: { period: string; total: number }) => (
              <div
                key={t.period}
                className="grid items-center px-6 py-3 text-sm text-zinc-800"
                style={{ gridTemplateColumns: "1.2fr 1fr" }}
              >
                <div className="font-bold text-zinc-600">{t.period}</div>
                <div className="text-right font-black">{fmtMoney(Number(t.total ?? 0))}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Category breakdown */}
      <div className={`${S.card} overflow-hidden`}>
        <div className="px-6 py-4">
          <div className="text-lg font-black text-zinc-900">Top Expense Categories</div>
          <div className="mt-1 text-sm text-zinc-500">Where most money went</div>
        </div>

        <div className="divide-y divide-zinc-200">
          {loading ? (
            <div className="px-6 py-10 text-sm text-zinc-500">Loading…</div>
          ) : topCats.length === 0 ? (
            <div className="px-6 py-10 text-sm text-zinc-500">No category totals yet.</div>
          ) : (
            topCats.map((c: TopCategoryRow) => (
              <div
                key={c.category}
                className="grid items-center px-6 py-3 text-sm text-zinc-800"
                style={{ gridTemplateColumns: "1.6fr 1fr" }}
              >
                <div className="font-black">{c.category}</div>
                <div className="text-right font-black">{fmtMoney(Number(c.amount ?? 0))}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}