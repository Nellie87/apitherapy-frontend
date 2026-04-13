"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600;700&display=swap');

        :root {
          --sidebar-bg: #111218;
          --sidebar-bg-2: #171923;
          --sidebar-border: rgba(255,255,255,0.08);
          --sidebar-text: #D6D7E3;
          --sidebar-text-dim: #7E8298;
          --sidebar-hover-bg: rgba(255,255,255,0.05);
          --sidebar-active-text: #FFFDF5;

          --accent: #F5C518;
          --accent-soft: rgba(245, 197, 24, 0.16);
          --accent-soft-2: rgba(245, 197, 24, 0.22);
          --accent-glow: rgba(245, 197, 24, 0.30);

          --main-bg: #F7F5EF;
          --main-bg-2: #FBF9F3;
          --card-bg: #FFFFFF;
          --card-border: #EADFC2;
          --card-border-soft: #F2EAD7;
          --card-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 10px 30px rgba(15, 23, 42, 0.06);

          --text-primary: #1E1B16;
          --text-secondary: #6A655B;
          --text-muted: #9A9386;
        }

        html, body {
          background: var(--main-bg);
          font-family: 'DM Sans', system-ui, sans-serif;
        }

        .font-display {
          font-family: 'DM Serif Display', Georgia, serif;
        }

        .shell-bg {
          background:
            radial-gradient(circle at top right, rgba(245, 197, 24, 0.08), transparent 28%),
            linear-gradient(180deg, var(--main-bg-2) 0%, var(--main-bg) 100%);
        }

        .sidebar {
          background:
            radial-gradient(circle at top left, rgba(245, 197, 24, 0.08), transparent 20%),
            linear-gradient(180deg, var(--sidebar-bg-2) 0%, var(--sidebar-bg) 100%);
        }

        /* Desktop Sidebar */
        .nav-link {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          border-radius: 16px;
          font-size: 14px;
          font-weight: 600;
          color: var(--sidebar-text);
          text-decoration: none;
          transition: all 0.18s ease;
          position: relative;
          border: 1px solid transparent;
          overflow: hidden;
        }

        .nav-link::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: linear-gradient(90deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01));
          opacity: 0;
          transition: opacity 0.18s ease;
          pointer-events: none;
        }

        .nav-link:hover {
          background: var(--sidebar-hover-bg);
          color: #FFFFFF;
          transform: translateX(2px);
          border-color: rgba(255,255,255,0.05);
        }

        .nav-link:hover::after {
          opacity: 1;
        }

        .nav-link.active {
          color: var(--sidebar-active-text);
          background: linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.025)),
                      linear-gradient(90deg, rgba(245,197,24,0.14), rgba(245,197,24,0.05));
          border-color: rgba(245,197,24,0.22);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.08),
                      inset 0 0 0 1px rgba(245,197,24,0.04),
                      0 0 0 1px rgba(245,197,24,0.06),
                      0 0 22px rgba(245,197,24,0.12);
        }

        .nav-link.active::before {
          content: '';
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: var(--accent);
          box-shadow: 0 0 0 4px rgba(245, 197, 24, 0.10),
                      0 0 18px rgba(245, 197, 24, 0.55);
        }

        .nav-icon {
          font-size: 15px;
          opacity: 0.95;
          width: 22px;
          text-align: center;
          flex-shrink: 0;
          transition: all 0.18s ease;
        }

        .nav-link.active .nav-icon {
          color: var(--accent);
          text-shadow: 0 0 18px rgba(245, 197, 24, 0.35);
        }

        /* Topbar */
        .topbar {
          height: 64px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 28px;
          background: rgba(255,255,255,0.72);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(234, 223, 194, 0.85);
          position: sticky;
          top: 0;
          z-index: 30;
        }

        .topbar-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          height: 36px;
          padding: 0 14px;
          border-radius: 999px;
          background: rgba(245, 197, 24, 0.10);
          border: 1px solid rgba(245, 197, 24, 0.22);
          color: #7A5A00;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.02em;
        }

        /* Mobile Navigation */
        .mobile-nav {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: rgba(17, 18, 24, 0.96);
          backdrop-filter: blur(20px);
          border-top: 1px solid var(--sidebar-border);
          z-index: 50;
          padding: 8px 12px 12px;
          display: none;
        }

        @media (max-width: 1024px) {
          .mobile-nav {
            display: flex;
            gap: 6px;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
          }
          
          .mobile-nav::-webkit-scrollbar {
            display: none;
          }
        }

        .mobile-chip {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          min-width: 68px;
          padding: 8px 6px;
          border-radius: 14px;
          font-size: 11px;
          font-weight: 600;
          text-align: center;
          text-decoration: none;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .mobile-chip.active {
          background: var(--accent);
          color: #2E2200;
          box-shadow: 0 4px 14px rgba(245, 197, 24, 0.35);
        }

        .mobile-chip.idle {
          color: var(--sidebar-text);
          background: rgba(255,255,255,0.05);
        }

        .mobile-chip .nav-icon {
          font-size: 18px;
        }

        /* Content adjustments */
        .content-shell {
          background: var(--card-bg);
          border-radius: 24px;
          border: 1px solid var(--card-border);
          box-shadow: var(--card-shadow);
          min-height: calc(100vh - 140px);
          overflow: hidden;
          position: relative;
        }

        .content-shell::before {
          content: "";
          position: absolute;
          inset: 0 0 auto 0;
          height: 88px;
          background: linear-gradient(180deg, rgba(245, 197, 24, 0.08), transparent);
          pointer-events: none;
        }

        /* Scrollbar */
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb {
          background: rgba(120,120,120,0.2);
          border-radius: 999px;
        }
      `}</style>

      <div className="shell-bg min-h-screen flex flex-col lg:flex-row">
        {/* Desktop Sidebar */}
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
          {/* Logo */}
          <div style={{ padding: "28px 20px 20px" }}>
            <div className="flex items-center gap-3">
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  background: "linear-gradient(135deg, #F8D54A 0%, #E2B11A 55%, #C9920A 100%)",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 22,
                  color: "#2B2100",
                  boxShadow: "0 10px 24px rgba(245,197,24,0.22), inset 0 1px 0 rgba(255,255,255,0.35)",
                }}
              >
                🐝
              </div>
              <div>
                <div className="font-display" style={{ color: "#FFFFFF", fontSize: 21, letterSpacing: "-0.4px" }}>
                  Pollinators
                </div>
                <div style={{ color: "var(--sidebar-text-dim)", fontSize: 11, fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase" }}>
                  Apitherapy
                </div>
              </div>
            </div>
          </div>

          <div style={{ padding: "0 20px 12px" }}>
            <span style={{ color: "var(--sidebar-text-dim)", fontSize: 10, fontWeight: 800, letterSpacing: "1.3px", textTransform: "uppercase" }}>
              MENU
            </span>
          </div>

          <nav style={{ padding: "0 14px", flex: 1 }}>
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
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

            <div className="nav-divider" style={{ height: 1, background: "var(--sidebar-border)", margin: "20px 0" }} />

            <div style={{ padding: "4px 4px 12px" }}>
              <span style={{ color: "var(--sidebar-text-dim)", fontSize: 10, fontWeight: 800, letterSpacing: "1.3px", textTransform: "uppercase" }}>
                ACCOUNT
              </span>
            </div>

            <Link
              href="/dashboard/settings"
              className={`nav-link ${pathname.startsWith("/dashboard/settings") ? "active" : ""}`}
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

          {/* Season Card */}
          <div style={{ padding: "20px" }}>
            <div
              style={{
                background: "linear-gradient(180deg, rgba(245,197,24,0.14), rgba(245,197,24,0.08))",
                border: "1px solid rgba(245,197,24,0.20)",
                borderRadius: 18,
                padding: "16px",
                boxShadow: "0 10px 24px rgba(245,197,24,0.08)",
              }}
            >
              <div style={{ color: "#A36E00", fontSize: 11, fontWeight: 800, letterSpacing: "0.8px" }}>
                SEASON 2025
              </div>
              <div style={{ color: "#F8F2E4", fontSize: 13.5, marginTop: 6, fontWeight: 600 }}>
                Harvest active
              </div>
            </div>
          </div>
        </aside>

        {/* Mobile Top Bar + Bottom Navigation */}
        <div className="lg:hidden">
          {/* Mobile Top Bar */}
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

          {/* Mobile Bottom Navigation */}
          <div className="mobile-nav">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
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

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 lg:ml-0">
          {/* Desktop Topbar */}
          <div className="topbar hidden lg:flex">
            <div style={{ color: "var(--text-secondary)", fontSize: 13.5, fontWeight: 600 }}>
              {new Date().toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
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

          {/* Page Content */}
          <div className="lg:p-8 p-4 pt-5 lg:pt-8 mt-[60px] lg:mt-0">
            <div className="content-shell">
              <div style={{ padding: "28px 32px", position: "relative", zIndex: 1 }}>
                {children}
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}