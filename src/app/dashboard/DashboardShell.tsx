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

type NavGroup = {
  label: string;
  href: string;
  children: NavItem[];
};

const REPORT_NAV: NavItem[] = [
  { href: "/dashboard/reports/sales-analytics", label: "Sales Summary" },
  { href: "/dashboard/reports/inventory", label: "Inventory Valuation" },
  { href: "/dashboard/reports/discounts", label: "Discount Report" },
  { href: "/dashboard/reports/expenses-pnl", label: "Expenses Summary" },
];

const ADMIN_NAV: (NavItem | NavGroup)[] = [
  { href: "/dashboard/summarydashboard", label: "Dashboard" },
  { href: "/dashboard/inventory", label: "Our Stock" },
  { href: "/dashboard/products", label: "Products" },
  { href: "/dashboard/sales", label: "Sales" },
  {
    href: "/dashboard/reports",
    label: "Reports",
    children: REPORT_NAV,
  },
  { href: "/dashboard/expenses", label: "Expenses" },
  { href: "/dashboard/suppliers", label: "Suppliers" },
  { href: "/dashboard/team", label: "Team" },
];

const SALES_ONLY_NAV: NavItem[] = [
  { href: "/dashboard/sales", label: "Sales" },
];

function isGroup(item: NavItem | NavGroup): item is NavGroup {
  return "children" in item;
}

export default function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [orgRole, setOrgRole] = useState<OrgRole>("admin");
  const [roleLoading, setRoleLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (pathname.startsWith("/dashboard/reports")) {
      setReportsOpen(true);
    }
  }, [pathname]);

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

  const flatAdminNav = ADMIN_NAV.flatMap((item) =>
    isGroup(item) ? [item, ...item.children] : [item]
  );

  const allNav = [...flatAdminNav, ...SALES_ONLY_NAV];

  const pageTitle =
    allNav.find((item) => pathname.startsWith(item.href))?.label ?? "Dashboard";

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
                  if (isGroup(item)) {
                    const groupActive = pathname.startsWith(item.href);

                    return (
                      <div key={item.href} className="nav-group">
                        <button
                          type="button"
                          onClick={() => setReportsOpen((v) => !v)}
                          className={`nav-link nav-group-trigger ${
                            groupActive ? "active" : ""
                          }`}
                          title={collapsed ? item.label : undefined}
                        >
                          <span className="nav-dot" />
                          {!collapsed && (
                            <>
                              <span className="nav-label">{item.label}</span>
                              <span className="nav-caret">
                                {reportsOpen ? "Open" : "Closed"}
                              </span>
                            </>
                          )}
                        </button>

                        {!collapsed && reportsOpen && (
                          <div className="nav-submenu">
                            {item.children.map((child) => {
                              const isActive =
                                pathname === child.href ||
                                pathname.startsWith(child.href + "/");

                              return (
                                <Link
                                  key={child.href}
                                  href={child.href}
                                  className={`nav-sub-link ${
                                    isActive ? "active" : ""
                                  }`}
                                >
                                  {child.label}
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }

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
          {(roleLoading ? [] : navItems).flatMap((item) =>
            isGroup(item) ? item.children : [item]
          ).map((item) => {
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