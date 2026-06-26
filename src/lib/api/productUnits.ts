import { createClient } from "@/lib/supabase/client";

export type ProductUnitSaleType = "retail" | "wholesale" | "stock_only";

export type ProductUnitRow = {
  id: string;
  org_id: string;
  product_id: string;
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
  unit_measure?: { id: string; name: string } | null;
  unit_size?: { id: string; label: string; kind: string } | null;
};

export type SaveProductUnitPayload = {
  id?: string;
  product_id: string;
  label: string;
  base_quantity: number;
  cost_price: number;
  selling_price: number;
  can_sell: boolean;
  can_restock: boolean;
  is_default?: boolean;
  active?: boolean;
  sale_type?: ProductUnitSaleType;
  unit_measure_id?: string | null;
  unit_size_id?: string | null;
  barcode?: string | null;
  sort_order?: number;
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

export async function listProductUnits(
  orgId: string,
  productId: string
): Promise<ProductUnitRow[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("product_units")
    .select(`
      id,
      org_id,
      product_id,
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
      sort_order,
      unit_measure:unit_measures ( id, name ),
      unit_size:unit_sizes ( id, label, kind )
    `)
    .eq("org_id", orgId)
    .eq("product_id", productId)
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("base_quantity", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row: any) => ({
    ...row,
    base_quantity: Number(row.base_quantity ?? 1),
    cost_price: Number(row.cost_price ?? 0),
    selling_price: Number(row.selling_price ?? 0),
    can_sell: row.can_sell !== false,
    can_restock: row.can_restock !== false,
    is_default: Boolean(row.is_default),
    active: row.active !== false,
    sale_type: normalizeSaleType(row.sale_type),
    sort_order: row.sort_order == null ? null : Number(row.sort_order),
    unit_measure: normalizeSingle(row.unit_measure),
    unit_size: normalizeSingle(row.unit_size),
  }));
}

export async function saveProductUnits(
  orgId: string,
  productId: string,
  units: SaveProductUnitPayload[]
) {
  const supabase = createClient();

  const cleaned = units
    .filter((u) => u.label.trim() && Number(u.base_quantity) > 0)
    .map((u, index) => {
      const saleType = normalizeSaleType(u.sale_type);
      return {
        ...(u.id ? { id: u.id } : {}),
        org_id: orgId,
        product_id: productId,
        label: u.label.trim(),
        base_quantity: Number(u.base_quantity),
        cost_price: Number(u.cost_price || 0),
        selling_price: Number(u.selling_price || 0),
        can_sell: saleType === "stock_only" ? false : u.can_sell,
        can_restock: u.can_restock,
        is_default: index === 0,
        active: u.active ?? true,
        sale_type: saleType,
        unit_measure_id: u.unit_measure_id || null,
        unit_size_id: u.unit_size_id || null,
        barcode: u.barcode?.trim() || null,
        sort_order: u.sort_order ?? index,
      };
    });

  if (cleaned.length === 0) {
    throw new Error("Add at least one product unit.");
  }

  cleaned[0].is_default = true;

  const { error: resetErr } = await supabase
    .from("product_units")
    .update({ is_default: false })
    .eq("org_id", orgId)
    .eq("product_id", productId);

  if (resetErr) throw new Error(resetErr.message);

  const { data, error } = await supabase
    .from("product_units")
    .upsert(cleaned, { onConflict: "id" })
    .select();

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function archiveProductUnit(
  orgId: string,
  productUnitId: string
) {
  const supabase = createClient();

  const { error } = await supabase
    .from("product_units")
    .update({ active: false })
    .eq("org_id", orgId)
    .eq("id", productUnitId);

  if (error) throw new Error(error.message);
}
