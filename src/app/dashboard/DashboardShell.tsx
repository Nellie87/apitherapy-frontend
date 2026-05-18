"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import { getOrgId } from "@/lib/org/org";
import { fetchMyOrgRole, type OrgRole } from "@/lib/auth/orgRole";
import { OrgRoleProvider } from "@/contexts/OrgRoleContext";
import "./dashboard-shell.css";

type NavItem = {
  href: string;
  label: string;
  icon: string;
};

const ADMIN_NAV: NavItem[] = [
  { href: "/dashboard/summarydashboard", label: "Dashboard", icon: "⊞" },
  { href: "/dashboard/inventory", label: "Our Stock", icon: "◫" },
  { href: "/dashboard/products", label: "Products", icon: "◈" },
  { href: "/dashboard/sales", label: "Sales", icon: "◉" },
  { href: "/dashboard/reports", label: "Reports", icon: "◧" },
  { href: "/dashboard/expenses", label: "Expenses", icon: "◨" },
  { href: "/dashboard/suppliers", label: "Suppliers", icon: "◎" },
  { href: "/dashboard/team", label: "Team", icon: "⎔" },
];

const SALES_ONLY_NAV: NavItem[] = [
  { href: "/dashboard/sales", label: "Sales", icon: "◉" },
];

export default function DashboardShell({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [orgRole, setOrgRole] = useState<OrgRole>("admin");
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initRole() {
      try {
        await bootstrapOrg();

        if (cancelled) return;

        const oid = getOrgId();
        const role = await fetchMyOrgRole(oid);

        if (cancelled) return;

        // TEMP FIX:
        // If user has no org_members role, allow them as admin for now.
        setOrgRole(role === "none" ? "admin" : role);
      } catch (error) {
        console.error("DashboardShell role bootstrap error:", error);

        if (!cancelled) {
          setOrgRole("admin");
        }
      } finally {
        if (!cancelled) {
          setRoleLoading(false);
        }
      }
    }

    initRole();

    return () => {
      cancelled = true;
    };
  }, []);

  const navItems = useMemo(() => {
    if (roleLoading) return [];
    return orgRole === "sales_clerk" ? SALES_ONLY_NAV : ADMIN_NAV;
  }, [orgRole, roleLoading]);

  useEffect(() => {
    if (roleLoading || orgRole !== "sales_clerk") return;

    const allowed =
      pathname.startsWith("/dashboard/sales") ||
      pathname.startsWith("/dashboard/org") ||
      pathname.startsWith("/dashboard/settings");

    if (!allowed) {
      router.replace("/dashboard/sales");
    }
  }, [roleLoading, orgRole, pathname, router]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const pageTitle =
    ADMIN_NAV.find((item) => pathname.startsWith(item.href))?.label ??
    SALES_ONLY_NAV.find((item) => pathname.startsWith(item.href))?.label ??
    "Dashboard";

  const today = mounted
    ? new Date().toLocaleDateString("en-KE", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "";

  return (
    <OrgRoleProvider role={orgRole} loading={roleLoading}>
      <div className="shell-bg min-h-screen flex flex-col lg:flex-row">
        <aside className="sidebar hidden lg:flex flex-col flex-shrink-0">
          <div style={{ padding: "28px 20px 20px" }}>
            <div className="flex items-center gap-3">
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  background:
                    "linear-gradient(135deg, #F8D54A 0%, #E2B11A 55%, #C9920A 100%)",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 22,
                  color: "#2B2100",
                  boxShadow:
                    "0 10px 24px rgba(245,197,24,0.22), inset 0 1px 0 rgba(255,255,255,0.35)",
                }}
              >
                🐝
              </div>

              <div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 900,
                    letterSpacing: "-0.02em",
                    color: "var(--sidebar-text)",
                    lineHeight: 1.1,
                  }}
                >
                  Pollinator Beekeeping
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: "var(--sidebar-text-dim)",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                  }}
                >
                  Apitherapy
                </div>
              </div>
            </div>
          </div>

          <nav style={{ padding: "0 14px", flex: 1 }}>
            {roleLoading ? (
              <div
                style={{
                  padding: "12px 14px",
                  color: "var(--sidebar-text-dim)",
                  fontSize: 13,
                }}
              >
                Loading menu…
              </div>
            ) : (
              navItems.map((item) => {
                const isActive =
                  pathname === item.href || pathname.startsWith(item.href + "/");

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-link ${isActive ? "active" : ""}`}
                    style={{ marginBottom: 6 }}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                );
              })
            )}

            {!roleLoading && orgRole === "sales_clerk" && (
              <Link
                href="/dashboard/org"
                className={`nav-link ${
                  pathname.startsWith("/dashboard/org") ? "active" : ""
                }`}
                style={{ marginBottom: 6 }}
              >
                <span className="nav-icon">🏢</span>
                <span>Organization</span>
              </Link>
            )}

            {!roleLoading && (
              <Link
                href="/dashboard/settings"
                className={`nav-link ${
                  pathname.startsWith("/dashboard/settings") ? "active" : ""
                }`}
                style={{ marginBottom: 6 }}
              >
                <span className="nav-icon">⚙</span>
                <span>Settings</span>
              </Link>
            )}

            <button
              onClick={handleLogout}
              className="nav-link"
              style={{
                marginTop: 14,
                width: "100%",
                border: 0,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span className="nav-icon">⎋</span>
              <span>Logout</span>
            </button>
          </nav>
        </aside>

        <div className="mobile-nav">
          {(roleLoading ? [] : navItems).map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`mobile-chip ${isActive ? "active" : "idle"}`}
              >
                <span className="nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}

          {!roleLoading && orgRole === "sales_clerk" && (
            <Link
              href="/dashboard/org"
              className={`mobile-chip ${
                pathname.startsWith("/dashboard/org") ? "active" : "idle"
              }`}
            >
              <span className="nav-icon">🏢</span>
              <span>Org</span>
            </Link>
          )}

          {!roleLoading && (
            <Link
              href="/dashboard/settings"
              className={`mobile-chip ${
                pathname.startsWith("/dashboard/settings") ? "active" : "idle"
              }`}
            >
              <span className="nav-icon">⚙</span>
              <span>Settings</span>
            </Link>
          )}
        </div>

        <main className="flex-1 min-w-0">
          <header className="topbar">
            <div>
              <div className="eyebrow">{today}</div>
              <h1 className="page-title">{pageTitle}</h1>
            </div>

            <div className="topbar-pill">
              {orgRole === "sales_clerk" ? "Sales Clerk" : "Admin Access"}
            </div>
          </header>

          <div className="content-wrap">{children}</div>
        </main>
      </div>
    </OrgRoleProvider>
  );
}