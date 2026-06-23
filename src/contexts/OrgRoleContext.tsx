"use client";

import React, { createContext, useContext, type ReactNode } from "react";
import type { OrgRole } from "@/lib/auth/orgRole";

type Ctx = {
  role: OrgRole | null;
  loading: boolean;

  isOwner: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isSalesClerk: boolean;
  isCashier: boolean;
  isPos: boolean;

  canSell: boolean;
  canViewReports: boolean;
  canManageInventory: boolean;
  canManageExpenses: boolean;
  canManageTeam: boolean;
  canManageSettings: boolean;
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
  const safeRole = role ?? "none";

  const isOwner = !loading && safeRole === "owner";
  const isAdmin = !loading && safeRole === "admin";
  const isManager = !loading && safeRole === "manager";
  const isSalesClerk = !loading && safeRole === "sales_clerk";
  const isCashier = !loading && safeRole === "cashier";
  const isPos = !loading && safeRole === "pos";

  const canSell = isOwner || isAdmin || isManager || isSalesClerk || isCashier || isPos;
  const canViewReports = isOwner || isAdmin || isManager;
  const canManageInventory = isOwner || isAdmin || isManager;
  const canManageExpenses = isOwner || isAdmin || isManager;
  const canManageTeam = isOwner || isAdmin;
  const canManageSettings = isOwner || isAdmin;

  const value: Ctx = {
    role: safeRole,
    loading,

    isOwner,
    isAdmin,
    isManager,
    isSalesClerk,
    isCashier,
    isPos,

    canSell,
    canViewReports,
    canManageInventory,
    canManageExpenses,
    canManageTeam,
    canManageSettings,
  };

  return (
    <OrgRoleContext.Provider value={value}>
      {children}
    </OrgRoleContext.Provider>
  );
}

export function useOrgRole(): Ctx {
  const v = useContext(OrgRoleContext);

  if (!v) {
    return {
      role: "none",
      loading: true,

      isOwner: false,
      isAdmin: false,
      isManager: false,
      isSalesClerk: false,
      isCashier: false,
      isPos: false,

      canSell: false,
      canViewReports: false,
      canManageInventory: false,
      canManageExpenses: false,
      canManageTeam: false,
      canManageSettings: false,
    };
  }

  return v;
}