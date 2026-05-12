"use client";

import React, { createContext, useContext, useMemo, type ReactNode } from "react";

import type { OrgRole } from "@/lib/auth/orgRole";

export type OrgRoleContextValue = {
  role: OrgRole | null;
  loading: boolean;
  isAdmin: boolean;
  isSalesClerk: boolean;
};

const OrgRoleContext = createContext<OrgRoleContextValue>({
  role: null,
  loading: true,
  isAdmin: false,
  isSalesClerk: false,
});

export function OrgRoleProvider({
  role,
  loading,
  children,
}: {
  role: OrgRole | null;
  loading: boolean;
  children: ReactNode;
}) {
  const value = useMemo(
    (): OrgRoleContextValue => ({
      role,
      loading,
      isAdmin: role === "admin",
      isSalesClerk: role === "sales_clerk",
    }),
    [role, loading]
  );

  return (
    <OrgRoleContext.Provider value={value}>{children}</OrgRoleContext.Provider>
  );
}

export function useOrgRole() {
  return useContext(OrgRoleContext);
}
