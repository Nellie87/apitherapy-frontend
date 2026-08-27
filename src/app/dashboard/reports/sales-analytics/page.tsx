"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { exportElementToPdf } from "@/lib/exportPdf";

import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import { listSales, type SaleRowWithItems } from "@/lib/api/sales";
import { listInventory, type InventoryRow } from "@/lib/api/inventory";
import * as S from "../page.styles";

import {
  Card,
  EmptyState,
  ErrorBanner,
  InsightCard,
  KpiCard,
  ReportHeader,
  SegControl,
  Spinner,
  fmtMoney,
} from "../components/report-ui";

import type { NavTab, SortBy } from "./sales-analytics.types";

import {
  bestAndWorstWeekday,
  buildCompareMetrics,
  buildPeriodSummary,
  fmtShortDate,
  getDeadStock,
  paymentMethodLabel,
  previousEqualRange,
  saleDateYMD,
} from "./sales-analytics.helpers";

import {
  CompareBars,
  ProductBar,
  SimpleLineChart,
  WeekdayBars,
} from "./sales-analytics.charts";
import { SalesAnalyticsPdfTemplate } from "./SalesAnalyticsPdfTemplate";

type RangePreset =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "90d"
  | "month"
  | "lastMonth"
  | "custom";

const dateToLocalIso = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const localIsoToDate = (value?: string) => {
  if (!value) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
};

function isCancelledSale(status?: string | null) {
  return ["cancelled", "voided", "void", "refunded"].includes(
    String(status ?? "").trim().toLowerCase(),
  );
}

function isInDateRange(sale: SaleRowWithItems, from: string, to: string) {
  const day = saleDateYMD(sale);
  return day >= from && day <= to;
}

const getPresetRange = (preset: Exclude<RangePreset, "custom">) => {
  const today = new Date();
  const from = new Date(today);
  const to = new Date(today);

  if (preset === "today") {
    return {
      from: dateToLocalIso(today),
      to: dateToLocalIso(today),
      label: "Today",
    };
  }

  if (preset === "yesterday") {
    from.setDate(today.getDate() - 1);
    to.setDate(today.getDate() - 1);

    return {
      from: dateToLocalIso(from),
      to: dateToLocalIso(to),
      label: "Yesterday",
    };
  }

  if (preset === "7d") {
    from.setDate(today.getDate() - 6);

    return {
      from: dateToLocalIso(from),
      to: dateToLocalIso(today),
      label: "Last 7 days",
    };
  }

  if (preset === "30d") {
    from.setDate(today.getDate() - 29);

    return {
      from: dateToLocalIso(from),
      to: dateToLocalIso(today),
      label: "Last 30 days",
    };
  }

  if (preset === "90d") {
    from.setDate(today.getDate() - 89);

    return {
      from: dateToLocalIso(from),
      to: dateToLocalIso(today),
      label: "Last 90 days",
    };
  }

  if (preset === "month") {
    return {
      from: dateToLocalIso(new Date(today.getFullYear(), today.getMonth(), 1)),
      to: dateToLocalIso(today),
      label: "This month",
    };
  }

  return {
    from: dateToLocalIso(
      new Date(today.getFullYear(), today.getMonth() - 1, 1),
    ),
    to: dateToLocalIso(new Date(today.getFullYear(), today.getMonth(), 0)),
    label: "Last month",
  };
};

function pctChange(a: number, b: number) {
  if (!a && !b) return 0;
  if (!a) return null;
  return ((b - a) / Math.abs(a)) * 100;
}

