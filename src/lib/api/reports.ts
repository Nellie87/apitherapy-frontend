import { supabase } from "@/lib/supabase/client";

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



function toISOStart(dayYYYYMMDD: string) {
  // inclusive start
  return `${dayYYYYMMDD}T00:00:00.000Z`;
}

function toISOEnd(dayYYYYMMDD: string) {
  // inclusive end -> next day start exclusive
  const d = new Date(`${dayYYYYMMDD}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

export async function getSalesSummary(orgId: string, args: { from: string; to: string }) {
  // from/to are YYYY-MM-DD (inclusive)
  const fromISO = toISOStart(args.from);
  const toISOExclusive = toISOEnd(args.to);

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
    const day = String(r.created_at).slice(0, 10); // YYYY-MM-DD
    const prev = map.get(day) ?? {
      day,
      sales_count: 0,
      subtotal: 0,
      discount_total: 0,
      total: 0,
    };

    prev.sales_count += 1;
    prev.subtotal += Number(r.subtotal ?? 0);
    prev.discount_total += Number(r.discount_total ?? 0);
    prev.total += Number(r.total ?? 0);

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

  const result: SalesSummaryResult = { rows, totals };
  return result;
}

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

function getStockStatus(qty: number, reorder: number): "out" | "critical" | "low" | "ok" {
  if (qty <= 0) return "out";
  if (qty <= Math.min(3, reorder)) return "critical";
  if (qty <= reorder) return "low";
  return "ok";
}

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
    const p = Array.isArray(r.products) ? r.products[0] : r.products; // safety
    const unit_price = Number(p?.unit_price ?? 0);
    const qty = Number(r.qty_on_hand ?? 0);
    const reorder = Number(r.reorder_level ?? 0);
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

  const result: InventoryValuationResult = { rows, totals };
  return result;
}