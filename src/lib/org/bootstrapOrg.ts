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

  if (orgs && orgs.length > 0) {
    await setOrgId(orgs[0].id);
    return orgs[0].id;
  }

  const { data: orgId, error: rpcErr } = await supabase.rpc("create_org", {
    p_name: "My Shop",
  });

  if (rpcErr) {
    throw new Error(rpcErr.message);
  }

  if (!orgId) {
    throw new Error("Failed to create organization.");
  }

  await setOrgId(String(orgId));

  return String(orgId);
}