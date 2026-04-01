import { createClient } from "@/lib/supabase/client";
import { getOrgId, setOrgId } from "@/lib/org/org";

/**
 * Ensures we have a selected org_id.
 * - If already stored, returns it
 * - Else loads my_orgs and picks newest
 * - Else creates "My Shop" and returns it
 */


export async function bootstrapOrg(): Promise<string> {
  const existing = getOrgId();
  if (existing) return existing;

  const supabase = createClient();
  const { data: orgs, error } = await supabase
    .from("my_orgs")
    .select("id, name, created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  if (orgs && orgs.length > 0) {
    setOrgId(orgs[0].id);
    return orgs[0].id;
  }

  const { data: orgId, error: rpcErr } = await supabase.rpc("create_org", {
    p_name: "My Shop",
  });

  if (rpcErr) throw new Error(rpcErr.message);

  setOrgId(orgId);
  return orgId;
}
