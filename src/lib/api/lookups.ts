import { supabase } from "@/lib/supabase/client";

export async function listUnitMeasures(orgId: string) {
  const { data, error } = await supabase
    .from("unit_measures")
    .select("id,name,allowed_kinds")
    .eq("org_id", orgId)
    .order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listUnitSizes(orgId: string) {
  const { data, error } = await supabase
    .from("unit_sizes")
    .select("id,label,kind,grams,ml,count")
    .eq("org_id", orgId)
    .order("label");
  if (error) throw new Error(error.message);
  return data ?? [];
}
