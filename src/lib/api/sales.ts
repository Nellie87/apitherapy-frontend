import { createClient } from "@/lib/supabase/client";

export type SaleRow = {
  id: string;
  org_id: string;
  sale_no: string;
  customer_name: string | null;
  status: string;
  subtotal: number;
  discount_total: number;
  total: number;
  created_at: string;
};

export type SaleItemProduct = {
  id: string;
  name: string;
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
  line_total: number;
  created_at: string;

  products?: { id: string; name: string } | null;
};

export type CreateSaleItemInput = {
  product_id: string;
  qty: number;
  unit_price_override?: number | null; // optional (discount)
};
export type SaleItemLite = {
  id: string;
  qty: number;
  product_id: string;
  products?: { id: string; name: string } | null;
};

export type SaleRowWithItems = SaleRow & {
  sale_items?: SaleItemLite[];
};

export async function listSales(orgId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("sales")
    .select(`
      id,
      org_id,
      sale_no,
      customer_name,
      status,
      subtotal,
      discount_total,
      total,
      created_at,
      sale_items:sale_items (
        id,
        qty,
        product_id,
        products:products ( id, name )
      )
    `)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((r: any) => ({
    ...r,
    subtotal: Number(r.subtotal ?? 0),
    discount_total: Number(r.discount_total ?? 0),
    total: Number(r.total ?? 0),
    sale_items: (r.sale_items ?? []).map((it: any) => {
      const p = Array.isArray(it.products) ? it.products[0] ?? null : it.products ?? null;
      return {
        id: String(it.id),
        qty: Number(it.qty ?? 0),
        product_id: String(it.product_id),
        products: p ? { id: String(p.id), name: String(p.name) } : null,
      };
    }),
  })) as SaleRowWithItems[];
}

export async function getSale(orgId: string, saleId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("sales")
    .select("id,org_id,sale_no,customer_name,status,subtotal,discount_total,total,created_at")
    .eq("org_id", orgId)
    .eq("id", saleId)
    .single();

  if (error) throw new Error(error.message);

  const r: any = data;
  return {
    ...r,
    subtotal: Number(r.subtotal ?? 0),
    discount_total: Number(r.discount_total ?? 0),
    total: Number(r.total ?? 0),
  } as SaleRow;
}

export async function listSaleItems(orgId: string, saleId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("sale_items")
    .select(
      `
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
      products:products ( id, name )
    `
    )
    .eq("org_id", orgId)
    .eq("sale_id", saleId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  // Normalize + coerce numerics
  return (data ?? []).map((r: any) => {
    const p = Array.isArray(r.products) ? r.products[0] ?? null : r.products ?? null;

    return {
      ...r,
      qty: Number(r.qty ?? 0),
      unit_price: Number(r.unit_price ?? 0),
      unit_price_base: Number(r.unit_price_base ?? 0),
      discount_per_unit: Number(r.discount_per_unit ?? 0),
      line_total: Number(r.line_total ?? 0),
      products: p ? { id: String(p.id), name: String(p.name) } : null,
    };
  }) as SaleItemRow[];
}

export async function createSaleStrict(
  orgId: string,
  args: { customer_name?: string; items: CreateSaleItemInput[] }
) {
  const supabase = createClient();
  const payload = {
    p_org_id: orgId,
    p_customer_name: args.customer_name ?? null,
    p_items: args.items,
  };

  const { data, error } = await supabase.rpc("create_sale_strict", payload);

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