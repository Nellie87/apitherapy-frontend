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
  icon: string; // SVG path(s) or identifier
};

type NavGroup = {
  label: string;
  href: string;
  icon: string;
  children: NavItem[];
};

// ── Icon SVG paths ────────────────────────────────────────────────────────────
const Icons: Record<string, ReactNode> = {
  dashboard: (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="7" height="7" rx="2" fill="currentColor" opacity=".85"/>
      <rect x="11" y="2" width="7" height="7" rx="2" fill="currentColor" opacity=".45"/>
      <rect x="2" y="11" width="7" height="7" rx="2" fill="currentColor" opacity=".45"/>
      <rect x="11" y="11" width="7" height="7" rx="2" fill="currentColor" opacity=".85"/>
    </svg>
  ),
  inventory: (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 6.5L10 3l7 3.5v7L10 17 3 13.5V6.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
      <path d="M10 3v14M3 6.5l7 4 7-4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
    </svg>
  ),
  products: (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M10 6v8M6 10h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  sales: (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 14l4-5 3 3 3-4 4 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 17h14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity=".5"/>
    </svg>
  ),
  reports: (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="14" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M6.5 13V10M10 13V7.5M13.5 13V9.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  expenses: (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M10 6.5v1M10 12.5v1M7.5 11.5c0 .83.67 1.5 1.5 1.5h2a1.5 1.5 0 0 0 0-3H9a1.5 1.5 0 0 1 0-3h2c.83 0 1.5.67 1.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  suppliers: (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2.5 14V8l5-4 5 4v6H2.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
      <path d="M10 18v-4h4l3.5 4H10Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
      <path d="M5.5 14v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity=".6"/>
    </svg>
  ),
  team: (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="7.5" cy="7" r="2.8" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M2 16c0-3.04 2.46-5.5 5.5-5.5S13 12.96 13 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <circle cx="14.5" cy="7.5" r="2.2" stroke="currentColor" strokeWidth="1.4" opacity=".6"/>
      <path d="M14.5 11.5c1.93 0 3.5 1.57 3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity=".6"/>
    </svg>
  ),
  org: (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="2.5" width="4" height="4" rx="1.2" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="2.5" y="13.5" width="4" height="4" rx="1.2" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="13.5" y="13.5" width="4" height="4" rx="1.2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M10 6.5v3M10 9.5H5.5V13.5M10 9.5H14.5V13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M10 2.5v1.7M10 15.8v1.7M2.5 10h1.7M15.8 10h1.7M4.4 4.4l1.2 1.2M14.4 14.4l1.2 1.2M4.4 15.6l1.2-1.2M14.4 5.6l1.2-1.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7.5 3H4a1.5 1.5 0 0 0-1.5 1.5v11A1.5 1.5 0 0 0 4 17h3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M13 6.5 17 10l-4 3.5M17 10H8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
};

// ── Nav definitions ───────────────────────────────────────────────────────────
const REPORT_NAV: NavItem[] = [
  { href: "/dashboard/reports/sales-analytics", label: "Sales Summary",       icon: "sales"     },
  { href: "/dashboard/reports/inventory",        label: "Inventory Valuation", icon: "inventory" },
  { href: "/dashboard/reports/discounts",        label: "Discount Report",     icon: "expenses"  },
  { href: "/dashboard/reports/expenses-pnl",     label: "Expenses Summary",    icon: "expenses"  },
];

const ADMIN_NAV: (NavItem | NavGroup)[] = [
  { href: "/dashboard/summarydashboard", label: "Dashboard", icon: "dashboard"  },
  { href: "/dashboard/inventory",        label: "Our Stock",  icon: "inventory"  },
  { href: "/dashboard/products",         label: "Products",   icon: "products"   },
  { href: "/dashboard/sales",            label: "Sales",      icon: "sales"      },
  { href: "/dashboard/reports", label: "Reports", icon: "reports", children: REPORT_NAV },
  { href: "/dashboard/expenses",         label: "Expenses",   icon: "expenses"   },
  { href: "/dashboard/suppliers",        label: "Suppliers",  icon: "suppliers"  },
  { href: "/dashboard/team",             label: "Team",       icon: "team"       },
];

const SALES_ONLY_NAV: NavItem[] = [
  { href: "/dashboard/sales", label: "Sales", icon: "sales" },
];

function isGroup(item: NavItem | NavGroup): item is NavGroup {
  return "children" in item;
}

// ── Hamburger icon ────────────────────────────────────────────────────────────
function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="hamburger-svg"
    >
      {open ? (
        // X / close
        <>
          <line x1="5" y1="5" x2="19" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <line x1="19" y1="5" x2="5"  y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </>
      ) : (
        // Hamburger
        <>
          <line x1="4" y1="7"  x2="20" y2="7"  stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <line x1="4" y1="17" x2="20" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </>
      )}
    </svg>
  );
}

// ── Tooltip wrapper for collapsed icon mode ───────────────────────────────────
function Tip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="tip-wrap">
      {children}
      <span className="tip-label">{label}</span>
    </div>
  );
}

