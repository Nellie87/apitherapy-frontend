import { supabase } from "@/lib/supabase/client";

/* ─────────────────────────────────────────────
   List products WITH lookup joins
───────────────────────────────────────────── */
export async function listProducts(orgId: string) {
  const { data, error } = await supabase
    .from("products")
    .select(`
      id,
      org_id,
      name, 
      barcode, 
      supplier, 
      notes,
      cost_price, 
      unit_price, 
      sell_status, 
      created_at,
      unit_measure:unit_measures ( id, name ),
      unit_size:unit_sizes ( id, label, kind )
    `)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  // Supabase returns FK joins as arrays — flatten to single object | null
  return (data ?? []).map((row) => ({
    ...row,
    unit_measure: Array.isArray(row.unit_measure)
      ? (row.unit_measure[0] ?? null)
      : row.unit_measure,
    unit_size: Array.isArray(row.unit_size)
      ? (row.unit_size[0] ?? null)
      : row.unit_size,
  }));
}

/* ─────────────────────────────────────────────
   Create product + inventory row
───────────────────────────────────────────── */
export async function createProduct(
  orgId: string,
  payload: {
    name: string;
    barcode?: string;
    unit_price: number;
    cost_price?: number;
    supplier?: string;
    notes?: string;
    unit_measure_id?: string | null;
    unit_size_id?: string | null;
    sell_status?: "to_be_sold" | "not_to_be_sold";
  }
) {
  const { data, error } = await supabase
    .from("products")
    .insert([
      {
        org_id: orgId,
        ...payload,
      },
    ])
    .select()
    .single();

  if (error) throw new Error(error.message);

  // auto-create inventory row
  const { error: invErr } = await supabase.from("inventory").insert([
    {
      org_id: orgId,
      product_id: data.id,
      qty_on_hand: 0,
      reorder_level: 5,
    },
  ]);

  if (invErr) throw new Error(invErr.message);

  return data;
}

/* ─────────────────────────────────────────────
   Delete product
───────────────────────────────────────────── */
export async function deleteProduct(orgId: string, id: string) {
  const { error } = await supabase
    .from("products")
    .delete()
    .eq("org_id", orgId)
    .eq("id", id);

  if (error) throw new Error(error.message);
}
