import { supabase } from "@/lib/supabase/client";

export type InventoryRow = {
  product_id: string;
  org_id: string;
  qty_on_hand: number;
  reorder_level: number;
  updated_at: string;
  products?: {
    id: string;
    name: string;
    unit_price: number;
    sku: string | null;
    category: string | null;
  } | null;
};

export async function listInventory(orgId: string) {
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
        unit_price,
        sku,
        category
      )
    `
    )
    .eq("org_id", orgId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as InventoryRow[];
}

export async function updateInventory(
  orgId: string,
  productId: string,
  patch: Partial<Pick<InventoryRow, "qty_on_hand" | "reorder_level">>
) {
  // Optional sanity check
  const ping = await supabase
    .from("inventory")
    .select("product_id")
    .eq("org_id", orgId)
    .eq("product_id", productId)
    .maybeSingle();

  if (ping.error) {
    throw new Error(`Inventory read failed: ${ping.error.message}`);
  }
  if (!ping.data) {
    throw new Error("Inventory row not found for this product.");
  }

  const { data, error } = await supabase
    .from("inventory")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("org_id", orgId)
    .eq("product_id", productId)
    .select(
      `
      product_id,
      org_id,
      qty_on_hand,
      reorder_level,
      updated_at
    `
    )
    .single();

  if (error) throw new Error(`Inventory update failed: ${error.message}`);
  return data;
}
