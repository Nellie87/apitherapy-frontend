import { supabase } from "@/lib/supabase/client";

export type SellableRow = {
  product_id: string;
  qty_on_hand: number;
  reorder_level: number;
  products: {
    id: string;
    name: string;
    unit_price: number;
    barcode: string | null;
    sku: string | null;
  } | null;
};

export async function listSellable(orgId: string) {
  const { data, error } = await supabase
    .from("inventory")
    .select(`
      product_id,
      qty_on_hand,
      reorder_level,
      products:products (
        id, name, unit_price, barcode, sku, sell_status
      )
    `)
    .eq("org_id", orgId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);

  // filter out not-to-be-sold on client side
  const rows = (data ?? []) as any[];
  return rows
    .filter((r) => r.products && r.products.sell_status !== "not_to_be_sold")
    .map((r) => ({
      product_id: r.product_id,
      qty_on_hand: Number(r.qty_on_hand ?? 0),
      reorder_level: Number(r.reorder_level ?? 0),
      products: r.products
        ? {
            id: r.products.id,
            name: r.products.name,
            unit_price: Number(r.products.unit_price ?? 0),
            barcode: r.products.barcode ?? null,
            sku: r.products.sku ?? null,
          }
        : null,
    })) as SellableRow[];
}
