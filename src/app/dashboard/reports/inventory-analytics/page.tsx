"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import {
  getInventoryValuation,
  type InventoryValuationRow,
} from "@/lib/api/reports";

import * as S from "../page.styles";

import type {
  CategoryData,
  Enriched,
  InventoryInsight,
  NavTab,
  SortCol,
  StockHealth,
  Totals,
} from "./inventory-analytics.types";

import {
  coverageRatio,
  downloadCSV,
  fmtMoney,
  urgencyScore,
} from "./inventory-analytics.helpers";

import { printInventoryPdfReport } from "./inventory-analytics.pdf";

import {
  CategoryValueBars,
  CoverageBar,
  ParetoChart,
  StatusDonut,
  ValueBars,
} from "./inventory-analytics.charts";

import {
  Card,
  InsightCard,
  KpiCard,
  SegControl,
  SortTh,
  Spinner,
  StatusBadge,
  STATUS_CFG,
  UrgencyBar,
} from "./inventory-analytics.ui";

export default function InventoryAnalyticsPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [rows, setRows] = useState<InventoryValuationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [tab, setTab] = useState<NavTab>("overview");
  const [q, setQ] = useState("");
  const [filterStatus, setFilterStatus] = useState<StockHealth | "all">("all");
  const [sortCol, setSortCol] = useState<SortCol>("urgency");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    (async () => {
      try {
        setOrgId(await bootstrapOrg());
      } catch (e: any) {
        setErr(e.message ?? String(e));
        setLoading(false);
      }
    })();
  }, []);

  const fetchData = useCallback(async () => {
    if (!orgId) return;

    setLoading(true);
    setErr("");

    try {
      const res = await getInventoryValuation(orgId);
      setRows(res.rows);
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const enriched = useMemo<Enriched[]>(
    () =>
      rows.map((r) => ({
        ...r,
        urgency: urgencyScore(r),
        coverage: coverageRatio(r),
      })),
    [rows]
  );

  const totals = useMemo<Totals>(() => {
    const out = enriched.filter((r) => r.status === "out").length;
    const critical = enriched.filter((r) => r.status === "critical").length;
    const low = enriched.filter((r) => r.status === "low").length;
    const ok = enriched.filter((r) => r.status === "ok").length;

    const totalVal = enriched.reduce((s, r) => s + r.total_value, 0);

    const atRiskVal = enriched
      .filter((r) => r.status !== "ok")
      .reduce((s, r) => s + r.total_value, 0);

    const avgCoverage = enriched.length
      ? enriched.reduce((s, r) => s + r.coverage, 0) / enriched.length
      : 0;

    const totalQty = enriched.reduce((s, r) => s + r.qty_on_hand, 0);

    return {
      out,
      critical,
      low,
      ok,
      totalVal,
      atRiskVal,
      avgCoverage,
      totalQty,
    };
  }, [enriched]);

  const categoryData = useMemo<CategoryData[]>(() => {
    const map: Record<string, CategoryData> = {};

    enriched.forEach((r) => {
      const cat = r.category ?? "Uncategorised";

      if (!map[cat]) {
        map[cat] = {
          name: cat,
          value: 0,
          qty: 0,
          count: 0,
          atRisk: 0,
        };
      }

      map[cat].value += r.total_value;
      map[cat].qty += r.qty_on_hand;
      map[cat].count++;

      if (r.status !== "ok") map[cat].atRisk++;
    });

    return Object.values(map).sort((a, b) => b.value - a.value);
  }, [enriched]);

  const statusDist = useMemo(
    () =>
      [
        { label: "Healthy", value: totals.ok, color: "#22c55e" },
        { label: "Low", value: totals.low, color: "#f59e0b" },
        { label: "Critical", value: totals.critical, color: "#f97316" },
        { label: "Out", value: totals.out, color: "#ef4444" },
      ].filter((d) => d.value > 0),
    [totals]
  );

  const coverageBuckets = useMemo(() => {
    const b = {
      "0× (Out)": 0,
      "< 1×": 0,
      "1–2×": 0,
      "2–5×": 0,
      "5×+": 0,
    };

    enriched.forEach((r) => {
      if (r.qty_on_hand === 0) b["0× (Out)"]++;
      else if (r.coverage < 1) b["< 1×"]++;
      else if (r.coverage < 2) b["1–2×"]++;
      else if (r.coverage < 5) b["2–5×"]++;
      else b["5×+"]++;
    });

    return Object.entries(b).map(([name, count]) => ({ name, count }));
  }, [enriched]);

  const top10ByValue = useMemo(
    () =>
      [...enriched]
        .sort((a, b) => b.total_value - a.total_value)
        .slice(0, 10),
    [enriched]
  );

  const paretoData = useMemo(() => {
    const sorted = [...enriched].sort((a, b) => b.total_value - a.total_value);
    const total = sorted.reduce((s, r) => s + r.total_value, 0) || 1;

    let cum = 0;

    return sorted.slice(0, 20).map((r, i) => {
      cum += r.total_value;

      return {
        name: r.name,
        cumPct: parseFloat(((cum / total) * 100).toFixed(1)),
        rank: i + 1,
      };
    });
  }, [enriched]);

  const tableRows = useMemo(() => {
    const term = q.trim().toLowerCase();

    return enriched
      .filter((r) => {
        const matchText =
          !term ||
          r.name.toLowerCase().includes(term) ||
          (r.sku ?? "").toLowerCase().includes(term) ||
          (r.category ?? "").toLowerCase().includes(term);

        const matchStatus =
          filterStatus === "all" || r.status === filterStatus;

        return matchText && matchStatus;
      })
      .sort((a, b) => {
        const mul = sortDir === "desc" ? -1 : 1;

        if (sortCol === "urgency") return mul * (a.urgency - b.urgency);
        if (sortCol === "value") return mul * (a.total_value - b.total_value);
        if (sortCol === "qty") return mul * (a.qty_on_hand - b.qty_on_hand);
        if (sortCol === "coverage") return mul * (a.coverage - b.coverage);

        return 0;
      });
  }, [enriched, q, filterStatus, sortCol, sortDir]);

  const insights = useMemo<InventoryInsight[]>(() => {
    if (!enriched.length) return [];

    const totalVal = totals.totalVal || 1;
    const top3Val = top10ByValue
      .slice(0, 3)
      .reduce((s, r) => s + r.total_value, 0);

    const concPct = (top3Val / totalVal) * 100;

    const deadStock = enriched.filter(
      (r) => r.qty_on_hand > 0 && r.reorder_level === 0
    );

    const urgentItems = enriched.filter((r) => r.urgency >= 75);

    const highCapLow = enriched.filter(
      (r) => r.unit_price > 500 && r.status !== "ok"
    );

    const bestCat = [...categoryData].sort((a, b) => b.value - a.value)[0];

    return [
      {
        type: totals.out > 0 ? "critical" : "ok",
        icon: totals.out > 0 ? "🚫" : "✅",
        title:
          totals.out > 0
            ? `${totals.out} product${totals.out > 1 ? "s" : ""} completely out of stock`
            : "No products are out of stock",
        detail:
          totals.out > 0
            ? "Immediate restocking required. Out-of-stock items are active lost-revenue events."
            : "All products have stock. Monitor critical and low items proactively.",
      },
      {
        type: urgentItems.length > 0 ? "warning" : "ok",
        icon: "⏰",
        title: `${urgentItems.length} item${
          urgentItems.length !== 1 ? "s" : ""
        } need urgent reorder action`,
        detail:
          urgentItems.length > 0
            ? `${urgentItems
                .map((r) => r.name)
                .slice(0, 3)
                .join(", ")}${
                urgentItems.length > 3
                  ? ` +${urgentItems.length - 3} more`
                  : ""
              } are at critical or out status.`
            : "All reorder levels are comfortably covered.",
      },
      {
        type: concPct > 60 ? "warning" : "ok",
        icon: "⚖️",
        title: `Top 3 products hold ${concPct.toFixed(0)}% of inventory value`,
        detail:
          concPct > 60
            ? "High concentration risk — a supply disruption on these items would severely impact operations."
            : "Inventory value is reasonably spread across the range.",
      },
      {
        type: totals.atRiskVal > totalVal * 0.3 ? "warning" : "ok",
        icon: "💸",
        title: `${fmtMoney(totals.atRiskVal)} tied up in at-risk stock`,
        detail: `${((totals.atRiskVal / totalVal) * 100).toFixed(
          1
        )}% of total inventory value is in products that are low, critical, or out.`,
      },
      {
        type: deadStock.length > 0 ? "warning" : "ok",
        icon: "💀",
        title: `${deadStock.length} product${
          deadStock.length !== 1 ? "s" : ""
        } may be dead stock`,
        detail:
          deadStock.length > 0
            ? `${deadStock
                .map((r) => r.name)
                .slice(0, 3)
                .join(", ")} have stock but no reorder level set — may be discontinued or forgotten.`
            : "All stocked products have reorder levels configured.",
      },
      {
        type: highCapLow.length > 0 ? "critical" : "ok",
        icon: "💎",
        title: `${highCapLow.length} high-value item${
          highCapLow.length !== 1 ? "s" : ""
        } below healthy stock`,
        detail:
          highCapLow.length > 0
            ? `${highCapLow
                .map((r) => r.name)
                .slice(0, 2)
                .join(", ")} cost over Ksh 500/unit and are low or critical — high restock cost risk.`
            : "All high-value items are well stocked.",
      },
      {
        type: "neutral",
        icon: "📦",
        title: `Highest-value category: ${bestCat?.name ?? "—"}`,
        detail: `${fmtMoney(bestCat?.value ?? 0)} total value across ${
          bestCat?.count ?? 0
        } products. Ensure priority restocking agreements.`,
      },
      {
        type: totals.avgCoverage < 2 ? "warning" : "ok",
        icon: "📊",
        title: `Average stock coverage: ${totals.avgCoverage.toFixed(
          1
        )}× reorder level`,
        detail:
          totals.avgCoverage < 2
            ? "Low average buffer. Most products are close to reorder points — build up safety stock."
            : "Coverage is adequate. Maintain current procurement cadence.",
      },
    ];
  }, [enriched, totals, top10ByValue, categoryData]);

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  };

  if (!orgId && !err) return <Spinner h={200} />;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Inventory Analytics
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {rows.length} products · {fmtMoney(totals.totalVal)} total value
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link href="/dashboard/reports" className={S.btnGhost}>
            ← Reports
          </Link>

          <button
            className={S.btnGhost}
            onClick={fetchData}
            disabled={loading || !orgId}
          >
            ↻ Refresh
          </button>

          <button
            className={S.btnGhost}
            disabled={!enriched.length}
            onClick={() =>
              printInventoryPdfReport({
                rows: enriched,
                totals,
                categoryData,
                insights,
              })
            }
          >
            🖨 PDF
          </button>

          <button
            className={S.btnGhost}
            disabled={!tableRows.length}
            onClick={() =>
              downloadCSV(
                `inventory_${new Date().toISOString().slice(0, 10)}.csv`,
                tableRows.map((r) => ({
                  name: r.name,
                  sku: r.sku ?? "",
                  category: r.category ?? "",
                  qty: r.qty_on_hand,
                  reorder: r.reorder_level,
                  status: r.status,
                  unit_price: r.unit_price,
                  total_value: r.total_value,
                  coverage: r.coverage,
                  urgency: r.urgency,
                }))
              )
            }
          >
            ⬇ CSV
          </button>
        </div>
      </div>

      <SegControl
        value={tab}
        onChange={setTab}
        options={[
          { value: "overview", label: "📊 Overview" },
          { value: "reorder", label: "⏰ Reorder" },
          { value: "valuation", label: "💰 Valuation" },
          { value: "insights", label: "💡 Insights" },
        ]}
      />

      {err && (
        <div className={S.alert}>
          <span>⚠️</span>
          <span className="flex-1">{err}</span>
          <button
            onClick={() => setErr("")}
            className="ml-auto text-red-400 hover:text-red-600"
          >
            ×
          </button>
        </div>
      )}

      {loading && <Spinner h={200} />}

      {!loading && !err && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
            <KpiCard
              label="Total SKUs"
              value={String(rows.length)}
              sub="tracked products"
              icon="📦"
            />

            <KpiCard
              label="Stock Value"
              value={fmtMoney(totals.totalVal)}
              sub="at cost price"
              icon="💰"
              variant="success"
            />

            <KpiCard
              label="At-Risk Value"
              value={fmtMoney(totals.atRiskVal)}
              sub={`${(
                (totals.atRiskVal / (totals.totalVal || 1)) *
                100
              ).toFixed(0)}% of total`}
              icon="⚠️"
              variant="warning"
            />

            <KpiCard
              label="Out of Stock"
              value={String(totals.out)}
              sub="needs immediate action"
              icon="🚫"
              variant={totals.out > 0 ? "danger" : "neutral"}
            />

            <KpiCard
              label="Low / Critical"
              value={String(totals.low + totals.critical)}
              sub="approaching reorder"
              icon="📉"
              variant={
                totals.low + totals.critical > 0 ? "warning" : "neutral"
              }
            />

            <KpiCard
              label="Avg Coverage"
              value={`${totals.avgCoverage.toFixed(1)}×`}
              sub="vs reorder level"
              icon="🛡️"
              variant={totals.avgCoverage < 2 ? "warning" : "success"}
            />
          </div>

          {rows.length === 0 && (
            <div className={`${S.card} py-16 text-center`}>
              <div className="mb-3 text-4xl">📭</div>
              <div className="font-semibold text-slate-600">
                No inventory data found
              </div>
            </div>
          )}

          {rows.length > 0 && (
            <>
              {tab === "overview" && (
                <div className="flex flex-col gap-5">
                  <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                    <Card
                      title="Stock Health Distribution"
                      sub="Hover segments to highlight"
                    >
                      <StatusDonut segs={statusDist} />
                    </Card>

                    <Card
                      title="Coverage Buckets"
                      sub="How many × reorder level each product holds"
                    >
                      <CoverageBar data={coverageBuckets} />
                    </Card>
                  </div>

                  <Card
                    title="Inventory Value by Category"
                    sub="Hover rows for detail"
                  >
                    <CategoryValueBars data={categoryData} />
                  </Card>

                  <Card
                    title="Category Risk Profile"
                    sub="Percentage of at-risk products per category"
                  >
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      {categoryData.map((cat) => {
                        const riskPct =
                          cat.count > 0 ? (cat.atRisk / cat.count) * 100 : 0;

                        const riskColor =
                          riskPct > 60
                            ? "border-red-200 bg-red-50"
                            : riskPct > 30
                            ? "border-orange-200 bg-orange-50"
                            : riskPct > 10
                            ? "border-amber-200 bg-amber-50"
                            : "border-green-200 bg-green-50";

                        const valColor =
                          riskPct > 60
                            ? "text-red-600"
                            : riskPct > 30
                            ? "text-orange-600"
                            : riskPct > 10
                            ? "text-amber-600"
                            : "text-green-600";

                        const barColor =
                          riskPct > 60
                            ? "#ef4444"
                            : riskPct > 30
                            ? "#f97316"
                            : riskPct > 10
                            ? "#f59e0b"
                            : "#22c55e";

                        return (
                          <div
                            key={cat.name}
                            className={`rounded-2xl border p-4 ${riskColor}`}
                          >
                            <div className="mb-1 truncate text-sm font-bold text-slate-900">
                              {cat.name}
                            </div>

                            <div className={`text-2xl font-bold ${valColor}`}>
                              {riskPct.toFixed(0)}%
                            </div>

                            <div className="mb-2 text-xs text-slate-500">
                              at-risk products
                            </div>

                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/60">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${riskPct}%`,
                                  background: barColor,
                                }}
                              />
                            </div>

                            <div className="mt-1.5 text-xs text-slate-400">
                              {cat.atRisk}/{cat.count} · {fmtMoney(cat.value)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                </div>
              )}

              {tab === "reorder" && (
                <div className="flex flex-col gap-5">
                  <div className={`${S.card} p-4`}>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="relative min-w-[200px] flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                          🔍
                        </span>
                        <input
                          className={`${S.input} pl-8`}
                          placeholder="Search product / SKU / category…"
                          value={q}
                          onChange={(e) => setQ(e.target.value)}
                        />
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {(["all", "out", "critical", "low", "ok"] as const).map(
                          (s) => {
                            const isA = filterStatus === s;
                            const cfg =
                              s !== "all" ? STATUS_CFG[s as StockHealth] : null;

                            return (
                              <button
                                key={s}
                                onClick={() => setFilterStatus(s)}
                                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                                  isA
                                    ? "border border-slate-200 bg-white text-slate-900 shadow-sm"
                                    : "border border-slate-200 bg-white text-slate-500 hover:text-slate-700"
                                }`}
                              >
                                {s === "all"
                                  ? "All"
                                  : `${cfg?.icon} ${
                                      s.charAt(0).toUpperCase() + s.slice(1)
                                    }`}
                              </button>
                            );
                          }
                        )}
                      </div>

                      <span className="whitespace-nowrap text-xs text-slate-400">
                        {tableRows.length} of {enriched.length}
                      </span>
                    </div>

                    {(q || filterStatus !== "all") && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {q && (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                            "{q}"
                            <button
                              onClick={() => setQ("")}
                              className="hover:text-amber-900"
                            >
                              ×
                            </button>
                          </span>
                        )}

                        {filterStatus !== "all" && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                            {STATUS_CFG[filterStatus as StockHealth]?.label}
                            <button
                              onClick={() => setFilterStatus("all")}
                              className="hover:text-slate-900"
                            >
                              ×
                            </button>
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className={`${S.card} overflow-hidden`}>
                    <div
                      className="hidden gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 sm:grid"
                      style={{
                        gridTemplateColumns:
                          "2fr 1fr 0.7fr 0.7fr 0.7fr 1fr 1.4fr",
                      }}
                    >
                      <div>Product</div>
                      <div>Category</div>
                      <SortTh
                        col="qty"
                        active={sortCol}
                        dir={sortDir}
                        onSort={toggleSort}
                        align="right"
                      >
                        On Hand
                      </SortTh>
                      <div className="text-right">Reorder At</div>
                      <SortTh
                        col="coverage"
                        active={sortCol}
                        dir={sortDir}
                        onSort={toggleSort}
                        align="right"
                      >
                        Coverage
                      </SortTh>
                      <div>Status</div>
                      <SortTh
                        col="urgency"
                        active={sortCol}
                        dir={sortDir}
                        onSort={toggleSort}
                      >
                        Urgency
                      </SortTh>
                    </div>

                    <div className="max-h-[520px] divide-y divide-slate-100 overflow-y-auto">
                      {tableRows.length === 0 ? (
                        <div className="py-14 text-center text-sm text-slate-400">
                          No products match this filter.
                        </div>
                      ) : (
                        tableRows.map((r) => (
                          <div
                            key={r.product_id}
                            className="grid items-center gap-4 px-5 py-3.5 transition-colors hover:bg-slate-50"
                            style={{
                              gridTemplateColumns:
                                "2fr 1fr 0.7fr 0.7fr 0.7fr 1fr 1.4fr",
                            }}
                          >
                            <div>
                              <div className="truncate text-sm font-semibold text-slate-900">
                                {r.name}
                              </div>
                              {r.sku && (
                                <div className="text-xs text-slate-400">
                                  {r.sku}
                                </div>
                              )}
                            </div>

                            <div className="truncate text-sm text-slate-500">
                              {r.category ?? "—"}
                            </div>

                            <div
                              className={`text-right text-sm font-bold ${
                                r.qty_on_hand === 0
                                  ? "text-red-600"
                                  : "text-slate-900"
                              }`}
                            >
                              {r.qty_on_hand}
                            </div>

                            <div className="text-right text-sm text-slate-400">
                              {r.reorder_level}
                            </div>

                            <div className="text-right text-sm font-bold">
                              <span
                                className={
                                  r.coverage < 1
                                    ? "text-red-600"
                                    : r.coverage < 2
                                    ? "text-amber-600"
                                    : "text-green-600"
                                }
                              >
                                {r.coverage >= 99 ? "∞" : `${r.coverage}×`}
                              </span>
                            </div>

                            <div>
                              <StatusBadge status={r.status as StockHealth} />
                            </div>

                            <div>
                              <UrgencyBar score={r.urgency} />
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-5 py-3">
                      <span className="text-xs text-slate-400">
                        {tableRows.length} of {enriched.length} products
                      </span>
                      <span className="text-xs text-slate-400">
                        Click column headers to sort
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {tab === "valuation" && (
                <div className="flex flex-col gap-5">
                  <Card
                    title="Top 10 Products by Stock Value"
                    sub="Capital locked in these items · colour = status"
                  >
                    <ValueBars
                      data={top10ByValue.map((r) => ({
                        name: r.name,
                        value: r.total_value,
                        status: r.status as StockHealth,
                      }))}
                    />

                    <div className="mt-4 flex flex-wrap gap-4 text-xs">
                      {Object.entries(STATUS_CFG).map(([k, v]) => (
                        <span key={k} className="flex items-center gap-1.5">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ background: v.dot }}
                          />
                          {v.label}
                        </span>
                      ))}
                    </div>
                  </Card>

                  <Card
                    title="Pareto — Cumulative Value %"
                    sub="Blue bars = A-items, first 80% of value"
                  >
                    <ParetoChart data={paretoData} />
                    <p className="mt-2 text-xs text-slate-400">
                      🔵 Blue bars are the products that make up the first 80% of
                      inventory value.
                    </p>
                  </Card>

                  <div className={`${S.card} overflow-hidden`}>
                    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                      <div>
                        <div className="font-bold text-slate-900">
                          Full Product Valuation
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          Sorted by value descending
                        </div>
                      </div>
                      <span className="text-xs text-slate-400">
                        {enriched.length} products
                      </span>
                    </div>

                    <div
                      className="hidden gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 sm:grid"
                      style={{
                        gridTemplateColumns: "2fr 0.8fr 1fr 1fr 1fr 1fr",
                      }}
                    >
                      <div>Product</div>
                      <div>SKU</div>
                      <div>Category</div>
                      <div className="text-right">Qty</div>
                      <div className="text-right">Unit Price</div>
                      <div className="text-right">Total Value</div>
                    </div>

                    <div className="max-h-[520px] divide-y divide-slate-100 overflow-y-auto">
                      {[...enriched]
                        .sort((a, b) => b.total_value - a.total_value)
                        .map((r) => (
                          <div
                            key={r.product_id}
                            className="grid items-center gap-4 px-5 py-3.5 transition-colors hover:bg-slate-50"
                            style={{
                              gridTemplateColumns:
                                "2fr 0.8fr 1fr 1fr 1fr 1fr",
                            }}
                          >
                            <div>
                              <div className="truncate text-sm font-semibold text-slate-900">
                                {r.name}
                              </div>
                              <StatusBadge status={r.status as StockHealth} />
                            </div>

                            <div className="text-xs text-slate-400">
                              {r.sku ?? "—"}
                            </div>

                            <div className="truncate text-sm text-slate-500">
                              {r.category ?? "—"}
                            </div>

                            <div className="text-right text-sm font-bold text-slate-900">
                              {r.qty_on_hand}
                            </div>

                            <div className="text-right text-sm text-slate-600">
                              {fmtMoney(r.unit_price)}
                            </div>

                            <div className="text-right">
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-900">
                                {fmtMoney(r.total_value)}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>

                    <div className="flex justify-between border-t border-slate-100 bg-slate-50 px-5 py-3">
                      <span className="text-xs text-slate-500">
                        {enriched.length} products
                      </span>
                      <span className="text-sm font-bold text-slate-900">
                        {fmtMoney(totals.totalVal)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {tab === "insights" && (
                <div className="flex flex-col gap-5">
                  <p className="text-sm text-slate-500">
                    Automated analysis of{" "}
                    <span className="font-semibold text-slate-700">
                      {rows.length} products
                    </span>{" "}
                    · {fmtMoney(totals.totalVal)} total inventory value
                  </p>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {insights.map((ins, i) => (
                      <InsightCard key={i} {...ins} />
                    ))}
                  </div>

                  <Card
                    title="📋 Report Summary"
                    sub="Plain-language interpretation of this inventory position"
                  >
                    <div className="space-y-4 text-sm leading-relaxed text-slate-600">
                      <p>
                        The business currently tracks{" "}
                        <span className="font-bold text-slate-900">
                          {rows.length}
                        </span>{" "}
                        products with a total inventory value of{" "}
                        <span className="font-bold text-slate-900">
                          {fmtMoney(totals.totalVal)}
                        </span>
                        .
                      </p>

                      <p>
                        Out of this value,{" "}
                        <span className="font-bold text-amber-700">
                          {fmtMoney(totals.atRiskVal)}
                        </span>{" "}
                        is tied up in products that are either low, critical, or
                        out of stock. This represents{" "}
                        <span className="font-bold text-amber-700">
                          {(
                            (totals.atRiskVal / (totals.totalVal || 1)) *
                            100
                          ).toFixed(1)}
                          %
                        </span>{" "}
                        of total inventory value.
                      </p>

                      <p>
                        There are{" "}
                        <span className="font-bold text-red-600">
                          {totals.out}
                        </span>{" "}
                        out-of-stock products,{" "}
                        <span className="font-bold text-orange-600">
                          {totals.critical}
                        </span>{" "}
                        critical products, and{" "}
                        <span className="font-bold text-amber-600">
                          {totals.low}
                        </span>{" "}
                        low-stock products. These should be reviewed before new
                        sales demand causes fulfilment problems.
                      </p>

                      <p>
                        Average stock coverage is{" "}
                        <span className="font-bold text-slate-900">
                          {totals.avgCoverage.toFixed(1)}×
                        </span>{" "}
                        the reorder level. A healthy inventory position normally
                        needs enough buffer to cover supplier lead times and
                        sudden increases in demand.
                      </p>
                    </div>
                  </Card>

                  <Card
                    title="🗂️ Inventory Action Plan"
                    sub="Priority-ordered steps based on your data"
                  >
                    <div className="divide-y divide-slate-100">
                      {[
                        {
                          step: "01",
                          priority: "URGENT",
                          color: "bg-red-500",
                          textColor: "text-red-500",
                          action: "Restock out-of-stock items immediately",
                          detail:
                            totals.out > 0
                              ? `${totals.out} product(s) are generating zero revenue right now. Contact suppliers today.`
                              : "No out-of-stock items currently. Monitor critical items before they hit zero.",
                        },
                        {
                          step: "02",
                          priority: "HIGH",
                          color: "bg-orange-500",
                          textColor: "text-orange-500",
                          action: "Place reorder for critical-level items",
                          detail:
                            totals.critical > 0
                              ? `${totals.critical} item(s) are at critical levels. Place orders now to account for supplier lead times.`
                              : "No critical items. Schedule a weekly reorder review to stay ahead.",
                        },
                        {
                          step: "03",
                          priority: "MEDIUM",
                          color: "bg-amber-500",
                          textColor: "text-amber-500",
                          action:
                            "ABC analysis — protect your top 20% value SKUs",
                          detail: `Your top 3 products hold ${(
                            (top10ByValue
                              .slice(0, 3)
                              .reduce((s, r) => s + r.total_value, 0) /
                              (totals.totalVal || 1)) *
                            100
                          ).toFixed(
                            0
                          )}% of inventory value. These A-items need dedicated safety stock and supplier SLAs.`,
                        },
                        {
                          step: "04",
                          priority: "MEDIUM",
                          color: "bg-amber-500",
                          textColor: "text-amber-500",
                          action:
                            "Investigate dead stock and zero-reorder-level items",
                          detail:
                            "Products with stock but no reorder level may be discontinued or forgotten. Review each — liquidate, bundle-sell, or reactivate.",
                        },
                        {
                          step: "05",
                          priority: "LOW",
                          color: "bg-blue-500",
                          textColor: "text-blue-500",
                          action:
                            "Renegotiate terms for high-value, low-coverage items",
                          detail:
                            "High unit-price items that frequently drop to low/critical represent cash-flow risk. Negotiate consignment or JIT delivery with suppliers.",
                        },
                      ].map((rec) => (
                        <div
                          key={rec.step}
                          className="flex items-start gap-4 py-4"
                        >
                          <div className="flex shrink-0 flex-col items-center gap-1.5">
                            <div
                              className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold text-white ${rec.color}`}
                            >
                              {rec.step}
                            </div>
                            <span
                              className={`text-[9px] font-bold uppercase tracking-wide ${rec.textColor}`}
                            >
                              {rec.priority}
                            </span>
                          </div>

                          <div>
                            <div className="mb-0.5 text-sm font-bold text-slate-900">
                              {rec.action}
                            </div>
                            <div className="text-xs leading-relaxed text-slate-500">
                              {rec.detail}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <div className={`${S.card} overflow-hidden`}>
                    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                      <div className="font-bold text-slate-900">
                        Category Summary
                      </div>
                      <span className="text-xs text-slate-400">
                        {categoryData.length} categories
                      </span>
                    </div>

                    <div
                      className="hidden gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 sm:grid"
                      style={{
                        gridTemplateColumns:
                          "1.5fr 0.6fr 0.6fr 1.2fr 0.8fr 1fr",
                      }}
                    >
                      <div>Category</div>
                      <div className="text-right">Products</div>
                      <div className="text-right">At Risk</div>
                      <div>Risk %</div>
                      <div className="text-right">Total Qty</div>
                      <div className="text-right">Stock Value</div>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {categoryData.map((cat) => {
                        const riskPct =
                          cat.count > 0 ? (cat.atRisk / cat.count) * 100 : 0;

                        const barColor =
                          riskPct > 60
                            ? "#ef4444"
                            : riskPct > 30
                            ? "#f97316"
                            : riskPct > 0
                            ? "#f59e0b"
                            : "#22c55e";

                        return (
                          <div
                            key={cat.name}
                            className="grid items-center gap-4 px-5 py-3.5 transition-colors hover:bg-slate-50"
                            style={{
                              gridTemplateColumns:
                                "1.5fr 0.6fr 0.6fr 1.2fr 0.8fr 1fr",
                            }}
                          >
                            <div className="text-sm font-semibold text-slate-900">
                              {cat.name}
                            </div>

                            <div className="text-right text-sm text-slate-600">
                              {cat.count}
                            </div>

                            <div
                              className="text-right text-sm font-bold"
                              style={{ color: barColor }}
                            >
                              {cat.atRisk}
                            </div>

                            <div className="flex items-center gap-2">
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${riskPct}%`,
                                    background: barColor,
                                  }}
                                />
                              </div>
                              <span
                                className="w-8 text-right text-xs font-bold"
                                style={{ color: barColor }}
                              >
                                {riskPct.toFixed(0)}%
                              </span>
                            </div>

                            <div className="text-right text-sm text-slate-600">
                              {cat.qty.toLocaleString()}
                            </div>

                            <div className="text-right">
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-900">
                                {fmtMoney(cat.value)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex justify-between border-t border-slate-100 bg-slate-50 px-5 py-3">
                      <span className="text-xs text-slate-500">
                        {categoryData.length} categories · {rows.length} products
                      </span>
                      <span className="text-sm font-bold text-slate-900">
                        {fmtMoney(totals.totalVal)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}