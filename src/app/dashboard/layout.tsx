import type { ReactNode } from "react";
import Link from "next/link";

const nav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/inventory", label: "Our Stock" },
  { href: "/dashboard/products", label: "Products we have" },
  { href: "/dashboard/sales", label: "Sales" },
  { href: "/dashboard/reports", label: "Reports" },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto flex max-w-[1400px] gap-6 p-6">
        {/* Sidebar */}
        <aside className="w-[280px] shrink-0">
          <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
            {/* Brand */}
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-500 text-white">
                🐝
              </div>
              <div>
                <div className="text-sm font-black text-zinc-900">Pollinators</div>
                <div className="text-xs text-zinc-500">Beekeepers Apitherapy</div>
              </div>
            </div>

            <div className="mt-6 space-y-1">
              {nav.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="flex items-center justify-between rounded-2xl px-3 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  <span>{n.label}</span>
                  <span className="text-zinc-300">›</span>
                </Link>
              ))}
            </div>

            <div className="mt-10 border-t pt-4">
              <Link
                href="/dashboard/settings"
                className="block rounded-2xl px-3 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Settings
              </Link>
              <Link
                href="/login"
                className="block rounded-2xl px-3 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Logout
              </Link>
            </div>
          </div>
        </aside>

        {/* Page */}
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}