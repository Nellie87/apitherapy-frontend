"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import { getInventoryValuation, type InventoryValuationRow } from "@/lib/api/reports";
import * as S from "../page.styles";

type Filter = "all" | "low" | "out";

function fmtMoney(v: number) {
  return `Ksh ${Number(v || 0).toLocaleString("en-KE", { minimumFractionDigits: 0 })}`;
}

function downloadCSV(filename: string, rows: Record<string, any>[]) {
  const headers = Object.keys(rows[0] ?? {});
  const escape = (v: any) => {
    const s = String(v ?? "");
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}

function StatusBadge({ status }: { status: InventoryValuationRow["status"] }) {
  if (status === "out")
    return <span className={`${S.badge} bg-red-100 text-red-700`}>🚫 Out</span>;
  if (status === "critical")
    return <span className={`${S.badge} bg-orange-100 text-orange-700`}>🔥 Critical</span>;
  if (status === "low")
    return <span className={`${S.badge} bg-amber-100 text-amber-700`}>📉 Low</span>;
  return <span className={`${S.badge} bg-emerald-100 text-emerald-700`}>✅ OK</span>;
}

export default function InventoryValuationReportPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [rows, setRows] = useState<InventoryValuationRow[]>([]);
  const [totals, setTotals] = useState({
    products_count: 0,
    total_qty: 0,
    low_count: 0,
    out_count: 0,
    total_value: 0,
  });

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const o = await bootstrapOrg();
        setOrgId(o);
      } catch (e: any) {
        setErr(e.message ?? String(e));
      }
    })();
  }, []);

  async function run() {
    if (!orgId) return;
    setLoading(true);
    setErr("");
    try {
      const res = await getInventoryValuation(orgId);
      setRows(res.rows);
      setTotals(res.totals);
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (orgId) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();

    return rows.filter((r) => {
      const matchesText =
        !term ||
        (r.name ?? "").toLowerCase().includes(term) ||
        (r.sku ?? "").toLowerCase().includes(term) ||
        (r.category ?? "").toLowerCase().includes(term);

      const matchesFilter =
        filter === "all" ||
        (filter === "out" && r.status === "out") ||
        (filter === "low" && (r.status === "low" || r.status === "critical"));

      return matchesText && matchesFilter;
    });
  }, [rows, q, filter]);

  const csvRows = useMemo(() => {
    return filtered.map((r) => ({
      product_id: r.product_id,
      name: r.name,
      sku: r.sku ?? "",
      category: r.category ?? "",
      unit_price: r.unit_price,
      qty_on_hand: r.qty_on_hand,
      reorder_level: r.reorder_level,
      status: r.status,
      total_value: r.total_value,
      updated_at: r.updated_at,
    }));
  }, [filtered]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`${S.card} p-6`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-3xl font-black text-slate-900">Inventory Valuation</div>
            <div className="mt-1 text-sm text-slate-500">
              Total value per product = qty × unit price · downloadable CSV
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link href="/dashboard/reports" className={S.btnGhost}>
              ← Reports
            </Link>
            <button className={S.btnGhost} onClick={run} disabled={loading || !orgId}>
              ↻ Refresh
            </button>
            <button
              className={S.btnGhost}
              disabled={csvRows.length === 0}
              onClick={() => downloadCSV(`inventory-valuation_${new Date().toISOString().slice(0, 10)}.csv`, csvRows)}
            >
              ⬇ Download CSV
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="md:col-span-2">
            <input
              className={S.input}
              placeholder="Search name / SKU / category..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <button
              className={S.btnGhost}
              onClick={() => setFilter("all")}
              style={{ opacity: filter === "all" ? 1 : 0.7 }}
            >
              All
            </button>
            <button
              className={S.btnGhost}
              onClick={() => setFilter("low")}
              style={{ opacity: filter === "low" ? 1 : 0.7 }}
            >
              Low
            </button>
            <button
              className={S.btnGhost}
              onClick={() => setFilter("out")}
              style={{ opacity: filter === "out" ? 1 : 0.7 }}
            >
              Out
            </button>
          </div>
        </div>
      </div>

      {err ? <div className={S.alert}>{err}</div> : null}

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className={`${S.card} p-6`}>
          <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">Products</div>
          <div className="mt-3 text-4xl font-black text-slate-900">{totals.products_count}</div>
        </div>

        <div className={`${S.card} p-6`}>
          <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">Total Qty</div>
          <div className="mt-3 text-4xl font-black text-slate-900">{totals.total_qty}</div>
        </div>

        <div className={`${S.card} p-6`}>
          <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">Low / Critical</div>
          <div className="mt-3 text-4xl font-black text-amber-700">{totals.low_count}</div>
        </div>

        <div className={`${S.card} p-6`}>
          <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">Total Value</div>
          <div className="mt-3 text-4xl font-black text-slate-900">{fmtMoney(totals.total_value)}</div>
        </div>
      </div>

      {/* Table */}
      <div className={`${S.card} overflow-hidden`}>
        <div className="px-6 py-4">
          <div className={S.tableHead} style={{ gridTemplateColumns: "2fr 1.1fr .8fr .9fr 1fr 1fr" }}>
            <div>Product</div>
            <div>Category</div>
            <div>On Hand</div>
            <div>Status</div>
            <div>Unit Price</div>
            <div className="text-right">Total Value</div>
          </div>
        </div>

        <div className="divide-y divide-slate-200">
          {loading ? (
            <div className="px-6 py-10 text-sm text-slate-500">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-10 text-sm text-slate-500">No results.</div>
          ) : (
            filtered.map((r) => (
              <div
                key={r.product_id}
                className="grid items-center px-6 py-4 text-sm text-slate-800 hover:bg-slate-50"
                style={{ gridTemplateColumns: "2fr 1.1fr .8fr .9fr 1fr 1fr" }}
              >
                <div className="min-w-0">
                  <div className="font-black text-slate-900 truncate">{r.name}</div>
                  <div className="text-xs text-slate-400 truncate">
                    {r.sku ? `SKU: ${r.sku}` : "—"} · Reorder: {r.reorder_level}
                  </div>
                </div>

                <div className="text-slate-600">{r.category ?? "—"}</div>
                <div className="font-black">{r.qty_on_hand}</div>
                <div>
                  <StatusBadge status={r.status} />
                </div>
                <div>{fmtMoney(r.unit_price)}</div>
                <div className="text-right font-black">{fmtMoney(r.total_value)}</div>
              </div>
            ))
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
          <span>Showing {filtered.length} of {rows.length}</span>
          <span>{filter !== "all" ? `Filter: ${filter}` : ""}</span>
        </div>
      </div>
    </div>
  );
}