import { createClient } from "@/lib/supabase/client";

export type PaymentMethod = "cash" | "mpesa" | "card" | "credit";
export type SalePaymentMethod = PaymentMethod | "cash+mpesa";
export type SaleStatus = "completed" | "voided" | "cancelled" | string;

export type SalePaymentInput = {
  payment_method: PaymentMethod;
  amount: number;
  note?: string | null;
};

export type SalePaymentRow = {
  id: string;
  org_id: string;
  sale_id: string;
  payment_date: string;
  amount: number;
  payment_method: PaymentMethod | string;
  note: string | null;
  created_at: string;
};

export type SaleRow = {
  id: string;
  org_id: string;
  sale_no: string;
  customer_name: string | null;
  payment_method: SalePaymentMethod | string | null;
  status: SaleStatus;
  subtotal: number;
  discount_total: number;
  total: number;
  created_at: string;
  sold_by_user_id?: string | null;
  sold_at: string;
  created_by?: string | null;
  recorded_by_name?: string | null;
  edit_count?: number;
  edited_at?: string | null;
  edited_by?: string | null;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  cancel_note?: string | null;
  sale_payments?: SalePaymentRow[];
};

export function formatPaymentMethodLabel(
  method?: string | null,
  payments?: SalePaymentRow[] | null,
  opts?: { detailed?: boolean }
) {
  if (payments && payments.length > 1) {
    if (opts?.detailed) {
      return payments
        .map((p) => {
          const label =
            String(p.payment_method).toLowerCase() === "mpesa"
              ? "M-Pesa"
              : String(p.payment_method).charAt(0).toUpperCase() +
                String(p.payment_method).slice(1);
          return `${label} ${Number(p.amount || 0).toLocaleString("en-KE")}`;
        })
        .join(" + ");
    }

    const methods = new Set(
      payments.map((p) => String(p.payment_method).toLowerCase())
    );
    if (methods.has("cash") && methods.has("mpesa") && methods.size === 2) {
      return "Cash + M-Pesa";
    }

    return Array.from(methods)
      .map((m) => (m === "mpesa" ? "M-Pesa" : m.charAt(0).toUpperCase() + m.slice(1)))
      .join(" + ");
  }

  const key = String(method ?? "").toLowerCase();
  if (key === "cash+mpesa" || key === "split") return "Cash + M-Pesa";
  if (key === "mpesa") return "M-Pesa";
  if (key === "cash") return "Cash";
  if (key === "card") return "Card";
  if (key === "credit") return "Credit";
  return method || "—";
}

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
  unit_price: number;
  line_total: number;
  products?: SaleItemProduct | null;
};

export type SaleRowWithItems = SaleRow & {
  sale_items?: SaleItemLite[];
};

export type EditSaleItemInput = {
  sale_item_id: string;
  product_id: string;
  qty: number;
};

export type SaleActivityLog = {
  id: string;
  org_id: string;
  sale_id: string;
  action: "edit" | "cancel" | "void" | string;
  note: string | null;
  before_json: Record<string, unknown> | null;
  after_json: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
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

export function isCancelledSale(status?: string | null) {
  return ["cancelled", "voided", "void", "refunded"].includes(
    String(status ?? "").trim().toLowerCase()
  );
}

function mapSaleRow(r: any, opts?: { ownOnly?: boolean }): SaleRowWithItems {
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
    sold_at: r.sold_at ?? null,
    sold_by_user_id: r.sold_by_user_id ?? null,
    created_by: r.created_by ?? null,
    recorded_by_name: opts?.ownOnly
      ? null
      : prof?.full_name
      ? String(prof.full_name)
      : null,
    edit_count: Number(r.edit_count ?? 0),
    edited_at: r.edited_at ?? null,
    edited_by: r.edited_by ?? null,
    cancelled_at: r.cancelled_at ?? null,
    cancelled_by: r.cancelled_by ?? null,
    cancel_note: r.cancel_note ?? null,
    sale_payments: (r.sale_payments ?? []).map((p: any) => ({
      id: String(p.id),
      org_id: String(p.org_id),
      sale_id: String(p.sale_id),
      payment_date: String(p.payment_date ?? ""),
      amount: Number(p.amount ?? 0),
      payment_method: String(p.payment_method ?? "cash"),
      note: p.note ?? null,
      created_at: p.created_at,
    })),
    sale_items: (r.sale_items ?? []).map((it: any) => {
      const p = Array.isArray(it.products)
        ? it.products[0] ?? null
        : it.products ?? null;

      return {
        id: String(it.id),
        qty: Number(it.qty ?? 0),
        product_id: String(it.product_id),
        unit_price: Number(it.unit_price ?? 0),
        line_total: Number(it.line_total ?? 0),
        products: normalizeProduct(p),
      };
    }),
  };
}

