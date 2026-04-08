import { createClient } from "@/lib/supabase/client";

export async function listUnitMeasures(orgId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("unit_measures")
    .select("id,name,allowed_kinds")
    .eq("org_id", orgId)
    .order("name");

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listUnitSizes(orgId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("unit_sizes")
    .select("id,label,kind,grams,ml,count")
    .eq("org_id", orgId)
    .order("label");

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listCategories(orgId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id,name")
    .eq("org_id", orgId)
    .order("name");

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createCategory(orgId: string, name: string) {
  const supabase = createClient();
  const cleanName = name.trim();

  if (!cleanName) throw new Error("Category name is required");

  const { data: existing, error: existingError } = await supabase
    .from("categories")
    .select("id,name")
    .eq("org_id", orgId)
    .ilike("name", cleanName)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);
  if (existing) return existing;

  const { data, error } = await supabase
    .from("categories")
    .insert([{ org_id: orgId, name: cleanName }])
    .select("id,name")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function createUnitSize(
  orgId: string,
  kind: "mass" | "volume" | "count",
  value: number
) {
  const supabase = createClient();

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Size value must be greater than zero");
  }

  const normalizedValue = Math.round(value);

  const label =
    kind === "mass"
      ? `${normalizedValue}g`
      : kind === "volume"
      ? `${normalizedValue}ml`
      : `${normalizedValue}pcs`;

  let query = supabase
    .from("unit_sizes")
    .select("id,label,kind,grams,ml,count")
    .eq("org_id", orgId)
    .eq("kind", kind);

  if (kind === "mass") query = query.eq("grams", normalizedValue);
  if (kind === "volume") query = query.eq("ml", normalizedValue);
  if (kind === "count") query = query.eq("count", normalizedValue);

  const { data: existing, error: existingError } = await query.maybeSingle();

  if (existingError) throw new Error(existingError.message);
  if (existing) return existing;

  const insertPayload =
    kind === "mass"
      ? {
          org_id: orgId,
          label,
          kind,
          grams: normalizedValue,
          ml: null,
          count: null,
        }
      : kind === "volume"
      ? {
          org_id: orgId,
          label,
          kind,
          grams: null,
          ml: normalizedValue,
          count: null,
        }
      : {
          org_id: orgId,
          label,
          kind,
          grams: null,
          ml: null,
          count: normalizedValue,
        };

  const { data, error } = await supabase
    .from("unit_sizes")
    .insert([insertPayload])
    .select("id,label,kind,grams,ml,count")
    .single();

  if (error) throw new Error(error.message);
  return data;
}