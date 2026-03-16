import { supabase } from "@/lib/supabase/client";

/* ─────────────────────────────────────────────
   List products WITH lookup joins
   activeOnly = true by default
───────────────────────────────────────────── */
export async function listProducts(orgId: string, activeOnly = true) {
  let query = supabase
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
      active,
      created_at,
      unit_measure:unit_measures ( id, name ),
      unit_size:unit_sizes ( id, label, kind )
    `)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (activeOnly) {
    query = query.eq("active", true);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);

  // Supabase returns FK joins as arrays — flatten to single object | null
  return (data ?? []).map((row: any) => ({
    ...row,
    active: Boolean(row.active),
    cost_price: Number(row.cost_price ?? 0),
    unit_price: Number(row.unit_price ?? 0),
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
        active: true,
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
   Archive product (soft delete)
───────────────────────────────────────────── */
export async function archiveProduct(orgId: string, id: string) {
  const { error } = await supabase
    .from("products")
    .update({ active: false })
    .eq("org_id", orgId)
    .eq("id", id);

  if (error) throw new Error(error.message);
}

/* ─────────────────────────────────────────────
   Restore product
───────────────────────────────────────────── */
export async function restoreProduct(orgId: string, id: string) {
  const { error } = await supabase
    .from("products")
    .update({ active: true })
    .eq("org_id", orgId)
    .eq("id", id);

  if (error) throw new Error(error.message);
}

/* ─────────────────────────────────────────────
   Hard delete ONLY if never used in sales
───────────────────────────────────────────── */
export async function deleteProductForever(orgId: string, id: string) {
  const { count, error: countErr } = await supabase
    .from("sale_items")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("product_id", id);

  if (countErr) throw new Error(countErr.message);

  if ((count ?? 0) > 0) {
    throw new Error("This product has sales history and cannot be deleted permanently. Archive it instead.");
  }

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("org_id", orgId)
    .eq("id", id);

  if (error) throw new Error(error.message);
}