const SALE_PAYMENTS_SELECT = `
  sale_payments:sale_payments (
    id,
    org_id,
    sale_id,
    payment_date,
    amount,
    payment_method,
    note,
    created_at
  )
`;

const SALE_SELECT_WITH_ITEMS = `
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
  edit_count,
  sold_at,
  edited_at,
  edited_by,
  cancelled_at,
  cancelled_by,
  cancel_note,
  recorded_by_profile:profiles!sales_created_by_fkey (
    full_name
  ),
  ${SALE_PAYMENTS_SELECT},
  sale_items:sale_items (
    id,
    qty,
    product_id,
    unit_price,
    line_total,
    products:products (
      id,
      name,
      quantity_value,
      quantity_unit
    )
  )
`;

const SALE_SELECT = `
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
  sold_at,
  sold_by_user_id,
  created_by,
  edit_count,
  edited_at,
  edited_by,
  cancelled_at,
  cancelled_by,
  cancel_note,
  recorded_by_profile:profiles!sales_created_by_fkey (
    full_name
  ),
  ${SALE_PAYMENTS_SELECT}
`;


export async function listSales(
  orgId: string,
  opts?: {
    ownOnly?: boolean;
    limit?: number;
  }
) {
  const supabase = createClient();

  let query = supabase
    .from("sales")
    .select(SALE_SELECT_WITH_ITEMS)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (opts?.ownOnly) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return [];

    query = query.eq("sold_by_user_id", user.id);
  }

  if (opts?.limit) query = query.limit(opts.limit);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((r: any) => mapSaleRow(r, opts)) as SaleRowWithItems[];
}

