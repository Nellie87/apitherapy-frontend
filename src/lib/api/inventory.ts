import { createClient } from "@/lib/supabase/client";

export type InventoryProduct = {
  id: string;
  name: string;
  unit_price: number;
  sku: string | null;
  category: string | null;
};

export type InventoryRow = {
  product_id: string;
  org_id: string;
  qty_on_hand: number;
  reorder_level: number;
  updated_at: string;

  // After normalization, this is a single object (not an array)
  products?: InventoryProduct | null;
};

export async function listInventory(orgId: string): Promise<InventoryRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("inventory")
    .select(`
      product_id,
      org_id,
      qty_on_hand,
      reorder_level,
      updated_at,
      products:products ( id, name, unit_price, sku, category )
    `)
    .eq("org_id", orgId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);

  // Flatten the array join → single object | null
  return (data ?? []).map((row) => ({
    ...row,
    products: Array.isArray(row.products)
      ? (row.products[0] ?? null)
      : row.products,
  })) as InventoryRow[];
}

export async function updateInventory(
  orgId: string,
  productId: string,
  patch: Partial<Pick<InventoryRow, "qty_on_hand" | "reorder_level">>
) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("inventory")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("org_id", orgId)
    .eq("product_id", productId)
    .select("product_id, org_id, qty_on_hand, reorder_level, updated_at")
    .maybeSingle(); // better than .single()

  if (error) throw new Error(`Inventory update failed: ${error.message}`);

  if (!data) {
    throw new Error(
      "No rows updated. Likely RLS blocked UPDATE (or row not found for this org_id/product_id)."
    );
  }

  return data;
}
