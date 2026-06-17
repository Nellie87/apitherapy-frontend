export type ProductStat = {
  product_id: string;
  name: string;
  qty: number;
  revenue: number;
  appearances: number;
};

export type DailyStat = {
  day: string;
  sales_count: number;
  subtotal: number;
  discount_total: number;
  total: number;
};

export type PaymentStat = {
  method: string;
  count: number;
  revenue: number;
};

export type PeriodSummary = {
  label: string;
  from: string;
  to: string;
  sales: number;
  gross: number;
  discounts: number;
  revenue: number;
  avgBasket: number;
  avgDaily: number;
  products: ProductStat[];
  payments: PaymentStat[];
  daily: DailyStat[];
};

export type CompareMetric = {
  label: string;
  a: number;
  b: number;
  diff: number;
  pct: number | null;
  money?: boolean;
};

export type NavTab = "overview" | "products" | "compare" | "insights";

export type SortBy = "revenue" | "qty";
