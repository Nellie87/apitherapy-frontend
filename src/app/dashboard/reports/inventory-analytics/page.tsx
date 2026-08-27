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
  isWithinDateRange,
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
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
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

  const filteredBaseRows = useMemo(() => {
    return enriched.filter((r) => isWithinDateRange(r, from, to));
  }, [enriched, from, to]);

  const totals = useMemo<Totals>(() => {
    const out = filteredBaseRows.filter((r) => r.status === "out").length;
    const critical = filteredBaseRows.filter((r) => r.status === "critical").length;
    const low = filteredBaseRows.filter((r) => r.status === "low").length;
    const ok = filteredBaseRows.filter((r) => r.status === "ok").length;

    const totalVal = filteredBaseRows.reduce((s, r) => s + r.total_value, 0);
    const atRiskVal = filteredBaseRows
      .filter((r) => r.status !== "ok")
      .reduce((s, r) => s + r.total_value, 0);

    const avgCoverage = filteredBaseRows.length
      ? filteredBaseRows.reduce((s, r) => s + r.coverage, 0) /
        filteredBaseRows.length
      : 0;

    const totalQty = filteredBaseRows.reduce((s, r) => s + r.qty_on_hand, 0);

    return { out, critical, low, ok, totalVal, atRiskVal, avgCoverage, totalQty };
  }, [filteredBaseRows]);

  const categoryData = useMemo<CategoryData[]>(() => {
    const map: Record<string, CategoryData> = {};

    filteredBaseRows.forEach((r) => {
      const cat = r.category ?? "Uncategorised";

      if (!map[cat]) {
        map[cat] = { name: cat, value: 0, qty: 0, count: 0, atRisk: 0 };
      }

      map[cat].value += r.total_value;
      map[cat].qty += r.qty_on_hand;
      map[cat].count += 1;
      if (r.status !== "ok") map[cat].atRisk += 1;
    });

    return Object.values(map).sort((a, b) => b.value - a.value);
  }, [filteredBaseRows]);

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
      "0×": 0,
      "< 1×": 0,
      "1–2×": 0,
      "2–5×": 0,
      "5×+": 0,
    };

    filteredBaseRows.forEach((r) => {
      if (r.qty_on_hand === 0) b["0×"]++;
      else if (r.coverage < 1) b["< 1×"]++;
      else if (r.coverage < 2) b["1–2×"]++;
      else if (r.coverage < 5) b["2–5×"]++;
      else b["5×+"]++;
    });

    return Object.entries(b).map(([name, count]) => ({ name, count }));
  }, [filteredBaseRows]);

  const top10ByValue = useMemo(
    () =>
      [...filteredBaseRows]
        .sort((a, b) => b.total_value - a.total_value)
        .slice(0, 10),
    [filteredBaseRows]
  );

  const paretoData = useMemo(() => {
    const sorted = [...filteredBaseRows].sort(
      (a, b) => b.total_value - a.total_value
    );
    const total = sorted.reduce((s, r) => s + r.total_value, 0) || 1;
    let cum = 0;

    return sorted.slice(0, 20).map((r, i) => {
      cum += r.total_value;
      return {
        name: r.name,
        cumPct: Number(((cum / total) * 100).toFixed(1)),
        rank: i + 1,
      };
    });
  }, [filteredBaseRows]);

  const tableRows = useMemo(() => {
    const term = q.trim().toLowerCase();

    return filteredBaseRows
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
  }, [filteredBaseRows, q, filterStatus, sortCol, sortDir]);

  const insights = useMemo<InventoryInsight[]>(() => {
    if (!filteredBaseRows.length) return [];

    const totalVal = totals.totalVal || 1;
    const urgentItems = filteredBaseRows.filter((r) => r.urgency >= 75);
    const deadStock = filteredBaseRows.filter(
      (r) => r.qty_on_hand > 0 && r.reorder_level === 0
    );

    const top3Val = top10ByValue
      .slice(0, 3)
      .reduce((s, r) => s + r.total_value, 0);

    const concPct = (top3Val / totalVal) * 100;
    const bestCat = [...categoryData].sort((a, b) => b.value - a.value)[0];

    return [
      {
        type: totals.out > 0 ? "critical" : "ok",
        title:
          totals.out > 0
            ? `${totals.out} product${totals.out > 1 ? "s are" : " is"} out of stock`
            : "No products are out of stock",
        detail:
          totals.out > 0
            ? "Restock these first because they cannot currently support sales."
            : "Stock availability is stable. Continue monitoring low and critical products.",
      },
      {
        type: urgentItems.length > 0 ? "warning" : "ok",
        title: `${urgentItems.length} urgent reorder item${
          urgentItems.length !== 1 ? "s" : ""
        }`,
        detail:
          urgentItems.length > 0
            ? `${urgentItems
                .map((r) => r.name)
                .slice(0, 3)
                .join(", ")}${
                urgentItems.length > 3 ? ` and ${urgentItems.length - 3} more` : ""
              } need attention.`
            : "No urgent reorder action is required from the current data.",
      },
      {
        type: totals.atRiskVal > totalVal * 0.3 ? "warning" : "ok",
        title: `${fmtMoney(totals.atRiskVal)} at risk`,
        detail: `${((totals.atRiskVal / totalVal) * 100).toFixed(
          1
        )}% of stock value is in low, critical, or out-of-stock products.`,
      },
      {
        type: concPct > 60 ? "warning" : "neutral",
        title: `Top 3 products hold ${concPct.toFixed(0)}% of stock value`,
        detail:
          concPct > 60
            ? "Value is concentrated in a few products, so these need reliable supplier coverage."
            : "Stock value is reasonably spread across products.",
      },
      {
        type: deadStock.length > 0 ? "warning" : "ok",
        title: `${deadStock.length} product${
          deadStock.length !== 1 ? "s" : ""
        } with no reorder level`,
        detail:
          deadStock.length > 0
            ? "Review whether these products should be restocked, discontinued, or configured properly."
            : "All stocked products have reorder levels configured.",
      },
      {
        type: "neutral",
        title: `Highest-value category: ${bestCat?.name ?? "—"}`,
        detail: `${fmtMoney(bestCat?.value ?? 0)} across ${
          bestCat?.count ?? 0
        } products.`,
      },
    ];
  }, [filteredBaseRows, totals, top10ByValue, categoryData]);

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
      return;
    }

    setSortCol(col);
    setSortDir("desc");
  };

  const clearFilters = () => {
    setQ("");
    setFrom("");
    setTo("");
    setFilterStatus("all");
  };

  const exportRows = tableRows.map((r) => ({
    name: r.name,
    sku: r.sku ?? "",
    category: r.category ?? "",
    qty_on_hand: r.qty_on_hand,
    reorder_level: r.reorder_level,
    status: r.status,
    unit_price: r.unit_price,
    total_value: r.total_value,
    coverage: r.coverage,
    urgency: r.urgency,
  }));

  if (!orgId && !err) return <Spinner h={200} />;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="font-display text-[2rem] leading-tight tracking-tight text-[#1f1b14]">
            Inventory analytics
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {filteredBaseRows.length} products · {fmtMoney(totals.totalVal)} stock value
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/dashboard/reports" className={S.btnGhost}>
            Reports
          </Link>

          <button
            className={S.btnGhost}
            onClick={fetchData}
            disabled={loading || !orgId}
          >
            Refresh
          </button>

          <button
            className={S.btnGhost}
            disabled={!tableRows.length}
            onClick={() =>
              printInventoryPdfReport({
                rows: tableRows,
                totals,
                categoryData,
                insights,
                from,
                to,
              })
            }
          >
            Export PDF
          </button>

          <button
            className={S.btnGhost}
            disabled={!tableRows.length}
            onClick={() =>
              downloadCSV(
                `inventory_${new Date().toISOString().slice(0, 10)}.csv`,
                exportRows
              )
            }
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className={`${S.card} p-4`}>
        <div className="grid gap-3 md:grid-cols-[1fr_160px_160px_auto] md:items-end">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">
              Search
            </label>
            <input
              className={S.input}
              placeholder="Search product, SKU, or category"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">
              From
            </label>
            <input
              type="date"
              className={S.input}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">
              To
            </label>
            <input
              type="date"
              className={S.input}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>

          <button className={S.btnGhost} onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      </div>

      <SegControl
        value={tab}
        onChange={setTab}
        options={[
          { value: "overview", label: "Overview" },
          { value: "reorder", label: "Reorder" },
          { value: "valuation", label: "Valuation" },
          { value: "insights", label: "Insights" },
        ]}
      />

      {err && (
        <div className={S.alert}>
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <KpiCard label="Total SKUs" value={String(filteredBaseRows.length)} sub="tracked products" />
            <KpiCard label="Stock Value" value={fmtMoney(totals.totalVal)} sub="at cost price" variant="success" />
            <KpiCard
              label="At-Risk Value"
              value={fmtMoney(totals.atRiskVal)}
              sub={`${((totals.atRiskVal / (totals.totalVal || 1)) * 100).toFixed(0)}% of total`}
              variant="warning"
            />
            <KpiCard label="Out of Stock" value={String(totals.out)} sub="needs action" variant={totals.out > 0 ? "danger" : "neutral"} />
            <KpiCard label="Low / Critical" value={String(totals.low + totals.critical)} sub="below healthy level" variant={totals.low + totals.critical > 0 ? "warning" : "neutral"} />
            <KpiCard label="Avg Coverage" value={`${totals.avgCoverage.toFixed(1)}×`} sub="vs reorder level" variant={totals.avgCoverage < 2 ? "warning" : "success"} />
          </div>

          {filteredBaseRows.length === 0 ? (
            <div className={`${S.card} py-16 text-center`}>
              <div className="font-semibold text-slate-600">
                No inventory data found for the selected filters.
              </div>
            </div>
          ) : (
            <>
              {tab === "overview" && (
                <div className="flex flex-col gap-5">
                  <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                    <Card title="Stock Health" sub="Current product status distribution">
                      <StatusDonut segs={statusDist} />
                    </Card>

                    <Card title="Coverage Buckets" sub="Products grouped by reorder coverage">
                      <CoverageBar data={coverageBuckets} />
                    </Card>
                  </div>

                  <Card title="Inventory Value by Category" sub="Category value based on filtered inventory">
                    <CategoryValueBars data={categoryData} />
                  </Card>

                  <Card title="Category Risk Profile" sub="At-risk products by category">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {categoryData.map((cat) => {
                        const riskPct = cat.count ? (cat.atRisk / cat.count) * 100 : 0;

                        return (
                          <div key={cat.name} className="rounded-2xl border border-slate-200 bg-white p-4">
                            <div className="truncate text-sm font-bold text-slate-900">
                              {cat.name}
                            </div>
                            <div className="mt-2 text-2xl font-bold text-slate-900">
                              {riskPct.toFixed(0)}%
                            </div>
                            <div className="text-xs text-slate-500">
                              {cat.atRisk} of {cat.count} products at risk
                            </div>
                            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-amber-500"
                                style={{ width: `${riskPct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                </div>
              )}

              {tab === "reorder" && (
                <div className={`${S.card} overflow-hidden`}>
                  <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-bold text-slate-900">Reorder Priority</div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {tableRows.length} of {filteredBaseRows.length} products
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {(["all", "out", "critical", "low", "ok"] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => setFilterStatus(s)}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                            filterStatus === s
                              ? "border-amber-500 bg-amber-50 text-amber-700"
                              : "border-slate-200 bg-white text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          {s === "all"
                            ? "All"
                            : STATUS_CFG[s as StockHealth]?.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <div className="min-w-[900px]">
                      <div
                        className="grid gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3"
                        style={{ gridTemplateColumns: "2fr 1fr .7fr .7fr .7fr 1fr 1.4fr" }}
                      >
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Product</div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Category</div>
                        <SortTh col="qty" active={sortCol} dir={sortDir} onSort={toggleSort} align="right">On Hand</SortTh>
                        <div className="text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Reorder</div>
                        <SortTh col="coverage" active={sortCol} dir={sortDir} onSort={toggleSort} align="right">Coverage</SortTh>
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</div>
                        <SortTh col="urgency" active={sortCol} dir={sortDir} onSort={toggleSort}>Urgency</SortTh>
                      </div>

                      <div className="max-h-[560px] divide-y divide-slate-100 overflow-y-auto">
                        {tableRows.length === 0 ? (
                          <div className="py-14 text-center text-sm text-slate-400">
                            No products match this filter.
                          </div>
                        ) : (
                          tableRows.map((r) => (
                            <div
                              key={r.product_id}
                              className="grid items-center gap-4 px-5 py-3.5 hover:bg-slate-50"
                              style={{ gridTemplateColumns: "2fr 1fr .7fr .7fr .7fr 1fr 1.4fr" }}
                            >
                              <div>
                                <div className="truncate text-sm font-semibold text-slate-900">{r.name}</div>
                                {r.sku && <div className="text-xs text-slate-400">{r.sku}</div>}
                              </div>
                              <div className="truncate text-sm text-slate-500">{r.category ?? "—"}</div>
                              <div className="text-right text-sm font-bold text-slate-900">{r.qty_on_hand}</div>
                              <div className="text-right text-sm text-slate-500">{r.reorder_level}</div>
                              <div className="text-right text-sm font-bold text-slate-900">
                                {r.coverage >= 99 ? "∞" : `${r.coverage}×`}
                              </div>
                              <StatusBadge status={r.status as StockHealth} />
                              <UrgencyBar score={r.urgency} />
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {tab === "valuation" && (
                <div className="flex flex-col gap-5">
                  <Card title="Top Products by Stock Value" sub="Highest-value products in current filter">
                    <ValueBars
                      data={top10ByValue.map((r) => ({
                        name: r.name,
                        value: r.total_value,
                        status: r.status as StockHealth,
                      }))}
                    />
                  </Card>

                  <Card title="Cumulative Value" sub="Shows how quickly stock value concentrates">
                    <ParetoChart data={paretoData} />
                  </Card>

                  <div className={`${S.card} overflow-hidden`}>
                    <div className="border-b border-slate-100 px-5 py-4">
                      <div className="font-bold text-slate-900">Product Valuation</div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        Sorted by stock value
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <div className="min-w-[820px]">
                        <div
                          className="grid gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3"
                          style={{ gridTemplateColumns: "2fr .8fr 1fr .7fr 1fr 1fr" }}
                        >
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Product</div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">SKU</div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Category</div>
                          <div className="text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Qty</div>
                          <div className="text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Unit Price</div>
                          <SortTh col="value" active={sortCol} dir={sortDir} onSort={toggleSort} align="right">Total Value</SortTh>
                        </div>

                        <div className="max-h-[560px] divide-y divide-slate-100 overflow-y-auto">
                          {[...tableRows]
                            .sort((a, b) => b.total_value - a.total_value)
                            .map((r) => (
                              <div
                                key={r.product_id}
                                className="grid items-center gap-4 px-5 py-3.5 hover:bg-slate-50"
                                style={{ gridTemplateColumns: "2fr .8fr 1fr .7fr 1fr 1fr" }}
                              >
                                <div>
                                  <div className="truncate text-sm font-semibold text-slate-900">{r.name}</div>
                                  <div className="mt-1">
                                    <StatusBadge status={r.status as StockHealth} />
                                  </div>
                                </div>
                                <div className="text-xs text-slate-400">{r.sku ?? "—"}</div>
                                <div className="truncate text-sm text-slate-500">{r.category ?? "—"}</div>
                                <div className="text-right text-sm font-bold text-slate-900">{r.qty_on_hand}</div>
                                <div className="text-right text-sm text-slate-600">{fmtMoney(r.unit_price)}</div>
                                <div className="text-right text-sm font-bold text-slate-900">{fmtMoney(r.total_value)}</div>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between border-t border-slate-100 bg-slate-50 px-5 py-3">
                      <span className="text-xs text-slate-500">{tableRows.length} products</span>
                      <span className="text-sm font-bold text-slate-900">{fmtMoney(totals.totalVal)}</span>
                    </div>
                  </div>
                </div>
              )}

              {tab === "insights" && (
                <div className="flex flex-col gap-5">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {insights.map((ins, i) => (
                      <InsightCard key={i} {...ins} />
                    ))}
                  </div>

                  <Card title="Action Plan" sub="Practical next steps from the current inventory position">
                    <div className="divide-y divide-slate-100">
                      {[
                        {
                          step: "01",
                          title: "Restock out-of-stock products",
                          detail:
                            totals.out > 0
                              ? `${totals.out} product(s) cannot currently support sales.`
                              : "No out-of-stock products currently.",
                        },
                        {
                          step: "02",
                          title: "Review critical and low-stock products",
                          detail: `${totals.critical + totals.low} product(s) are below healthy stock levels.`,
                        },
                        {
                          step: "03",
                          title: "Protect high-value products",
                          detail: "Products with high stock value should have reliable supplier coverage.",
                        },
                        {
                          step: "04",
                          title: "Check missing reorder levels",
                          detail: "Products with stock but no reorder level should be reviewed and configured.",
                        },
                      ].map((item) => (
                        <div key={item.step} className="flex gap-4 py-4">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-700">
                            {item.step}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-900">{item.title}</div>
                            <div className="mt-1 text-xs leading-relaxed text-slate-500">{item.detail}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card title="Category Summary" sub="Value and risk by category" noPad>
                    <div className="overflow-x-auto">
                      <div className="min-w-[820px]">
                        <div
                          className="grid gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3"
                          style={{ gridTemplateColumns: "1.5fr .7fr .7fr 1.2fr .8fr 1fr" }}
                        >
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Category</div>
                          <div className="text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Products</div>
                          <div className="text-right text-xs font-semibold uppercase tracking-wide text-slate-500">At Risk</div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Risk</div>
                          <div className="text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Qty</div>
                          <div className="text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Value</div>
                        </div>

                        <div className="divide-y divide-slate-100">
                          {categoryData.map((cat) => {
                            const riskPct = cat.count ? (cat.atRisk / cat.count) * 100 : 0;

                            return (
                              <div
                                key={cat.name}
                                className="grid items-center gap-4 px-5 py-3.5 hover:bg-slate-50"
                                style={{ gridTemplateColumns: "1.5fr .7fr .7fr 1.2fr .8fr 1fr" }}
                              >
                                <div className="text-sm font-semibold text-slate-900">{cat.name}</div>
                                <div className="text-right text-sm text-slate-600">{cat.count}</div>
                                <div className="text-right text-sm font-bold text-slate-900">{cat.atRisk}</div>
                                <div className="flex items-center gap-2">
                                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                                    <div className="h-full rounded-full bg-amber-500" style={{ width: `${riskPct}%` }} />
                                  </div>
                                  <span className="w-9 text-right text-xs font-bold text-slate-700">
                                    {riskPct.toFixed(0)}%
                                  </span>
                                </div>
                                <div className="text-right text-sm text-slate-600">{cat.qty.toLocaleString()}</div>
                                <div className="text-right text-sm font-bold text-slate-900">{fmtMoney(cat.value)}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}