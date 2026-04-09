import { createClient } from "@/lib/supabase/client";

/* ─────────────────────────────────────────────
   List products WITH lookup joins
   activeOnly = true by default
───────────────────────────────────────────── */
export async function listProducts(orgId: string, activeOnly = true) {
  const supabase = createClient();

  let query = supabase
    .from("products")
    .select(`
      id,
      org_id,
      name,
      sku,
      category_id,
      barcode,
      notes,
      cost_price,
      unit_price,
      is_sellable,
      active,
      created_at,
      supplier_id,
      category:categories ( id, name ),
      supplier:suppliers ( id, name, contact_person, phone, email, notes, active ),
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

  return (data ?? []).map((row: any) => ({
    ...row,
    active: Boolean(row.active),
    is_sellable: row.is_sellable !== false,
    cost_price: Number(row.cost_price ?? 0),
    unit_price: Number(row.unit_price ?? 0),
    category: Array.isArray(row.category) ? (row.category[0] ?? null) : row.category,
    supplier: Array.isArray(row.supplier) ? (row.supplier[0] ?? null) : row.supplier,
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
    sku?: string;
    category_id?: string | null;
    barcode?: string;
    supplier_id?: string | null;
    notes?: string;
    unit_price: number;
    cost_price?: number;
    unit_measure_id?: string | null;
    unit_size_id?: string | null;
    is_sellable?: boolean;
  }
) {
  const supabase = createClient();

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
  const supabase = createClient();
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
  const supabase = createClient();
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
  const supabase = createClient();

  const { count, error: countErr } = await supabase
    .from("sale_items")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("product_id", id);

  if (countErr) throw new Error(countErr.message);

  if ((count ?? 0) > 0) {
    throw new Error(
      "This product has sales history and cannot be deleted permanently. Archive it instead."
    );
  }

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("org_id", orgId)
    .eq("id", id);

  if (error) throw new Error(error.message);
}