"use client";

import React, { useEffect, useMemo, useState } from "react";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import { getBalanceSheet, type BalanceSheetResult } from "@/lib/api/reports";
import * as S from "../page.styles";

function fmtMoney(v: number) {
  return `Ksh ${Number(v || 0).toLocaleString("en-KE")}`;
}

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function BalanceSheetReportPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [asOf, setAsOf] = useState(() => iso(new Date()));
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [data, setData] = useState<BalanceSheetResult | null>(null);

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
      const res = await getBalanceSheet(orgId, { as_of: asOf });
      setData(res);
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
  }, [orgId, asOf]);

  const checkOk = useMemo(() => {
    const v = Number(data?.check.assets_minus_liabilities_minus_equity ?? 0);
    return Math.abs(v) < 0.01;
  }, [data]);

  if (!orgId && !err) return <div className="p-6">Loading…</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`${S.card} p-6`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-3xl font-black text-zinc-900">Balance Sheet</div>
            <div className="mt-1 text-sm text-zinc-500">
              Snapshot of Assets, Liabilities, and Equity (inventory valued at cost).
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-zinc-500">As of</label>
              <input className={S.input} type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
            </div>

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
          <div className="text-[11px] font-black uppercase tracking-wide text-zinc-500">Total Assets</div>
          <div className="mt-3 text-3xl font-black text-zinc-900">{fmtMoney(data?.assets.total_assets ?? 0)}</div>
        </div>

        <div className={`${S.card} p-6`}>
          <div className="text-[11px] font-black uppercase tracking-wide text-zinc-500">Liabilities</div>
          <div className="mt-3 text-3xl font-black text-zinc-900">{fmtMoney(data?.liabilities.total_liabilities ?? 0)}</div>
          <div className="mt-2 text-xs text-zinc-500">No payables/loans tables yet</div>
        </div>

        <div className={`${S.card} p-6`}>
          <div className="text-[11px] font-black uppercase tracking-wide text-zinc-500">Equity</div>
          <div className="mt-3 text-3xl font-black text-zinc-900">{fmtMoney(data?.equity.total_equity ?? 0)}</div>
          <div className="mt-2 text-xs text-zinc-500">Derived from retained earnings</div>
        </div>

        <div className={`${S.card} p-6`}>
          <div className="text-[11px] font-black uppercase tracking-wide text-zinc-500">Balance Check</div>
          <div className={`mt-3 text-2xl font-black ${checkOk ? "text-emerald-700" : "text-rose-700"}`}>
            {checkOk ? "Balanced ✅" : "Not balanced ⚠️"}
          </div>
          <div className="mt-2 text-xs text-zinc-500">
            Diff: {fmtMoney(data?.check.assets_minus_liabilities_minus_equity ?? 0)}
          </div>
        </div>
      </div>

      {/* Statement */}
      <div className={`${S.card} overflow-hidden`}>
        <div className="px-6 py-4">
          <div className="text-lg font-black text-zinc-900">Statement</div>
          <div className="mt-1 text-sm text-zinc-500">As of {asOf}</div>
        </div>

        <div className="divide-y divide-zinc-200">
          {/* Assets */}
          <div className="px-6 py-4">
            <div className="text-sm font-black text-zinc-900">Assets</div>

            <div className="mt-3 grid text-sm text-zinc-800" style={{ gridTemplateColumns: "1.6fr 1fr" }}>
              <div className="text-zinc-600">Inventory (at cost)</div>
              <div className="text-right font-black">{fmtMoney(data?.assets.inventory_at_cost ?? 0)}</div>

              <div className="mt-2 text-zinc-600">Total Assets</div>
              <div className="mt-2 text-right font-black">{fmtMoney(data?.assets.total_assets ?? 0)}</div>
            </div>
          </div>

          {/* Liabilities */}
          <div className="px-6 py-4">
            <div className="text-sm font-black text-zinc-900">Liabilities</div>

            <div className="mt-3 grid text-sm text-zinc-800" style={{ gridTemplateColumns: "1.6fr 1fr" }}>
              <div className="text-zinc-600">Total Liabilities</div>
              <div className="text-right font-black">{fmtMoney(data?.liabilities.total_liabilities ?? 0)}</div>
            </div>
          </div>

          {/* Equity */}
          <div className="px-6 py-4">
            <div className="text-sm font-black text-zinc-900">Equity</div>

            <div className="mt-3 grid text-sm text-zinc-800" style={{ gridTemplateColumns: "1.6fr 1fr" }}>
              <div className="text-zinc-600">Retained Earnings (Net Profit to date)</div>
              <div className="text-right font-black">{fmtMoney(data?.equity.retained_earnings ?? 0)}</div>

              <div className="mt-2 text-zinc-600">Total Equity</div>
              <div className="mt-2 text-right font-black">{fmtMoney(data?.equity.total_equity ?? 0)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* How equity was derived */}
      <div className={`${S.card} p-6`}>
        <div className="text-lg font-black text-zinc-900">Retained Earnings Breakdown</div>
        <div className="mt-1 text-sm text-zinc-500">
          Since you don’t have “cash/bank/loans” tables yet, equity is derived from cumulative profit.
        </div>

        <div className="mt-4 grid gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-zinc-600">Revenue</span>
            <span className="font-black">{fmtMoney(data?.pnl_to_date.revenue ?? 0)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-600">COGS (cost_price × qty sold)</span>
            <span className="font-black">{fmtMoney(data?.pnl_to_date.cogs ?? 0)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-600">Expenses</span>
            <span className="font-black">{fmtMoney(data?.pnl_to_date.expenses ?? 0)}</span>
          </div>

          <div className="mt-3 flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <span className="text-zinc-700 font-black">Net Profit (Retained Earnings)</span>
            <span className={`text-lg font-black ${(data?.pnl_to_date.net_profit ?? 0) < 0 ? "text-rose-700" : "text-emerald-700"}`}>
              {fmtMoney(data?.pnl_to_date.net_profit ?? 0)}
            </span>
          </div>

          <div className="mt-2 text-xs text-zinc-500">
            Note: Discounts are already included in sales totals (you can show them separately in a P&L report).
          </div>
        </div>
      </div>
    </div>
  );
}