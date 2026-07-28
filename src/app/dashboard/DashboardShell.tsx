"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  bootstrapOrg,
  isMissingOrgError,
} from "@/lib/org/bootstrapOrg";
import { clearOrgId, getOrgId } from "@/lib/org/org";
import { fetchMyOrgRole, type OrgRole } from "@/lib/auth/orgRole";
import { OrgRoleProvider } from "@/contexts/OrgRoleContext";
import "./dashboard-shell.css";

type NavItem = {
  href: string;
  label: string;
  icon: string;
};

type NavGroup = {
  label: string;
  href: string;
  icon: string;
  children: NavItem[];
};

const Icons: Record<string, ReactNode> = {
  dashboard: <span>▦</span>,
  inventory: <span>□</span>,
  products: <span>＋</span>,
  sales: <span>↗</span>,
  reports: <span>▤</span>,
  expenses: <span>🧾</span>,
  discounts: <span>％</span>,
  revenue: <span>₵</span>,
  services: <span>◷</span>,
  suppliers: <span>▣</span>,
  team: <span>👥</span>,
  org: <span>⌂</span>,
  settings: <span>⚙</span>,
  logout: <span>↪</span>,
  menu: <span>☰</span>,
  close: <span>×</span>,
};

const REPORT_NAV: NavItem[] = [
  { href: "/dashboard/reports/sales-analytics", label: "Sales Report", icon: "sales" },
  { href: "/dashboard/reports/inventory", label: "Inventory Valuation", icon: "inventory" },
  { href: "/dashboard/reports/discounts", label: "Discount Report", icon: "expenses" },
  { href: "/dashboard/reports/revenue-health", label: "Revenue Health", icon: "expenses" },
];

const ADMIN_NAV: (NavItem | NavGroup)[] = [
  { href: "/dashboard/summarydashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/dashboard/inventory", label: "Our Stock", icon: "inventory" },
  { href: "/dashboard/products", label: "Products", icon: "products" },
  { href: "/dashboard/sales", label: "Sales", icon: "sales" },
  { href: "/dashboard/services", label: "Services", icon: "services" },
  { href: "/dashboard/reports", label: "Reports", icon: "reports", children: REPORT_NAV },
  { href: "/dashboard/expenses", label: "Expenses", icon: "expenses" },
  { href: "/dashboard/suppliers", label: "Suppliers", icon: "suppliers" },
  { href: "/dashboard/team", label: "Team", icon: "team" },
  { href: "/dashboard/settings", label: "Settings", icon: "settings" },
];

const SALES_ONLY_NAV: NavItem[] = [
  { href: "/dashboard/sales", label: "Sales", icon: "sales" },
];

function isGroup(item: NavItem | NavGroup): item is NavGroup {
  return "children" in item;
}

function roleLabel(role: OrgRole) {
  if (role === "owner") return "Owner Access";
  if (role === "admin") return "Admin Access";
  if (role === "manager") return "Manager Access";
  if (role === "sales_clerk") return "Sales Clerk";
  if (role === "cashier") return "Cashier";
  if (role === "pos") return "POS Access";
  return "No Access";
}

function canAccessHref(role: OrgRole, href: string) {
  if (role === "none") return false;

  if (["sales_clerk", "cashier", "pos"].includes(role)) {
  return href.startsWith("/dashboard/sales");
}

  if (role === "manager") {
    return !(
      href.startsWith("/dashboard/team") ||
      href.startsWith("/dashboard/settings")
    );
  }

  return true;
}

function filterNavByRole(role: OrgRole): (NavItem | NavGroup)[] {
  if (["sales_clerk", "cashier", "pos"].includes(role)) {
    return SALES_ONLY_NAV;
  }

  if (role === "manager") {
    return ADMIN_NAV
      .map((item) => {
        if (!isGroup(item)) return canAccessHref(role, item.href) ? item : null;

        const children = item.children.filter((child) => canAccessHref(role, child.href));
        return children.length ? { ...item, children } : null;
      })
      .filter(Boolean) as (NavItem | NavGroup)[];
  }

  if (["owner", "admin"].includes(role)) {
    return ADMIN_NAV;
  }

  return [];
}

