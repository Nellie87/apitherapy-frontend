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