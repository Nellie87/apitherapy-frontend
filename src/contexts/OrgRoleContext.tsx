"use client";

import React, { createContext, useContext, type ReactNode } from "react";
import type { OrgRole } from "@/lib/auth/orgRole";

type Ctx = {
  role: OrgRole | null;
  loading: boolean;
  isSalesClerk: boolean;
  isAdmin: boolean;
};

const OrgRoleContext = createContext<Ctx | null>(null);

export function OrgRoleProvider({
  role,
  loading,
  children,
}: {
  role: OrgRole | null;
  loading: boolean;
  children: ReactNode;
}) {
  const value: Ctx = {
    role,
    loading,
    isSalesClerk: !loading && role === "sales_clerk",
    isAdmin: !loading && role !== "sales_clerk",
  };

  return <OrgRoleContext.Provider value={value}>{children}</OrgRoleContext.Provider>;
}

export function useOrgRole(): Ctx {
  const v = useContext(OrgRoleContext);
  if (!v) {
    return {
      role: null,
      loading: true,
      isSalesClerk: false,
      isAdmin: false,
    };
  }
  return v;
}
