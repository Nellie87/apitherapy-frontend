import { createClient } from "@/lib/supabase/client";

/* ─────────────────────────────────────────────
   Shared Types
───────────────────────────────────────────── */
export type Granularity = "day" | "month";
export type DateRange = { from: string; to: string };

/* ─────────────────────────────────────────────
   Shared Helpers (unique names)
───────────────────────────────────────────── */
function isoStartDay(dayYYYYMMDD: string) {
  return `${dayYYYYMMDD}T00:00:00.000Z`;
}

// End-exclusive (next day start). Use with `.lt(...)`.
function isoEndExclusiveDay(dayYYYYMMDD: string) {
  const d = new Date(`${dayYYYYMMDD}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

function periodKeyUTC(d: Date, g: Granularity) {
  if (g === "month") {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate()
  ).padStart(2, "0")}`;
}

function numSafe(v: any) {
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
  const fromISO = isoStartDay(args.from);
  const toISOExclusive = isoEndExclusiveDay(args.to);

  const supabase = createClient();
  const { data, error } = await supabase
    .from("sales")
    .select("sold_at, subtotal, discount_total, total")
    .eq("org_id", orgId)
    .gte("sold_at", fromISO)
    .lt("sold_at", toISOExclusive)
    .order("sold_at", { ascending: true });

  if (error) throw new Error(error.message);

  const map = new Map<string, SalesSummaryRow>();

  for (const r of data ?? []) {
    const day = String((r as any).sold_at).slice(0, 10);
    const prev =
      map.get(day) ??
      ({
        day,
        sales_count: 0,
        subtotal: 0,
        discount_total: 0,
        total: 0,
      } as SalesSummaryRow);

    prev.sales_count += 1;
    prev.subtotal += numSafe((r as any).subtotal);
    prev.discount_total += numSafe((r as any).discount_total);
    prev.total += numSafe((r as any).total);

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
  /** Selling price / retail price */
  unit_price: number;
  /** Purchase cost per unit */
  cost_price: number;
  qty_on_hand: number;
  reorder_level: number;
  status: "out" | "critical" | "low" | "ok";
  /** Cost value: qty_on_hand × cost_price */
  cost_value: number;
  /** Retail value: qty_on_hand × unit_price */
  retail_value: number;
  /** Kept for old pages that still read total_value. This is cost value. */
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
    /** Cost value of current stock */
    total_value: number;
    total_cost_value: number;
    /** Retail value of current stock */
    total_retail_value: number;
    potential_gross_profit: number;
    gross_margin: number;
  };
};

export async function getInventoryValuation(orgId: string) {
  const supabase = createClient();
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
        unit_price,
        cost_price
      )
    `
    )
    .eq("org_id", orgId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);

  const rows: InventoryValuationRow[] = (data ?? []).map((r: any) => {
    const p = Array.isArray(r.products) ? r.products[0] : r.products;
    const unit_price = numSafe(p?.unit_price);
    const cost_price = numSafe(p?.cost_price);
    const qty = numSafe(r.qty_on_hand);
    const reorder = numSafe(r.reorder_level);
    const status = getStockStatus(qty, reorder);
    const cost_value = cost_price * qty;
    const retail_value = unit_price * qty;
    const total_value = cost_value;

    return {
      product_id: r.product_id,
      name: p?.name ?? "Unknown",
      sku: p?.sku ?? null,
      category: p?.category ?? null,
      unit_price,
      cost_price,
      qty_on_hand: qty,
      reorder_level: reorder,
      status,
      cost_value,
      retail_value,
      total_value,
      updated_at: r.updated_at,
    };
  });

  const totals = rows.reduce(
    (acc, x) => {
      acc.products_count += 1;
      acc.total_qty += x.qty_on_hand;
      acc.total_value += x.cost_value;
      acc.total_cost_value += x.cost_value;
      acc.total_retail_value += x.retail_value;
      if (x.status === "out") acc.out_count += 1;
      if (x.status === "low" || x.status === "critical") acc.low_count += 1;
      return acc;
    },
    {
      products_count: 0,
      total_qty: 0,
      low_count: 0,
      out_count: 0,
      total_value: 0,
      total_cost_value: 0,
      total_retail_value: 0,
      potential_gross_profit: 0,
      gross_margin: 0,
    }
  );

  totals.potential_gross_profit = totals.total_retail_value - totals.total_cost_value;
  totals.gross_margin =
    totals.total_retail_value > 0
      ? (totals.potential_gross_profit / totals.total_retail_value) * 100
      : 0;

  return { rows, totals } as InventoryValuationResult;
}

/* ─────────────────────────────────────────────
   3) Discount Report
───────────────────────────────────────────── */
export type DiscountReportRow = {
  sale_id: string;
  sold_at: string;
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
  const fromISO = args.from ? isoStartDay(args.from) : null;
  const toISOExclusive = args.to ? isoEndExclusiveDay(args.to) : null;
  const supabase = createClient();

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

    const qty = numSafe(r.qty);
    const base = numSafe(r.unit_price_base ?? r.unit_price);
    const dpu = numSafe(r.discount_per_unit);
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
   4) Expenses Trend + Categories (reportExpenses)
   Backwards compatible: exposes `by_category`
───────────────────────────────────────────── */
export type ExpenseTrendPoint = {
  period: string;
  total: number;
};

export type ExpenseCategoryTotal = {
  category: string;
  amount: number;
};

export type ExpensesReportResult = {
  trend: ExpenseTrendPoint[];
  top_categories: ExpenseCategoryTotal[];
  by_category: ExpenseCategoryTotal[]; // ✅ alias for older pages
  totals: {
    total_expenses: number;
  };
};

async function reportExpensesCore(
  orgId: string,
  args: { from: string; to: string; granularity?: Granularity; topN?: number }
) {
  const g: Granularity = args.granularity ?? "day";
  const topN = args.topN ?? 8;
  const supabase = createClient();
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
    const k = periodKeyUTC(d, g);
    trendMap.set(k, (trendMap.get(k) ?? 0) + numSafe((r as any).amount));

    const cat = String((r as any).category ?? "Uncategorized");
    catMap.set(cat, (catMap.get(cat) ?? 0) + numSafe((r as any).amount));
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
    by_category: top_categories, // ✅ alias
    totals: { total_expenses },
  } as ExpensesReportResult;
}

// ✅ supports BOTH: reportExpenses(orgId, {from,to,granularity}) and reportExpenses(orgId, range, g)
export async function reportExpenses(orgId: string, a: any, b?: any, c?: any) {
  if (typeof a === "object" && a?.from && a?.to && (typeof b === "string" || b === undefined)) {
    // called as reportExpenses(orgId, range, g)
    const range = a as DateRange;
    const g = (b as Granularity) ?? "day";
    const topN = typeof c === "number" ? c : 8;
    return reportExpensesCore(orgId, { from: range.from, to: range.to, granularity: g, topN });
  }

  // called as reportExpenses(orgId, argsObject)
  return reportExpensesCore(orgId, a);
}

/* ─────────────────────────────────────────────
   5) P&L (reportPnL)
   Backwards compatible: exposes `summary` with `profit`
───────────────────────────────────────────── */
export type PnLTrendPoint = {
  period: string;
  revenue: number;
  discounts: number;
  cogs: number;
  expenses: number;
  gross_profit: number;
  net_profit: number;
};

export type PnLSummary = {
  revenue: number;
  discounts: number;
  cogs: number;
  expenses: number;
  gross_profit: number;
  net_profit: number;
  profit: number; // ✅ alias (net_profit)
};

export type PnLReportResult = {
  points: PnLTrendPoint[];
  totals: Omit<PnLTrendPoint, "period">;
  summary: PnLSummary; // ✅ for your UI
};

async function reportPnLCore(orgId: string, args: { from: string; to: string; granularity?: Granularity }) {
  const g: Granularity = args.granularity ?? "day";
  const fromISO = isoStartDay(args.from);
  const toISOExclusive = isoEndExclusiveDay(args.to);

  // 1) Sales
  const supabase = createClient();
  const { data: sales, error: salesErr } = await supabase
    .from("sales")
    .select("id,total,discount_total,created_at,sold_at")
    .eq("org_id", orgId)
    .gte("sold_at", fromISO)
    .lt("sold_at", toISOExclusive)
    .order("sold_at", { ascending: true });

  if (salesErr) throw new Error(salesErr.message);

  // 2) Sale items for COGS
  let itemsQ = supabase
    .from("sale_items")
    .select(
      `
      sale_id,
      qty,
      products:products ( cost_price ),
      sales:sales ( sold_at )
    `
    )
    .eq("org_id", orgId);

  // join filter (perf); still guard in JS
itemsQ = itemsQ
  .gte("sales.sold_at", fromISO)
  .lt("sales.sold_at", toISOExclusive);

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
    const k = periodKeyUTC(d, g);
    const row = ensure(k);
    row.revenue += numSafe((s as any).total);
    row.discounts += numSafe((s as any).discount_total);
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
    if (t < fromT || t >= toT) continue;

    const k = periodKeyUTC(d, g);
    const row = ensure(k);

    const p = Array.isArray((it as any).products) ? (it as any).products[0] : (it as any).products;
    const cost = numSafe(p?.cost_price);
    const qty = numSafe((it as any).qty);
    row.cogs += cost * qty;
  }

  // Expenses -> expenses
  for (const e of expenses ?? []) {
    const d = new Date(`${String((e as any).expense_date)}T00:00:00.000Z`);
    const k = periodKeyUTC(d, g);
    const row = ensure(k);
    row.expenses += numSafe((e as any).amount);
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

  const summary: PnLSummary = {
    ...totals,
    profit: totals.net_profit, // ✅ alias your UI expects
  };

  return { points, totals, summary } as PnLReportResult;
}

// ✅ supports BOTH: reportPnL(orgId, {from,to,granularity}) and reportPnL(orgId, range, g)
export async function reportPnL(orgId: string, a: any, b?: any) {
  if (typeof a === "object" && a?.from && a?.to && (typeof b === "string" || b === undefined)) {
    const range = a as DateRange;
    const g = (b as Granularity) ?? "day";
    return reportPnLCore(orgId, { from: range.from, to: range.to, granularity: g });
  }
  return reportPnLCore(orgId, a);
}

/* ─────────────────────────────────────────────
   6) Balance Sheet (best with your schema)
   - Inventory at COST (cost_price * qty_on_hand)
   - Liabilities = 0 (until payables/loans tables exist)
   - Equity = retained earnings = net profit to date
───────────────────────────────────────────── */
export type BalanceSheetResult = {
  as_of: string;
  assets: {
    inventory_at_cost: number;
    total_assets: number;
  };
  liabilities: {
    total_liabilities: number;
  };
  equity: {
    retained_earnings: number;
    total_equity: number;
  };
  pnl_to_date: {
    revenue: number;
    discounts: number;
    cogs: number;
    expenses: number;
    net_profit: number;
  };
  check: {
    assets_minus_liabilities_minus_equity: number;
  };
};

export async function getBalanceSheet(orgId: string, args: { as_of: string }) {
  const asOf = args.as_of;
  const toISOExclusive = isoEndExclusiveDay(asOf);

  // Inventory at cost (point-in-time)
  const supabase = createClient();

  const { data: inv, error: invErr } = await supabase
    .from("inventory")
    .select(
      `
      qty_on_hand,
      products:products ( cost_price )
    `
    )
    .eq("org_id", orgId);

  if (invErr) throw new Error(invErr.message);

  let inventoryAtCost = 0;
  for (const r of inv ?? []) {
    const p = Array.isArray((r as any).products) ? (r as any).products[0] : (r as any).products;
    const qty = numSafe((r as any).qty_on_hand);
    const cost = numSafe(p?.cost_price);
    inventoryAtCost += cost * qty;
  }

  // Sales up to as_of
  const { data: sales, error: salesErr } = await supabase
    .from("sales")
    .select("id,total,discount_total,created_at")
    .eq("org_id", orgId)
    .lt("created_at", toISOExclusive);

  if (salesErr) throw new Error(salesErr.message);

  const saleIds = (sales ?? []).map((s: any) => String(s.id));
  let revenue = 0;
  let discounts = 0;

  for (const s of sales ?? []) {
    revenue += numSafe((s as any).total);
    discounts += numSafe((s as any).discount_total);
  }

  // COGS for those sales
  let cogs = 0;
  if (saleIds.length) {
    const chunkSize = 200;
    for (let i = 0; i < saleIds.length; i += chunkSize) {
      const chunk = saleIds.slice(i, i + chunkSize);

      const { data: items, error: itemsErr } = await supabase
        .from("sale_items")
        .select(`sale_id, qty, products:products ( cost_price )`)
        .eq("org_id", orgId)
        .in("sale_id", chunk);

      if (itemsErr) throw new Error(itemsErr.message);

      for (const it of items ?? []) {
        const p = Array.isArray((it as any).products) ? (it as any).products[0] : (it as any).products;
        cogs += numSafe((it as any).qty) * numSafe(p?.cost_price);
      }
    }
  }

  // Expenses up to as_of
  const { data: ex, error: exErr } = await supabase
    .from("expenses")
    .select("amount,expense_date")
    .eq("org_id", orgId)
    .lte("expense_date", asOf);

  if (exErr) throw new Error(exErr.message);

  let expenses = 0;
  for (const e of ex ?? []) expenses += numSafe((e as any).amount);

  const netProfit = revenue - cogs - expenses;

  const assets = { inventory_at_cost: inventoryAtCost, total_assets: inventoryAtCost };
  const liabilities = { total_liabilities: 0 };
  const equity = { retained_earnings: netProfit, total_equity: netProfit };

  const checkVal = assets.total_assets - liabilities.total_liabilities - equity.total_equity;

  return {
    as_of: asOf,
    assets,
    liabilities,
    equity,
    pnl_to_date: { revenue, discounts, cogs, expenses, net_profit: netProfit },
    check: { assets_minus_liabilities_minus_equity: checkVal },
  } as BalanceSheetResult;
}

// ✅ Alias name if your page imports `reportBalanceSheet`
export async function reportBalanceSheet(orgId: string, args: { asOf: string }) {
  return getBalanceSheet(orgId, { as_of: args.asOf });
}