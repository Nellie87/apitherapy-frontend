"use client";

import React, { useEffect, useMemo, useState } from "react";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import { listSales, type SaleRow } from "@/lib/api/sales";
import * as S from "./page.styles";

function fmtMoney(v: number) {
  return `Ksh ${Number(v || 0).toFixed(2)}`;
}

export default function SalesPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");

  async function refresh(o: string) {
    const data = await listSales(o);
    setRows(data);
  }

  useEffect(() => {
    (async () => {
      try {
        const o = await bootstrapOrg();
        setOrgId(o);
        await refresh(o);
      } catch (e: any) {
        setErr(e.message ?? String(e));
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((s) => {
      return (
        s.sale_no.toLowerCase().includes(t) ||
        (s.customer_name ?? "").toLowerCase().includes(t)
      );
    });
  }, [rows, q]);

  const kpis = useMemo(() => {
    const totalSales = rows.length;
    const totalRevenue = rows.reduce((sum, r) => sum + Number(r.total ?? 0), 0);
    const totalDiscounts = rows.reduce((sum, r) => sum + Number(r.discount_total ?? 0), 0);
    return { totalSales, totalRevenue, totalDiscounts };
  }, [rows]);

  if (!orgId && !err) return <div className="p-6">Loading…</div>;

  return (
    <div className="space-y-6">
      <div className={`${S.card} p-6`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-3xl font-black text-zinc-900">Sales</div>
            <div className="mt-1 text-sm text-zinc-500">Track completed sales and totals</div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              className={S.input}
              placeholder="Search sale no / customer..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <a href="/dashboard/sales/new" className={S.btnPrimary}>
              + New Sale
            </a>
          </div>
        </div>
      </div>

      {err ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
          {err}
        </div>
      ) : null}

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className={`${S.card} p-6`}>
          <div className="text-[11px] font-black uppercase tracking-wide text-zinc-500">Total Sales</div>
          <div className="mt-3 text-4xl font-black text-zinc-900">{kpis.totalSales}</div>
        </div>

        <div className={`${S.card} p-6`}>
          <div className="text-[11px] font-black uppercase tracking-wide text-zinc-500">Revenue</div>
          <div className="mt-3 text-4xl font-black text-zinc-900">{fmtMoney(kpis.totalRevenue)}</div>
        </div>

        <div className={`${S.card} p-6`}>
          <div className="text-[11px] font-black uppercase tracking-wide text-zinc-500">Discounts</div>
          <div className="mt-3 text-4xl font-black text-zinc-900">{fmtMoney(kpis.totalDiscounts)}</div>
        </div>
      </div>

      {/* Table */}
      <div className={`${S.card} overflow-hidden`}>
        <div className="px-6 py-4">
          <div className={`${S.tableHead}`} style={{ gridTemplateColumns: "1.2fr 1.4fr 1fr 1fr" }}>
            <div>Sale No</div>
            <div>Customer</div>
            <div>Date</div>
            <div className="text-right">Total</div>
          </div>
        </div>

        <div className="divide-y divide-zinc-200">
          {filtered.map((s) => (
            <div
              key={s.id}
              className="grid items-center px-6 py-4 text-sm text-zinc-800 hover:bg-zinc-50"
              style={{ gridTemplateColumns: "1.2fr 1.4fr 1fr 1fr" }}
            >
              <div className="font-black">{s.sale_no}</div>
              <div className="text-zinc-600">{s.customer_name ?? "—"}</div>
              <div className="text-zinc-500">
                {new Date(s.created_at).toLocaleString()}
              </div>
              <div className="text-right font-black">{fmtMoney(Number(s.total ?? 0))}</div>
            </div>
          ))}

          {filtered.length === 0 ? (
            <div className="px-6 py-10 text-sm text-zinc-500">No sales yet. Create one.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
