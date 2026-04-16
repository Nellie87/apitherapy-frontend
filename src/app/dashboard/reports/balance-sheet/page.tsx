"use client";

import React, { useEffect, useMemo, useState } from "react";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import { getBalanceSheet, type BalanceSheetResult } from "@/lib/api/reports";
import * as S from "../page.styles";
import {
  Card,
  EmptyState,
  ErrorBanner,
  InsightCard,
  KpiCard,
  ReportHeader,
  ReportsBackButton,
  Spinner,
  fmtK,
  fmtMoney,
  iso,
} from "../_components/report-ui";

/* ════════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════════ */
function StatRow({
  label,
  value,
  indent = false,
  bold = false,
  positive,
  subtotal = false,
}: {
  label: string;
  value: number;
  indent?: boolean;
  bold?: boolean;
  positive?: boolean;
  subtotal?: boolean;
}) {
  const valColor =
    positive === undefined
      ? bold
        ? "text-slate-900"
        : "text-slate-700"
      : positive
        ? "text-green-600"
        : "text-red-600";

  return (
    <div
      className={`flex items-center justify-between ${
        subtotal ? "mt-2 pt-2.5 border-t border-slate-200" : "py-1.5"
      }`}
    >
      <span
        className={`text-sm ${
          indent
            ? "pl-5 text-slate-500"
            : bold
              ? "font-semibold text-slate-900"
              : "text-slate-600"
        }`}
      >
        {label}
      </span>
      <span className={`text-sm font-bold ${valColor}`}>{fmtMoney(value)}</span>
    </div>
  );
}

function SectionStripe({
  color,
  label,
}: {
  color: "blue" | "red" | "green";
  label: string;
}) {
  const colors = {
    blue: "text-blue-600 bg-blue-50 border-blue-100",
    red: "text-red-500 bg-red-50 border-red-100",
    green: "text-green-600 bg-green-50 border-green-100",
  }[color];

  return (
    <div
      className={`-mx-5 px-5 py-2 border-y text-xs font-bold uppercase tracking-widest ${colors}`}
    >
      {label}
    </div>
  );
}

function CapitalBar({
  assets,
  liabilities,
  equity,
}: {
  assets: number;
  liabilities: number;
  equity: number;
}) {
  const total = Math.max(assets, 1);
  const liabPct = Math.min(100, (liabilities / total) * 100);
  const equPct = Math.min(100 - liabPct, (equity / total) * 100);

  return (
    <div>
      <div className="flex justify-between mb-2 text-xs font-semibold text-slate-600">
        <span>Capital Structure</span>
        <span className="text-slate-400">
          Total assets:{" "}
          <span className="text-slate-900 font-bold">{fmtMoney(assets)}</span>
        </span>
      </div>

      <div className="h-5 w-full rounded-full bg-slate-100 overflow-hidden flex gap-px">
        {liabPct > 0 && (
          <div
            className="h-full transition-all duration-700 rounded-l-full"
            style={{
              width: `${liabPct}%`,
              background: "linear-gradient(90deg,#fca5a5,#ef4444)",
            }}
          />
        )}

        {equPct > 0 && (
          <div
            className="h-full transition-all duration-700"
            style={{
              width: `${equPct}%`,
              background: "linear-gradient(90deg,#86efac,#22c55e)",
              borderRadius: liabPct < 1 ? "9999px" : "0 9999px 9999px 0",
            }}
          />
        )}
      </div>

      <div className="flex items-center gap-5 mt-2.5 text-xs text-slate-500 flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400 shrink-0" />
          Liabilities{" "}
          <span className="font-bold text-slate-700 ml-1">
            {liabPct.toFixed(0)}%
          </span>
        </span>

        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-green-500 shrink-0" />
          Equity{" "}
          <span className="font-bold text-slate-700 ml-1">
            {equPct.toFixed(0)}%
          </span>
        </span>

        {liabPct + equPct < 99 && (
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-300 shrink-0" />
            Unallocated
          </span>
        )}
      </div>
    </div>
  );
}

