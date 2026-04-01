import { createClient } from "@/lib/supabase/client";

export type ExpenseRow = {
  id: string;
  org_id: string;
  expense_date: string; // YYYY-MM-DD
  category: string;
  amount: number;
  note: string | null;
  created_at: string;
};

export async function listExpenses(
  orgId: string,
  args?: { from?: string; to?: string; q?: string }
) {
  const supabase = createClient();
  let query = supabase
    .from("expenses")
    .select("id,org_id,expense_date,category,amount,note,created_at")
    .eq("org_id", orgId)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (args?.from) query = query.gte("expense_date", args.from);
  if (args?.to) query = query.lte("expense_date", args.to);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const q = (args?.q ?? "").trim().toLowerCase();
  if (!q) return (data ?? []) as ExpenseRow[];

  // client-side text filter (safe + simple)
  return (data ?? []).filter((r: any) => {
    const cat = String(r.category ?? "").toLowerCase();
    const note = String(r.note ?? "").toLowerCase();
    return cat.includes(q) || note.includes(q);
  }) as ExpenseRow[];
}

export async function createExpense(
  orgId: string,
  payload: {
    expense_date: string; // YYYY-MM-DD
    category: string;
    amount: number;
    note?: string | null;
  }
) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("expenses")
    .insert([
      {
        org_id: orgId,
        expense_date: payload.expense_date,
        category: payload.category,
        amount: payload.amount,
        note: payload.note ?? null,
      },
    ])
    .select("id,org_id,expense_date,category,amount,note,created_at")
    .single();

  if (error) throw new Error(error.message);
  return data as ExpenseRow;
}

export async function updateExpense(
  orgId: string,
  id: string,
  patch: Partial<Pick<ExpenseRow, "expense_date" | "category" | "amount" | "note">>
) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("expenses")
    .update(patch)
    .eq("org_id", orgId)
    .eq("id", id)
    .select("id,org_id,expense_date,category,amount,note,created_at")
    .single();

  if (error) throw new Error(error.message);
  return data as ExpenseRow;
}

export async function deleteExpense(orgId: string, id: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("org_id", orgId)
    .eq("id", id);

  if (error) throw new Error(error.message);
}