import { createClient } from "@/lib/supabase/client";

export type QuantityUnit = "g" | "kg" | "ml" | "L" | "pc";
export type UnitKind = "mass" | "volume" | "count";
export type ProductUnitSaleType = "retail" | "wholesale" | "stock_only";

export type ProductUnitRow = {
  id: string;
  label: string;
  base_quantity: number;
  cost_price: number;
  selling_price: number;
  can_sell: boolean;
  can_restock: boolean;
  is_default: boolean;
  active: boolean;
  sale_type: ProductUnitSaleType;
  unit_measure_id?: string | null;
  unit_size_id?: string | null;
  barcode?: string | null;
  sort_order?: number | null;
};

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
  product_units?: ProductUnitRow[];
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
  create_default_unit?: boolean;
};

function normalizeSingle<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function normalizeSaleType(value: unknown): ProductUnitSaleType {
  if (value === "retail" || value === "wholesale" || value === "stock_only") {
    return value;
  }
  return "retail";
}

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
      unit_size:unit_sizes ( id, label, kind ),
      product_units (
        id,
        label,
        base_quantity,
        cost_price,
        selling_price,
        can_sell,
        can_restock,
        is_default,
        active,
        sale_type,
        unit_measure_id,
        unit_size_id,
        barcode,
        sort_order
      )
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
    category: normalizeSingle(row.category),
    supplier: normalizeSingle(row.supplier),
    unit_measure: normalizeSingle(row.unit_measure),
    unit_size: (() => {
      const size = normalizeSingle(row.unit_size);
      if (!size) return null;
      return {
        id: size.id,
        label: size.label,
        kind: size.kind as UnitKind,
      };
    })(),
    product_units: (row.product_units ?? [])
      .map((u: any) => ({
        id: u.id,
        label: u.label,
        base_quantity: Number(u.base_quantity ?? 1),
        cost_price: Number(u.cost_price ?? 0),
        selling_price: Number(u.selling_price ?? 0),
        can_sell: u.can_sell !== false,
        can_restock: u.can_restock !== false,
        is_default: Boolean(u.is_default),
        active: u.active !== false,
        sale_type: normalizeSaleType(u.sale_type),
        unit_measure_id: u.unit_measure_id ?? null,
        unit_size_id: u.unit_size_id ?? null,
        barcode: u.barcode ?? null,
        sort_order: u.sort_order == null ? null : Number(u.sort_order),
      }))
      .sort((a: ProductUnitRow, b: ProductUnitRow) => {
        if (a.is_default && !b.is_default) return -1;
        if (!a.is_default && b.is_default) return 1;
        return Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0);
      }),
  }));
}

export async function createProduct(
  orgId: string,
  payload: CreateProductPayload
) {
  const supabase = createClient();

  const { create_default_unit, ...productPayload } = payload;

  const { data, error } = await supabase
    .from("products")
    .insert([
      {
        org_id: orgId,
        active: true,
        ...productPayload,
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

  if (create_default_unit !== false) {
    const defaultLabel =
      payload.quantity_value && payload.quantity_unit
        ? `${payload.quantity_value}${payload.quantity_unit}`
        : "Default unit";

    const { error: productUnitErr } = await supabase
      .from("product_units")
      .insert([
        {
          org_id: orgId,
          product_id: data.id,
          label: defaultLabel,
          base_quantity: 1,
          cost_price: Number(payload.cost_price ?? 0),
          selling_price: Number(payload.unit_price ?? 0),
          can_sell: payload.is_sellable ?? true,
          can_restock: true,
          is_default: true,
          active: true,
          sale_type: "retail",
          unit_measure_id: payload.unit_measure_id ?? null,
          unit_size_id: payload.unit_size_id ?? null,
          barcode: payload.barcode ?? null,
          sort_order: 0,
        },
      ]);

    if (productUnitErr) throw new Error(productUnitErr.message);
  }

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
