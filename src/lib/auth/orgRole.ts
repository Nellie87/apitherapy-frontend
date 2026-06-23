import { createClient } from "@/lib/supabase/client";

export type OrgRole =
  | "owner"
  | "admin"
  | "manager"
  | "sales_clerk"
  | "cashier"
  | "pos"
  | "none";

const ALLOWED_ROLES = new Set<OrgRole>([
  "owner",
  "admin",
  "manager",
  "sales_clerk",
  "cashier",
  "pos",
  "none",
]);

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

  if (error) {
    console.error("fetchMyOrgRole error:", error.message);
    return "none";
  }

  const raw = String(data?.role ?? "none").trim().toLowerCase() as OrgRole;

  if (ALLOWED_ROLES.has(raw)) return raw;

  return "none";
}