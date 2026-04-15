"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import "./dashboard-shell.css";

const navItems = [
  { href: "/dashboard/summarydashboard", label: "Dashboard", icon: "⊞" },
  { href: "/dashboard/inventory", label: "Our Stock", icon: "◫" },
  { href: "/dashboard/products", label: "Products", icon: "◈" },
  { href: "/dashboard/sales", label: "Sales", icon: "◉" },
  { href: "/dashboard/reports", label: "Reports", icon: "◧" },
  { href: "/dashboard/expenses", label: "Expenses", icon: "◨" },
  { href: "/dashboard/suppliers", label: "Suppliers", icon: "◎" },
];

export default function DashboardShell({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
                Apitherapy
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
          {navItems.map((item) => {
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
          {navItems.map((item) => {
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

          <div className="topbar-badge">
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#D4A017",
                display: "inline-block",
              }}
            />
            Live operations
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
  );
}