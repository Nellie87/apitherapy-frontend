import type { SaleRowWithItems } from "@/lib/api/sales";
import type {
  CompareMetric,
  DailyStat,
  PaymentStat,
  PeriodSummary,
  ProductStat,
} from "./sales-analytics.types";
import { fmtMoney } from "../components/report-ui";

export const toYMD = (s: string) => s.slice(0, 10);

export const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

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
export const saleDateYMD = (sale: SaleRowWithItems) =>
  toYMD(sale.sold_at ?? sale.created_at);

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

export function getPaymentStats(sales: SaleRowWithItems[]): PaymentStat[] {
  const map: Record<string, PaymentStat> = {};

  sales.forEach((sale) => {
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