// ── Shell ─────────────────────────────────────────────────────────────────────
export default function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();

  const [mounted,      setMounted     ] = useState(false);
  const [orgRole,      setOrgRole     ] = useState<OrgRole>("admin");
  const [roleLoading,  setRoleLoading ] = useState(true);
  const [collapsed,    setCollapsed   ] = useState(false);
  const [reportsOpen,  setReportsOpen ] = useState(true);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (pathname.startsWith("/dashboard/reports")) setReportsOpen(true);
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    async function initRole() {
      try {
        await bootstrapOrg();
        if (cancelled) return;
        const oid  = await getOrgId();
        const role = await fetchMyOrgRole(oid);
        if (cancelled) return;
        setOrgRole(role === "none" ? "admin" : role);
      } catch (err) {
        console.error("DashboardShell role bootstrap error:", err);
        if (!cancelled) setOrgRole("admin");
      } finally {
        if (!cancelled) setRoleLoading(false);
      }
    }
    initRole();
    return () => { cancelled = true; };
  }, []);

  const navItems = useMemo(() => {
    if (roleLoading) return [];
    return orgRole === "sales_clerk" ? SALES_ONLY_NAV : ADMIN_NAV;
  }, [orgRole, roleLoading]);

  useEffect(() => {
    if (roleLoading || orgRole !== "sales_clerk") return;
    const allowed =
      pathname.startsWith("/dashboard/sales") ||
      pathname.startsWith("/dashboard/org")   ||
      pathname.startsWith("/dashboard/settings");
    if (!allowed) router.replace("/dashboard/sales");
  }, [roleLoading, orgRole, pathname, router]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const flatAdminNav = ADMIN_NAV.flatMap((item) =>
    isGroup(item) ? [item, ...item.children] : [item]
  );
  const allNav    = [...flatAdminNav, ...SALES_ONLY_NAV];
  const pageTitle = allNav.find((item) => pathname.startsWith(item.href))?.label ?? "Dashboard";

  const today = mounted
    ? {
        weekday : new Date().toLocaleDateString("en-KE", { weekday: "short" }),
        day     : new Date().toLocaleDateString("en-KE", { day: "2-digit" }),
        month   : new Date().toLocaleDateString("en-KE", { month: "short" }),
        year    : new Date().toLocaleDateString("en-KE", { year: "numeric" }),
      }
    : { weekday: "", day: "", month: "", year: "" };

  const workspaceLabel = orgRole === "sales_clerk" ? "Sales Clerk" : "Admin Access";

  // ── helper: render a single nav link ──────────────────────────────────────
  function NavLink({
    href, label, icon, extra,
  }: { href: string; label: string; icon: string; extra?: string }) {
    const isActive = pathname === href || pathname.startsWith(href + "/");
    const inner = (
      <Link
        href={href}
        className={`nav-link ${isActive ? "active" : ""} ${extra ?? ""}`}
        title={collapsed ? label : undefined}
      >
        <span className="nav-icon">{Icons[icon]}</span>
        {!collapsed && <span className="nav-label">{label}</span>}
      </Link>
    );
    return collapsed ? <Tip label={label}>{inner}</Tip> : inner;
  }

  return (
    <OrgRoleProvider role={orgRole} loading={roleLoading}>
      <div className={`shell-bg min-h-screen ${collapsed ? "shell-collapsed" : ""}`}>

        {/* ── Sidebar ── */}
        <aside className="sidebar hidden lg:flex">
          <div className="sidebar-inner">

            {/* Brand */}
            <div className="brand-row">
              <div className="brand-mark">PB</div>
              {!collapsed && (
                <div className="brand-copy">
                  <div className="brand-title">Pollinator Beekeeping</div>
                  <div className="brand-subtitle">Apitherapy</div>
                </div>
              )}
            </div>

            {/* Hamburger toggle */}
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className="hamburger-btn"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <HamburgerIcon open={!collapsed} />
            </button>

            {/* Nav */}
            <nav className="side-nav">
              {roleLoading ? (
                <div className="menu-loading">{collapsed ? "…" : "Loading menu…"}</div>
              ) : (
                navItems.map((item) => {
                  if (isGroup(item)) {
                    const groupActive = pathname.startsWith(item.href);

                    if (collapsed) {
                      // In collapsed mode show the group icon as a single entry
                      return (
                        <Tip key={item.href} label={item.label}>
                          <button
                            type="button"
                            onClick={() => setReportsOpen((v) => !v)}
                            className={`nav-link nav-group-trigger ${groupActive ? "active" : ""}`}
                          >
                            <span className="nav-icon">{Icons[item.icon]}</span>
                          </button>
                        </Tip>
                      );
                    }

                    return (
                      <div key={item.href} className="nav-group">
                        <button
                          type="button"
                          onClick={() => setReportsOpen((v) => !v)}
                          className={`nav-link nav-group-trigger ${groupActive ? "active" : ""}`}
                        >
                          <span className="nav-icon">{Icons[item.icon]}</span>
                          <span className="nav-label">{item.label}</span>
                          <span className={`nav-caret ${reportsOpen ? "caret-open" : ""}`}>
                            <svg viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style={{width:10,height:10}}>
                              <path d="M2 4.5l4 3 4-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </span>
                        </button>

                        {reportsOpen && (
                          <div className="nav-submenu">
                            {item.children.map((child) => {
                              const isActive = pathname === child.href || pathname.startsWith(child.href + "/");
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

              {/* Sales-clerk org link */}
              {!roleLoading && orgRole === "sales_clerk" && (
                <NavLink href="/dashboard/org" label="Organization" icon="org" />
              )}

              {/* Settings */}
              {!roleLoading && (
                <NavLink href="/dashboard/settings" label="Settings" icon="settings" />
              )}

              {/* Logout */}
              {collapsed ? (
                <Tip label="Logout">
                  <button onClick={handleLogout} className="nav-link logout-btn" aria-label="Logout">
                    <span className="nav-icon">{Icons.logout}</span>
                  </button>
                </Tip>
              ) : (
                <button onClick={handleLogout} className="nav-link logout-btn">
                  <span className="nav-icon">{Icons.logout}</span>
                  <span className="nav-label">Logout</span>
                </button>
              )}
            </nav>

            {/* Footer */}
            {!collapsed && (
              <div className="sidebar-footer">
                <div className="sidebar-footer-label">Workspace</div>
                <div className="sidebar-footer-value">{workspaceLabel}</div>
              </div>
            )}
          </div>
        </aside>

        {/* ── Main ── */}
        <main className="main-area">
          <header className="topbar">
            <div className="topbar-left">
              <div className="date-card">
                <div className="date-day">{today.day}</div>
                <div className="date-copy">
                  <div className="date-weekday">{today.weekday}</div>
                  <div className="date-month">{today.month} {today.year}</div>
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

        {/* ── Mobile nav ── */}
        <nav className="mobile-nav">
          {(roleLoading ? [] : navItems)
            .flatMap((item) => (isGroup(item) ? item.children : [item]))
            .map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
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
              className={`mobile-chip ${pathname.startsWith("/dashboard/settings") ? "active" : "idle"}`}
            >
              Settings
            </Link>
          )}
        </nav>

      </div>
    </OrgRoleProvider>
  );
}