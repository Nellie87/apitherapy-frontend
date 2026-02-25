import { supabase } from "@/lib/supabase/client";

/* ─────────────────────────────────────────────
   Shared Types (exported)
───────────────────────────────────────────── */
export type Granularity = "day" | "month";
export type DateRange = { from: string; to: string };

/* ─────────────────────────────────────────────
   Shared Helpers (unique names, no duplicates)
───────────────────────────────────────────── */
function toISOStartDay(dayYYYYMMDD: string) {
  return `${dayYYYYMMDD}T00:00:00.000Z`;
}

// End-exclusive (next day start). Use with `.lt(...)`.
function toISOEndExclusiveDay(dayYYYYMMDD: string) {
  const d = new Date(`${dayYYYYMMDD}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

function periodKey(d: Date, g: Granularity) {
  if (g === "month") {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate()
  ).padStart(2, "0")}`;
}

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function getStockStatus(qty: number, reorder: number): "out" | "critical" | "low" | "ok" {
  if (qty <= 0) return "out";
  if (qty <= Math.min(3, reorder)) return "critical";
  if (qty <= reorder) return "low";
  return "ok";
}

/* ─────────────────────────────────────────────
   1) Sales Summary
───────────────────────────────────────────── */
export type SalesSummaryRow = {
  day: string; // YYYY-MM-DD
  sales_count: number;
  subtotal: number;
  discount_total: number;
  total: number;
};

export type SalesSummaryResult = {
  rows: SalesSummaryRow[];
  totals: {
    sales_count: number;
    subtotal: number;
    discount_total: number;
    total: number;
  };
};

export async function getSalesSummary(orgId: string, args: { from: string; to: string }) {
  // from/to are YYYY-MM-DD (inclusive)
  const fromISO = toISOStartDay(args.from);
  const toISOExclusive = toISOEndExclusiveDay(args.to);

  const { data, error } = await supabase
    .from("sales")
    .select("created_at, subtotal, discount_total, total")
    .eq("org_id", orgId)
    .gte("created_at", fromISO)
    .lt("created_at", toISOExclusive)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  const map = new Map<string, SalesSummaryRow>();

  for (const r of data ?? []) {
    const day = String((r as any).created_at).slice(0, 10);
    const prev = map.get(day) ?? {
      day,
      sales_count: 0,
      subtotal: 0,
      discount_total: 0,
      total: 0,
    };

    prev.sales_count += 1;
    prev.subtotal += num((r as any).subtotal);
    prev.discount_total += num((r as any).discount_total);
    prev.total += num((r as any).total);

    map.set(day, prev);
  }

  const rows = Array.from(map.values()).sort((a, b) => a.day.localeCompare(b.day));

  const totals = rows.reduce(
    (acc, x) => {
      acc.sales_count += x.sales_count;
      acc.subtotal += x.subtotal;
      acc.discount_total += x.discount_total;
      acc.total += x.total;
      return acc;
    },
    { sales_count: 0, subtotal: 0, discount_total: 0, total: 0 }
  );

  return { rows, totals } as SalesSummaryResult;
}

/* ─────────────────────────────────────────────
   2) Inventory Valuation
───────────────────────────────────────────── */
export type InventoryValuationRow = {
  product_id: string;
  name: string;
  sku: string | null;
  category: string | null;
  unit_price: number;
  qty_on_hand: number;
  reorder_level: number;
  status: "out" | "critical" | "low" | "ok";
  total_value: number;
  updated_at: string;
};

export type InventoryValuationResult = {
  rows: InventoryValuationRow[];
  totals: {
    products_count: number;
    total_qty: number;
    low_count: number;
    out_count: number;
    total_value: number;
  };
};

export async function getInventoryValuation(orgId: string) {
  const { data, error } = await supabase
    .from("inventory")
    .select(
      `
      product_id,
      org_id,
      qty_on_hand,
      reorder_level,
      updated_at,
      products:products (
        id,
        name,
        sku,
        category,
        unit_price
      )
    `
    )
    .eq("org_id", orgId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);

  const rows: InventoryValuationRow[] = (data ?? []).map((r: any) => {
    const p = Array.isArray(r.products) ? r.products[0] : r.products;
    const unit_price = num(p?.unit_price);
    const qty = num(r.qty_on_hand);
    const reorder = num(r.reorder_level);
    const status = getStockStatus(qty, reorder);
    const total_value = unit_price * qty;

    return {
      product_id: r.product_id,
      name: p?.name ?? "Unknown",
      sku: p?.sku ?? null,
      category: p?.category ?? null,
      unit_price,
      qty_on_hand: qty,
      reorder_level: reorder,
      status,
      total_value,
      updated_at: r.updated_at,
    };
  });

  const totals = rows.reduce(
    (acc, x) => {
      acc.products_count += 1;
      acc.total_qty += x.qty_on_hand;
      acc.total_value += x.total_value;
      if (x.status === "out") acc.out_count += 1;
      if (x.status === "low" || x.status === "critical") acc.low_count += 1;
      return acc;
    },
    { products_count: 0, total_qty: 0, low_count: 0, out_count: 0, total_value: 0 }
  );

  return { rows, totals } as InventoryValuationResult;
}

/* ─────────────────────────────────────────────
   3) Discount Report
───────────────────────────────────────────── */
export type DiscountReportRow = {
  sale_id: string;
  sold_at: string; // sales.sold_at (fallback to sales.created_at)
  sale_no: string;
  customer_name: string | null;

  product_id: string;
  name: string;
  sku: string | null;
  category: string | null;

  qty: number;
  base_price: number;
  discount_per_unit: number;
  final_price: number;
  saved_total: number;
};

export type DiscountReportResult = {
  rows: DiscountReportRow[];
  totals: {
    discounted_lines: number;
    discounted_qty: number;
    total_saved: number;
  };
};

export async function getDiscountReport(orgId: string, args: { from?: string; to?: string }) {
  const fromISO = args.from ? toISOStartDay(args.from) : null;
  const toISOExclusive = args.to ? toISOEndExclusiveDay(args.to) : null;

  let q = supabase
    .from("sale_items")
    .select(
      `
      id,
      org_id,
      sale_id,
      product_id,
      qty,
      unit_price,
      unit_price_base,
      discount_per_unit,
      line_total,
      sales:sales (
        id,
        sale_no,
        customer_name,
        sold_at,
        created_at
      ),
      products:products (
        id,
        name,
        sku,
        category
      )
    `
    )
    .eq("org_id", orgId)
    .gt("discount_per_unit", 0);

  // Prefer sold_at filters; if you don’t populate sold_at, switch these to sales.created_at.
  if (fromISO) q = q.gte("sales.sold_at", fromISO);
  if (toISOExclusive) q = q.lt("sales.sold_at", toISOExclusive);

  const { data, error } = await q.order("sale_id", { ascending: false });
  if (error) throw new Error(error.message);

  const rows: DiscountReportRow[] = (data ?? []).map((r: any) => {
    const sale = Array.isArray(r.sales) ? r.sales[0] : r.sales;
    const p = Array.isArray(r.products) ? r.products[0] : r.products;

    const qty = num(r.qty);
    const base = num(r.unit_price_base ?? r.unit_price);
    const dpu = num(r.discount_per_unit);
    const final = Math.max(0, base - dpu);
    const saved_total = dpu * qty;

    return {
      sale_id: r.sale_id,
      sold_at: sale?.sold_at ?? sale?.created_at ?? new Date().toISOString(),
      sale_no: sale?.sale_no ?? "—",
      customer_name: sale?.customer_name ?? null,

      product_id: r.product_id,
      name: p?.name ?? "Unknown",
      sku: p?.sku ?? null,
      category: p?.category ?? null,

      qty,
      base_price: base,
      discount_per_unit: dpu,
      final_price: final,
      saved_total,
    };
  });

  const totals = rows.reduce(
    (acc, x) => {
      acc.discounted_lines += 1;
      acc.discounted_qty += x.qty;
      acc.total_saved += x.saved_total;
      return acc;
    },
    { discounted_lines: 0, discounted_qty: 0, total_saved: 0 }
  );

  return { rows, totals } as DiscountReportResult;
}

/* ─────────────────────────────────────────────
   4) Expenses Trend + Categories (THIS is reportExpenses)
───────────────────────────────────────────── */
export type ExpenseTrendPoint = {
  period: string; // day or month key
  total: number;
};

export type ExpenseCategoryTotal = {
  category: string;
  amount: number;
};

export type ExpensesReportResult = {
  trend: ExpenseTrendPoint[];
  top_categories: ExpenseCategoryTotal[];
  totals: {
    total_expenses: number;
  };
};

export async function reportExpenses(orgId: string, args: {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
  granularity?: Granularity;
  topN?: number;
}) {
  const g: Granularity = args.granularity ?? "day";
  const topN = args.topN ?? 8;

  const { data, error } = await supabase
    .from("expenses")
    .select("expense_date, amount, category")
    .eq("org_id", orgId)
    .gte("expense_date", args.from)
    .lte("expense_date", args.to)
    .order("expense_date", { ascending: true });

  if (error) throw new Error(error.message);

  const trendMap = new Map<string, number>();
  const catMap = new Map<string, number>();

  for (const r of data ?? []) {
    const d = new Date(`${String((r as any).expense_date)}T00:00:00.000Z`);
    const k = periodKey(d, g);
    trendMap.set(k, (trendMap.get(k) ?? 0) + num((r as any).amount));

    const cat = String((r as any).category ?? "Uncategorized");
    catMap.set(cat, (catMap.get(cat) ?? 0) + num((r as any).amount));
  }

  const trend: ExpenseTrendPoint[] = Array.from(trendMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, total]) => ({ period, total }));

  const top_categories: ExpenseCategoryTotal[] = Array.from(catMap.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, topN);

  const total_expenses = trend.reduce((sum, x) => sum + x.total, 0);

  return {
    trend,
    top_categories,
    totals: { total_expenses },
  } as ExpensesReportResult;
}