function PnLWaterfall({
  rev,
  cogs,
  exp,
  net,
}: {
  rev: number;
  cogs: number;
  exp: number;
  net: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 440;
  const H = 170;
  const P = { t: 18, r: 12, b: 38, l: 52 };
  const iW = W - P.l - P.r;
  const iH = H - P.t - P.b;

  const bars = useMemo(
    () => [
      { label: "Revenue", value: rev, color: "#22c55e" },
      { label: "COGS", value: cogs, color: "#ef4444" },
      { label: "Expenses", value: exp, color: "#f59e0b" },
      {
        label: "Net",
        value: Math.abs(net),
        color: net >= 0 ? "#22c55e" : "#ef4444",
      },
    ],
    [rev, cogs, exp, net]
  );

  const maxV = Math.max(...bars.map((b) => b.value), 1);
  const bW = iW / bars.length - 14;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      <line
        x1={P.l}
        y1={P.t + iH}
        x2={W - P.r}
        y2={P.t + iH}
        stroke="#e2e8f0"
        strokeWidth="1"
      />

      {[0, 0.5, 1].map((f, i) => {
        const v = maxV * f;
        const y = P.t + iH - (v / maxV) * iH * 0.9;

        return (
          <g key={i}>
            <line
              x1={P.l}
              y1={y}
              x2={W - P.r}
              y2={y}
              stroke="#f8fafc"
              strokeWidth="1"
            />
            <text
              x={P.l - 6}
              y={y + 4}
              textAnchor="end"
              fontSize="8.5"
              fill="#94a3b8"
            >
              {fmtK(v)}
            </text>
          </g>
        );
      })}

      {bars.map((b, i) => {
        const x = P.l + i * (bW + 14) + 6;
        const bH = Math.max(4, (b.value / maxV) * iH * 0.9);
        const y = P.t + iH - bH;
        const mid = x + bW / 2;
        const isH = hover === i;

        return (
          <g
            key={b.label}
            style={{ cursor: "default" }}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            {isH && (
              <rect
                x={x - 2}
                y={y + 4}
                width={bW + 4}
                height={bH}
                rx="5"
                fill={b.color}
                opacity="0.12"
              />
            )}

            <rect
              x={x}
              y={y}
              width={bW}
              height={bH}
              rx="4"
              fill={b.color}
              opacity={hover === null || isH ? (i === bars.length - 1 ? 1 : 0.8) : 0.3}
              style={{ transition: "opacity 0.15s" }}
            />

            {isH && (
              <rect
                x={x - 1}
                y={y - 1}
                width={bW + 2}
                height={bH + 2}
                rx="5"
                fill="none"
                stroke={b.color}
                strokeWidth="1.5"
              />
            )}

            <text
              x={mid}
              y={P.t + iH + 16}
              textAnchor="middle"
              fontSize="9"
              fill={isH ? "#374151" : "#94a3b8"}
              fontWeight={isH ? "700" : "400"}
            >
              {b.label}
            </text>

            <text
              x={mid}
              y={y - 5}
              textAnchor="middle"
              fontSize="9"
              fill={b.color}
              fontWeight="700"
              opacity={isH ? 1 : 0.85}
            >
              {fmtK(b.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function buildInsights({
  assets,
  liabs,
  equity,
  invCost,
  net,
  diff,
  checkOk,
}: {
  assets: number;
  liabs: number;
  equity: number;
  invCost: number;
  net: number;
  diff: number;
  checkOk: boolean;
}) {
  const invPct = assets > 0 ? (invCost / assets) * 100 : 0;
  const debtPct = assets > 0 ? (liabs / assets) * 100 : 0;

  return [
    {
      type: checkOk ? "ok" : "critical",
      icon: checkOk ? "✅" : "⚠️",
      title: checkOk ? "Balance sheet is balanced" : "Balance sheet is off balance",
      detail: checkOk
        ? "Assets equal liabilities plus equity."
        : `The accounting equation is out by ${fmtMoney(diff)} and needs review.`,
    },
    {
      type: equity >= 0 ? "positive" : "negative",
      icon: equity >= 0 ? "📈" : "📉",
      title:
        equity >= 0
          ? "Equity position is positive"
          : "Equity position is negative",
      detail:
        equity >= 0
          ? `${fmtMoney(equity)} in owner value is currently supported by the business.`
          : `Negative equity of ${fmtMoney(Math.abs(equity))} suggests accumulated losses or undercapitalisation.`,
    },
    {
      type: debtPct > 60 ? "warning" : "neutral",
      icon: "🏦",
      title: `Liabilities fund ${debtPct.toFixed(1)}% of total assets`,
      detail:
        debtPct > 60
          ? "Debt dependence is relatively high. Monitor repayment pressure closely."
          : "Liability dependence remains within a more moderate range.",
    },
    {
      type: invPct > 70 ? "warning" : "ok",
      icon: "📦",
      title: `Inventory makes up ${invPct.toFixed(1)}% of assets`,
      detail:
        invPct > 70
          ? "A large share of business value is tied up in stock. Slow-moving inventory could strain cash flow."
          : "Inventory concentration looks manageable relative to total assets.",
    },
    {
      type: net >= 0 ? "positive" : "negative",
      icon: net >= 0 ? "💰" : "💸",
      title:
        net >= 0
          ? "Retained earnings are being supported by profit"
          : "Retained earnings are being pressured by losses",
      detail:
        net >= 0
          ? `${fmtMoney(net)} profit to date is strengthening the equity base.`
          : `${fmtMoney(Math.abs(net))} loss to date is weakening retained earnings.`,
    },
  ];
}

/* ════════════════════════════════════════════════════════════════
   PAGE
════════════════════════════════════════════════════════════════ */
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
    if (orgId) load();
  }, [orgId, asOf]);

  const checkOk = useMemo(
    () =>
      Math.abs(Number(data?.check.assets_minus_liabilities_minus_equity ?? 0)) <
      0.01,
    [data]
  );

  const assets = Number(data?.assets.total_assets ?? 0);
  const invCost = Number(data?.assets.inventory_at_cost ?? 0);
  const liabs = Number(data?.liabilities.total_liabilities ?? 0);
  const equity = Number(data?.equity.total_equity ?? 0);
  const re = Number(data?.equity.retained_earnings ?? 0);
  const rev = Number(data?.pnl_to_date.revenue ?? 0);
  const cogs = Number(data?.pnl_to_date.cogs ?? 0);
  const exp = Number(data?.pnl_to_date.expenses ?? 0);
  const net = Number(data?.pnl_to_date.net_profit ?? 0);
  const diff = Number(data?.check.assets_minus_liabilities_minus_equity ?? 0);

  const insights = useMemo(
    () =>
      buildInsights({
        assets,
        liabs,
        equity,
        invCost,
        net,
        diff,
        checkOk,
      }),
    [assets, liabs, equity, invCost, net, diff, checkOk]
  );

  if (!orgId && !err) return <Spinner h={180} />;

  return (
    <div className="flex flex-col gap-6">
      <ReportHeader
        title="Balance Sheet"
        subtitle="Assets, liabilities, equity, and inventory value at cost"
        actions={
          <>
            <ReportsBackButton />

            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-500 whitespace-nowrap">
                As of
              </label>
              <input
                type="date"
                value={asOf}
                onChange={(e) => setAsOf(e.target.value)}
                className={S.input}
                style={{ width: 150 }}
              />
            </div>

            <button className={S.btnPrimary} onClick={load} disabled={loading}>
              {loading ? "Loading…" : "↻ Refresh"}
            </button>
          </>
        }
      />

      {err && <ErrorBanner message={err} onClose={() => setErr("")} />}

      {!loading && !data && !err && (
        <EmptyState
          icon="📭"
          title="No balance sheet data found"
          detail="Try refreshing or add inventory and financial activity first."
        />
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Total Assets"
          value={loading ? "—" : fmtMoney(assets)}
          sub="Inventory at cost"
          icon="🏦"
          variant="info"
        />
        <KpiCard
          label="Liabilities"
          value={loading ? "—" : fmtMoney(liabs)}
          sub="Payables and loans"
          icon="📋"
          variant={liabs > 0 ? "warning" : "neutral"}
        />
        <KpiCard
          label="Equity"
          value={loading ? "—" : fmtMoney(equity)}
          sub="Retained earnings included"
          icon="📈"
          variant={equity >= 0 ? "success" : "danger"}
        />
        <KpiCard
          label="Balance Check"
          value={loading ? "—" : checkOk ? "Balanced" : "Off balance"}
          sub={!loading && !checkOk ? `Diff: ${fmtMoney(diff)}` : "Accounting equation"}
          icon={loading ? "·" : checkOk ? "✅" : "⚠️"}
          variant={checkOk ? "success" : "danger"}
        />
      </div>

      {!loading && assets > 0 && (
        <Card title="Capital Structure" sub="How assets are funded">
          <CapitalBar assets={assets} liabilities={liabs} equity={equity} />
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        <Card title="Statement" sub={`As of ${asOf}`} noPad>
          {loading ? (
            <Spinner h={260} />
          ) : !data ? (
            <div className="py-12 text-center text-sm text-slate-400">
              No statement available.
            </div>
          ) : (
            <div>
              <div className="px-5 pt-4 pb-5">
                <SectionStripe color="blue" label="Assets" />
                <div className="mt-3 space-y-0.5">
                  <StatRow label="Inventory (at cost)" value={invCost} indent />
                  <StatRow label="Total Assets" value={assets} bold subtotal />
                </div>
              </div>

              <div className="px-5 pt-4 pb-5 border-t border-slate-100">
                <SectionStripe color="red" label="Liabilities" />
                <div className="mt-3">
                  <StatRow label="Total Liabilities" value={liabs} bold />
                  <p className="mt-2 text-xs text-slate-400 italic pl-1">
                    No payables or loans recorded yet.
                  </p>
                </div>
              </div>

              <div className="px-5 pt-4 pb-5 border-t border-slate-100">
                <SectionStripe color="green" label="Equity" />
                <div className="mt-3 space-y-0.5">
                  <StatRow
                    label="Retained Earnings (net profit to date)"
                    value={re}
                    indent
                  />
                  <StatRow
                    label="Total Equity"
                    value={equity}
                    bold
                    positive={equity >= 0}
                    subtotal
                  />
                </div>
              </div>

              <div className="px-5 py-4 bg-slate-50 border-t border-slate-200">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <div className="text-sm font-bold text-slate-800">
                      Assets = Liabilities + Equity
                    </div>
                    <div className="mt-1 text-xs text-slate-400 font-mono">
                      {fmtMoney(assets)} = {fmtMoney(liabs)} + {fmtMoney(equity)}
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold whitespace-nowrap ${
                      checkOk
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {checkOk ? "✓ Balanced" : `⚠ Diff: ${fmtMoney(diff)}`}
                  </span>
                </div>
              </div>
            </div>
          )}
        </Card>

        <div className="flex flex-col gap-6">
          <Card title="Retained Earnings" sub="Cumulative P&L to date">
            {loading ? (
              <Spinner h={220} />
            ) : (
              <div className="space-y-0.5">
                <StatRow label="Revenue" value={rev} />
                <StatRow label="COGS" value={cogs} indent positive={false} />
                <StatRow label="Expenses" value={exp} indent positive={false} />
                <StatRow
                  label="Net Profit"
                  value={net}
                  bold
                  positive={net >= 0}
                  subtotal
                />
                <p className="pt-3 text-xs text-slate-400 leading-relaxed">
                  Discounts are reflected within sales revenue. Use the P&amp;L
                  report for period-level detail.
                </p>
              </div>
            )}
          </Card>

          <Card title="P&L Waterfall" sub="Revenue flow to net result">
            {loading ? (
              <Spinner h={170} />
            ) : (
              <PnLWaterfall rev={rev} cogs={cogs} exp={exp} net={net} />
            )}
            {!loading && (
              <div className="border-t border-slate-100 mt-4 pt-3 flex justify-between items-center">
                <span className="text-xs text-slate-500">Net Profit</span>
                <span
                  className={`text-sm font-bold ${
                    net >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {fmtMoney(net)}
                </span>
              </div>
            )}
          </Card>
        </div>
      </div>

      {!loading && data && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {insights.map((ins, i) => (
            <InsightCard key={i} {...ins} />
          ))}
        </div>
      )}
    </div>
  );
}