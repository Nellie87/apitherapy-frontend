import type { SaleRowWithItems } from "@/lib/api/sales";
import type {
  CompareMetric,
  DailyStat,
  DeadStockItem,
  PaymentStat,
  PeriodSummary,
  ProductStat,
  WeekdayStat,
} from "./sales-analytics.types";
import { fmtMoney } from "../components/report-ui";

const WEEKDAY_META = [
  { label: "Sunday", shortLabel: "Sun" },
  { label: "Monday", shortLabel: "Mon" },
  { label: "Tuesday", shortLabel: "Tue" },
  { label: "Wednesday", shortLabel: "Wed" },
  { label: "Thursday", shortLabel: "Thu" },
  { label: "Friday", shortLabel: "Fri" },
  { label: "Saturday", shortLabel: "Sat" },
] as const;

/** Local calendar YYYY-MM-DD (never UTC-slice an ISO timestamp). */
export const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

export const toYMD = (value: string) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.slice(0, 10);
  return ymd(d);
};

export const todayYMD = () => ymd(new Date());

export const daysAgoYMD = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return ymd(d);
};

export const startOfMonthYMD = (year: number, monthIndex: number) =>
  ymd(new Date(year, monthIndex, 1));

export const endOfMonthYMD = (year: number, monthIndex: number) =>
  ymd(new Date(year, monthIndex + 1, 0));

/** Inclusive day count between two YYYY-MM-DD local dates. */
export const daysBetweenInclusive = (from: string, to: string) => {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const a = new Date(fy, fm - 1, fd);
  const b = new Date(ty, tm - 1, td);
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1);
};

/** Same-length window ending the day before `from`. */
export const previousEqualRange = (from: string, to: string) => {
  const days = daysBetweenInclusive(from, to);
  const [fy, fm, fd] = from.split("-").map(Number);
  const prevTo = new Date(fy, fm - 1, fd - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setDate(prevFrom.getDate() - (days - 1));
  return { from: ymd(prevFrom), to: ymd(prevTo) };
};

export const weekdayFromYMD = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
};

export const fmtShortDate = (date: string) => {
  try {
    const [y, m, d] = date.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-KE", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return date;
  }
};

export const pctChange = (a: number, b: number) => {
  if (!a && !b) return 0;
  if (!a) return null;
  return ((b - a) / Math.abs(a)) * 100;
};

