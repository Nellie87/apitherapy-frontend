import { createClient } from "@/lib/supabase/client";
import { clearOrgId, getOrgId, setOrgId } from "@/lib/org/org";

export class OrgSelectionRequiredError extends Error {
  constructor(message = "Organization selection required.") {
    super(message);
    this.name = "OrgSelectionRequiredError";
  }
}

export function isOrgSelectionRequiredError(err: unknown): boolean {
  return (
    err instanceof OrgSelectionRequiredError ||
    (err instanceof Error && err.name === "OrgSelectionRequiredError")
  );
}

export function isMissingOrgError(err: unknown): boolean {
  return (
    isOrgSelectionRequiredError(err) ||
    (err instanceof Error && err.message === "No organization found.")
  );
}

/** After login: pick the right landing path without hitting a dashboard error state. */
export async function resolvePostLoginPath(): Promise<string> {
  const supabase = createClient();

  const { data: orgs, error } = await supabase
    .from("my_orgs")
    .select("id")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  if (!orgs || orgs.length === 0) {
    return "/dashboard/org";
  }

  if (orgs.length === 1) {
    await setOrgId(orgs[0].id);
    return "/dashboard/summarydashboard";
  }

  return "/dashboard/org";
}

export async function bootstrapOrg(): Promise<string> {
  const supabase = createClient();

  const { data: orgs, error } = await supabase
    .from("my_orgs")
    .select("id, name, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  if (!orgs || orgs.length === 0) {
    await clearOrgId();
    throw new Error("No organization found.");
  }

  const existing = await getOrgId();
  if (existing && orgs.some((o) => o.id === existing)) {
    return existing;
  }

  if (existing) {
    await clearOrgId();
  }

  // Fresh session (e.g. incognito): only auto-bind when there is a single org.
  // Multiple memberships need an explicit choice so the wrong workspace isn't loaded empty.
  if (orgs.length > 1) {
    throw new OrgSelectionRequiredError();
  }

  await setOrgId(orgs[0].id);
  return orgs[0].id;
}
