import { createClient } from "@/lib/supabase/client";

export type OrgRole = "admin" | "sales_clerk";

export async function fetchMyOrgRole(orgId: string | null): Promise<OrgRole> {
  if (!orgId) return "admin";

  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_my_org_role", {
    p_org_id: orgId,
  });

  if (error) {
    console.warn("[orgRole] get_my_org_role:", error.message);
    return "admin";
  }

  const r = String(data ?? "admin");
  return r === "sales_clerk" ? "sales_clerk" : "admin";
}
