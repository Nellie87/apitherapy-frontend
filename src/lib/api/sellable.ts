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
    sell_status: string | null;
    active: boolean;
    is_sellable?: boolean | null;
    quantity_value?: number | null;
    quantity_unit?: string | null;
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
        active,
        is_sellable,
        quantity_value,
        quantity_unit
      )
    `)
    .eq("org_id", orgId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as any[];

  return rows
    .map((r) => {
      const p = Array.isArray(r.products)
        ? r.products[0] ?? null
        : r.products ?? null;

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
              is_sellable: p.is_sellable ?? null,
              quantity_value: p.quantity_value ?? null,
              quantity_unit: p.quantity_unit ?? null,
            }
          : null,
      };
    })

    // MUST have product
    .filter((r) => r.products !== null)

    // ONLY ACTIVE
    .filter((r) => r.products!.active === true)

    // ONLY EXPLICITLY SELLABLE
    .filter((r) => r.products!.is_sellable !== false)

    // ONLY PRODUCTS MEANT TO BE SOLD
    .filter((r) => r.products!.sell_status === "to_be_sold") as SellableRow[];
}