function buildInsights(
  summary: ReturnType<typeof buildPeriodSummary>,
  deadStock: ReturnType<typeof getDeadStock>,
) {
  if (!summary.daily.length && !deadStock.length) return [];

  const insights: {
    type: string;
    title: string;
    detail: string;
  }[] = [];

  if (summary.daily.length) {
    const sortedDays = [...summary.daily].sort((a, b) => b.total - a.total);
    const best = sortedDays[0];
    const worst = sortedDays[sortedDays.length - 1];

    const sortedProducts = [...summary.products].sort(
      (a, b) => b.revenue - a.revenue,
    );

    const top = sortedProducts[0];
    const bottom = sortedProducts[sortedProducts.length - 1];

    const discountRate = summary.gross
      ? (summary.discounts / summary.gross) * 100
      : 0;

    const midpoint = Math.floor(summary.daily.length / 2);

    const firstHalf =
      summary.daily.slice(0, midpoint).reduce((sum, d) => sum + d.total, 0) /
      (midpoint || 1);

    const secondHalf =
      summary.daily.slice(midpoint).reduce((sum, d) => sum + d.total, 0) /
      (summary.daily.length - midpoint || 1);

    const trend = pctChange(firstHalf, secondHalf) ?? 0;
    const { best: bestWd, worst: worstWd } = bestAndWorstWeekday(
      summary.weekdays,
    );

    insights.push(
      {
        type: trend >= 0 ? "positive" : "negative",
        title: `Revenue ${trend >= 0 ? "improved" : "declined"} ${Math.abs(
          trend,
        ).toFixed(1)}%`,
        detail:
          trend >= 0
            ? "Sales momentum improved across the selected period."
            : "Sales momentum softened across the selected period.",
      },
      {
        type: "positive",
        title: `Best day · ${fmtShortDate(best.day)}`,
        detail: `${fmtMoney(best.total)} from ${best.sales_count} transaction${
          best.sales_count !== 1 ? "s" : ""
        }.`,
      },
      {
        type: "warning",
        title: `Lowest day · ${fmtShortDate(worst.day)}`,
        detail: `${fmtMoney(worst.total)} from ${worst.sales_count} transaction${
          worst.sales_count !== 1 ? "s" : ""
        }.`,
      },
    );

    if (bestWd) {
      insights.push({
        type: "positive",
        title: `Best weekday · ${bestWd.label}`,
        detail: `${fmtMoney(bestWd.revenue)} across ${bestWd.sales_count} sale${
          bestWd.sales_count !== 1 ? "s" : ""
        } · avg basket ${fmtMoney(bestWd.avgBasket)}.`,
      });
    }

    if (worstWd && worstWd.weekday !== bestWd?.weekday) {
      insights.push({
        type: "warning",
        title: `Slowest weekday · ${worstWd.label}`,
        detail: `${fmtMoney(worstWd.revenue)} across ${worstWd.sales_count} sale${
          worstWd.sales_count !== 1 ? "s" : ""
        }. Consider promos or staffing changes.`,
      });
    }

    if (top) {
      insights.push({
        type: "positive",
        title: `Top product · ${top.name}`,
        detail: `${fmtMoney(top.revenue)} revenue · ${top.qty} unit${
          top.qty !== 1 ? "s" : ""
        } sold.`,
      });
    }

    if (bottom && sortedProducts.length > 1) {
      insights.push({
        type: "negative",
        title: `Needs attention · ${bottom.name}`,
        detail: `${fmtMoney(bottom.revenue)} revenue · ${bottom.qty} unit${
          bottom.qty !== 1 ? "s" : ""
        } sold.`,
      });
    }

    insights.push({
      type: discountRate > 10 ? "warning" : "neutral",
      title: "Discount impact",
      detail: `${discountRate.toFixed(1)}% of gross revenue was discounted.`,
    });
  }

  const neverSold = deadStock.filter((d) => d.never_sold);
  const dormant = deadStock.filter((d) => !d.never_sold);
  const tiedCost = deadStock.reduce((sum, d) => sum + d.cost_value, 0);

  if (deadStock.length) {
    insights.push({
      type: "warning",
      title: `${deadStock.length} dead-stock product${
        deadStock.length !== 1 ? "s" : ""
      }`,
      detail: `${fmtMoney(tiedCost)} at cost sitting with no sales in this range${
        neverSold.length
          ? ` · ${neverSold.length} never sold`
          : dormant.length
            ? ` · oldest last sold ${dormant[0]?.days_since_sale ?? "?"} days ago`
            : ""
      }.`,
    });
  }

  return insights;
}

