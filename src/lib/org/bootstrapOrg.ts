import { createClient } from "@/lib/supabase/client";
import { getOrgId, setOrgId, clearOrgId } from "@/lib/org/org";

/**
 * Ensures we have a selected org_id ONLY if user belongs to an org.
 * Does NOT auto-create "My Shop".
 */
export async function bootstrapOrg(): Promise<string> {
  const existing = getOrgId();

  const supabase = createClient();

  const { data: orgs, error } = await supabase
    .from("my_orgs")
    .select("id, name, created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  if (existing && orgs?.some((o) => o.id === existing)) {
    return existing;
  }

  if (orgs && orgs.length > 0) {
    setOrgId(orgs[0].id);
    return orgs[0].id;
  }

  clearOrgId();
  throw new Error("NO_ORG_MEMBERSHIP");
}