function flatNav(items: (NavItem | NavGroup)[]) {
  return items.flatMap((item) => (isGroup(item) ? [item, ...item.children] : [item]));
}

export default function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [orgRole, setOrgRole] = useState<OrgRole>("none");
  const [roleLoading, setRoleLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (pathname.startsWith("/dashboard/reports")) {
      setReportsOpen(true);
    }
  }, [pathname]);

  const onOrgPage = pathname.startsWith("/dashboard/org");

  useEffect(() => {
    let cancelled = false;

    async function initRole() {
      try {
        await bootstrapOrg();

        if (cancelled) return;

        const oid = await getOrgId();
        const role = await fetchMyOrgRole(oid);

        if (cancelled) return;

        setOrgRole(role);
      } catch (err) {
        if (!isMissingOrgError(err)) {
          console.error("DashboardShell role bootstrap error:", err);
        }

        if (!cancelled) {
          setOrgRole("none");
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
    return filterNavByRole(orgRole);
  }, [orgRole, roleLoading]);

  const allNav = useMemo(() => flatNav(navItems), [navItems]);

  const needsOrgPick = !roleLoading && orgRole === "none";
  // Keep dashboard pages unmounted until a workspace is ready so they never flash errors.
  const showWorkspaceGate = roleLoading || (needsOrgPick && !onOrgPage);

  useEffect(() => {
    if (roleLoading) return;

    if (onOrgPage) return;

    if (orgRole === "none") {
      router.replace("/dashboard/org");
      return;
    }

    const allowed = allNav.some(
      (item) => pathname === item.href || pathname.startsWith(item.href + "/")
    );

    if (!allowed) {
      if (["sales_clerk", "cashier", "pos"].includes(orgRole)) {
        router.replace("/dashboard/sales");
        return;
      }

      if (orgRole === "manager") {
        router.replace("/dashboard/summarydashboard");
      }
    }
  }, [roleLoading, orgRole, pathname, router, allNav, onOrgPage]);

  async function handleLogout() {
    await clearOrgId();
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const pageTitle =
    allNav.find((item) => pathname === item.href || pathname.startsWith(item.href + "/"))?.label ??
    "Dashboard";

  const today = mounted
    ? {
        weekday: new Date().toLocaleDateString("en-KE", { weekday: "short" }),
        day: new Date().toLocaleDateString("en-KE", { day: "2-digit" }),
        month: new Date().toLocaleDateString("en-KE", { month: "short" }),
        year: new Date().toLocaleDateString("en-KE", { year: "numeric" }),
      }
    : { weekday: "", day: "", month: "", year: "" };

  const workspaceLabel = roleLabel(orgRole);

  // Org picker is its own full-page flow — skip the dashboard chrome.
  if (onOrgPage && (roleLoading || orgRole === "none")) {
    return (
      <OrgRoleProvider role={orgRole} loading={roleLoading}>
        {children}
      </OrgRoleProvider>
    );
  }

  function NavLink({
    href,
    label,
    icon,
    mobile = false,
  }: {
    href: string;
    label: string;
    icon: string;
    mobile?: boolean;
  }) {
    const isActive = pathname === href || pathname.startsWith(href + "/");

    return (
      <Link
        href={href}
        className={`${mobile ? "mobile-menu-link" : "nav-link"} ${isActive ? "active" : ""}`}
        title={collapsed && !mobile ? label : undefined}
      >
        <span className="nav-icon">{Icons[icon]}</span>
        {(!collapsed || mobile) && <span className="nav-label">{label}</span>}
      </Link>
    );
  }

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
              onClick={() => setCollapsed((v) => !v)}
              className="hamburger-btn"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? Icons.menu : Icons.close}
            </button>

            <nav className="side-nav" aria-label="Main navigation">
              {roleLoading ? (
                <div className="menu-loading">{collapsed ? "…" : "Loading menu…"}</div>
              ) : (
                navItems.map((item) => {
                  if (isGroup(item)) {
                    const groupActive = pathname.startsWith(item.href);

                    if (collapsed) {
                      return (
                        <button
                          key={item.href}
                          type="button"
                          onClick={() => setReportsOpen((v) => !v)}
                          className={`nav-link nav-group-trigger ${groupActive ? "active" : ""}`}
                          aria-label={item.label}
                        >
                          <span className="nav-icon">{Icons[item.icon]}</span>
                        </button>
                      );
                    }

                    return (
                      <div key={item.href} className="nav-group">
                        <button
                          type="button"
                          onClick={() => setReportsOpen((v) => !v)}
                          className={`nav-link nav-group-trigger ${groupActive ? "active" : ""}`}
                          aria-expanded={reportsOpen}
                        >
                          <span className="nav-icon">{Icons[item.icon]}</span>
                          <span className="nav-label">{item.label}</span>
                          <span className={`nav-caret ${reportsOpen ? "caret-open" : ""}`}>
                            ▾
                          </span>
                        </button>

                        {reportsOpen && (
                          <div className="nav-submenu">
                            {item.children.map((child) => {
                              const isActive =
                                pathname === child.href ||
                                pathname.startsWith(child.href + "/");

                              return (
                                <Link
                                  key={child.href}
                                  href={child.href}
                                  className={`nav-sub-link ${isActive ? "active" : ""}`}
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

                  return (
                    <NavLink
                      key={item.href}
                      href={item.href}
                      label={item.label}
                      icon={item.icon}
                    />
                  );
                })
              )}

             

              <button
                type="button"
                onClick={handleLogout}
                className="nav-link logout-btn"
                aria-label="Log out"
              >
                <span className="nav-icon">{Icons.logout}</span>
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
              <button
                type="button"
                className="mobile-menu-button lg:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation menu"
              >
                {Icons.menu}
              </button>

              <div className="date-card hidden sm:flex">
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

            <button
              type="button"
              onClick={handleLogout}
              className="topbar-logout hidden sm:inline-flex"
            >
              Logout
            </button>
          </header>

          <div className="content-wrap">
            {showWorkspaceGate ? (
              <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
                <div className="mb-4 h-10 w-10 animate-spin rounded-full border-2 border-amber-300 border-t-amber-600" />
                <p className="text-lg font-semibold text-slate-800">
                  {needsOrgPick
                    ? "Taking you to your workspaces…"
                    : "Preparing your workspace…"}
                </p>
                <p className="mt-1 max-w-sm text-sm text-slate-500">
                  {needsOrgPick
                    ? "You have more than one organization. Pick one to continue."
                    : "Just a moment while we load your dashboard."}
                </p>
              </div>
            ) : (
              children
            )}
          </div>
        </main>

        {mobileOpen && (
          <div className="mobile-menu-overlay lg:hidden" role="dialog" aria-modal="true">
            <button
              type="button"
              className="mobile-menu-backdrop"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation menu"
            />

            <div className="mobile-menu-panel">
              <div className="mobile-menu-header">
                <div>
                  <div className="brand-title">Pollinator Beekeeping</div>
                  <div className="brand-subtitle">{workspaceLabel}</div>
                </div>

                <button
                  type="button"
                  className="mobile-menu-close"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close navigation menu"
                >
                  {Icons.close}
                </button>
              </div>

              <nav className="mobile-menu-list" aria-label="Mobile navigation">
                {roleLoading ? (
                  <div className="menu-loading">Loading menu…</div>
                ) : (
                  navItems.map((item) => {
                    if (isGroup(item)) {
                      return (
                        <div key={item.href} className="mobile-menu-group">
                          <div className="mobile-menu-group-title">{item.label}</div>

                          {item.children.map((child) => (
                            <NavLink
                              key={child.href}
                              href={child.href}
                              label={child.label}
                              icon={child.icon}
                              mobile
                            />
                          ))}
                        </div>
                      );
                    }

                    return (
                      <NavLink
                        key={item.href}
                        href={item.href}
                        label={item.label}
                        icon={item.icon}
                        mobile
                      />
                    );
                  })
                )}

               
              </nav>

              <button
                type="button"
                onClick={handleLogout}
                className="mobile-logout-button"
              >
                <span>{Icons.logout}</span>
                <span>Logout</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </OrgRoleProvider>
  );
}