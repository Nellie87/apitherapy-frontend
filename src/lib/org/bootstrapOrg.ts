import { createClient } from "@/lib/supabase/client";
import { getOrgId, setOrgId } from "@/lib/org/org";

export async function bootstrapOrg(): Promise<string> {
  const existing = await getOrgId();

  if (existing) {
    return existing;
  }

  const supabase = createClient();

  const { data: orgs, error } = await supabase
    .from("my_orgs")
    .select("id, name, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  if (!orgs || orgs.length === 0) {
    throw new Error("No organization found.");
  }

  await setOrgId(orgs[0].id);
  return orgs[0].id;
}