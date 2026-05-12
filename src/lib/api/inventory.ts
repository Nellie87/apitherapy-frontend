import { createClient } from "@/lib/supabase/client";

export type QuantityUnit = "g" | "kg" | "ml" | "L" | "pc";

export type InventoryProduct = {
  id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  category?: string | null;
  unit_price?: number | null;
  cost_price?: number | null;
  quantity_value?: number | null;
  quantity_unit?: QuantityUnit | null;
};

export type InventoryRow = {
  product_id: string;
  org_id: string;
  qty_on_hand: number;
  reorder_level: number;
  updated_at?: string | null;
  products?: InventoryProduct | null;
};

export type InventoryMovementRow = {
  id: string;
  org_id: string;
  product_id: string;
  ref_sale_id?: string | null;
  type: "add" | "remove" | "set" | "restock" | "sale" | "sale_void";
  qty_delta: number;
  qty_before: number;
  qty_after: number;
  note?: string | null;
  created_at: string;
  products?: {
    id: string;
    name: string;
    sku?: string | null;
    quantity_value?: number | null;
    quantity_unit?: QuantityUnit | null;
  } | null;
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
      products:products (
        id,
        name,
        sku,
        barcode,
        cost_price,
        unit_price,
        quantity_value,
        quantity_unit,
        category:categories ( name )
      )
    `)
    .eq("org_id", orgId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row: any) => {
    const rawProduct = Array.isArray(row.products) ? row.products[0] : row.products;
    const rawCategory = Array.isArray(rawProduct?.category)
      ? rawProduct.category[0]
      : rawProduct?.category;

    return {
      product_id: row.product_id,
      org_id: row.org_id,
      qty_on_hand: Number(row.qty_on_hand ?? 0),
      reorder_level: Number(row.reorder_level ?? 0),
      updated_at: row.updated_at ?? null,
      products: rawProduct
        ? {
            id: rawProduct.id,
            name: rawProduct.name,
            sku: rawProduct.sku ?? null,
            barcode: rawProduct.barcode ?? null,
            cost_price:
              rawProduct.cost_price !== null && rawProduct.cost_price !== undefined
                ? Number(rawProduct.cost_price)
                : null,
            unit_price:
              rawProduct.unit_price !== null && rawProduct.unit_price !== undefined
                ? Number(rawProduct.unit_price)
                : null,
            quantity_value:
              rawProduct.quantity_value !== null &&
              rawProduct.quantity_value !== undefined
                ? Number(rawProduct.quantity_value)
                : null,
            quantity_unit: rawProduct.quantity_unit ?? null,
            category: rawCategory?.name ?? null,
          }
        : null,
    };
  });
}

export async function createInventoryRow(
  orgId: string,
  payload: {
    product_id: string;
    qty_on_hand: number;
    reorder_level: number;
  }
) {
  const supabase = createClient();

  const { error } = await supabase.from("inventory").insert([
    {
      org_id: orgId,
      product_id: payload.product_id,
      qty_on_hand: payload.qty_on_hand,
      reorder_level: payload.reorder_level,
    },
  ]);

  if (error) throw new Error(error.message);
}

/** Atomic qty change + movement row (see supabase/migrations). Preferred over updateInventory + manual log. */
export async function adjustInventoryDelta(
  orgId: string,
  productId: string,
  args: {
    mode: "add" | "remove" | "set";
    amount: number;
    reorder_level?: number | null;
    note?: string | null;
    /** Log movement as `restock` while applying an `add` (quick restock). */
    recordAs?: "restock" | null;
  }
) {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("adjust_inventory_delta", {
    p_org_id: orgId,
    p_product_id: productId,
    p_mode: args.mode,
    p_amount: args.amount,
    p_reorder_level: args.reorder_level ?? null,
    p_note: args.note ?? null,
    p_record_as: args.recordAs ?? null,
  });

  if (error) throw new Error(error.message);

  const r = data as {
    qty_before?: unknown;
    qty_after?: unknown;
    qty_delta?: unknown;
  };

  return {
    qty_before: Number(r?.qty_before ?? 0),
    qty_after: Number(r?.qty_after ?? 0),
    qty_delta: Number(r?.qty_delta ?? 0),
  };
}

/** Insert first inventory row + initial movement in one transaction (see supabase/migrations). */
export async function createInventoryInitial(
  orgId: string,
  payload: {
    product_id: string;
    qty_on_hand: number;
    reorder_level: number;
    note?: string | null;
  }
) {
  const supabase = createClient();

  const { error } = await supabase.rpc("create_inventory_initial", {
    p_org_id: orgId,
    p_product_id: payload.product_id,
    p_qty_on_hand: payload.qty_on_hand,
    p_reorder_level: payload.reorder_level,
    p_note: payload.note ?? null,
  });

  if (error) throw new Error(error.message);
}

export async function updateInventory(
  orgId: string,
  productId: string,
  payload: {
    qty_on_hand: number;
    reorder_level: number;
  }
) {
  const supabase = createClient();

  const { error } = await supabase
    .from("inventory")
    .update({
      qty_on_hand: payload.qty_on_hand,
      reorder_level: payload.reorder_level,
      updated_at: new Date().toISOString(),
    })
    .eq("org_id", orgId)
    .eq("product_id", productId);

  if (error) throw new Error(error.message);
}

export async function listInventoryMovements(
  orgId: string,
  productId?: string
): Promise<InventoryMovementRow[]> {
  const supabase = createClient();

  let query = supabase
    .from("inventory_movements")
    .select(`
      id,
      org_id,
      product_id,
      ref_sale_id,
      type,
      qty_delta,
      qty_before,
      qty_after,
      note,
      created_at,
      products:products (
        id,
        name,
        sku,
        quantity_value,
        quantity_unit
      )
    `)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (productId) {
    query = query.eq("product_id", productId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row: any) => {
    const p = Array.isArray(row.products) ? row.products[0] : row.products;

    return {
      id: row.id,
      org_id: row.org_id,
      product_id: row.product_id,
      ref_sale_id: row.ref_sale_id ?? null,
      type: row.type,
      qty_delta: Number(row.qty_delta ?? 0),
      qty_before: Number(row.qty_before ?? 0),
      qty_after: Number(row.qty_after ?? 0),
      note: row.note ?? null,
      created_at: row.created_at,
      products: p
        ? {
            id: p.id,
            name: p.name,
            sku: p.sku ?? null,
            quantity_value:
              p.quantity_value !== null && p.quantity_value !== undefined
                ? Number(p.quantity_value)
                : null,
            quantity_unit: p.quantity_unit ?? null,
          }
        : null,
    };
  });
}