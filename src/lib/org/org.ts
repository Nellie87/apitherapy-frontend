import { createClient } from "@/lib/supabase/client";

function buildKey(userId: string) {
  return `beeshop_org_id:${userId}`;
}

/** In-memory org cache for the current tab (survives within the page; cleared on reload). */
let sessionOrgCache: { userId: string; orgId: string } | null = null;

export function getCachedOrgId(userId: string): string | null {
  if (sessionOrgCache?.userId === userId) return sessionOrgCache.orgId;
  return null;
}

export function setCachedOrgId(userId: string, orgId: string) {
  sessionOrgCache = { userId, orgId };
}

export function clearOrgBootstrapCache() {
  sessionOrgCache = null;
}

async function requireUserId(): Promise<string> {
  if (typeof window === "undefined") {
    throw new Error("Organization context is only available in the browser.");
  }

  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw new Error(error.message);
  if (!user) throw new Error("Not authenticated.");

  return user.id;
}

export async function getOrgId(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  try {
    const userId = await requireUserId();
    const cached = getCachedOrgId(userId);
    if (cached) return cached;
    return localStorage.getItem(buildKey(userId));
  } catch {
    return null;
  }
}

export async function setOrgId(orgId: string): Promise<void> {
  const userId = await requireUserId();
  localStorage.setItem(buildKey(userId), orgId);
  setCachedOrgId(userId, orgId);
}

export async function clearOrgId(): Promise<void> {
  clearOrgBootstrapCache();
  try {
    const userId = await requireUserId();
    localStorage.removeItem(buildKey(userId));
  } catch {
    // Session may already be gone during logout; nothing to clear.
  }
}
