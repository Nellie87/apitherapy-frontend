"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { exportElementToPdf } from "@/lib/exportPdf";

import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import { listSales, type SaleRowWithItems } from "@/lib/api/sales";
import { listInventory, type InventoryRow } from "@/lib/api/inventory";
import * as S from "../page.styles";

import {
  Card,
  ErrorBanner,
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

function CleanPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-visible rounded-[28px] border border-[#EADFC2] bg-white p-4 shadow-[0_12px_36px_rgba(92,64,16,0.06)] sm:p-6">
      <div className="pointer-events-none absolute right-0 top-0 h-56 w-56 rounded-full bg-amber-100/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-48 w-48 rounded-full bg-[#FFF8E6] blur-3xl" />
      <div className="relative">{children}</div>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const toneClass = {
    neutral: "border-[#EADFC2] bg-white text-slate-950",
    success: "border-green-200 bg-green-50/70 text-green-800",
    warning: "border-amber-200 bg-amber-50/80 text-amber-800",
    danger: "border-red-200 bg-red-50/70 text-red-800",
  }[tone];

  return (
    <div className={`rounded-[24px] border p-5 shadow-sm ${toneClass}`}>
      <div className="text-xs font-black uppercase tracking-[0.18em] text-[#8A6A00]">
        {label}
      </div>
      <div className="mt-3 text-2xl font-black tracking-tight">{value}</div>
      <div className="mt-1 text-xs font-semibold text-slate-500">{sub}</div>
    </div>
  );
}

function CleanKpi({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const cfg = {
    neutral: {
      border: "border-[#EADFC2]",
      bg: "bg-white",
      value: "text-slate-950",
      label: "text-[#8A6A00]",
    },
    success: {
      border: "border-green-200",
      bg: "bg-green-50/70",
      value: "text-green-800",
      label: "text-green-700",
    },
    warning: {
      border: "border-amber-200",
      bg: "bg-amber-50/80",
      value: "text-amber-800",
      label: "text-amber-700",
    },
    danger: {
      border: "border-red-200",
      bg: "bg-red-50/70",
      value: "text-red-800",
      label: "text-red-700",
    },
  }[tone];

  return (
    <div
      className={`rounded-[24px] border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${cfg.border} ${cfg.bg}`}
    >
      <div
        className={`text-xs font-black uppercase tracking-[0.18em] ${cfg.label}`}
      >
        {label}
      </div>
      <div className={`mt-3 text-2xl font-black tracking-tight ${cfg.value}`}>
        {value}
      </div>
      <div className="mt-1 text-xs font-semibold text-slate-500">{sub}</div>
    </div>
  );
}

function CleanInsight({
  title,
  detail,
  type,
}: {
  title: string;
  detail: string;
  type: string;
}) {
  const tone =
    type === "positive"
      ? "border-green-200 bg-green-50/60"
      : type === "negative"
        ? "border-red-200 bg-red-50/60"
        : type === "warning"
          ? "border-amber-200 bg-amber-50/70"
          : "border-[#EADFC2] bg-white";

  return (
    <div className={`rounded-[24px] border p-5 shadow-sm ${tone}`}>
      <div className="text-sm font-black text-slate-950">{title}</div>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{detail}</p>
    </div>
  );
}

function CleanEmpty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-[28px] border border-[#EADFC2] bg-white px-6 py-16 text-center shadow-sm">
      <div className="text-base font-black text-slate-900">{title}</div>
      <p className="mt-2 text-sm text-slate-500">{detail}</p>
    </div>
  );
}

function DateInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-2xl border border-[#EADFC2] bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
    />
  );
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
      <div className="fixed left-[-10000px] top-0 z-[-1] w-[794px] bg-white" aria-hidden="true">
        <SalesAnalyticsPdfTemplate
          mode={tab}
          fromDate={fromDate}
          toDate={toDate}
          currentSummary={currentSummary}
          compareA={compareA}
          compareB={compareB}
          compareMetrics={compareMetrics}
          sortedProducts={sortedProducts}
          generatedAt={new Date().toLocaleString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        />
      </div>
      <ReportHeader
        title="Sales Analytics"
        subtitle={
          tab === "compare"
            ? `Reference: ${compareAFrom} → ${compareATo} · Comparison: ${compareBFrom} → ${compareBTo}`
            : `${fromDate} → ${toDate} · ${currentSummary.sales} transaction${
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

      <CleanPanel>
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
         

          <div className="rounded-3xl border border-[#EADFC2] bg-white p-3 shadow-sm">
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
          </div>
        </div>

        <div className="rounded-3xl border border-[#EADFC2] bg-[#FFFDF8] p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            {tab !== "compare" && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowDatePicker((value) => !value)}
                  className="flex min-w-[260px] items-center justify-between gap-4 rounded-3xl border border-[#EADFC2] bg-white px-4 py-3 text-left shadow-sm transition hover:bg-[#FFF8E6]"
                >
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8A6A00]">
                      Date range
                    </div>
                    <div className="mt-1 text-sm font-black text-slate-950">
                      {fromDate} → {toDate}
                    </div>
                  </div>

                  <span className="rounded-full bg-[#2F2718] px-3 py-1 text-xs font-bold text-white">
                    Change
                  </span>
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

            {tab === "compare" && (
              <div className="grid w-full gap-4 lg:grid-cols-2">
                <div className="relative rounded-3xl border border-[#EADFC2] bg-white p-4 shadow-sm">
                  <div className="mb-3">
                    <div className="text-sm font-black text-slate-950">
                      Reference period
                    </div>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      This is the baseline range you are comparing against.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowCompareAPicker((v) => !v);
                      setShowCompareBPicker(false);
                    }}
                    className="flex w-full items-center justify-between gap-4 rounded-2xl border border-[#EADFC2] bg-[#FFFDF8] px-4 py-3 text-left transition hover:bg-[#FFF8E6]"
                  >
                    <span className="text-sm font-black text-slate-950">
                      {compareAFrom} → {compareATo}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#8A6A00] shadow-sm">
                      Change range
                    </span>
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

                <div className="relative rounded-3xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
                  <div className="mb-3">
                    <div className="text-sm font-black text-slate-950">
                      Comparison period
                    </div>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      This is the range being measured against the baseline.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowCompareBPicker((v) => !v);
                      setShowCompareAPicker(false);
                    }}
                    className="flex w-full items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-white px-4 py-3 text-left transition hover:bg-[#FFF8E6]"
                  >
                    <span className="text-sm font-black text-slate-950">
                      {compareBFrom} → {compareBTo}
                    </span>
                    <span className="rounded-full bg-[#2F2718] px-3 py-1 text-xs font-bold text-white shadow-sm">
                      Change range
                    </span>
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
        </div>
      </CleanPanel>

      {err && <ErrorBanner message={err} onClose={() => setErr("")} />}
      {loading && <Spinner h={200} />}

      {!loading && !err && tab !== "compare" && tab !== "stock" && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <CleanKpi
              label="Revenue"
              value={fmtMoney(currentSummary.revenue)}
              sub={`${fmtMoney(currentSummary.avgDaily)}/day average`}
              tone="warning"
            />

            <CleanKpi
              label="Sales"
              value={String(currentSummary.sales)}
              sub={`${currentSummary.daily.length} active day${
                currentSummary.daily.length !== 1 ? "s" : ""
              }`}
            />

            <CleanKpi
              label="Average Basket"
              value={fmtMoney(currentSummary.avgBasket)}
              sub="per transaction"
            />

            <CleanKpi
              label="Discounts"
              value={fmtMoney(currentSummary.discounts)}
              sub={`${currentAudit.discountedCount} discounted sale${
                currentAudit.discountedCount !== 1 ? "s" : ""
              } · ${discountRate.toFixed(1)}% of gross`}
              tone={discountRate > 10 ? "danger" : "neutral"}
            />

            <CleanKpi
              label="Edited Sales"
              value={String(currentAudit.editedCount)}
              sub={`${currentAudit.editEvents} edit event${
                currentAudit.editEvents !== 1 ? "s" : ""
              } recorded`}
              tone={currentAudit.editedCount > 0 ? "warning" : "neutral"}
            />

            <CleanKpi
              label="Cancelled Sales"
              value={String(currentAudit.cancelledCount)}
              sub={`${fmtMoney(currentAudit.cancelledValue)} cancelled value`}
              tone={currentAudit.cancelledCount > 0 ? "danger" : "neutral"}
            />
          </div>

          {currentSummary.sales === 0 && (
            <CleanEmpty
              title="No sales found in this range"
              detail="Try expanding the date range or check back later."
            />
          )}
        </>
      )}

      {!loading && !err && tab === "stock" && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <CleanKpi
              label="Dead stock SKUs"
              value={String(deadStock.length)}
              sub={`In stock with 0 sales · ${fromDate} → ${toDate}`}
              tone={deadStock.length > 0 ? "warning" : "neutral"}
            />
            <CleanKpi
              label="Never sold"
              value={String(neverSoldStock.length)}
              sub="Products with stock and no sales history"
              tone={neverSoldStock.length > 0 ? "danger" : "neutral"}
            />
            <CleanKpi
              label="Tied-up cost"
              value={fmtMoney(deadStockCost)}
              sub="Inventory cost with no sales in range"
              tone={deadStockCost > 0 ? "warning" : "neutral"}
            />
            <CleanKpi
              label="Retail at risk"
              value={fmtMoney(
                deadStock.reduce((sum, d) => sum + d.retail_value, 0),
              )}
              sub="Retail value of unsold stock"
            />
          </div>

          {deadStock.length === 0 ? (
            <CleanEmpty
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
                className={`${S.tableHead} hidden border-b border-[#F1E6C9] bg-[#FFFDF8] px-5 py-3 sm:grid`}
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
                    className="grid gap-3 px-5 py-4 text-sm transition-colors hover:bg-[#FFFDF8] sm:grid-cols-[2fr_0.7fr_1fr_1fr_1.2fr] sm:items-center"
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
            <Card title="Revenue Trend" sub={`${fromDate} → ${toDate}`}>
              <SimpleLineChart daily={currentSummary.daily} />
            </Card>

            <Card
              title="Sales by weekday"
              sub={
                weekdayHighlight.best
                  ? `Best: ${weekdayHighlight.best.label} · Slowest: ${
                      weekdayHighlight.worst?.label ?? "—"
                    }`
                  : "Revenue pattern across days of the week"
              }
            >
              <WeekdayBars weekdays={currentSummary.weekdays} />
            </Card>

            <Card title="Top Products" sub="Highest product contribution">
              <ProductBar
                data={sortedProducts.slice(0, 6)}
                valueKey="revenue"
              />
            </Card>

            <Card
              title="Daily Summary"
              sub={`${currentSummary.daily.length} active day${
                currentSummary.daily.length !== 1 ? "s" : ""
              }`}
              noPad
            >
              <div
                className={`${S.tableHead} hidden border-b border-[#F1E6C9] bg-[#FFFDF8] px-5 py-3 sm:grid`}
                style={{ gridTemplateColumns: "1fr 0.8fr 1fr 1fr 1fr" }}
              >
                <div>Date</div>
                <div className="text-right">Sales</div>
                <div className="text-right">Gross</div>
                <div className="text-right">Discounts</div>
                <div className="text-right">Net</div>
              </div>

              <div className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
                {[...currentSummary.daily].reverse().map((r) => (
                  <div
                    key={r.day}
                    className="grid gap-3 px-5 py-4 text-sm transition-colors hover:bg-[#FFFDF8] sm:grid-cols-[1fr_0.8fr_1fr_1fr_1fr] sm:items-center"
                  >
                    <div className="font-bold text-slate-900">
                      {fmtShortDate(r.day)}
                    </div>
                    <div className="text-slate-600 sm:text-right sm:tabular-nums">
                      {r.sales_count}
                    </div>
                    <div className="text-slate-600 sm:text-right sm:tabular-nums">
                      {fmtMoney(r.subtotal)}
                    </div>
                    <div className="font-bold text-red-500 sm:text-right sm:tabular-nums">
                      -{fmtMoney(r.discount_total)}
                    </div>
                    <div className="font-black text-slate-950 sm:text-right sm:tabular-nums">
                      {fmtMoney(r.total)}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="flex flex-col gap-6 xl:col-span-4">
            <Card
              title="Sales Control Summary"
              sub="Edits, cancellations and discounts in this range"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <span className="text-sm font-bold text-slate-700">Edited sales</span>
                  <span className="text-sm font-black text-slate-950">{currentAudit.editedCount}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-amber-50 px-4 py-3">
                  <span className="text-sm font-bold text-amber-800">Discounted sales</span>
                  <span className="text-sm font-black text-amber-900">{currentAudit.discountedCount}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-red-50 px-4 py-3">
                  <span className="text-sm font-bold text-red-700">Cancelled sales</span>
                  <span className="text-sm font-black text-red-800">{currentAudit.cancelledCount}</span>
                </div>
              </div>
            </Card>

            {deadStock.length > 0 && (
              <Card
                title="Dead stock alert"
                sub={`${deadStock.length} SKU${deadStock.length !== 1 ? "s" : ""} with no sales`}
              >
                <div className="space-y-2">
                  <div className="text-2xl font-black text-slate-950">
                    {fmtMoney(deadStockCost)}
                  </div>
                  <p className="text-xs font-medium text-slate-500">
                    Cost tied up in stock that did not sell in this range
                    {neverSoldStock.length
                      ? ` · ${neverSoldStock.length} never sold`
                      : ""}
                    .
                  </p>
                  <button
                    type="button"
                    onClick={() => setTab("stock")}
                    className="mt-2 rounded-xl bg-[#2F2718] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#1F1A10]"
                  >
                    View dead stock
                  </button>
                </div>
              </Card>
            )}

            <MiniMetric
              label="Retail Sales"
              value={fmtMoney(currentSummary.revenue)}
              sub={`${currentSummary.sales} transaction${
                currentSummary.sales !== 1 ? "s" : ""
              }`}
            />

            <MiniMetric
              label="Average Basket"
              value={fmtMoney(currentSummary.avgBasket)}
              sub="average transaction value"
            />

            <Card title="Payment Split" sub="Revenue by payment method" noPad>
              <div className="divide-y divide-slate-100">
                {currentSummary.payments.length === 0 ? (
                  <div className="py-10 text-center text-sm text-slate-400">
                    No payment data.
                  </div>
                ) : (
                  currentSummary.payments.map((p) => (
                    <div
                      key={p.method}
                      className="flex items-center justify-between px-5 py-4 hover:bg-[#FFFDF8]"
                    >
                      <div>
                        <div className="text-sm font-black capitalize text-slate-900">
                          {p.method}
                        </div>
                        <div className="text-xs font-semibold text-slate-400">
                          {p.count} transaction{p.count !== 1 ? "s" : ""}
                        </div>
                      </div>

                      <div className="text-right text-sm font-black text-slate-950">
                        {fmtMoney(p.revenue)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card title="Daily Transactions" sub="Sales count by day">
              <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
                {[...currentSummary.daily].reverse().map((d) => {
                  const maxSales = Math.max(
                    ...currentSummary.daily.map((x) => x.sales_count),
                    1,
                  );
                  const pct = (d.sales_count / maxSales) * 100;

                  return (
                    <div key={d.day}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="font-bold text-slate-600">
                          {fmtShortDate(d.day)}
                        </span>
                        <span className="font-black text-slate-900">
                          {d.sales_count} sale{d.sales_count !== 1 ? "s" : ""}
                        </span>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-[#F8F3E7]">
                        <div
                          className="h-full rounded-full bg-[#D6A324]"
                          style={{ width: `${Math.max(3, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
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
              className={`${S.tableHead} hidden border-b border-[#F1E6C9] bg-[#FFFDF8] px-5 py-3 sm:grid`}
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
                  className={`grid gap-3 px-5 py-4 text-sm transition-colors hover:bg-[#FFFDF8] sm:grid-cols-[0.5fr_2fr_1fr_1fr_0.8fr] sm:items-center ${
                    i === 0 ? "bg-amber-50/40" : ""
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
            <CleanKpi
              label="Reference Period"
              value={fmtMoney(compareA.revenue)}
              sub={`${compareA.sales} sale${compareA.sales !== 1 ? "s" : ""} · ${
                compareA.from
              } → ${compareA.to}`}
            />

            <CleanKpi
              label="Comparison Period"
              value={fmtMoney(compareB.revenue)}
              sub={`${compareB.sales} sale${compareB.sales !== 1 ? "s" : ""} · ${
                compareB.from
              } → ${compareB.to}`}
              tone="warning"
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
              <SimpleLineChart daily={compareA.daily} />
            </Card>

            <Card
              title="Comparison Period Trend"
              sub={`${compareB.from} → ${compareB.to}`}
            >
              <SimpleLineChart daily={compareB.daily} />
            </Card>
          </div>
        </div>
      )}

      {!loading && !err && tab === "insights" && (
        <div className="flex flex-col gap-6">
          {insights.length === 0 ? (
            <CleanEmpty
              title="Not enough data for insights"
              detail="Try a wider date range once you have more sales."
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {insights.map((ins, i) => (
                <CleanInsight key={i} {...ins} />
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
