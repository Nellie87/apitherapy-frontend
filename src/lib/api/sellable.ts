import { createClient } from "@/lib/supabase/client";

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
  const supabase = createClient();
  const { data, error } = await supabase
    .from("inventory")
    .select(`
      product_id,
      qty_on_hand,
      reorder_level,
      products:products (
        id,
        name,
        unit_price,
        barcode,
        sku,
        sell_status,
        active
      )
    `)
    .eq("org_id", orgId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as any[];

  return rows
    .map((r) => {
      const p = Array.isArray(r.products) ? r.products[0] ?? null : r.products ?? null;
      return {
        product_id: r.product_id,
        qty_on_hand: Number(r.qty_on_hand ?? 0),
        reorder_level: Number(r.reorder_level ?? 0),
        products: p
          ? {
              id: String(p.id),
              name: String(p.name),
              unit_price: Number(p.unit_price ?? 0),
              barcode: p.barcode ?? null,
              sku: p.sku ?? null,
              sell_status: p.sell_status ?? null,
              active: Boolean(p.active),
            }
          : null,
      };
    })
    .filter((r) => r.products)
    .filter((r: any) => r.products.active === true)
    .filter((r: any) => r.products.sell_status !== "not_to_be_sold")
    .map((r: any) => ({
      product_id: r.product_id,
      qty_on_hand: r.qty_on_hand,
      reorder_level: r.reorder_level,
      products: {
        id: r.products.id,
        name: r.products.name,
        unit_price: r.products.unit_price,
        barcode: r.products.barcode,
        sku: r.products.sku,
      },
    })) as SellableRow[];
}