import { createClient } from "@/lib/supabase/client";

export type PaymentMethod = "cash" | "mpesa" | "card" | "credit";
export type ServiceStatus = "scheduled" | "in_progress" | "completed" | "voided" | "cancelled";
export type PaymentPlan = "full" | "installment" | "periodic";
export type PeriodicInterval = "weekly" | "biweekly" | "monthly" | "quarterly";

export type ServicePaymentRow = {
  id: string;
  org_id: string;
  service_id: string;
  payment_date: string;
  amount: number;
  payment_method: PaymentMethod | string;
  note: string | null;
  created_at: string;
};

export type ServiceRow = {
  id: string;
  org_id: string;
  service_date: string;
  service_type: string;
  customer_name: string | null;
  payment_method: PaymentMethod | string;
  amount: number;
  total_amount: number | null;
  note: string | null;
  status: ServiceStatus | string;
  scheduled_date: string | null;
  reminder_at: string | null;
  reminder_dismissed: boolean;
  payment_plan: PaymentPlan | string;
  periodic_interval: PeriodicInterval | string | null;
  created_at: string;
  service_payments?: ServicePaymentRow[];
};

export const PRESET_SERVICE_TYPES = [
  "Training",
  "Inspection",
  "Tenders",
  "Bee removal / relocation",
  "Honey harvesting",
  "Bee hive installation",
  "Apiary siting",
  "Pollination",
  "Apitourism",
] as const;

const SERVICE_SELECT =
  "id,org_id,service_date,service_type,customer_name,payment_method,amount,total_amount,note,status,scheduled_date,reminder_at,reminder_dismissed,payment_plan,periodic_interval,created_at";

async function syncServiceCollected(orgId: string, serviceId: string) {
  const supabase = createClient();
  const { data: payments, error: payErr } = await supabase
    .from("service_payments")
    .select("amount")
    .eq("org_id", orgId)
    .eq("service_id", serviceId);

  if (payErr) throw new Error(payErr.message);

  const collected = (payments ?? []).reduce((s, p) => s + Number((p as { amount: number }).amount ?? 0), 0);

  const { data: svc, error: svcErr } = await supabase
    .from("services")
    .select("total_amount,status,payment_plan")
    .eq("org_id", orgId)
    .eq("id", serviceId)
    .single();

  if (svcErr) throw new Error(svcErr.message);

  const total = Number((svc as ServiceRow).total_amount ?? 0);
  const plan = String((svc as ServiceRow).payment_plan ?? "full");
  let status = (svc as ServiceRow).status;

  if (plan !== "full" && total > 0 && collected >= total && status !== "cancelled" && status !== "voided") {
    status = "completed";
  } else if (collected > 0 && status === "scheduled") {
    status = "in_progress";
  }

  const { error: updErr } = await supabase
    .from("services")
    .update({ amount: collected, status })
    .eq("org_id", orgId)
    .eq("id", serviceId);

  if (updErr) throw new Error(updErr.message);
  return collected;
}

