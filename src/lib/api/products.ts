import { supabase } from "@/lib/supabase/client";

export async function listProducts(orgId: string) {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createProduct(orgId: string, payload: {
  name: string; sku?: string; category?: string; unit_price: number;
}) {
  const { data, error } = await supabase
    .from("products")
    .insert([{ org_id: orgId, ...payload }])
    .select()
    .single();
  if (error) throw error;

  // ensure inventory row exists
  await supabase.from("inventory").insert([{
    org_id: orgId,
    product_id: data.id,
    qty_on_hand: 0,
    reorder_level: 5
  }]);

  return data;
}

export async function deleteProduct(orgId: string, id: string) {
  const { error } = await supabase
    .from("products")
    .delete()
    .eq("org_id", orgId)
    .eq("id", id);
  if (error) throw error;
}
