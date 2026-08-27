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

export type WeekdayStat = {
  weekday: number;
  label: string;
  shortLabel: string;
  sales_count: number;
  revenue: number;
  avgBasket: number;
};

export type PaymentStat = {
  method: string;
  count: number;
  revenue: number;
};

export type DeadStockItem = {
  product_id: string;
  name: string;
  qty_on_hand: number;
  cost_value: number;
  retail_value: number;
  last_sold_at: string | null;
  days_since_sale: number | null;
  never_sold: boolean;
};

export type PeriodSummary = {
  label: string;
  from: string;
  to: string;
  sales: number;
  cancelledSales?: number;
  cancelledValue?: number;
  gross: number;
  discounts: number;
  revenue: number;
  avgBasket: number;
  avgDaily: number;
  products: ProductStat[];
  payments: PaymentStat[];
  daily: DailyStat[];
  weekdays: WeekdayStat[];
};

export type CompareMetric = {
  label: string;
  a: number;
  b: number;
  diff: number;
  pct: number | null;
  money?: boolean;
};

export type NavTab = "overview" | "products" | "stock" | "compare" | "insights";

export type SortBy = "revenue" | "qty";

export type SaleAuditSummary = {
  cancelledCount: number;
  cancelledValue: number;
  editedCount: number;
  editEvents: number;
  discountedCount: number;
};

export type SaleDetailRow = {
  id: string;
  sale_no: string;
  day: string;
  customer: string;
  items: string;
  payment: string;
  staff: string;
  discount: number;
  total: number;
};