export async function listServices(
  orgId: string,
  args?: {
    from?: string;
    to?: string;
    q?: string;
    includeVoided?: boolean;
    mode?: "income" | "scheduled" | "all";
  }
) {
  const supabase = createClient();
  const mode = args?.mode ?? "income";

  let query = supabase
    .from("services")
    .select(`${SERVICE_SELECT}, service_payments(id,org_id,service_id,payment_date,amount,payment_method,note,created_at)`)
    .eq("org_id", orgId)
    .order("service_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (mode === "income") {
    query = query.in("status", ["completed", "in_progress"]);
    if (args?.from) query = query.gte("service_date", args.from);
    if (args?.to) query = query.lte("service_date", args.to);
  } else if (mode === "scheduled") {
    query = query.eq("status", "scheduled");
    if (args?.from) query = query.gte("scheduled_date", args.from);
    if (args?.to) query = query.lte("scheduled_date", args.to);
  } else {
    if (!args?.includeVoided) query = query.not("status", "in", "(voided,cancelled)");
    if (args?.from) query = query.gte("service_date", args.from);
    if (args?.to) query = query.lte("service_date", args.to);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const q = (args?.q ?? "").trim().toLowerCase();
  const rows = (data ?? []) as ServiceRow[];
  if (!q) return rows;

  return rows.filter((r) => {
    const type = String(r.service_type ?? "").toLowerCase();
    const customer = String(r.customer_name ?? "").toLowerCase();
    const note = String(r.note ?? "").toLowerCase();
    return type.includes(q) || customer.includes(q) || note.includes(q);
  });
}

export async function listDueReminders(orgId: string) {
  const supabase = createClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("services")
    .select(SERVICE_SELECT)
    .eq("org_id", orgId)
    .eq("reminder_dismissed", false)
    .not("reminder_at", "is", null)
    .lte("reminder_at", now)
    .in("status", ["scheduled", "in_progress"])
    .order("reminder_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as ServiceRow[];
}

export async function listUpcomingScheduled(orgId: string, days = 14) {
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);
  const end = new Date();
  end.setDate(end.getDate() + days);
  const endStr = end.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("services")
    .select(SERVICE_SELECT)
    .eq("org_id", orgId)
    .in("status", ["scheduled", "in_progress"])
    .not("scheduled_date", "is", null)
    .gte("scheduled_date", today)
    .lte("scheduled_date", endStr)
    .order("scheduled_date", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as ServiceRow[];
}

export async function createService(
  orgId: string,
  payload: {
    service_date: string;
    service_type: string;
    amount: number;
    total_amount?: number;
    customer_name?: string | null;
    payment_method?: PaymentMethod;
    note?: string | null;
    status?: ServiceStatus;
    scheduled_date?: string | null;
    reminder_at?: string | null;
    payment_plan?: PaymentPlan;
    periodic_interval?: PeriodicInterval | null;
    recordPayment?: boolean;
  }
) {
  const supabase = createClient();
  const plan = payload.payment_plan ?? "full";
  const status = payload.status ?? (plan === "full" && !payload.scheduled_date ? "completed" : "scheduled");
  const total = payload.total_amount ?? payload.amount;
  const collected = status === "completed" && plan === "full" ? payload.amount : 0;

  const { data, error } = await supabase
    .from("services")
    .insert([
      {
        org_id: orgId,
        service_date: payload.service_date,
        service_type: payload.service_type,
        customer_name: payload.customer_name?.trim() || null,
        payment_method: payload.payment_method ?? "cash",
        amount: collected,
        total_amount: total,
        note: payload.note ?? null,
        status,
        scheduled_date: payload.scheduled_date ?? null,
        reminder_at: payload.reminder_at ?? null,
        payment_plan: plan,
        periodic_interval: payload.periodic_interval ?? null,
      },
    ])
    .select(SERVICE_SELECT)
    .single();

  if (error) throw new Error(error.message);

  const row = data as ServiceRow;
  // Explicit recordPayment:true always wins (e.g. deposit on a scheduled job).
  // Otherwise keep the previous heuristics for completed / non-full plans.
  const shouldPay =
    payload.amount > 0 &&
    (payload.recordPayment === true ||
      (payload.recordPayment !== false &&
        ((plan === "full" && status === "completed") || plan !== "full")));

  if (shouldPay) {
    await createServicePayment(orgId, row.id, {
      payment_date: payload.service_date,
      amount: payload.amount,
      payment_method: payload.payment_method ?? "cash",
      note: payload.note ?? null,
    });
    const refreshed = await getService(orgId, row.id);
    return refreshed ?? row;
  }

  return row;
}

export async function getService(orgId: string, id: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("services")
    .select(`${SERVICE_SELECT}, service_payments(id,org_id,service_id,payment_date,amount,payment_method,note,created_at)`)
    .eq("org_id", orgId)
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return data as ServiceRow;
}

export async function updateService(
  orgId: string,
  id: string,
  patch: Partial<
    Pick<
      ServiceRow,
      | "service_date"
      | "service_type"
      | "customer_name"
      | "payment_method"
      | "amount"
      | "total_amount"
      | "note"
      | "status"
      | "scheduled_date"
      | "reminder_at"
      | "reminder_dismissed"
      | "payment_plan"
      | "periodic_interval"
    >
  >
) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("services")
    .update(patch)
    .eq("org_id", orgId)
    .eq("id", id)
    .select(SERVICE_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return data as ServiceRow;
}

export async function dismissReminder(orgId: string, id: string) {
  return updateService(orgId, id, { reminder_dismissed: true });
}

export async function markServiceCompleted(orgId: string, id: string, serviceDate?: string) {
  const svc = await getService(orgId, id);
  const patch: Partial<ServiceRow> = { status: "completed" };
  if (serviceDate) patch.service_date = serviceDate;
  else if (svc.scheduled_date) patch.service_date = svc.scheduled_date;
  return updateService(orgId, id, patch);
}

export async function createServicePayment(
  orgId: string,
  serviceId: string,
  payload: {
    payment_date: string;
    amount: number;
    payment_method?: PaymentMethod;
    note?: string | null;
  }
) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("service_payments")
    .insert([
      {
        org_id: orgId,
        service_id: serviceId,
        payment_date: payload.payment_date,
        amount: payload.amount,
        payment_method: payload.payment_method ?? "cash",
        note: payload.note ?? null,
      },
    ])
    .select("id,org_id,service_id,payment_date,amount,payment_method,note,created_at")
    .single();

  if (error) throw new Error(error.message);
  await syncServiceCollected(orgId, serviceId);
  return data as ServicePaymentRow;
}

export async function deleteServicePayment(orgId: string, paymentId: string, serviceId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("service_payments")
    .delete()
    .eq("org_id", orgId)
    .eq("id", paymentId);

  if (error) throw new Error(error.message);
  await syncServiceCollected(orgId, serviceId);
}

export async function deleteService(orgId: string, id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("services").delete().eq("org_id", orgId).eq("id", id);
  if (error) throw new Error(error.message);
}

export function paymentProgress(svc: ServiceRow) {
  const total = Number(svc.total_amount ?? svc.amount ?? 0);
  const collected = Number(svc.amount ?? 0);
  const pct = total > 0 ? Math.min(100, (collected / total) * 100) : collected > 0 ? 100 : 0;
  return { total, collected, remaining: Math.max(0, total - collected), pct };
}

/** Upcoming / booked work — includes deposits that flipped status to in_progress. */
export function isScheduledJob(svc: ServiceRow) {
  const status = String(svc.status);
  if (status === "scheduled") return true;
  if (status === "in_progress" && svc.scheduled_date) return true;
  return false;
}

export function planLabel(plan: string) {
  if (plan === "installment") return "Installments";
  if (plan === "periodic") return "Periodic";
  return "Full payment";
}
