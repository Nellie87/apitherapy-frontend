import { supabase } from "@/lib/supabase/client";

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

  // Supabase often returns array here
  products?: { id: string; name: string }[] | null;
};


export type CreateSaleItemInput = {
  product_id: string;
  qty: number;
  unit_price_override?: number | null; // optional (discount)
};

export async function listSales(orgId: string) {
  const { data, error } = await supabase
    .from("sales")
    .select("id,org_id,sale_no,customer_name,status,subtotal,discount_total,total,created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as SaleRow[];
}

export async function getSale(orgId: string, saleId: string) {
  const { data, error } = await supabase
    .from("sales")
    .select("id,org_id,sale_no,customer_name,status,subtotal,discount_total,total,created_at")
    .eq("org_id", orgId)
    .eq("id", saleId)
    .single();

  if (error) throw new Error(error.message);
  return data as SaleRow;
}

export async function listSaleItems(orgId: string, saleId: string) {
  const { data, error } = await supabase
    .from("sale_items")
    .select(`
      id,org_id,sale_id,product_id,qty,unit_price,unit_price_base,discount_per_unit,line_total,created_at,
      products:products ( id, name )
    `)
    .eq("org_id", orgId)
    .eq("sale_id", saleId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as SaleItemRow[];
}

export async function createSaleStrict(orgId: string, args: {
  customer_name?: string;
  items: CreateSaleItemInput[];
}) {
  const payload = {
    p_org_id: orgId,
    p_customer_name: args.customer_name ?? null,
    p_items: args.items,
  };

  const { data, error } = await supabase.rpc("create_sale_strict", payload);

  if (error) throw new Error(error.message);
  return data as {
    sale_id: string;
    sale_no: string;
    subtotal: number;
    discount_total: number;
    total: number;
  };
}
