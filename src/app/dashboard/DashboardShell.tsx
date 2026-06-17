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
};

const ADMIN_NAV: NavItem[] = [
  { href: "/dashboard/summarydashboard", label: "Dashboard" },
  { href: "/dashboard/inventory", label: "Our Stock" },
  { href: "/dashboard/products", label: "Products" },
  { href: "/dashboard/sales", label: "Sales" },
  { href: "/dashboard/reports", label: "Reports" },
  { href: "/dashboard/expenses", label: "Expenses" },
  { href: "/dashboard/suppliers", label: "Suppliers" },
  { href: "/dashboard/team", label: "Team" },
];

const SALES_ONLY_NAV: NavItem[] = [
  { href: "/dashboard/sales", label: "Sales" },
];

export default function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [orgRole, setOrgRole] = useState<OrgRole>("admin");
  const [roleLoading, setRoleLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initRole() {
      try {
        await bootstrapOrg();

        if (cancelled) return;

        const oid = await getOrgId();
        const role = await fetchMyOrgRole(oid);

        if (cancelled) return;

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

  const allNav = [...ADMIN_NAV, ...SALES_ONLY_NAV];

  const pageTitle =
    allNav.find((item) => pathname.startsWith(item.href))?.label ??
    "Dashboard";

  const today = mounted
    ? {
        weekday: new Date().toLocaleDateString("en-KE", { weekday: "short" }),
        day: new Date().toLocaleDateString("en-KE", { day: "2-digit" }),
        month: new Date().toLocaleDateString("en-KE", { month: "short" }),
        year: new Date().toLocaleDateString("en-KE", { year: "numeric" }),
      }
    : {
        weekday: "",
        day: "",
        month: "",
        year: "",
      };

  const workspaceLabel =
    orgRole === "sales_clerk" ? "Sales Clerk" : "Admin Access";

  return (
    <OrgRoleProvider role={orgRole} loading={roleLoading}>
      <div className={`shell-bg min-h-screen ${collapsed ? "shell-collapsed" : ""}`}>
        <aside className="sidebar hidden lg:flex">
          <div className="sidebar-inner">
            <div className="brand-row">
              <div className="brand-mark">PB</div>

              {!collapsed && (
                <div className="brand-copy">
                  <div className="brand-title">Pollinator Beekeeping</div>
                  <div className="brand-subtitle">Apitherapy</div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              className="collapse-btn"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? "Open" : "Collapse"}
            </button>

            <nav className="side-nav">
              {roleLoading ? (
                <div className="menu-loading">
                  {collapsed ? "..." : "Loading menu..."}
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
                      title={collapsed ? item.label : undefined}
                    >
                      <span className="nav-dot" />
                      {!collapsed && <span className="nav-label">{item.label}</span>}
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
                  title={collapsed ? "Organization" : undefined}
                >
                  <span className="nav-dot" />
                  {!collapsed && <span className="nav-label">Organization</span>}
                </Link>
              )}

              {!roleLoading && (
                <Link
                  href="/dashboard/settings"
                  className={`nav-link ${
                    pathname.startsWith("/dashboard/settings") ? "active" : ""
                  }`}
                  title={collapsed ? "Settings" : undefined}
                >
                  <span className="nav-dot" />
                  {!collapsed && <span className="nav-label">Settings</span>}
                </Link>
              )}

              <button onClick={handleLogout} className="nav-link logout-btn">
                <span className="nav-dot" />
                {!collapsed && <span className="nav-label">Logout</span>}
              </button>
            </nav>

            {!collapsed && (
              <div className="sidebar-footer">
                <div className="sidebar-footer-label">Workspace</div>
                <div className="sidebar-footer-value">{workspaceLabel}</div>
              </div>
            )}
          </div>
        </aside>

        <main className="main-area">
          <header className="topbar">
            <div className="topbar-left">
              <div className="date-card">
                <div className="date-day">{today.day}</div>
                <div className="date-copy">
                  <div className="date-weekday">{today.weekday}</div>
                  <div className="date-month">
                    {today.month} {today.year}
                  </div>
                </div>
              </div>

              <div>
                <div className="eyebrow">{workspaceLabel}</div>
                <h1 className="page-title">{pageTitle}</h1>
              </div>
            </div>

            <div className="topbar-pill">{workspaceLabel}</div>
          </header>

          <div className="content-wrap">{children}</div>
        </main>

        <nav className="mobile-nav">
          {(roleLoading ? [] : navItems).map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`mobile-chip ${isActive ? "active" : "idle"}`}
              >
                {item.label}
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
              Org
            </Link>
          )}

          {!roleLoading && (
            <Link
              href="/dashboard/settings"
              className={`mobile-chip ${
                pathname.startsWith("/dashboard/settings") ? "active" : "idle"
              }`}
            >
              Settings
            </Link>
          )}
        </nav>
      </div>
    </OrgRoleProvider>
  );
}