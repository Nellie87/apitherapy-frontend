import type { ReactNode } from "react";
import Link from "next/link";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-100/70">
      <div className="mx-auto flex max-w-[1280px] gap-6 p-6">
        {/* Sidebar */}
        <aside className="hidden lg:block w-[260px]">
          <div className="rounded-3xl border border-zinc-200/70 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-500 text-white">
                🍯
              </div>
              <div>
                <div className="text-sm font-black text-zinc-900">BeeShop</div>
                <div className="text-[11px] text-zinc-500">Dashboard</div>
              </div>
            </div>

            <nav className="mt-6 space-y-1">
              <SideLink href="/dashboard/products" label="Products" />
              <SideLink href="/dashboard/inventory" label="Inventory" />
              <SideLink href="/dashboard/sales" label="Sales" />
              <SideLink href="/dashboard/expenses" label="Expenses" />
              <SideLink href="/dashboard/reports" label="Reports" />
            </nav>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1">
          <div className="rounded-3xl border border-zinc-200/70 bg-white p-5 shadow-sm">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function SideLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-2xl px-3 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
    >
      <span>{label}</span>
      <span className="text-zinc-400">›</span>
    </Link>
  );
}
