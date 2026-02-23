// app/(dashboard)/layout.tsx
import type { ReactNode } from "react";
import Link from "next/link";

const navItems = [
  { href: "/dashboard",          label: "Dashboard" },
  { href: "/dashboard/inventory", label: "Our Stock" },
  { href: "/dashboard/products",  label: "Products" },
  { href: "/dashboard/sales",     label: "Sales" },
  { href: "/dashboard/reports",   label: "Reports" },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=DM+Sans:wght@300;400;500;700&display=swap');

        .dashboard-layout * {
          font-family: 'DM Sans', system-ui, sans-serif;
        }
        .dashboard-layout .font-display {
          font-family: 'Playfair Display', serif;
        }

        .nav-link {
          transition: all 0.16s ease;
        }
        .nav-link:hover {
          background: #FFF9DC;
          color: #926E0A;
          transform: translateX(4px);
        }
        .nav-link.active {
          background: #FFF2CC;
          color: #926E0A;
          font-weight: 600;
        }
      `}</style>

      <div className="dashboard-layout min-h-screen bg-[#FFFEF5]">
        <div className="mx-auto flex max-w-[1600px] flex-col lg:flex-row gap-6 p-4 sm:p-6 lg:p-8">
          {/* Sidebar */}
          <aside className="lg:w-[300px] lg:shrink-0">
            <div
              className="rounded-3xl shadow-sm overflow-hidden"
              style={{
                background: "white",
                border: "1px solid rgba(245,197,24,0.18)",
              }}
            >
              {/* Brand / Header */}
              <div className="relative">
                <div style={{ height: 5, background: "linear-gradient(90deg, #F5C518, #FFE566, #F5C518)" }} />
                <div className="px-6 pt-7 pb-6">
                  <div className="flex items-center gap-4">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#FFF9DC] text-3xl shadow-sm">
                      🐝
                    </div>
                    <div>
                      <div className="font-display text-2xl font-bold text-[#1a1a0a] leading-none">
                        Pollinators
                      </div>
                      <div className="text-xs text-[#777766] mt-1 tracking-wide">
                        Beekeepers Apitherapy
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <div className="px-3 pb-6">
                <div className="space-y-1.5">
                  {navItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`nav-link flex items-center justify-between rounded-2xl px-5 py-3 text-sm font-medium text-[#555540] hover:bg-[#FFF9DC] hover:text-[#926E0A]`}
                    >
                      <span>{item.label}</span>
                      <span className="text-[#F5C518] opacity-60 text-lg">›</span>
                    </Link>
                  ))}
                </div>

                {/* Secondary links */}
                <div className="mt-8 pt-6 border-t border-[#F5C518]/10 space-y-1.5">
                  <Link
                    href="/dashboard/settings"
                    className="nav-link flex items-center rounded-2xl px-5 py-3 text-sm font-medium text-[#777766] hover:bg-[#FFF9DC] hover:text-[#926E0A]"
                  >
                    Settings
                  </Link>
                  <Link
                    href="/login"
                    className="nav-link flex items-center rounded-2xl px-5 py-3 text-sm font-medium text-[#777766] hover:bg-[#FFF9DC] hover:text-[#926E0A]"
                  >
                    Logout
                  </Link>
                </div>
              </div>
            </div>
          </aside>

          {/* Main content area */}
          <main className="flex-1 min-w-0">
            <div className="rounded-3xl shadow-sm" style={{ background: "white", border: "1px solid rgba(245,197,24,0.12)" }}>
              <div className="p-6 lg:p-8">{children}</div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}