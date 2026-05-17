import { requireSession } from "@/lib/auth/session";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";

export async function requireOrg() {
  const session = await requireSession();

  if (!session) {
    window.location.href = "/login";
    return null;
  }

  try {
    const orgId = await bootstrapOrg();
    return orgId;
  } catch (e) {
    window.location.href = "/dashboard/org";
    return null;
  }
}