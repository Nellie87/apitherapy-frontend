"use client";

import Link from "next/link";
import * as S from "./page.styles";

export default function ReportsHomePage() {
  const cards = [
    {
      title: "Sales report",
      desc: "Revenue trend, weekday mix, products, and dead stock",
      href: "/dashboard/reports/sales-analytics",
    },
    {
      title: "Inventory",
      desc: "Stock value, coverage, and reorder priority",
      href: "/dashboard/reports/inventory",
    },
    {
      title: "Discount report",
      desc: "What was discounted and how it moved the basket",
      href: "/dashboard/reports/discounts",
    },
    {
      title: "Revenue health",
      desc: "Sales, services, expenses, and profit",
      href: "/dashboard/reports/revenue-health",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a6a00]">
          Analytics
        </div>
        <h1 className="mt-2 font-display text-4xl tracking-tight text-[#1f1b14]">
          Reports
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#766b59]">
          Downloadable views of sales, stock, discounts, and profit.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {cards.map((c) => (
          <Link
            key={c.title}
            href={c.href}
            className={`${S.card} group p-6 transition hover:-translate-y-0.5 hover:border-[rgba(215,168,32,0.35)]`}
          >
            <div className="h-1 w-8 rounded-full bg-[#d7a820] transition group-hover:w-12" />
            <div className="mt-4 text-lg font-semibold tracking-tight text-[#1f1b14]">
              {c.title}
            </div>
            <div className="mt-1.5 text-sm leading-relaxed text-[#766b59]">
              {c.desc}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
