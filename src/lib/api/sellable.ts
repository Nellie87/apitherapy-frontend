import { createClient } from "@/lib/supabase/client";

export type SellableProductUnit = {
  id: string;
  label: string;
  base_quantity: number;
  selling_price: number;
  cost_price: number;
  can_sell: boolean;
  is_default: boolean;
  active: boolean;
};

export type SellableProduct = {
  id: string;
  name: string | null;
  sku?: string | null;
  barcode?: string | null;
  category?: string | null;
  unit_price?: number | null;
  quantity_value?: number | null;
  quantity_unit?: string | null;
  product_units?: SellableProductUnit[];
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
        active,
        product_units (
          id,
          label,
          base_quantity,
          selling_price,
          cost_price,
          can_sell,
          is_default,
          active
        )
      )
    `)
    .eq("org_id", orgId)
    .gte("qty_on_hand", 0)
    .eq("products.is_sellable", true)
    .eq("products.active", true)
    .order("qty_on_hand", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((r: any) => {
      const p = Array.isArray(r.products) ? r.products[0] ?? null : r.products;

      return {
        org_id: String(r.org_id),
        product_id: String(r.product_id),
        qty_on_hand: Number(r.qty_on_hand ?? 0),
        reorder_level: r.reorder_level == null ? null : Number(r.reorder_level),
        products: p
          ? {
              id: String(p.id),
              name: p.name ?? null,
              sku: p.sku ?? null,
              barcode: p.barcode ?? null,
              category: p.category ?? null,
              unit_price: p.unit_price == null ? null : Number(p.unit_price),
              quantity_value:
                p.quantity_value == null ? null : Number(p.quantity_value),
              quantity_unit: p.quantity_unit ?? null,
              product_units: (p.product_units ?? [])
                .filter((u: any) => u.active !== false && u.can_sell !== false)
                .map((u: any) => ({
                  id: String(u.id),
                  label: String(u.label),
                  base_quantity: Number(u.base_quantity ?? 1),
                  selling_price: Number(u.selling_price ?? 0),
                  cost_price: Number(u.cost_price ?? 0),
                  can_sell: u.can_sell !== false,
                  is_default: Boolean(u.is_default),
                  active: u.active !== false,
                })),
            }
          : null,
      };
    })
    .filter((r) => r.products !== null);
}