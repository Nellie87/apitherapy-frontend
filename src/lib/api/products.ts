import { createClient } from "@/lib/supabase/client";

export type UnitKind = "mass" | "volume" | "count";
export type QuantityUnit = "g" | "kg" | "ml" | "L" | "pc";

export type ProductRow = {
  id: string;
  org_id: string;
  name: string;
  sku?: string | null;
  category_id?: string | null;
  barcode?: string | null;
  notes?: string | null;
  cost_price?: number;
  unit_price?: number;
  quantity_value?: number | null;
  quantity_unit?: QuantityUnit | null;
  unit_measure_id?: string | null;
  unit_size_id?: string | null;
  is_sellable?: boolean;
  active?: boolean;
  created_at?: string;
  supplier_id?: string | null;
  category?: { id: string; name: string } | null;
  supplier?: {
    id: string;
    name: string;
    contact_person?: string | null;
    phone?: string | null;
    email?: string | null;
    notes?: string | null;
    active?: boolean | null;
  } | null;
  unit_measure?: { id: string; name: string } | null;
  unit_size?: { id: string; label: string; kind: UnitKind } | null;
};

export type CreateProductPayload = {
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
  quantity_value?: number | null;
  quantity_unit?: QuantityUnit | null;
  is_sellable?: boolean;
};

export async function listProducts(
  orgId: string,
  activeOnly = true
): Promise<ProductRow[]> {
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
      quantity_value,
      quantity_unit,
      unit_measure_id,
      unit_size_id,
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
    quantity_value:
      row.quantity_value !== null && row.quantity_value !== undefined
        ? Number(row.quantity_value)
        : null,
    quantity_unit: row.quantity_unit ?? null,
    category: Array.isArray(row.category) ? (row.category[0] ?? null) : row.category,
    supplier: Array.isArray(row.supplier) ? (row.supplier[0] ?? null) : row.supplier,
    unit_measure: Array.isArray(row.unit_measure)
      ? (row.unit_measure[0] ?? null)
      : row.unit_measure,
    unit_size: Array.isArray(row.unit_size)
      ? row.unit_size[0]
        ? {
            ...row.unit_size[0],
            kind: row.unit_size[0].kind as UnitKind,
          }
        : null
      : row.unit_size
      ? {
          ...row.unit_size,
          kind: row.unit_size.kind as UnitKind,
        }
      : null,
  }));
}

export async function createProduct(
  orgId: string,
  payload: CreateProductPayload
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

export async function archiveProduct(orgId: string, id: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("products")
    .update({ active: false })
    .eq("org_id", orgId)
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function restoreProduct(orgId: string, id: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("products")
    .update({ active: true })
    .eq("org_id", orgId)
    .eq("id", id);

  if (error) throw new Error(error.message);
}

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