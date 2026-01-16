import { requireSession } from "@/lib/auth/session";
import { getOrgId } from "@/lib/org/org";

export async function requireOrg() {
  const session = await requireSession();
  if (!session) {
    window.location.href = "/login";
    return null;
  }
  const orgId = getOrgId();
  if (!orgId) {
    window.location.href = "/dashboard/org";
    return null;
  }
  return orgId;
}
