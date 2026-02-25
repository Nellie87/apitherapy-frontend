"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import { getDiscountReport, type DiscountReportRow } from "@/lib/api/reports";
import * as S from "../page.styles";

function fmtMoney(v: number) {
  return `Ksh ${Number(v || 0).toLocaleString("en-KE", { minimumFractionDigits: 0 })}`;
}

function fmtDate(d: string) {
  try {
    return new Date(d).toLocaleString();
  } catch {
    return d;
  }
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

export default function DiscountsReportPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [rows, setRows] = useState<DiscountReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // filters
  const [from, setFrom] = useState<string>(""); // YYYY-MM-DD
  const [to, setTo] = useState<string>("");     // YYYY-MM-DD
  const [q, setQ] = useState<string>("");

  const totals = useMemo(() => {
    const discounted_lines = rows.length;
    const discounted_qty = rows.reduce((s, r) => s + Number(r.qty ?? 0), 0);
    const total_saved = rows.reduce((s, r) => s + Number(r.saved_total ?? 0), 0);
    return { discounted_lines, discounted_qty, total_saved };
  }, [rows]);

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
      const res = await getDiscountReport(orgId, { from: from || undefined, to: to || undefined });
      setRows(res.rows);
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
    if (!term) return rows;
    return rows.filter((r) => {
      return (
        (r.name ?? "").toLowerCase().includes(term) ||
        (r.sku ?? "").toLowerCase().includes(term) ||
        (r.category ?? "").toLowerCase().includes(term) ||
        (r.sale_no ?? "").toLowerCase().includes(term) ||
        (r.customer_name ?? "").toLowerCase().includes(term)
      );
    });
  }, [rows, q]);

  const byProduct = useMemo(() => {
    const map = new Map<string, { name: string; sku: string | null; category: string | null; qty: number; saved: number }>();
    for (const r of filtered) {
      const key = r.product_id;
      const cur = map.get(key) ?? { name: r.name, sku: r.sku ?? null, category: r.category ?? null, qty: 0, saved: 0 };
      cur.qty += r.qty;
      cur.saved += r.saved_total;
      map.set(key, cur);
    }
    return Array.from(map.entries())
      .map(([product_id, v]) => ({ product_id, ...v }))
      .sort((a, b) => b.saved - a.saved);
  }, [filtered]);

  const csvRows = useMemo(() => {
    return filtered.map((r) => ({
      sale_no: r.sale_no,
      customer_name: r.customer_name ?? "",
      sold_at: r.sold_at,
      product_name: r.name,
      sku: r.sku ?? "",
      category: r.category ?? "",
      qty: r.qty,
      base_price: r.base_price,
      discount_per_unit: r.discount_per_unit,
      final_price: r.final_price,
      saved_total: r.saved_total,
    }));
  }, [filtered]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`${S.card} p-6`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-3xl font-black text-slate-900">Discounts Report</div>
            <div className="mt-1 text-sm text-slate-500">
              Shows discounted items, totals saved, and which products were discounted
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link href="/dashboard/reports" className={S.btnGhost}>
              ← Reports
            </Link>
            <button className={S.btnGhost} onClick={run} disabled={loading || !orgId}>
              ↻ Run
            </button>
            <button
              className={S.btnGhost}
              disabled={csvRows.length === 0}
              onClick={() => downloadCSV(`discounts_${new Date().toISOString().slice(0, 10)}.csv`, csvRows)}
            >
              ⬇ Download CSV
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <input className={S.input} placeholder="Search product / sale / customer..." value={q} onChange={(e) => setQ(e.target.value)} />
          <input className={S.input} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input className={S.input} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <button className={S.btnPrimary} onClick={run} disabled={loading || !orgId}>
            {loading ? "Running…" : "Apply"}
          </button>
        </div>
      </div>

      {err ? <div className={S.alert}>{err}</div> : null}

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className={`${S.card} p-6`}>
          <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">Discounted Lines</div>
          <div className="mt-3 text-4xl font-black text-slate-900">{totals.discounted_lines}</div>
        </div>
        <div className={`${S.card} p-6`}>
          <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">Discounted Qty</div>
          <div className="mt-3 text-4xl font-black text-slate-900">{totals.discounted_qty}</div>
        </div>
        <div className={`${S.card} p-6`}>
          <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">Total Saved</div>
          <div className="mt-3 text-4xl font-black text-amber-700">{fmtMoney(totals.total_saved)}</div>
        </div>
      </div>

      {/* By Product (who got discounts) */}
      <div className={`${S.card} overflow-hidden`}>
        <div className="px-6 py-4">
          <div className="text-lg font-black text-slate-900">Products Given Discounts</div>
          <div className="mt-1 text-sm text-slate-500">Grouped summary (highest savings first)</div>
        </div>

        <div className="px-6 pb-4">
          <div className={S.tableHead} style={{ gridTemplateColumns: "2fr 1.2fr 1fr 1fr" }}>
            <div>Product</div>
            <div>Category</div>
            <div>Qty Discounted</div>
            <div className="text-right">Saved</div>
          </div>
        </div>

        <div className="divide-y divide-slate-200">
          {loading ? (
            <div className="px-6 py-10 text-sm text-slate-500">Loading…</div>
          ) : byProduct.length === 0 ? (
            <div className="px-6 py-10 text-sm text-slate-500">No discounts in this range.</div>
          ) : (
            byProduct.map((p) => (
              <div
                key={p.product_id}
                className="grid items-center px-6 py-4 text-sm text-slate-800 hover:bg-slate-50"
                style={{ gridTemplateColumns: "2fr 1.2fr 1fr 1fr" }}
              >
                <div className="min-w-0">
                  <div className="font-black text-slate-900 truncate">{p.name}</div>
                  <div className="text-xs text-slate-400 truncate">{p.sku ? `SKU: ${p.sku}` : "—"}</div>
                </div>
                <div className="text-slate-600">{p.category ?? "—"}</div>
                <div className="font-black">{p.qty}</div>
                <div className="text-right font-black text-amber-700">{fmtMoney(p.saved)}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Line Items (details) */}
      <div className={`${S.card} overflow-hidden`}>
        <div className="px-6 py-4">
          <div className={S.tableHead} style={{ gridTemplateColumns: "1.1fr 1.3fr 2fr .7fr 1fr 1fr" }}>
            <div>Sale</div>
            <div>Date</div>
            <div>Product</div>
            <div>Qty</div>
            <div>Discount / unit</div>
            <div className="text-right">Saved</div>
          </div>
        </div>

        <div className="divide-y divide-slate-200">
          {loading ? (
            <div className="px-6 py-10 text-sm text-slate-500">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-10 text-sm text-slate-500">No discounted lines.</div>
          ) : (
            filtered.map((r, idx) => (
              <div
                key={`${r.sale_id}-${r.product_id}-${idx}`}
                className="grid items-center px-6 py-4 text-sm text-slate-800 hover:bg-slate-50"
                style={{ gridTemplateColumns: "1.1fr 1.3fr 2fr .7fr 1fr 1fr" }}
              >
                <div className="font-black text-slate-900">
                  {r.sale_no}
                  <div className="text-xs text-slate-400">{r.customer_name ?? "—"}</div>
                </div>
                <div className="text-slate-600">{fmtDate(r.sold_at)}</div>
                <div className="min-w-0">
                  <div className="font-black text-slate-900 truncate">{r.name}</div>
                  <div className="text-xs text-slate-400 truncate">{r.category ?? "—"}</div>
                </div>
                <div className="font-black">{r.qty}</div>
                <div className="font-black text-amber-700">-{fmtMoney(r.discount_per_unit)}</div>
                <div className="text-right font-black text-amber-700">{fmtMoney(r.saved_total)}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}