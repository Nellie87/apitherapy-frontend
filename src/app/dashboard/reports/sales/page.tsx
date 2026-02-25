"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import { getSalesSummary, type SalesSummaryRow } from "@/lib/api/reports";
import * as S from "../page.styles";

function fmtMoney(v: number) {
  return `Ksh ${Number(v || 0).toLocaleString("en-KE", { minimumFractionDigits: 0 })}`;
}

function todayYYYYMMDD() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function daysAgoYYYYMMDD(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function downloadCSV(filename: string, rows: Record<string, any>[]) {
  const headers = Object.keys(rows[0] ?? {});

  const escape = (v: any) => {
    const s = String(v ?? "");
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}

export default function SalesSummaryReportPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [from, setFrom] = useState<string>(() => daysAgoYYYYMMDD(6));
  const [to, setTo] = useState<string>(() => todayYYYYMMDD());

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState<SalesSummaryRow[]>([]);
  const [totals, setTotals] = useState({
    sales_count: 0,
    subtotal: 0,
    discount_total: 0,
    total: 0,
  });

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
    if (!from || !to) return setErr("Select a start and end date.");
    if (from > to) return setErr("Start date cannot be after end date.");

    setLoading(true);
    setErr("");
    try {
      const res = await getSalesSummary(orgId, { from, to });
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

  const hasData = rows.length > 0;

  const csvRows = useMemo(() => {
    return rows.map((r) => ({
      day: r.day,
      sales_count: r.sales_count,
      subtotal: r.subtotal,
      discount_total: r.discount_total,
      total: r.total,
    }));
  }, [rows]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`${S.card} p-6`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-3xl font-black text-slate-900">Sales Summary</div>
            <div className="mt-1 text-sm text-slate-500">
              Totals by day · downloadable CSV · date-range filter
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link href="/dashboard/reports" className={S.btnGhost}>
              ← Reports
            </Link>
            <button className={S.btnGhost} onClick={() => { setFrom(daysAgoYYYYMMDD(6)); setTo(todayYYYYMMDD()); }}>
              Last 7 days
            </button>
            <button className={S.btnGhost} onClick={() => { setFrom(daysAgoYYYYMMDD(29)); setTo(todayYYYYMMDD()); }}>
              Last 30 days
            </button>
            <button className={S.btnPrimary} onClick={run} disabled={loading || !orgId}>
              {loading ? "Loading…" : "Run Report"}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500">From</label>
            <input className={S.input} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500">To</label>
            <input className={S.input} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="flex items-end gap-2">
            <button
              className={S.btnGhost}
              disabled={!hasData}
              onClick={() => {
                if (!hasData) return;
                downloadCSV(`sales-summary_${from}_to_${to}.csv`, csvRows);
              }}
            >
              ⬇ Download CSV
            </button>
          </div>
        </div>
      </div>

      {err ? <div className={S.alert}>{err}</div> : null}

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className={`${S.card} p-6`}>
          <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">Total Sales</div>
          <div className="mt-3 text-4xl font-black text-slate-900">{totals.sales_count}</div>
          <div className="mt-2 text-sm text-slate-500">in selected range</div>
        </div>

        <div className={`${S.card} p-6`}>
          <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">Revenue</div>
          <div className="mt-3 text-4xl font-black text-slate-900">{fmtMoney(totals.total)}</div>
          <div className="mt-2 text-sm text-slate-500">after discounts</div>
        </div>

        <div className={`${S.card} p-6`}>
          <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">Discounts</div>
          <div className="mt-3 text-4xl font-black text-slate-900">{fmtMoney(totals.discount_total)}</div>
          <div className="mt-2 text-sm text-slate-500">total saved</div>
        </div>
      </div>

      {/* Table */}
      <div className={`${S.card} overflow-hidden`}>
        <div className="px-6 py-4">
          <div className={S.tableHead} style={{ gridTemplateColumns: "1.2fr .8fr 1fr 1fr 1fr" }}>
            <div>Day</div>
            <div># Sales</div>
            <div>Subtotal</div>
            <div>Discounts</div>
            <div className="text-right">Total</div>
          </div>
        </div>

        <div className="divide-y divide-slate-200">
          {loading ? (
            <div className="px-6 py-10 text-sm text-slate-500">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="px-6 py-10 text-sm text-slate-500">No sales in this range.</div>
          ) : (
            rows.map((r) => (
              <div
                key={r.day}
                className="grid items-center px-6 py-4 text-sm text-slate-800"
                style={{ gridTemplateColumns: "1.2fr .8fr 1fr 1fr 1fr" }}
              >
                <div className="font-black">{r.day}</div>
                <div className="font-bold text-slate-700">{r.sales_count}</div>
                <div>{fmtMoney(r.subtotal)}</div>
                <div className="font-bold text-amber-700">-{fmtMoney(r.discount_total)}</div>
                <div className="text-right font-black">{fmtMoney(r.total)}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}