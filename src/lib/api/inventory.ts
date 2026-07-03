import { createClient } from "@/lib/supabase/client";

export type QuantityUnit = "g" | "kg" | "ml" | "L" | "pc";
export type ProductUnitSaleType = "retail" | "wholesale" | "stock_only";

export type InventoryProductUnit = {
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
  barcode?: string | null;
  sort_order?: number | null;
  unit_measure_id?: string | null;
  unit_size_id?: string | null;
};

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
  product_units?: InventoryProductUnit[];
};

export type InventoryRow = {
  product_id: string;
  org_id: string;
  qty_on_hand: number;
  reorder_level: number;
  updated_at?: string | null;
  products?: InventoryProduct | null;
};

export type InventoryMovementType =
  | "add"
  | "remove"
  | "set"
  | "restock"
  | "sale"
  | "sale_void";

export type InventoryMovementRow = {
  id: string;
  org_id: string;
  product_id: string;
  ref_sale_id?: string | null;
  product_unit_id?: string | null;
  unit_label?: string | null;
  unit_base_quantity: number;
  base_qty?: number | null;
  type: InventoryMovementType;
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

export type InventoryAdjustmentResult = {
  qty_before: number;
  qty_after: number;
  qty_delta: number;
};

export type RestockProductUnitArgs = {
  product_unit_id: string;
  unit_label: string;
  unit_base_quantity: number;
  quantity: number;
  reorder_level?: number | null;
  note?: string | null;
};

function normalizeSingle<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function normalizeSaleType(value: unknown): ProductUnitSaleType {
  if (value === "retail" || value === "wholesale" || value === "stock_only") {
    return value;
  }
  return "retail";
}

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
        category:categories ( name ),
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
          barcode,
          sort_order,
          unit_measure_id,
          unit_size_id
        )
      )
    `)
    .eq("org_id", orgId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row: any): InventoryRow => {
    const rawProduct = normalizeSingle(row.products);
    const rawCategory = normalizeSingle(rawProduct?.category);

    const productUnits: InventoryProductUnit[] = (rawProduct?.product_units ?? [])
      .filter((unit: any) => unit.active !== false)
      .map(
        (unit: any): InventoryProductUnit => ({
          id: String(unit.id),
          label: String(unit.label ?? "Unit"),
          base_quantity: Number(unit.base_quantity ?? 1),
          cost_price: Number(unit.cost_price ?? 0),
          selling_price: Number(unit.selling_price ?? 0),
          can_sell: unit.can_sell !== false,
          can_restock: unit.can_restock !== false,
          is_default: Boolean(unit.is_default),
          active: unit.active !== false,
          sale_type: normalizeSaleType(unit.sale_type),
          barcode: unit.barcode ?? null,
          sort_order:
            unit.sort_order === null || unit.sort_order === undefined
              ? null
              : Number(unit.sort_order),
          unit_measure_id: unit.unit_measure_id ?? null,
          unit_size_id: unit.unit_size_id ?? null,
        }),
      )
      .sort((a: InventoryProductUnit, b: InventoryProductUnit) => {
        if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
        const sortA = a.sort_order ?? Number.MAX_SAFE_INTEGER;
        const sortB = b.sort_order ?? Number.MAX_SAFE_INTEGER;
        if (sortA !== sortB) return sortA - sortB;
        return a.base_quantity - b.base_quantity;
      });

    return {
      product_id: String(row.product_id),
      org_id: String(row.org_id),
      qty_on_hand: Number(row.qty_on_hand ?? 0),
      reorder_level: Number(row.reorder_level ?? 0),
      updated_at: row.updated_at ?? null,
      products: rawProduct
        ? {
            id: String(rawProduct.id),
            name: String(rawProduct.name ?? "Unnamed product"),
            sku: rawProduct.sku ?? null,
            barcode: rawProduct.barcode ?? null,
            cost_price: toNumberOrNull(rawProduct.cost_price),
            unit_price: toNumberOrNull(rawProduct.unit_price),
            quantity_value: toNumberOrNull(rawProduct.quantity_value),
            quantity_unit: rawProduct.quantity_unit ?? null,
            category: rawCategory?.name ?? null,
            product_units: productUnits,
          }
        : null,
    };
  });
}

export async function createInventoryRow(
  orgId: string,
  payload: { product_id: string; qty_on_hand: number; reorder_level: number },
) {
  const supabase = createClient();
  const qtyOnHand = Number(payload.qty_on_hand);
  const reorderLevel = Number(payload.reorder_level);

  if (!Number.isFinite(qtyOnHand) || qtyOnHand < 0) {
    throw new Error("Opening stock cannot be below zero.");
  }
  if (!Number.isFinite(reorderLevel) || reorderLevel < 0) {
    throw new Error("Reorder level cannot be below zero.");
  }

  const { error } = await supabase.from("inventory").insert([
    {
      org_id: orgId,
      product_id: payload.product_id,
      qty_on_hand: qtyOnHand,
      reorder_level: reorderLevel,
    },
  ]);

  if (error) throw new Error(error.message);
}

export async function adjustInventoryDelta(
  orgId: string,
  productId: string,
  args: {
    mode: "add" | "remove" | "set";
    amount: number;
    reorder_level?: number | null;
    note?: string | null;
    recordAs?: "restock" | null;
  },
): Promise<InventoryAdjustmentResult> {
  const supabase = createClient();
  const amount = Number(args.amount);

  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Inventory quantity must be a valid number that is not below zero.");
  }
  if (args.mode !== "set" && amount <= 0) {
    throw new Error("Inventory quantity must be greater than zero.");
  }

  const { data, error } = await supabase.rpc("adjust_inventory_delta", {
    p_org_id: orgId,
    p_product_id: productId,
    p_mode: args.mode,
    p_amount: amount,
    p_reorder_level: args.reorder_level ?? null,
    p_note: args.note?.trim() || null,
    p_record_as: args.recordAs ?? null,
  });

  if (error) throw new Error(error.message);

  const result = data as {
    qty_before?: unknown;
    qty_after?: unknown;
    qty_delta?: unknown;
  };

  return {
    qty_before: Number(result?.qty_before ?? 0),
    qty_after: Number(result?.qty_after ?? 0),
    qty_delta: Number(result?.qty_delta ?? 0),
  };
}

export async function restockProductUnit(
  orgId: string,
  productId: string,
  args: RestockProductUnitArgs,
): Promise<InventoryAdjustmentResult> {
  const enteredQuantity = Number(args.quantity);
  const conversion = Number(args.unit_base_quantity);

  if (!Number.isFinite(enteredQuantity) || enteredQuantity <= 0) {
    throw new Error("Restock quantity must be greater than zero.");
  }
  if (!Number.isFinite(conversion) || conversion <= 0) {
    throw new Error("The selected stock unit has an invalid conversion quantity.");
  }

  const baseQty = enteredQuantity * conversion;
  const formattedEnteredQty = enteredQuantity.toLocaleString("en-KE", {
    maximumFractionDigits: 3,
  });
  const formattedBaseQty = baseQty.toLocaleString("en-KE", {
    maximumFractionDigits: 3,
  });

  const generatedNote = [
    `Restocked ${formattedEnteredQty} ${args.unit_label}`,
    `${formattedBaseQty} base units added`,
    args.note?.trim() || null,
  ]
    .filter(Boolean)
    .join(" — ");

  return adjustInventoryDelta(orgId, productId, {
    mode: "add",
    amount: baseQty,
    reorder_level: args.reorder_level ?? null,
    recordAs: "restock",
    note: generatedNote,
  });
}

export async function createInventoryInitial(
  orgId: string,
  payload: {
    product_id: string;
    qty_on_hand: number;
    reorder_level: number;
    note?: string | null;
  },
) {
  const supabase = createClient();
  const qtyOnHand = Number(payload.qty_on_hand);
  const reorderLevel = Number(payload.reorder_level);

  if (!Number.isFinite(qtyOnHand) || qtyOnHand < 0) {
    throw new Error("Opening stock cannot be below zero.");
  }
  if (!Number.isFinite(reorderLevel) || reorderLevel < 0) {
    throw new Error("Reorder level cannot be below zero.");
  }

  const { error } = await supabase.rpc("create_inventory_initial", {
    p_org_id: orgId,
    p_product_id: payload.product_id,
    p_qty_on_hand: qtyOnHand,
    p_reorder_level: reorderLevel,
    p_note: payload.note?.trim() || null,
  });

  if (error) throw new Error(error.message);
}

export async function updateInventory(
  orgId: string,
  productId: string,
  payload: { qty_on_hand: number; reorder_level: number },
) {
  const supabase = createClient();
  const qtyOnHand = Number(payload.qty_on_hand);
  const reorderLevel = Number(payload.reorder_level);

  if (!Number.isFinite(qtyOnHand) || qtyOnHand < 0) {
    throw new Error("Stock quantity cannot be below zero.");
  }
  if (!Number.isFinite(reorderLevel) || reorderLevel < 0) {
    throw new Error("Reorder level cannot be below zero.");
  }

  const { error } = await supabase
    .from("inventory")
    .update({
      qty_on_hand: qtyOnHand,
      reorder_level: reorderLevel,
      updated_at: new Date().toISOString(),
    })
    .eq("org_id", orgId)
    .eq("product_id", productId);

  if (error) throw new Error(error.message);
}

export async function listInventoryMovements(
  orgId: string,
  productId?: string,
): Promise<InventoryMovementRow[]> {
  const supabase = createClient();

  let query = supabase
    .from("inventory_movements")
    .select(`
      id,
      org_id,
      product_id,
      ref_sale_id,
      product_unit_id,
      unit_label,
      unit_base_quantity,
      base_qty,
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

  if (productId) query = query.eq("product_id", productId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row: any): InventoryMovementRow => {
    const product = normalizeSingle(row.products);

    return {
      id: String(row.id),
      org_id: String(row.org_id),
      product_id: String(row.product_id),
      ref_sale_id: row.ref_sale_id ?? null,
      product_unit_id: row.product_unit_id ?? null,
      unit_label: row.unit_label ?? null,
      unit_base_quantity: Number(row.unit_base_quantity ?? 1),
      base_qty: toNumberOrNull(row.base_qty),
      type: row.type as InventoryMovementType,
      qty_delta: Number(row.qty_delta ?? 0),
      qty_before: Number(row.qty_before ?? 0),
      qty_after: Number(row.qty_after ?? 0),
      note: row.note ?? null,
      created_at: String(row.created_at),
      products: product
        ? {
            id: String(product.id),
            name: String(product.name ?? "Unnamed product"),
            sku: product.sku ?? null,
            quantity_value: toNumberOrNull(product.quantity_value),
            quantity_unit: product.quantity_unit ?? null,
          }
        : null,
    };
  });
}
