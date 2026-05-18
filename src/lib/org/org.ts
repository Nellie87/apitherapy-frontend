import { createClient } from "@/lib/supabase/client";

function buildKey(userId: string) {
  return `beeshop_org_id:${userId}`;
}

export async function getOrgId() {
  if (typeof window === "undefined") return null;

  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return localStorage.getItem(buildKey(user.id));
}

export async function setOrgId(orgId: string) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  localStorage.setItem(buildKey(user.id), orgId);
}

export async function clearOrgId() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  localStorage.removeItem(buildKey(user.id));
}