export async function getSale(orgId: string, saleId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("sales")
    .select(SALE_SELECT)
    .eq("org_id", orgId)
    .eq("id", saleId)
    .single();

  if (error) throw new Error(error.message);
  return mapSaleRow(data) as SaleRow;
}
export async function updateSaleDateStrict(
  orgId: string,
  saleId: string,
  saleDate: string,
  note?: string | null
) {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("update_sale_date_strict", {
    p_org_id: orgId,
    p_sale_id: saleId,
    p_sale_date: saleDate,
    p_note: note ?? null,
  });

  if (error) throw new Error(error.message);

  return data;
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
    : `${baseFields}, cost_price_at_sale`;

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

export async function listSaleActivityLogs(orgId: string, saleId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("sale_activity_logs")
    .select("*")
    .eq("org_id", orgId)
    .eq("sale_id", saleId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((r: any) => ({
    id: String(r.id),
    org_id: String(r.org_id),
    sale_id: String(r.sale_id),
    action: String(r.action ?? ""),
    note: r.note ?? null,
    before_json: r.before_json ?? null,
    after_json: r.after_json ?? null,
    created_by: r.created_by ?? null,
    created_at: r.created_at,
  })) as SaleActivityLog[];
}

export async function createSalePayments(
  orgId: string,
  saleId: string,
  payments: SalePaymentInput[],
  paymentDate?: string | null
) {
  const supabase = createClient();
  const date =
    paymentDate && /^\d{4}-\d{2}-\d{2}$/.test(paymentDate)
      ? paymentDate
      : new Date().toISOString().slice(0, 10);

  const rows = payments
    .map((p) => ({
      org_id: orgId,
      sale_id: saleId,
      payment_date: date,
      amount: Number(p.amount),
      payment_method: p.payment_method,
      note: p.note ?? null,
    }))
    .filter((p) => Number.isFinite(p.amount) && p.amount > 0);

  if (rows.length === 0) return [];

  const { data, error } = await supabase
    .from("sale_payments")
    .insert(rows)
    .select(
      "id,org_id,sale_id,payment_date,amount,payment_method,note,created_at"
    );

  if (error) throw new Error(error.message);
  return (data ?? []) as SalePaymentRow[];
}

async function setSalePaymentMethod(
  orgId: string,
  saleId: string,
  paymentMethod: SalePaymentMethod
) {
  const supabase = createClient();
  const { error } = await supabase
    .from("sales")
    .update({ payment_method: paymentMethod })
    .eq("org_id", orgId)
    .eq("id", saleId);

  if (error) throw new Error(error.message);
}

export async function createSaleStrict(
  orgId: string,
  args: {
    customer_name?: string;
    payment_method: SalePaymentMethod;
    items: CreateSaleItemInput[];
    sale_date?: string | null;
    payments?: SalePaymentInput[];
  }
) {
  const supabase = createClient();

  const payments = (args.payments ?? []).filter(
    (p) => Number.isFinite(p.amount) && p.amount > 0
  );
  const isSplit =
    args.payment_method === "cash+mpesa" || payments.length > 1;

  // create_sale_strict may only accept single tender values; use the larger
  // tender as the RPC value, then stamp the composite label + payment rows.
  const rpcMethod: PaymentMethod = isSplit
    ? (() => {
        const cash = payments.find((p) => p.payment_method === "cash")?.amount ?? 0;
        const mpesa =
          payments.find((p) => p.payment_method === "mpesa")?.amount ?? 0;
        return cash >= mpesa ? "cash" : "mpesa";
      })()
    : (args.payment_method as PaymentMethod);

  const { data, error } = await supabase.rpc("create_sale_strict", {
    p_org_id: orgId,
    p_customer_name: args.customer_name ?? null,
    p_payment_method: rpcMethod,
    p_items: args.items,
    p_sale_date: args.sale_date ?? null,
  });

  if (error) throw new Error(error.message);

  const r: any = data;
  const saleId = String(r.sale_id);

  if (isSplit && payments.length > 0) {
    try {
      await setSalePaymentMethod(orgId, saleId, "cash+mpesa");
      await createSalePayments(orgId, saleId, payments, args.sale_date);
    } catch (e: any) {
      // Sale already committed; surface payment-recording failure clearly.
      throw new Error(
        e?.message
          ? `Sale created, but split payments failed: ${e.message}`
          : "Sale created, but split payments failed to save."
      );
    }
  }

  return {
    sale_id: saleId,
    sale_no: String(r.sale_no),
    subtotal: Number(r.subtotal ?? 0),
    discount_total: Number(r.discount_total ?? 0),
    total: Number(r.total ?? 0),
  };
}

export async function editSaleItemsRestoreInventory(
  orgId: string,
  saleId: string,
  payload: {
    items: EditSaleItemInput[];
    note?: string | null;
  }
) {
  const supabase = createClient();

  const cleanedItems = payload.items
    .map((item) => ({
      sale_item_id: String(item.sale_item_id),
      product_id: String(item.product_id),
      qty: Number(item.qty),
    }))
    .filter(
      (item) =>
        item.sale_item_id &&
        item.product_id &&
        Number.isFinite(item.qty) &&
        item.qty > 0
    );

  if (cleanedItems.length === 0) {
    throw new Error("A sale must have at least one product. Void the sale instead.");
  }

  const { data, error } = await supabase.rpc(
    "edit_sale_items_restore_inventory",
    {
      p_org_id: orgId,
      p_sale_id: saleId,
      p_items: cleanedItems,
      p_note: payload.note ?? null,
    }
  );

  if (error) throw new Error(error.message);
  return data as Record<string, unknown> | null;
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
