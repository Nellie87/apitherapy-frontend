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
  { href: "/dashboard/expenses", label: "Expenses", icon: "◧" },
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
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600;700&display=swap');

        :root {
          --sidebar-bg:         #1A1A24;
          --sidebar-border:     rgba(255,255,255,0.07);
          --sidebar-text:       #C8C8D8;
          --sidebar-text-dim:   #6E6E82;
          --sidebar-hover-bg:   rgba(255, 255, 255, 0.06);
          --sidebar-active-bg:  #2A2A3A;
          --sidebar-active-text:#FFFFFF;

          --accent:             #F5C518;

          --main-bg:            #F4F5F7;
          --surface-bg:         #FFFFFF;
          --surface-border:     #E4E6EB;
          --surface-shadow:     0 1px 3px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.05);

          --topbar-bg:          rgba(255,255,255,0.72);
          --topbar-border:      #E4E6EB;

          --text-primary:       #17171F;
          --text-secondary:     #4A4A5A;

          font-family: 'DM Sans', system-ui, sans-serif;
        }

        .font-display {
          font-family: 'DM Serif Display', Georgia, serif;
        }

        .nav-link {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 500;
          color: var(--sidebar-text);
          text-decoration: none;
          transition: background 0.15s ease, color 0.15s ease;
          position: relative;
        }

        .nav-link:hover {
          background: var(--sidebar-hover-bg);
          color: #FFFFFF;
        }

        .nav-link.active {
          background: var(--sidebar-active-bg);
          color: var(--sidebar-active-text);
        }

        .nav-link.active::before {
          content: "";
          position: absolute;
          left: 0;
          top: 20%;
          height: 60%;
          width: 3px;
          background: var(--accent);
          border-radius: 0 3px 3px 0;
        }

        .nav-icon {
          font-size: 16px;
          opacity: 0.9;
          width: 20px;
          text-align: center;
          flex-shrink: 0;
        }

        .topbar {
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 28px;
          background: var(--topbar-bg);
          border-bottom: 1px solid var(--topbar-border);
          backdrop-filter: blur(10px);
          position: sticky;
          top: 0;
          z-index: 30;
        }

        .nav-divider {
          height: 1px;
          background: var(--sidebar-border);
          margin: 12px 0;
        }

        .logout-link {
          color: #FF6B6B !important;
          background: none;
          border: none;
          width: 100%;
          text-align: left;
          cursor: pointer;
        }

        .logout-link:hover {
          background: rgba(255, 107, 107, 0.1) !important;
          color: #FF8A8A !important;
        }

        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }

        ::-webkit-scrollbar-track {
          background: transparent;
        }

        ::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 3px;
        }
      `}</style>

      <div
        className="flex min-h-screen"
        style={{
          background: "var(--main-bg)",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <aside
          className="hidden lg:flex flex-col flex-shrink-0"
          style={{
            width: 240,
            background: "var(--sidebar-bg)",
            borderRight: "1px solid var(--sidebar-border)",
            position: "sticky",
            top: 0,
            height: "100vh",
            overflowY: "auto",
          }}
        >
          <div style={{ padding: "24px 20px 20px" }}>
            <div className="flex items-center gap-3">
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: "linear-gradient(135deg, #F5C518 0%, #D4A017 100%)",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 20,
                  flexShrink: 0,
                }}
              >
                🐝
              </div>

              <div>
                <div
                  className="font-display"
                  style={{
                    color: "#FFFFFF",
                    fontSize: 18,
                    lineHeight: 1.2,
                    letterSpacing: "-0.3px",
                  }}
                >
                  Pollinators
                </div>

                <div
                  style={{
                    color: "var(--sidebar-text-dim)",
                    fontSize: 11,
                    marginTop: 2,
                    fontWeight: 500,
                    letterSpacing: "0.5px",
                    textTransform: "uppercase",
                  }}
                >
                  Apitherapy
                </div>
              </div>
            </div>
          </div>

          <div style={{ padding: "4px 20px 8px" }}>
            <span
              style={{
                color: "var(--sidebar-text-dim)",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "1.2px",
                textTransform: "uppercase",
              }}
            >
              Menu
            </span>
          </div>

          <nav style={{ padding: "0 12px", flex: 1 }}>
            {navItems.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + "/");

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-link ${isActive ? "active" : ""}`}
                  style={{ marginBottom: 2 }}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}

            <div className="nav-divider" style={{ margin: "16px 0" }} />

            <div style={{ padding: "4px 2px 8px" }}>
              <span
                style={{
                  color: "var(--sidebar-text-dim)",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "1.2px",
                  textTransform: "uppercase",
                }}
              >
                Account
              </span>
            </div>

            <Link href="/dashboard/settings" className="nav-link" style={{ marginBottom: 2 }}>
              <span className="nav-icon">◎</span>
              <span>Settings</span>
            </Link>

            <button onClick={handleLogout} className="nav-link logout-link">
              <span className="nav-icon">→</span>
              <span>Log out</span>
            </button>
          </nav>

          <div style={{ padding: "16px 20px" }}>
            <div
              style={{
                background: "rgba(245,197,24,0.1)",
                border: "1px solid rgba(245,197,24,0.2)",
                borderRadius: 8,
                padding: "10px 12px",
              }}
            >
              <div
                style={{
                  color: "#F5C518",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.5px",
                }}
              >
                SEASON 2025
              </div>

              <div
                style={{
                  color: "var(--sidebar-text)",
                  fontSize: 12,
                  marginTop: 3,
                }}
              >
                Harvest active
              </div>
            </div>
          </div>
        </aside>

        <div
          className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4"
          style={{
            height: 56,
            background: "var(--sidebar-bg)",
            borderBottom: "1px solid var(--sidebar-border)",
          }}
        >
          <div className="flex items-center gap-2.5">
            <span style={{ fontSize: 22 }}>🐝</span>
            <span className="font-display" style={{ color: "#FFF", fontSize: 17 }}>
              Pollinators
            </span>
          </div>

          <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
            {navItems.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + "/");

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    padding: "5px 10px",
                    borderRadius: 7,
                    fontSize: 12,
                    fontWeight: 500,
                    color: isActive ? "#111" : "var(--sidebar-text)",
                    background: isActive ? "var(--accent)" : "transparent",
                    textDecoration: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        <main className="flex-1 min-w-0">
          <div className="topbar">
            <div
              style={{
                color: "var(--text-secondary)",
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {new Date().toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </div>
          </div>

          <div className="p-4 pt-4 lg:p-8 lg:pt-6 mt-14 lg:mt-0">
            {children}
          </div>
        </main>
      </div>
    </>
  );
}