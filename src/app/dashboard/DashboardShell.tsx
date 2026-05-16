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

type NavItem = { href: string; label: string; icon: string };

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
  const [orgRole, setOrgRole] = useState<OrgRole | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await bootstrapOrg();
        if (cancelled) return;
        const oid = getOrgId();
        const r = await fetchMyOrgRole(oid);
        if (!cancelled) setOrgRole(r);
      } catch {
        if (!cancelled) setOrgRole("admin");
      } finally {
        if (!cancelled) setRoleLoading(false);
      }
    })();
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
    router.replace("/login");
    router.refresh();
  }

  const formattedDate = mounted
    ? new Date().toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  return (
    <OrgRoleProvider role={orgRole} loading={roleLoading}>
    <div className="shell-bg min-h-screen flex flex-col lg:flex-row">
      <aside
        className="sidebar hidden lg:flex flex-col flex-shrink-0"
        style={{
          width: 260,
          borderRight: "1px solid var(--sidebar-border)",
          position: "sticky",
          top: 0,
          height: "100vh",
          overflowY: "auto",
        }}
      >
        <div style={{ padding: "28px 20px 20px" }}>
          <div className="flex items-center gap-3">
            <div
              
            >
              
            </div>
            <div>
              <div
                className="font-display"
                style={{ color: "#FFFFFF", fontSize: 21, letterSpacing: "-0.4px" }}
              >
                Pollinator Beekeeping & Apitherapy
              </div>
              <div
                style={{
                  color: "var(--sidebar-text-dim)",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "1.2px",
                  textTransform: "uppercase",
                }}
              >
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: "0 20px 12px" }}>
          <span
            style={{
              color: "var(--sidebar-text-dim)",
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "1.3px",
              textTransform: "uppercase",
            }}
          >
            MENU
          </span>
        </div>

        <nav style={{ padding: "0 14px", flex: 1 }}>
          {roleLoading && (
            <div
              style={{
                padding: "12px 14px",
                color: "var(--sidebar-text-dim)",
                fontSize: 13,
              }}
            >
              Loading menu…
            </div>
          )}
          {!roleLoading &&
            navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link ${isActive ? "active" : ""}`}
                style={{ marginBottom: 6, paddingLeft: isActive ? 28 : 14 }}
              >
                <span className="nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}

          <div
            className="nav-divider"
            style={{ height: 1, background: "var(--sidebar-border)", margin: "20px 0" }}
          />

          <div style={{ padding: "4px 4px 12px" }}>
            <span
              style={{
                color: "var(--sidebar-text-dim)",
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "1.3px",
                textTransform: "uppercase",
              }}
            >
              ACCOUNT
            </span>
          </div>

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
            className="nav-link logout-link"
            style={{ color: "#FF8080", marginTop: 4 }}
          >
            <span className="nav-icon">→</span>
            <span>Log out</span>
          </button>
        </nav>

      </aside>

      <div className="lg:hidden">
        <div
          className="fixed top-0 left-0 right-0 z-50"
          style={{
            background: "rgba(17,18,24,0.96)",
            backdropFilter: "blur(16px)",
            borderBottom: "1px solid var(--sidebar-border)",
          }}
        >
          <div className="flex items-center justify-between px-5" style={{ height: 60 }}>
            <div className="flex items-center gap-2.5">
              <span style={{ fontSize: 24 }}>🐝</span>
              <span className="font-display" style={{ color: "#FFF", fontSize: 18.5 }}>
                Pollinators
              </span>
            </div>

            <div
              style={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: "var(--accent)",
                boxShadow: "0 0 18px rgba(245,197,24,0.7)",
              }}
            />
          </div>
        </div>

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
            <>
              <Link
                href="/dashboard/org"
                className={`mobile-chip ${
                  pathname.startsWith("/dashboard/org") ? "active" : "idle"
                }`}
              >
                <span className="nav-icon">🏢</span>
                <span>Org</span>
              </Link>
              <Link
                href="/dashboard/settings"
                className={`mobile-chip ${
                  pathname.startsWith("/dashboard/settings") ? "active" : "idle"
                }`}
              >
                <span className="nav-icon">⚙</span>
                <span>Settings</span>
              </Link>
            </>
          )}
          {!roleLoading && orgRole !== "sales_clerk" && (
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
      </div>

      <main className="flex-1 min-w-0 lg:ml-0">
        <div className="topbar hidden lg:flex">
          <div
            suppressHydrationWarning
            style={{ color: "var(--text-secondary)", fontSize: 13.5, fontWeight: 600 }}
          >
            {formattedDate}
          </div>

              
        </div>

        <div className="lg:p-8 p-4 pt-5 lg:pt-8 mt-[60px] lg:mt-0">
          <div className="content-shell">
            <div style={{ padding: "28px 32px", position: "relative", zIndex: 1 }}>
              {children}
            </div>
          </div>
        </div>
      </main>
    </div>
    </OrgRoleProvider>
  );
}