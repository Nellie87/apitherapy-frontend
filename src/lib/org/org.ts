const KEY = "beeshop_org_id";

export function getOrgId() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY);
}

export function setOrgId(orgId: string) {
  localStorage.setItem(KEY, orgId);
}

export function clearOrgId() {
  localStorage.removeItem(KEY);
}