export const fmtPct = (v: number | null) => {
  if (v === null) return "New";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}%`;
};

export const fmtValue = (v: number, money?: boolean) =>
  money ? fmtMoney(v) : Number(v || 0).toLocaleString("en-KE");

export const saleTimestamp = (sale: SaleRowWithItems) =>
  sale.sold_at ?? sale.created_at;

export const saleDateYMD = (sale: SaleRowWithItems) =>
  toYMD(saleTimestamp(sale));

export function filterSalesByRange(
  sales: SaleRowWithItems[],
  from: string,
  to: string
) {
  return sales.filter((sale) => {
    const day = saleDateYMD(sale);
    return day >= from && day <= to;
  });
}

export function getProductStats(sales: SaleRowWithItems[]): ProductStat[] {
  const map: Record<string, ProductStat> = {};

  sales.forEach((sale) => {
    const items = sale.sale_items ?? [];

    items.forEach((item) => {
      const product = item.products;
      const qty = Number(item.qty ?? 0);

      const sizeLabel =
        product?.quantity_value && product?.quantity_unit
          ? `${product.quantity_value}${product.quantity_unit}`
          : null;

      const name = [product?.name ?? "Unknown product", sizeLabel]
        .filter(Boolean)
        .join(" · ");

      const productKey = `${item.product_id}:${sizeLabel ?? ""}`;

      const revenue =
        Number(item.line_total ?? 0) ||
        Number(item.unit_price ?? 0) * qty ||
        0;

      if (!map[productKey]) {
        map[productKey] = {
          product_id: productKey,
          name,
          qty: 0,
          revenue: 0,
          appearances: 0,
        };
      }

      map[productKey].qty += qty;
      map[productKey].revenue += revenue;
      map[productKey].appearances += 1;
    });
  });

  return Object.values(map).sort((a, b) => b.revenue - a.revenue);
}

export function getDailyStats(sales: SaleRowWithItems[]): DailyStat[] {
  const map: Record<string, DailyStat> = {};

  sales.forEach((sale) => {
    const day = saleDateYMD(sale);

    if (!map[day]) {
      map[day] = {
        day,
        sales_count: 0,
        subtotal: 0,
        discount_total: 0,
        total: 0,
      };
    }

    map[day].sales_count += 1;
    map[day].subtotal += Number(sale.subtotal ?? 0);
    map[day].discount_total += Number(sale.discount_total ?? 0);
    map[day].total += Number(sale.total ?? 0);
  });

  return Object.values(map).sort((a, b) => a.day.localeCompare(b.day));
}

/** Mon→Sun order for business-friendly charts. */
export function getWeekdayStats(sales: SaleRowWithItems[]): WeekdayStat[] {
  const byDay: WeekdayStat[] = WEEKDAY_META.map((meta, weekday) => ({
    weekday,
    label: meta.label,
    shortLabel: meta.shortLabel,
    sales_count: 0,
    revenue: 0,
    avgBasket: 0,
  }));

  sales.forEach((sale) => {
    const day = saleDateYMD(sale);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
    const wd = weekdayFromYMD(day);
    byDay[wd].sales_count += 1;
    byDay[wd].revenue += Number(sale.total ?? 0);
  });

  byDay.forEach((row) => {
    row.avgBasket = row.sales_count ? row.revenue / row.sales_count : 0;
  });

  return [...byDay.slice(1), byDay[0]];
}

export function bestAndWorstWeekday(weekdays: WeekdayStat[]) {
  const withSales = weekdays.filter((d) => d.sales_count > 0);
  if (!withSales.length) return { best: null, worst: null };

  const sorted = [...withSales].sort((a, b) => b.revenue - a.revenue);
  return {
    best: sorted[0],
    worst: sorted[sorted.length - 1],
  };
}

export function getPaymentStats(sales: SaleRowWithItems[]): PaymentStat[] {
  const map: Record<string, PaymentStat> = {};

  sales.forEach((sale) => {
    const payments = sale.sale_payments ?? [];

    if (payments.length > 0) {
      payments.forEach((p) => {
        const method = String(p.payment_method || "unknown").toLowerCase();

        if (!map[method]) {
          map[method] = {
            method,
            count: 0,
            revenue: 0,
          };
        }

        map[method].count += 1;
        map[method].revenue += Number(p.amount ?? 0);
      });
      return;
    }

    const method = String(sale.payment_method || "unknown").toLowerCase();

    if (!map[method]) {
      map[method] = {
        method,
        count: 0,
        revenue: 0,
      };
    }

    map[method].count += 1;
    map[method].revenue += Number(sale.total ?? 0);
  });

  return Object.values(map).sort((a, b) => b.revenue - a.revenue);
}

export type InventoryStockInput = {
  product_id: string;
  name: string;
  qty_on_hand: number;
  cost_price?: number | null;
  unit_price?: number | null;
};

/**
 * In-stock products with zero completed sales in [from, to].
 * Uses full sales history only to compute last-sold date.
 */
export function getDeadStock(params: {
  inventory: InventoryStockInput[];
  allSales: SaleRowWithItems[];
  from: string;
  to: string;
  asOfYMD?: string;
}): DeadStockItem[] {
  const { inventory, allSales, from, to, asOfYMD = todayYMD() } = params;
  const soldInRange = new Set<string>();
  const lastSold = new Map<string, string>();

  allSales.forEach((sale) => {
    if (String(sale.status ?? "").toLowerCase() === "cancelled") return;
    const day = saleDateYMD(sale);
    (sale.sale_items ?? []).forEach((item) => {
      const id = String(item.product_id ?? "");
      if (!id) return;
      const prev = lastSold.get(id);
      if (!prev || day > prev) lastSold.set(id, day);
      if (day >= from && day <= to) soldInRange.add(id);
    });
  });

  const asOf = new Date(`${asOfYMD}T12:00:00`);

  return inventory
    .filter((row) => Number(row.qty_on_hand) > 0 && !soldInRange.has(row.product_id))
    .map((row) => {
      const last = lastSold.get(row.product_id) ?? null;
      let days_since_sale: number | null = null;
      if (last) {
        const lastDate = new Date(`${last}T12:00:00`);
        days_since_sale = Math.max(
          0,
          Math.round((asOf.getTime() - lastDate.getTime()) / 86_400_000)
        );
      }
      const qty = Number(row.qty_on_hand ?? 0);
      const cost = Number(row.cost_price ?? 0);
      const retail = Number(row.unit_price ?? 0);
      return {
        product_id: row.product_id,
        name: row.name,
        qty_on_hand: qty,
        cost_value: cost * qty,
        retail_value: retail * qty,
        last_sold_at: last,
        days_since_sale,
        never_sold: !last,
      };
    })
    .sort((a, b) => {
      if (a.never_sold !== b.never_sold) return a.never_sold ? -1 : 1;
      return b.cost_value - a.cost_value;
    });
}

export function buildPeriodSummary(
  label: string,
  allSales: SaleRowWithItems[],
  from: string,
  to: string
): PeriodSummary {
  const rangeSales = filterSalesByRange(allSales, from, to);

  const completedSales = rangeSales.filter(
    (sale) => sale.status === "completed"
  );

  const cancelledSales = rangeSales.filter(
    (sale) => sale.status === "cancelled"
  );

  const daily = getDailyStats(completedSales);
  const weekdays = getWeekdayStats(completedSales);
  const products = getProductStats(completedSales);
  const payments = getPaymentStats(completedSales);

  const revenue = completedSales.reduce(
    (sum, row) => sum + Number(row.total ?? 0),
    0
  );

  const gross = completedSales.reduce(
    (sum, row) => sum + Number(row.subtotal ?? 0),
    0
  );

  const discounts = completedSales.reduce(
    (sum, row) => sum + Number(row.discount_total ?? 0),
    0
  );

  const cancelledValue = cancelledSales.reduce(
    (sum, row) => sum + Number(row.total ?? 0),
    0
  );

  return {
    label,
    from,
    to,
    sales: completedSales.length,
    cancelledSales: cancelledSales.length,
    cancelledValue,
    gross,
    discounts,
    revenue,
    avgBasket: completedSales.length ? revenue / completedSales.length : 0,
    avgDaily: daily.length ? revenue / daily.length : 0,
    products,
    payments,
    daily,
    weekdays,
  };
}

export function buildCompareMetrics(
  a: PeriodSummary,
  b: PeriodSummary
): CompareMetric[] {
  return [
    {
      label: "Net Revenue",
      a: a.revenue,
      b: b.revenue,
      diff: b.revenue - a.revenue,
      pct: pctChange(a.revenue, b.revenue),
      money: true,
    },
    {
      label: "Gross Revenue",
      a: a.gross,
      b: b.gross,
      diff: b.gross - a.gross,
      pct: pctChange(a.gross, b.gross),
      money: true,
    },
    {
      label: "Total Sales",
      a: a.sales,
      b: b.sales,
      diff: b.sales - a.sales,
      pct: pctChange(a.sales, b.sales),
    },
    {
      label: "Average Basket",
      a: a.avgBasket,
      b: b.avgBasket,
      diff: b.avgBasket - a.avgBasket,
      pct: pctChange(a.avgBasket, b.avgBasket),
      money: true,
    },
    {
      label: "Discounts",
      a: a.discounts,
      b: b.discounts,
      diff: b.discounts - a.discounts,
      pct: pctChange(a.discounts, b.discounts),
      money: true,
    },
  ];
}
