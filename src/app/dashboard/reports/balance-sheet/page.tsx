"use client";

import React, { useEffect, useMemo, useState } from "react";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import { getBalanceSheet, type BalanceSheetResult } from "@/lib/api/reports";
import * as S from "../page.styles";

/* ─── Helpers ────────────────────────────────────────────────── */
function fmtMoney(v: number) {
  return `Ksh ${Number(v || 0).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
}
function iso(d: Date) { return d.toISOString().slice(0, 10); }
function fmtK(v: number) { return v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(Math.round(v)); }

/* ─── Spinner ────────────────────────────────────────────────── */
function Spinner() {
  return (
    <div className="flex items-center justify-center gap-3 py-14 text-slate-400">
      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" strokeOpacity="0.2" />
        <path d="M12 2a10 10 0 0110 10" />
      </svg>
      <span className="text-sm">Loading…</span>
    </div>
  );
}

/* ─── Capital structure stacked bar ──────────────────────────── */
function CapitalBar({ assets, liabilities, equity }: { assets: number; liabilities: number; equity: number }) {
  const total = Math.max(assets, 1);
  const liabPct = Math.min(100, (liabilities / total) * 100);
  const equPct  = Math.min(100 - liabPct, (equity / total) * 100);
  return (
    <div>
      <div className="flex justify-between mb-2 text-xs font-semibold text-slate-600">
        <span>Capital Structure</span>
        <span className="text-slate-400">Total assets: <span className="text-slate-900 font-bold">{fmtMoney(assets)}</span></span>
      </div>
      <div className="h-5 w-full rounded-full bg-slate-100 overflow-hidden flex gap-px">
        {liabPct > 0 && (
          <div className="h-full transition-all duration-700 rounded-l-full"
            style={{ width: `${liabPct}%`, background: "linear-gradient(90deg,#fca5a5,#ef4444)" }} />
        )}
        {equPct > 0 && (
          <div className="h-full transition-all duration-700"
            style={{
              width: `${equPct}%`,
              background: "linear-gradient(90deg,#86efac,#22c55e)",
              borderRadius: liabPct < 1 ? "9999px" : "0 9999px 9999px 0",
            }} />
        )}
      </div>
      <div className="flex items-center gap-5 mt-2.5 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400 shrink-0" />
          Liabilities <span className="font-bold text-slate-700 ml-1">{liabPct.toFixed(0)}%</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-green-500 shrink-0" />
          Equity <span className="font-bold text-slate-700 ml-1">{equPct.toFixed(0)}%</span>
        </span>
        {(liabPct + equPct) < 99 && (
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-300 shrink-0" />
            Unallocated
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Interactive P&L waterfall ──────────────────────────────── */
function PnLWaterfall({ rev, cogs, exp, net, loading }: {
  rev: number; cogs: number; exp: number; net: number; loading: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 440, H = 170, P = { t: 18, r: 12, b: 38, l: 52 };
  const iW = W - P.l - P.r, iH = H - P.t - P.b;

  const bars = useMemo(() => [
    { label: "Revenue",  value: rev,           color: "#22c55e" },
    { label: "COGS",     value: cogs,           color: "#ef4444" },
    { label: "Expenses", value: exp,            color: "#f97316" },
    { label: "Net",      value: Math.abs(net),  color: net >= 0 ? "#22c55e" : "#ef4444" },
  ], [rev, cogs, exp, net]);

  const maxV = Math.max(...bars.map(b => b.value), 1);
  const bW   = iW / bars.length - 14;

  if (loading) return (
    <div className="h-[170px] flex items-center justify-center">
      <svg className="h-4 w-4 animate-spin text-slate-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0110 10"/>
      </svg>
    </div>
  );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      <line x1={P.l} y1={P.t + iH} x2={W - P.r} y2={P.t + iH} stroke="#e2e8f0" strokeWidth="1" />
      {[0, 0.5, 1].map((f, i) => {
        const v = maxV * f;
        const y = P.t + iH - (v / maxV) * iH * 0.9;
        return (
          <g key={i}>
            <line x1={P.l} y1={y} x2={W - P.r} y2={y} stroke="#f8fafc" strokeWidth="1" />
            <text x={P.l - 6} y={y + 4} textAnchor="end" fontSize="8.5" fill="#94a3b8">{fmtK(v)}</text>
          </g>
        );
      })}
      {bars.map((b, i) => {
        const x   = P.l + i * (bW + 14) + 6;
        const bH  = Math.max(4, (b.value / maxV) * iH * 0.9);
        const y   = P.t + iH - bH;
        const mid = x + bW / 2;
        const isH = hover === i;
        return (
          <g key={b.label} style={{ cursor: "default" }}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            {isH && (
              <rect x={x - 2} y={y + 4} width={bW + 4} height={bH} rx="5" fill={b.color} opacity="0.12" />
            )}
            <rect x={x} y={y} width={bW} height={bH} rx="4" fill={b.color}
              opacity={hover === null || isH ? (i === bars.length - 1 ? 1 : 0.8) : 0.3}
              style={{ transition: "opacity 0.15s" }} />
            {isH && (
              <rect x={x - 1} y={y - 1} width={bW + 2} height={bH + 2} rx="5"
                fill="none" stroke={b.color} strokeWidth="1.5" />
            )}
            <text x={mid} y={P.t + iH + 16} textAnchor="middle" fontSize="9"
              fill={isH ? "#374151" : "#94a3b8"} fontWeight={isH ? "700" : "400"}>
              {b.label}
            </text>
            <text x={mid} y={y - 5} textAnchor="middle" fontSize="9"
              fill={b.color} fontWeight="700" opacity={isH ? 1 : 0.85}>
              {fmtK(b.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ─── Statement section row ──────────────────────────────────── */
function StatRow({ label, value, indent = false, bold = false, positive, subtotal = false }: {
  label: string; value: number; indent?: boolean; bold?: boolean;
  positive?: boolean; subtotal?: boolean;
}) {
  const valColor = positive === undefined
    ? (bold ? "text-slate-900" : "text-slate-700")
    : positive ? "text-green-600" : "text-red-600";
  return (
    <div className={`flex items-center justify-between ${
      subtotal ? "mt-2 pt-2.5 border-t border-slate-200" : "py-1.5"
    }`}>
      <span className={`text-sm ${indent ? "pl-5 text-slate-500" : bold ? "font-semibold text-slate-900" : "text-slate-600"}`}>
        {label}
      </span>
      <span className={`text-sm font-bold ${valColor}`}>{fmtMoney(value)}</span>
    </div>
  );
}

/* ─── Section header stripe ──────────────────────────────────── */
function SectionStripe({ color, label }: { color: string; label: string }) {
  const colors = {
    blue:  "text-blue-600 bg-blue-50 border-blue-100",
    red:   "text-red-500 bg-red-50 border-red-100",
    green: "text-green-600 bg-green-50 border-green-100",
  }[color] ?? "text-slate-600 bg-slate-50 border-slate-200";
  return (
    <div className={`-mx-5 px-5 py-2 border-y text-xs font-bold uppercase tracking-widest ${colors}`}>
      {label}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   PAGE
════════════════════════════════════════════════════════════════ */
export default function BalanceSheetReportPage() {
  const [orgId,   setOrgId]   = useState<string | null>(null);
  const [asOf,    setAsOf]    = useState(() => iso(new Date()));
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState("");
  const [data,    setData]    = useState<BalanceSheetResult | null>(null);

  useEffect(() => {
    (async () => {
      try { const o = await bootstrapOrg(); setOrgId(o); }
      catch (e: any) { setErr(e.message ?? String(e)); }
    })();
  }, []);

  async function load() {
    if (!orgId) return;
    setLoading(true); setErr("");
    try {
      const res = await getBalanceSheet(orgId, { as_of: asOf });
      setData(res);
    } catch (e: any) { setErr(e.message ?? String(e)); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (orgId) load(); }, [orgId, asOf]);

  const checkOk = useMemo(() =>
    Math.abs(Number(data?.check.assets_minus_liabilities_minus_equity ?? 0)) < 0.01,
  [data]);

  const assets  = Number(data?.assets.total_assets          ?? 0);
  const invCost = Number(data?.assets.inventory_at_cost     ?? 0);
  const liabs   = Number(data?.liabilities.total_liabilities ?? 0);
  const equity  = Number(data?.equity.total_equity           ?? 0);
  const re      = Number(data?.equity.retained_earnings      ?? 0);
  const rev     = Number(data?.pnl_to_date.revenue           ?? 0);
  const cogs    = Number(data?.pnl_to_date.cogs              ?? 0);
  const exp     = Number(data?.pnl_to_date.expenses          ?? 0);
  const net     = Number(data?.pnl_to_date.net_profit        ?? 0);
  const diff    = Number(data?.check.assets_minus_liabilities_minus_equity ?? 0);

  if (!orgId && !err) return <Spinner />;

  return (
    <div className="flex flex-col gap-5">

      {/* ── Page header ───────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Balance Sheet</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Assets · Liabilities · Equity · Inventory valued at cost
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-500 whitespace-nowrap">As of</label>
            <input
              type="date" value={asOf}
              onChange={e => setAsOf(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
            />
          </div>
          <button className={S.btnPrimary} onClick={load} disabled={loading}>
            {loading ? "Loading…" : "↻ Refresh"}
          </button>
        </div>
      </div>

      {/* ── Error ─────────────────────────────────────────── */}
      {err && (
        <div className={S.alert}>
          <span>⚠️</span>
          <span className="flex-1">{err}</span>
          <button onClick={() => setErr("")} className="ml-auto text-red-400 hover:text-red-600 leading-none">×</button>
        </div>
      )}

      {/* ── KPI row ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">

        {/* Total Assets */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-lg mb-3">🏦</div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Total Assets</div>
          <div className="text-2xl font-bold text-slate-900">{loading ? "—" : fmtMoney(assets)}</div>
          <div className="mt-1 text-xs text-slate-400">Inventory at cost</div>
        </div>

        {/* Liabilities */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-red-50 text-lg mb-3">📋</div>
          <div className="text-xs font-semibold uppercase tracking-wider text-red-500 mb-1.5">Liabilities</div>
          <div className="text-2xl font-bold text-slate-900">{loading ? "—" : fmtMoney(liabs)}</div>
          <div className="mt-1 text-xs text-slate-400">Payables & loans</div>
        </div>

        {/* Equity */}
        <div className="rounded-2xl border border-green-200 bg-green-50 p-5 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-green-100 text-lg mb-3">📈</div>
          <div className="text-xs font-semibold uppercase tracking-wider text-green-700 mb-1.5">Equity</div>
          <div className="text-2xl font-bold text-green-800">{loading ? "—" : fmtMoney(equity)}</div>
          <div className="mt-1 text-xs text-green-600">Retained earnings</div>
        </div>

        {/* Balance check */}
        <div className={`rounded-2xl border p-5 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 ${
          checkOk
            ? "border-green-200 bg-green-50"
            : "border-red-200 bg-red-50"
        }`}>
          <div className={`grid h-10 w-10 place-items-center rounded-xl text-lg mb-3 ${checkOk ? "bg-green-100" : "bg-red-100"}`}>
            {loading ? "·" : checkOk ? "✅" : "⚠️"}
          </div>
          <div className={`text-xs font-semibold uppercase tracking-wider mb-1.5 ${checkOk ? "text-green-700" : "text-red-500"}`}>
            Balance Check
          </div>
          <div className={`text-xl font-bold ${checkOk ? "text-green-800" : "text-red-700"}`}>
            {loading ? "—" : checkOk ? "Balanced" : "Off balance"}
          </div>
          {!loading && !checkOk && (
            <div className="mt-1 text-xs text-red-500 font-semibold">Diff: {fmtMoney(diff)}</div>
          )}
        </div>
      </div>

      {/* ── Capital structure bar ─────────────────────────── */}
      {!loading && assets > 0 && (
        <div className={`${S.card} p-5`}>
          <CapitalBar assets={assets} liabilities={liabs} equity={equity} />
        </div>
      )}

      {/* ── Two column: Statement | Retained Earnings + Chart ─ */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_340px]">

        {/* ── Balance Sheet Statement ── */}
        <div className={`${S.card} overflow-hidden`}>
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-slate-50 text-base shrink-0">📄</div>
            <div>
              <div className="font-bold text-slate-900">Statement</div>
              <div className="text-xs text-slate-500 mt-0.5">As of {asOf}</div>
            </div>
          </div>

          {loading ? <Spinner /> : (
            <div>
              {/* Assets */}
              <div className="px-5 pt-4 pb-5">
                <SectionStripe color="blue" label="Assets" />
                <div className="mt-3 space-y-0.5">
                  <StatRow label="Inventory (at cost)" value={invCost} indent />
                  <StatRow label="Total Assets" value={assets} bold subtotal />
                </div>
              </div>

              {/* Liabilities */}
              <div className="px-5 pt-4 pb-5 border-t border-slate-100">
                <SectionStripe color="red" label="Liabilities" />
                <div className="mt-3">
                  <StatRow label="Total Liabilities" value={liabs} bold />
                  <p className="mt-2 text-xs text-slate-400 italic pl-1">
                    No payables or loans recorded yet.
                  </p>
                </div>
              </div>

              {/* Equity */}
              <div className="px-5 pt-4 pb-5 border-t border-slate-100">
                <SectionStripe color="green" label="Equity" />
                <div className="mt-3 space-y-0.5">
                  <StatRow label="Retained Earnings (net profit to date)" value={re} indent />
                  <StatRow label="Total Equity" value={equity} bold positive={equity >= 0} subtotal />
                </div>
              </div>

              {/* Accounting equation */}
              <div className="px-5 py-4 bg-slate-50 border-t border-slate-200">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-bold text-slate-800">Assets = Liabilities + Equity</div>
                    <div className="mt-1 text-xs text-slate-400 font-mono">
                      {fmtMoney(assets)} = {fmtMoney(liabs)} + {fmtMoney(equity)}
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold whitespace-nowrap ${
                    checkOk ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  }`}>
                    {checkOk ? "✓ Balanced" : `⚠ Diff: ${fmtMoney(diff)}`}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Right column ── */}
        <div className="flex flex-col gap-5">

          {/* Retained Earnings breakdown */}
          <div className={`${S.card} overflow-hidden`}>
            <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-slate-50 text-base shrink-0">💹</div>
              <div>
                <div className="font-bold text-slate-900">Retained Earnings</div>
                <div className="text-xs text-slate-500 mt-0.5">Cumulative P&L to date</div>
              </div>
            </div>
            {loading ? <Spinner /> : (
              <div className="px-5 py-4 space-y-0.5">
                <StatRow label="Revenue" value={rev} />
                <StatRow label="COGS" value={cogs} indent positive={false} />
                <StatRow label="Expenses" value={exp} indent positive={false} />
                <StatRow label="Net Profit" value={net} bold positive={net >= 0} subtotal />
                <p className="pt-3 text-xs text-slate-400 leading-relaxed">
                  Discounts are reflected within sales revenue. See the Expenses &amp; P&L report for a full breakdown.
                </p>
              </div>
            )}
          </div>

          {/* P&L Waterfall chart */}
          <div className={`${S.card} overflow-hidden`}>
            <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-slate-50 text-base shrink-0">📊</div>
              <div>
                <div className="font-bold text-slate-900">P&L Waterfall</div>
                <div className="text-xs text-slate-500 mt-0.5">Hover bars to inspect</div>
              </div>
            </div>
            <div className="px-4 py-4">
              <PnLWaterfall rev={rev} cogs={cogs} exp={exp} net={net} loading={loading} />
            </div>
            {!loading && (
              <div className="border-t border-slate-100 px-5 py-3 flex justify-between items-center">
                <span className="text-xs text-slate-500">Net Profit</span>
                <span className={`text-sm font-bold ${net >= 0 ? "text-green-600" : "text-red-600"}`}>{fmtMoney(net)}</span>
              </div>
            )}
          </div>

        </div>
      </div>

    </div>
  );
}