import { createClient } from "@/lib/supabase/client";

export type OrgRole = "admin" | "sales_clerk" | "none";

const ADMIN_ROLES = new Set(["owner", "admin", "manager"]);
const CLERK_ROLES = new Set(["sales_clerk", "cashier", "pos"]);

export async function fetchMyOrgRole(
  orgId: string | null | undefined
): Promise<OrgRole> {
  if (!orgId) return "none";

  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return "none";

  const { data, error } = await supabase
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const raw = String(data?.role ?? "").trim().toLowerCase();

  if (CLERK_ROLES.has(raw)) return "sales_clerk";
  if (ADMIN_ROLES.has(raw)) return "admin";

  return "none";
}