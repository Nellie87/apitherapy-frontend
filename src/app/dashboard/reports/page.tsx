"use client";

import Link from "next/link";
import * as S from "./page.styles";

export default function ReportsHomePage() {
  const cards = [
    {
      title: "Sales Summary",
      desc: "Totals by day, date range, downloadable CSV",
      href: "/dashboard/reports/sales",
      icon: "🧾",
    },
    // next ones we’ll add:
    { title: "Inventory Valuation", desc: "Stock value per product + totals", href: "#", icon: "📦" },
    { title: "Discount Report", desc: "Which products got discounts", href: "#", icon: "🏷️" },
    { title: "Expenses Summary", desc: "Spend by category + totals", href: "#", icon: "💳" },
  ];

  return (
    <div className="space-y-6">
      <div className={`${S.card} p-6`}>
        <div className="text-3xl font-black text-slate-900">Reports</div>
        <div className="mt-1 text-sm text-slate-500">
          Sales · Inventory · Discounts · Expenses (downloadable)
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {cards.map((c) => (
          <Link
            key={c.title}
            href={c.href}
            className={`${S.card} p-6 hover:bg-slate-50 transition`}
          >
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-50 text-xl">
                {c.icon}
              </div>
              <div className="min-w-0">
                <div className="text-lg font-black text-slate-900">{c.title}</div>
                <div className="mt-1 text-sm text-slate-500">{c.desc}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}