function SalesDateRangePicker({
  valuePreset,
  valueFrom,
  valueTo,
  onApply,
  onClose,
}: {
  valuePreset: RangePreset;
  valueFrom: string;
  valueTo: string;
  onApply: (preset: RangePreset, from: string, to: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const [tempPreset, setTempPreset] = useState<RangePreset>(valuePreset);
  const [tempRange, setTempRange] = useState<DateRange | undefined>({
    from: localIsoToDate(valueFrom),
    to: localIsoToDate(valueTo),
  });

  const presetItems: { id: RangePreset; label: string }[] = [
    { id: "today", label: "Today" },
    { id: "yesterday", label: "Yesterday" },
    { id: "7d", label: "Last 7 days" },
    { id: "30d", label: "Last 30 days" },
    { id: "90d", label: "Last 90 days" },
    { id: "month", label: "This month" },
    { id: "lastMonth", label: "Last month" },
    { id: "custom", label: "Custom range" },
  ];

  useEffect(() => {
    setTempPreset(valuePreset);
    setTempRange({
      from: localIsoToDate(valueFrom),
      to: localIsoToDate(valueTo),
    });
  }, [valuePreset, valueFrom, valueTo]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  function applyPreset(preset: RangePreset) {
    setTempPreset(preset);

    if (preset === "custom") return;

    const next = getPresetRange(preset);
    setTempRange({
      from: localIsoToDate(next.from),
      to: localIsoToDate(next.to),
    });
  }

  function handleApply() {
    if (!tempRange?.from) return;

    const from = dateToLocalIso(tempRange.from);
    const to = dateToLocalIso(tempRange.to ?? tempRange.from);

    onApply(tempPreset, from, to);
    onClose();
  }

  const footerLabel = tempRange?.from
    ? `${dateToLocalIso(tempRange.from)} → ${dateToLocalIso(tempRange.to ?? tempRange.from)}`
    : "Select a date range";

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full z-[9999] mt-3 w-[min(430px,calc(100vw-1.5rem))] overflow-hidden rounded-[22px] border border-[#EADFC2] bg-white shadow-2xl"
      style={{ boxShadow: "0 24px 70px rgba(92, 64, 16, 0.16)" }}
    >
      <div className="grid grid-cols-1">
        <div className="border-b border-[#F1E6C9] bg-[#FFFDF8] p-2">
          {presetItems.map((item) => {
            const active = tempPreset === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => applyPreset(item.id)}
                className={`mb-1 mr-1 inline-flex rounded-xl px-3 py-2 text-left text-xs font-bold transition ${
                  active
                    ? "bg-[#2F2718] text-white shadow-sm"
                    : "text-slate-600 hover:bg-white hover:text-slate-950"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="bg-white p-3 sm:p-4">
          <DayPicker
            mode="range"
            selected={tempRange}
            onSelect={(nextRange) => {
              setTempPreset("custom");
              setTempRange(nextRange);
            }}
            defaultMonth={tempRange?.from ?? new Date()}
            numberOfMonths={1}
            showOutsideDays
            disabled={{ after: new Date() }}
            className="sales-rdp"
            classNames={{
              months: "flex flex-col",
              month: "space-y-2",
              caption: "relative flex items-center justify-center",
              caption_label: "text-xs font-black text-slate-900",
              nav: "flex items-center gap-2",
              nav_button:
                "h-7 w-7 rounded-full text-slate-500 transition hover:bg-[#FFF8E6] hover:text-slate-950",
              table: "w-full border-collapse",
              head_row: "flex",
              head_cell:
                "w-8 flex-1 text-center text-[10px] font-black uppercase text-slate-400",
              row: "mt-1 flex w-full",
              cell: "relative h-8 flex-1 p-0 text-center text-xs",
              day: "h-8 w-8 rounded-xl text-xs font-bold text-slate-700 transition hover:bg-[#FFF8E6] hover:text-slate-950",
              day_selected:
                "bg-[#2F2718] text-white hover:bg-[#2F2718] hover:text-white",
              day_today: "border border-amber-300 bg-amber-50 text-amber-800",
              day_outside: "text-slate-300",
              day_disabled: "text-slate-300 opacity-40",
              day_range_middle:
                "rounded-none bg-[#FFF4CC] text-slate-900 hover:bg-[#FFF4CC]",
              day_range_start:
                "rounded-l-xl rounded-r-none bg-[#2F2718] text-white hover:bg-[#2F2718]",
              day_range_end:
                "rounded-l-none rounded-r-xl bg-[#2F2718] text-white hover:bg-[#2F2718]",
            }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-[#F1E6C9] bg-[#FFFDF8] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs font-bold text-slate-600">{footerLabel}</div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#EADFC2] bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-[#FFF8E6]"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleApply}
            disabled={!tempRange?.from}
            className="rounded-xl bg-[#2F2718] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#1F1A10] disabled:opacity-50"
          >
            Apply range
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SalesAnalyticsPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [allSales, setAllSales] = useState<SaleRowWithItems[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const initialRange = getPresetRange("30d");
  const initialCompareA = previousEqualRange(initialRange.from, initialRange.to);

  const [rangePreset, setRangePreset] = useState<RangePreset>("30d");
  const [fromDate, setFromDate] = useState(initialRange.from);
  const [toDate, setToDate] = useState(initialRange.to);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCompareAPicker, setShowCompareAPicker] = useState(false);
  const [showCompareBPicker, setShowCompareBPicker] = useState(false);
  const [tab, setTab] = useState<NavTab>("overview");
  const [sortBy, setSortBy] = useState<SortBy>("revenue");
  const [exportingPdf, setExportingPdf] = useState(false);
  const [compareSynced, setCompareSynced] = useState(true);

  const [compareAFrom, setCompareAFrom] = useState(initialCompareA.from);
  const [compareATo, setCompareATo] = useState(initialCompareA.to);
  const [compareBFrom, setCompareBFrom] = useState(initialRange.from);
  const [compareBTo, setCompareBTo] = useState(initialRange.to);

  useEffect(() => {
    (async () => {
      try {
        const o = await bootstrapOrg();
        setOrgId(o);
      } catch (e: any) {
        setErr(e.message ?? String(e));
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!orgId) return;

    let live = true;

    (async () => {
      setLoading(true);
      setErr("");

      try {
        const [salesData, inventoryData] = await Promise.all([
          listSales(orgId),
          listInventory(orgId),
        ]);
        if (live) {
          setAllSales(salesData);
          setInventory(inventoryData);
        }
      } catch (e: any) {
        if (live) setErr(e.message ?? String(e));
      } finally {
        if (live) setLoading(false);
      }
    })();

    return () => {
      live = false;
    };
  }, [orgId]);

  useEffect(() => {
    if (!compareSynced) return;
    const prev = previousEqualRange(fromDate, toDate);
    setCompareBFrom(fromDate);
    setCompareBTo(toDate);
    setCompareAFrom(prev.from);
    setCompareATo(prev.to);
  }, [fromDate, toDate, compareSynced]);

  const applyMainRange = useCallback(
    (preset: RangePreset, from: string, to: string) => {
      setRangePreset(preset);
      setFromDate(from);
      setToDate(to);
      setCompareSynced(true);
    },
    [],
  );

  const activeSalesForSummary = useMemo(
    () => allSales.filter((sale) => !isCancelledSale(sale.status)),
    [allSales],
  );

  const currentAuditRows = useMemo(
    () => allSales.filter((sale) => isInDateRange(sale, fromDate, toDate)),
    [allSales, fromDate, toDate],
  );

  const currentAudit = useMemo(() => {
    const cancelled = currentAuditRows.filter((sale) => isCancelledSale(sale.status));
    const edited = currentAuditRows.filter((sale) => Number(sale.edit_count ?? 0) > 0);
    const active = currentAuditRows.filter((sale) => !isCancelledSale(sale.status));
    const discounted = active.filter((sale) => Number(sale.discount_total ?? 0) > 0);

    return {
      cancelledCount: cancelled.length,
      cancelledValue: cancelled.reduce((sum, sale) => sum + Number(sale.total ?? 0), 0),
      editedCount: edited.length,
      editEvents: edited.reduce((sum, sale) => sum + Number(sale.edit_count ?? 0), 0),
      discountedCount: discounted.length,
    };
  }, [currentAuditRows]);

  const currentSummary = useMemo(
    () => buildPeriodSummary("Selected Period", activeSalesForSummary, fromDate, toDate),
    [activeSalesForSummary, fromDate, toDate],
  );

  const compareA = useMemo(
    () =>
      buildPeriodSummary(
        "Reference Period",
        activeSalesForSummary,
        compareAFrom,
        compareATo,
      ),
    [activeSalesForSummary, compareAFrom, compareATo],
  );

  const compareB = useMemo(
    () =>
      buildPeriodSummary(
        "Comparison Period",
        activeSalesForSummary,
        compareBFrom,
        compareBTo,
      ),
    [activeSalesForSummary, compareBFrom, compareBTo],
  );

  const compareMetrics = useMemo(
    () => buildCompareMetrics(compareA, compareB),
    [compareA, compareB],
  );

  const sortedProducts = useMemo(
    () =>
      [...currentSummary.products].sort((a, b) =>
        sortBy === "revenue" ? b.revenue - a.revenue : b.qty - a.qty,
      ),
    [currentSummary.products, sortBy],
  );

  const deadStock = useMemo(() => {
    const stockInput = inventory.map((row) => {
      const product = row.products;
      const sizeLabel =
        product?.quantity_value && product?.quantity_unit
          ? `${product.quantity_value}${product.quantity_unit}`
          : null;
      const name = [product?.name ?? "Unknown product", sizeLabel]
        .filter(Boolean)
        .join(" · ");

      return {
        product_id: row.product_id,
        name,
        qty_on_hand: Number(row.qty_on_hand ?? 0),
        cost_price: product?.cost_price ?? null,
        unit_price: product?.unit_price ?? null,
      };
    });

    return getDeadStock({
      inventory: stockInput,
      allSales: activeSalesForSummary,
      from: fromDate,
      to: toDate,
    });
  }, [inventory, activeSalesForSummary, fromDate, toDate]);

  const neverSoldStock = useMemo(
    () => deadStock.filter((d) => d.never_sold),
    [deadStock],
  );

  const insights = useMemo(
    () => buildInsights(currentSummary, deadStock),
    [currentSummary, deadStock],
  );

  const weekdayHighlight = useMemo(
    () => bestAndWorstWeekday(currentSummary.weekdays),
    [currentSummary.weekdays],
  );

  const deadStockCost = useMemo(
    () => deadStock.reduce((sum, d) => sum + d.cost_value, 0),
    [deadStock],
  );

  const discountRate = currentSummary.gross
    ? (currentSummary.discounts / currentSummary.gross) * 100
    : 0;

  const handlePDF = useCallback(async () => {
    if (typeof window === "undefined") return;

    setExportingPdf(true);
    setErr("");

    try {
      const filename =
        tab === "compare"
          ? `sales-comparison-${compareAFrom}-to-${compareBTo}.pdf`
          : `sales-analytics-${fromDate}-to-${toDate}.pdf`;

      await exportElementToPdf("sales-analytics-pdf-template", filename);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to export PDF. Please try again.");
    } finally {
      setExportingPdf(false);
    }
  }, [tab, compareAFrom, compareBTo, fromDate, toDate]);

  if (!orgId && !err) return <Spinner h={200} />;

  return (
    <div className="flex flex-col gap-6">
      {typeof document !== "undefined"
        ? createPortal(
            <div
              aria-hidden="true"
              style={{
                position: "fixed",
                left: 0,
                top: 0,
                width: 794,
                zIndex: -1,
                pointerEvents: "none",
                overflow: "visible",
              }}
            >
              <SalesAnalyticsPdfTemplate
                mode={tab}
                fromDate={fromDate}
                toDate={toDate}
                currentSummary={currentSummary}
                compareA={compareA}
                compareB={compareB}
                compareMetrics={compareMetrics}
                sortedProducts={sortedProducts}
                audit={currentAudit}
                generatedAt={new Date().toLocaleString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              />
            </div>,
            document.body,
          )
        : null}
      <div className="flex flex-col gap-4">
        <ReportHeader
          title="Sales report"
          subtitle={
            tab === "compare"
              ? `Reference ${compareAFrom} → ${compareATo} vs ${compareBFrom} → ${compareBTo}`
              : `${fromDate} → ${toDate} · ${currentSummary.sales} sale${
                  currentSummary.sales !== 1 ? "s" : ""
                }`
          }
          actions={
            <button
              className={S.btnGhost}
              disabled={loading || exportingPdf}
              onClick={handlePDF}
            >
              {exportingPdf ? "Exporting PDF…" : "Download PDF"}
            </button>
          }
        />

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <SegControl
            value={tab}
            onChange={(v: NavTab) => setTab(v)}
            options={[
              { value: "overview", label: "Overview" },
              { value: "products", label: "Products" },
              { value: "stock", label: "Dead stock" },
              { value: "compare", label: "Compare" },
              { value: "insights", label: "Insights" },
            ]}
          />

          {tab !== "compare" && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowDatePicker((value) => !value)}
                className="flex min-w-[240px] items-center justify-between gap-3 rounded-xl border border-[rgba(80,61,25,0.12)] bg-white px-4 py-2.5 text-left"
              >
                <span className="text-sm font-semibold text-slate-800">
                  {fromDate} → {toDate}
                </span>
                <span className="text-xs font-bold text-[#8A6A00]">Change</span>
              </button>

              {showDatePicker && (
                <SalesDateRangePicker
                  valuePreset={rangePreset}
                  valueFrom={fromDate}
                  valueTo={toDate}
                  onApply={(preset, from, to) => {
                    applyMainRange(preset, from, to);
                  }}
                  onClose={() => setShowDatePicker(false)}
                />
              )}
            </div>
          )}
        </div>

        {tab === "compare" && (
          <div className="grid w-full gap-3 lg:grid-cols-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowCompareAPicker((v) => !v);
                  setShowCompareBPicker(false);
                }}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[#EADFC2] bg-white px-4 py-3 text-left"
              >
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Baseline
                  </div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-900">
                    {compareAFrom} → {compareATo}
                  </div>
                </div>
                <span className="text-xs font-bold text-[#8A6A00]">Change</span>
              </button>
              {showCompareAPicker && (
                <SalesDateRangePicker
                  valuePreset="custom"
                  valueFrom={compareAFrom}
                  valueTo={compareATo}
                  onApply={(_, from, to) => {
                    setCompareSynced(false);
                    setCompareAFrom(from);
                    setCompareATo(to);
                  }}
                  onClose={() => setShowCompareAPicker(false)}
                />
              )}
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowCompareBPicker((v) => !v);
                  setShowCompareAPicker(false);
                }}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/40 px-4 py-3 text-left"
              >
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wide text-amber-700">
                    Comparison
                  </div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-900">
                    {compareBFrom} → {compareBTo}
                  </div>
                </div>
                <span className="text-xs font-bold text-[#8A6A00]">Change</span>
              </button>
              {showCompareBPicker && (
                <SalesDateRangePicker
                  valuePreset="custom"
                  valueFrom={compareBFrom}
                  valueTo={compareBTo}
                  onApply={(_, from, to) => {
                    setCompareSynced(false);
                    setCompareBFrom(from);
                    setCompareBTo(to);
                  }}
                  onClose={() => setShowCompareBPicker(false)}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {err && <ErrorBanner message={err} onClose={() => setErr("")} />}
      {loading && <Spinner h={200} />}

      {!loading && !err && tab !== "compare" && tab !== "stock" && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Revenue"
              value={fmtMoney(currentSummary.revenue)}
              sub="Finished sales after discounts"
            />

            <KpiCard
              label="Sales"
              value={String(currentSummary.sales)}
              sub={`${currentSummary.daily.length} day${
                currentSummary.daily.length !== 1 ? "s" : ""
              } with sales`}
            />

            <KpiCard
              label="Average basket"
              value={fmtMoney(currentSummary.avgBasket)}
              sub="Typical spend per checkout"
            />

            <KpiCard
              label="Discounts"
              value={fmtMoney(currentSummary.discounts)}
              sub={`${currentAudit.discountedCount} sale${
                currentAudit.discountedCount !== 1 ? "s" : ""
              } · ${discountRate.toFixed(1)}% of gross`}
              tone={discountRate > 10 ? "danger" : "neutral"}
            />
          </div>

          {currentSummary.sales === 0 && (
            <EmptyState
              title="No sales found in this range"
              detail="Try expanding the date range or check back later."
            />
          )}
        </>
      )}

      {!loading && !err && tab === "stock" && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Dead stock SKUs"
              value={String(deadStock.length)}
              sub={`In stock with 0 sales · ${fromDate} → ${toDate}`}
              tone={deadStock.length > 0 ? "warning" : "neutral"}
            />
            <KpiCard
              label="Never sold"
              value={String(neverSoldStock.length)}
              sub="Products with stock and no sales history"
              tone={neverSoldStock.length > 0 ? "danger" : "neutral"}
            />
            <KpiCard
              label="Tied-up cost"
              value={fmtMoney(deadStockCost)}
              sub="Inventory cost with no sales in range"
              tone={deadStockCost > 0 ? "warning" : "neutral"}
            />
            <KpiCard
              label="Retail at risk"
              value={fmtMoney(
                deadStock.reduce((sum, d) => sum + d.retail_value, 0),
              )}
              sub="Retail value of unsold stock"
            />
          </div>

          {deadStock.length === 0 ? (
            <EmptyState
              title="No dead stock in this range"
              detail="Every in-stock product recorded at least one sale in the selected dates."
            />
          ) : (
            <Card
              title="Products with no sales"
              sub="In-stock items that did not sell in the selected date range"
              noPad
            >
              <div
                className={`${S.tableHead} hidden border-b border-[rgba(80,61,25,0.08)] px-5 py-3 sm:grid`}
                style={{
                  gridTemplateColumns: "2fr 0.7fr 1fr 1fr 1.2fr",
                }}
              >
                <div>Product</div>
                <div className="text-right">Qty</div>
                <div className="text-right">Cost value</div>
                <div className="text-right">Retail value</div>
                <div className="text-right">Last sold</div>
              </div>

              <div className="max-h-[32rem] divide-y divide-slate-100 overflow-y-auto">
                {deadStock.map((row) => (
                  <div
                    key={row.product_id}
                    className="grid gap-3 px-5 py-4 text-sm transition-colors hover:bg-[#fffdf8] sm:grid-cols-[2fr_0.7fr_1fr_1fr_1.2fr] sm:items-center"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-bold text-slate-900">
                        {row.name}
                      </div>
                      {row.never_sold ? (
                        <span className="mt-1 inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
                          Never sold
                        </span>
                      ) : (
                        <span className="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                          No sales in range
                        </span>
                      )}
                    </div>
                    <div className="text-slate-600 sm:text-right sm:tabular-nums">
                      {row.qty_on_hand.toLocaleString("en-KE")}
                    </div>
                    <div className="font-bold text-slate-900 sm:text-right sm:tabular-nums">
                      {fmtMoney(row.cost_value)}
                    </div>
                    <div className="text-slate-600 sm:text-right sm:tabular-nums">
                      {fmtMoney(row.retail_value)}
                    </div>
                    <div className="text-slate-500 sm:text-right">
                      {row.never_sold
                        ? "—"
                        : row.last_sold_at
                          ? `${fmtShortDate(row.last_sold_at)}${
                              row.days_since_sale != null
                                ? ` · ${row.days_since_sale}d ago`
                                : ""
                            }`
                          : "—"}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {!loading && !err && currentSummary.sales > 0 && tab === "overview" && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="flex flex-col gap-6 xl:col-span-8">
            <Card title="Revenue trend" sub="Daily totals, including quiet days">
              <SimpleLineChart
                daily={currentSummary.daily}
                from={fromDate}
                to={toDate}
              />
            </Card>

            <Card
              title="Sales by weekday"
              sub={
                weekdayHighlight.best
                  ? `Best: ${weekdayHighlight.best.label}. Slowest: ${
                      weekdayHighlight.worst?.label ?? "—"
                    }.`
                  : "Revenue grouped by day of week"
              }
            >
              <WeekdayBars weekdays={currentSummary.weekdays} />
            </Card>

            <Card title="Top 5 sellers" sub="Highest revenue in this range">
              <ProductBar
                data={sortedProducts.slice(0, 5)}
                valueKey="revenue"
              />
            </Card>
          </div>

          <div className="flex flex-col gap-6 xl:col-span-4">
            <Card title="How customers paid">
              <div className="space-y-3">
                {currentSummary.payments.length === 0 ? (
                  <div className="py-6 text-center text-sm text-slate-400">
                    No payment data.
                  </div>
                ) : (
                  currentSummary.payments.map((p) => (
                    <div key={p.method}>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-800">
                          {paymentMethodLabel(p.method)}
                        </span>
                        <span className="text-sm font-bold tabular-nums text-slate-950">
                          {fmtMoney(p.revenue)}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400">
                        {p.count} sale{p.count !== 1 ? "s" : ""}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card title="Worth a look" sub="Not included in revenue">
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Cancelled</span>
                  <span className="font-bold text-slate-900">
                    {currentAudit.cancelledCount} · {fmtMoney(currentAudit.cancelledValue)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Edited after save</span>
                  <span className="font-bold text-slate-900">{currentAudit.editedCount}</span>
                </div>
                {deadStock.length > 0 ? (
                  <div className="border-t border-[#F1E6C9] pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Stock with no sales</span>
                      <span className="font-bold text-slate-900">
                        {deadStock.length} · {fmtMoney(deadStockCost)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTab("stock")}
                      className="mt-3 text-xs font-bold text-[#8A6A00] hover:underline"
                    >
                      Open dead stock
                    </button>
                  </div>
                ) : null}
              </div>
            </Card>
          </div>
        </div>
      )}

      {!loading && !err && currentSummary.sales > 0 && tab === "products" && (
        <div className="flex flex-col gap-6">
          <Card
            title="Product Performance"
            sub={`${sortedProducts.length} product${
              sortedProducts.length !== 1 ? "s" : ""
            } tracked`}
            action={
              <SegControl
                value={sortBy}
                onChange={(v: SortBy) => setSortBy(v)}
                options={[
                  { value: "revenue", label: "Revenue" },
                  { value: "qty", label: "Units Sold" },
                ]}
              />
            }
          >
            <ProductBar data={sortedProducts} valueKey={sortBy} />
          </Card>

          <Card
            title="Product Ranking"
            sub="Detailed product performance"
            noPad
          >
            <div
              className={`${S.tableHead} hidden border-b border-[rgba(80,61,25,0.08)] px-5 py-3 sm:grid`}
              style={{ gridTemplateColumns: "0.5fr 2fr 1fr 1fr 0.8fr" }}
            >
              <div>#</div>
              <div>Product</div>
              <div className="text-right">Revenue</div>
              <div className="text-right">Units</div>
              <div className="text-right">Sales In</div>
            </div>

            <div className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
              {sortedProducts.map((p, i) => (
                <div
                  key={p.product_id}
                  className={`grid gap-3 px-5 py-4 text-sm transition-colors hover:bg-[#fffdf8] sm:grid-cols-[0.5fr_2fr_1fr_1fr_0.8fr] sm:items-center ${
                    i === 0 ? "bg-[#fffdf8]" : ""
                  }`}
                >
                  <div className="font-black text-slate-400">#{i + 1}</div>
                  <div className="min-w-0">
                    <div className="truncate font-bold text-slate-900">
                      {p.name}
                    </div>
                    {i === 0 && (
                      <span className="mt-1 inline-flex rounded-full bg-[#FFF4CC] px-2 py-0.5 text-[10px] font-bold text-[#8A6A00]">
                        Top seller
                      </span>
                    )}
                  </div>
                  <div className="font-black text-slate-950 sm:text-right sm:tabular-nums">
                    {fmtMoney(p.revenue)}
                  </div>
                  <div className="text-slate-600 sm:text-right sm:tabular-nums">
                    {p.qty.toLocaleString()}
                  </div>
                  <div className="text-slate-400 sm:text-right sm:tabular-nums">
                    {p.appearances}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {!loading && !err && tab === "compare" && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <KpiCard
              label="Reference Period"
              value={fmtMoney(compareA.revenue)}
              sub={`${compareA.sales} sale${compareA.sales !== 1 ? "s" : ""} · ${
                compareA.from
              } → ${compareA.to}`}
            />

            <KpiCard
              label="Comparison Period"
              value={fmtMoney(compareB.revenue)}
              sub={`${compareB.sales} sale${compareB.sales !== 1 ? "s" : ""} · ${
                compareB.from
              } → ${compareB.to}`}
            />
          </div>

          <Card
            title="Comparison Summary"
            sub="Comparison period measured against the reference period"
          >
            <CompareBars metrics={compareMetrics} />
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card
              title="Reference Period Trend"
              sub={`${compareA.from} → ${compareA.to}`}
            >
              <SimpleLineChart
                daily={compareA.daily}
                from={compareAFrom}
                to={compareATo}
              />
            </Card>

            <Card
              title="Comparison Period Trend"
              sub={`${compareB.from} → ${compareB.to}`}
            >
              <SimpleLineChart
                daily={compareB.daily}
                from={compareBFrom}
                to={compareBTo}
              />
            </Card>
          </div>
        </div>
      )}

      {!loading && !err && tab === "insights" && (
        <div className="flex flex-col gap-6">
          {insights.length === 0 ? (
            <EmptyState
              title="Not enough data for insights"
              detail="Try a wider date range once you have more sales."
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {insights.map((ins, i) => (
                <InsightCard key={i} {...ins} />
              ))}
            </div>
          )}

          <Card title="Action Plan" sub="Practical next steps">
            <div className="divide-y divide-slate-100">
              {[
                {
                  step: "01",
                  action: "Protect top sellers",
                  detail: sortedProducts[0]?.name
                    ? `Keep "${sortedProducts[0].name}" well stocked because it is currently your strongest performer.`
                    : "Identify and protect your strongest products.",
                },
                {
                  step: "02",
                  action: "Staff for peak weekdays",
                  detail: weekdayHighlight.best
                    ? `${weekdayHighlight.best.label} is your strongest weekday (${fmtMoney(
                        weekdayHighlight.best.revenue,
                      )}). ${
                        weekdayHighlight.worst &&
                        weekdayHighlight.worst.weekday !==
                          weekdayHighlight.best.weekday
                          ? `${weekdayHighlight.worst.label} is slowest — try promos or lighter staffing.`
                          : "Plan inventory and staffing around that pattern."
                      }`
                    : "Watch weekday patterns as more sales come in.",
                },
                {
                  step: "03",
                  action: "Clear dead stock",
                  detail:
                    deadStock.length > 0
                      ? `${deadStock.length} product${
                          deadStock.length !== 1 ? "s" : ""
                        } (${fmtMoney(
                          deadStockCost,
                        )} at cost) had no sales in this range. Discount, bundle, or pause reorders.`
                      : "No dead stock in this range — keep monitoring slow movers.",
                },
                {
                  step: "04",
                  action: "Review discounting",
                  detail:
                    discountRate > 10
                      ? `Discounts are ${discountRate.toFixed(
                          1,
                        )}% of gross revenue. Review if they are improving volume enough.`
                      : `Discount rate is ${discountRate.toFixed(
                          1,
                        )}%, which looks controlled.`,
                },
              ].map((rec) => (
                <div
                  key={rec.step}
                  className="grid gap-3 py-4 sm:grid-cols-[48px_1fr]"
                >
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-[#8A6A00]">
                    {rec.step}
                  </div>
                  <div>
                    <div className="mb-0.5 text-sm font-black text-slate-950">
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
        </div>
      )}
    </div>
  );
}
