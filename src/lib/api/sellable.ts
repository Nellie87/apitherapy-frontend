import { createClient } from "@/lib/supabase/client";

export type SellableProduct = {
  id: string;
  name: string | null;
  sku?: string | null;
  barcode?: string | null;
  category?: string | null;
  unit_price?: number | null;
  quantity_value?: number | null;
  quantity_unit?: string | null;
};

export type SellableRow = {
  org_id: string;
  product_id: string;
  qty_on_hand: number;
  reorder_level?: number | null;
  products: SellableProduct | null;
};

export async function listSellable(orgId: string): Promise<SellableRow[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("inventory")
    .select(`
      org_id,
      product_id,
      qty_on_hand,
      reorder_level,
      products:products (
        id,
        name,
        sku,
        barcode,
        category,
        unit_price,
        quantity_value,
        quantity_unit,
        is_sellable,
        active
      )
    `)
    .eq("org_id", orgId)
    .gte("qty_on_hand", 0)
    .eq("products.is_sellable", true)
    .eq("products.active", true)
    .order("qty_on_hand", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((r: any) => {
    const p = Array.isArray(r.products) ? r.products[0] ?? null : r.products;

    return {
      org_id: String(r.org_id),
      product_id: String(r.product_id),
      qty_on_hand: Number(r.qty_on_hand ?? 0),
      reorder_level: r.reorder_level == null ? null : Number(r.reorder_level),
      products: p
  ? {
      id: String(p.id),
      name: String(p.name),
      quantity_value: p.quantity_value == null ? null : Number(p.quantity_value),
      quantity_unit: p.quantity_unit ?? null,
    }
  : null,
    };
  });
}