/* ─────────────────────────────────────────────
   5) P&L (THIS is reportPnL)
───────────────────────────────────────────── */
export type PnLTrendPoint = {
  period: string; // e.g. 2026-02-01 or 2026-02
  revenue: number;
  discounts: number;
  cogs: number;
  expenses: number;
  gross_profit: number;
  net_profit: number;
};

export type PnLReportResult = {
  points: PnLTrendPoint[];
  totals: Omit<PnLTrendPoint, "period">;
};

export async function getPnLReport(orgId: string, args: {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
  granularity?: Granularity; // day/month
}) {
  const g: Granularity = args.granularity ?? "day";
  const fromISO = toISOStartDay(args.from);
  const toISOExclusive = toISOEndExclusiveDay(args.to);

  // 1) Sales
  const { data: sales, error: salesErr } = await supabase
    .from("sales")
    .select("id,total,discount_total,created_at,sold_at")
    .eq("org_id", orgId)
    .gte("created_at", fromISO)
    .lt("created_at", toISOExclusive)
    .order("created_at", { ascending: true });

  if (salesErr) throw new Error(salesErr.message);

  // 2) Sale items (COGS)
  let itemsQ = supabase
    .from("sale_items")
    .select(`
      sale_id,
      qty,
      products:products ( cost_price ),
      sales:sales ( created_at, sold_at )
    `)
    .eq("org_id", orgId);

  // Try filtering by joined sales.created_at too (helps perf). Still keep JS guard below.
  itemsQ = itemsQ.gte("sales.created_at", fromISO).lt("sales.created_at", toISOExclusive);

  const { data: items, error: itemsErr } = await itemsQ;
  if (itemsErr) throw new Error(itemsErr.message);

  // 3) Expenses
  const { data: expenses, error: expErr } = await supabase
    .from("expenses")
    .select("expense_date,amount")
    .eq("org_id", orgId)
    .gte("expense_date", args.from)
    .lte("expense_date", args.to)
    .order("expense_date", { ascending: true });

  if (expErr) throw new Error(expErr.message);

  const map = new Map<string, PnLTrendPoint>();

  const ensure = (k: string) => {
    const cur = map.get(k);
    if (cur) return cur;
    const fresh: PnLTrendPoint = {
      period: k,
      revenue: 0,
      discounts: 0,
      cogs: 0,
      expenses: 0,
      gross_profit: 0,
      net_profit: 0,
    };
    map.set(k, fresh);
    return fresh;
  };

  // Sales -> revenue/discounts
  for (const s of sales ?? []) {
    const dtRaw = (s as any).sold_at ?? (s as any).created_at;
    const d = new Date(dtRaw);
    const k = periodKey(d, g);
    const row = ensure(k);
    row.revenue += num((s as any).total);
    row.discounts += num((s as any).discount_total);
  }

  // Items -> cogs
  const fromT = new Date(fromISO).getTime();
  const toT = new Date(toISOExclusive).getTime();

  for (const it of items ?? []) {
    const sale = Array.isArray((it as any).sales) ? (it as any).sales[0] : (it as any).sales;
    const dtRaw = sale?.sold_at ?? sale?.created_at;
    if (!dtRaw) continue;

    const d = new Date(dtRaw);
    const t = d.getTime();
    if (t < fromT || t >= toT) continue; // end-exclusive

    const k = periodKey(d, g);
    const row = ensure(k);

    const p = Array.isArray((it as any).products) ? (it as any).products[0] : (it as any).products;
    const cost = num(p?.cost_price);
    const qty = num((it as any).qty);
    row.cogs += cost * qty;
  }

  // Expenses -> expenses
  for (const e of expenses ?? []) {
    const d = new Date(`${(e as any).expense_date}T00:00:00.000Z`);
    const k = periodKey(d, g);
    const row = ensure(k);
    row.expenses += num((e as any).amount);
  }

  // Compute profits
  for (const row of map.values()) {
    row.gross_profit = row.revenue - row.cogs;
    row.net_profit = row.gross_profit - row.expenses;
  }

  const points = Array.from(map.values()).sort((a, b) => a.period.localeCompare(b.period));

  const totals = points.reduce(
    (acc, p) => {
      acc.revenue += p.revenue;
      acc.discounts += p.discounts;
      acc.cogs += p.cogs;
      acc.expenses += p.expenses;
      acc.gross_profit += p.gross_profit;
      acc.net_profit += p.net_profit;
      return acc;
    },
    { revenue: 0, discounts: 0, cogs: 0, expenses: 0, gross_profit: 0, net_profit: 0 }
  );

  return { points, totals } as PnLReportResult;
}

// alias export (so your pages can import reportPnL)
export async function reportPnL(orgId: string, args: {
  from: string;
  to: string;
  granularity?: Granularity;
}) {
  return getPnLReport(orgId, args);
}