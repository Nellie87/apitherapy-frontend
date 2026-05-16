import { createClient } from "@/lib/supabase/client";

export type PaymentMethod = "cash" | "mpesa" | "card" | "credit";

export type SaleRow = {
  id: string;
  org_id: string;
  sale_no: string;
  customer_name: string | null;
  payment_method: PaymentMethod | string | null;
  status: string;
  subtotal: number;
  discount_total: number;
  total: number;
  created_at: string;
  sold_by_user_id?: string | null;
  created_by?: string | null;
  recorded_by_name?: string | null;
};

export type SaleItemProduct = {
  id: string;
  name: string;
  quantity_value?: number | null;
  quantity_unit?: string | null;
};

export type SaleItemRow = {
  id: string;
  org_id: string;
  sale_id: string;
  product_id: string;
  qty: number;
  unit_price: number;
  unit_price_base: number;
  discount_per_unit: number;
  cost_price_at_sale: number;
  line_total: number;
  created_at: string;
  products?: SaleItemProduct | null;
};

export type CreateSaleItemInput = {
  product_id: string;
  qty: number;
  unit_price_override?: number | null;
};

export type SaleItemLite = {
  id: string;
  qty: number;
  product_id: string;
  products?: SaleItemProduct | null;
};

export type SaleRowWithItems = SaleRow & {
  sale_items?: SaleItemLite[];
};

function normalizeProduct(p: any): SaleItemProduct | null {
  if (!p) return null;

  return {
    id: String(p.id),
    name: String(p.name ?? ""),
    quantity_value: p.quantity_value == null ? null : Number(p.quantity_value),
    quantity_unit: p.quantity_unit ?? null,
  };
}

export async function listSales(orgId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("sales")
    .select(`
      id,
      org_id,
      sale_no,
      customer_name,
      payment_method,
      status,
      subtotal,
      discount_total,
      total,
      created_at,
      sold_by_user_id,
      created_by,
      recorded_by_profile:profiles!sales_created_by_fkey (
        full_name
      ),
      sale_items:sale_items (
        id,
        qty,
        product_id,
        products:products (
          id,
          name,
          quantity_value,
          quantity_unit
        )
      )
    `)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((r: any) => {
    const prof = Array.isArray(r.recorded_by_profile)
      ? r.recorded_by_profile[0]
      : r.recorded_by_profile;

    return {
      id: String(r.id),
      org_id: String(r.org_id),
      sale_no: String(r.sale_no ?? ""),
      customer_name: r.customer_name ?? null,
      payment_method: r.payment_method ?? null,
      status: String(r.status ?? ""),
      subtotal: Number(r.subtotal ?? 0),
      discount_total: Number(r.discount_total ?? 0),
      total: Number(r.total ?? 0),
      created_at: r.created_at,
      sold_by_user_id: r.sold_by_user_id ?? null,
      created_by: r.created_by ?? null,
      recorded_by_name: prof?.full_name ? String(prof.full_name) : null,
      sale_items: (r.sale_items ?? []).map((it: any) => {
        const p = Array.isArray(it.products)
          ? it.products[0] ?? null
          : it.products ?? null;

        return {
          id: String(it.id),
          qty: Number(it.qty ?? 0),
          product_id: String(it.product_id),
          products: normalizeProduct(p),
        };
      }),
    };
  }) as SaleRowWithItems[];
}

export async function getSale(orgId: string, saleId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("sales")
    .select(`
      id,
      org_id,
      sale_no,
      customer_name,
      payment_method,
      status,
      subtotal,
      discount_total,
      total,
      created_at,
      sold_by_user_id,
      created_by,
      recorded_by_profile:profiles!sales_created_by_fkey (
        full_name
      )
    `)
    .eq("org_id", orgId)
    .eq("id", saleId)
    .single();

  if (error) throw new Error(error.message);

  const r: any = data;
  const prof = Array.isArray(r.recorded_by_profile)
    ? r.recorded_by_profile[0]
    : r.recorded_by_profile;

  return {
    id: String(r.id),
    org_id: String(r.org_id),
    sale_no: String(r.sale_no ?? ""),
    customer_name: r.customer_name ?? null,
    payment_method: r.payment_method ?? null,
    status: String(r.status ?? ""),
    subtotal: Number(r.subtotal ?? 0),
    discount_total: Number(r.discount_total ?? 0),
    total: Number(r.total ?? 0),
    created_at: r.created_at,
    sold_by_user_id: r.sold_by_user_id ?? null,
    created_by: r.created_by ?? null,
    recorded_by_name: prof?.full_name ? String(prof.full_name) : null,
  } as SaleRow;
}

export async function listSaleItems(
  orgId: string,
  saleId: string,
  opts?: { hideCostFields?: boolean }
) {
  const supabase = createClient();

  const baseFields = `
    id,
    org_id,
    sale_id,
    product_id,
    qty,
    unit_price,
    unit_price_base,
    discount_per_unit,
    line_total,
    created_at,
    products:products (
      id,
      name,
      quantity_value,
      quantity_unit
    )
  `;

  const select = opts?.hideCostFields
    ? baseFields
    : `${baseFields.trim()},
      cost_price_at_sale
    `;

  const { data, error } = await supabase
    .from("sale_items")
    .select(select)
    .eq("org_id", orgId)
    .eq("sale_id", saleId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((r: any) => {
    const p = Array.isArray(r.products)
      ? r.products[0] ?? null
      : r.products ?? null;

    return {
      id: String(r.id),
      org_id: String(r.org_id),
      sale_id: String(r.sale_id),
      product_id: String(r.product_id),
      qty: Number(r.qty ?? 0),
      unit_price: Number(r.unit_price ?? 0),
      unit_price_base: Number(r.unit_price_base ?? 0),
      discount_per_unit: Number(r.discount_per_unit ?? 0),
      cost_price_at_sale: opts?.hideCostFields
        ? 0
        : Number(r.cost_price_at_sale ?? 0),
      line_total: Number(r.line_total ?? 0),
      created_at: r.created_at,
      products: normalizeProduct(p),
    };
  }) as SaleItemRow[];
}

export async function createSaleStrict(
  orgId: string,
  args: {
    customer_name?: string;
    payment_method: PaymentMethod;
    items: CreateSaleItemInput[];
  }
) {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("create_sale_strict", {
    p_org_id: orgId,
    p_customer_name: args.customer_name ?? null,
    p_payment_method: args.payment_method,
    p_items: args.items,
  });

  if (error) throw new Error(error.message);

  const r: any = data;
  return {
    sale_id: String(r.sale_id),
    sale_no: String(r.sale_no),
    subtotal: Number(r.subtotal ?? 0),
    discount_total: Number(r.discount_total ?? 0),
    total: Number(r.total ?? 0),
  };
}

export async function voidSaleRestoreInventory(
  orgId: string,
  saleId: string,
  args?: { note?: string | null }
) {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("void_sale_restore_inventory", {
    p_org_id: orgId,
    p_sale_id: saleId,
    p_note: args?.note ?? null,
  });

  if (error) throw new Error(error.message);

  return data as Record<string, unknown>;
}