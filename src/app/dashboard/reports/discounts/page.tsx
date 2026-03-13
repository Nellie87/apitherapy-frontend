"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import { getDiscountReport, type DiscountReportRow } from "@/lib/api/reports";
import * as S from "../page.styles";

/* ─── Helpers ────────────────────────────────────────────────── */
function fmtMoney(v: number) {
  return `Ksh ${Number(v || 0).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
}
function fmtDate(d: string) {
  try { return new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
  catch { return d; }
}
function downloadCSV(filename: string, rows: Record<string, any>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const esc = (v: any) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = [headers.join(","), ...rows.map(r => headers.map(h => esc(r[h])).join(","))].join("\n");
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" })),
    download: filename,
  });
  a.click(); URL.revokeObjectURL(a.href);
}

/* ─── Spinner ────────────────────────────────────────────────── */
function Spinner() {
  return (
    <div className="flex items-center justify-center gap-3 py-14 text-slate-400">
      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" strokeOpacity="0.2" /><path d="M12 2a10 10 0 0110 10" />
      </svg>
      <span className="text-sm">Loading…</span>
    </div>
  );
}

/* ─── Horizontal bar chart with hover ───────────────────────── */
function DiscountBar({ data }: { data: { label: string; saved: number; qty: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...data.map(d => d.saved), 1);
  if (!data.length) return null;
  return (
    <div className="space-y-3">
      {data.slice(0, 8).map((d, i) => {
        const pct = (d.saved / max) * 100;
        const isH = hover === i;
        return (
          <div key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className="cursor-default">
            <div className="flex items-center justify-between mb-1">
              <span className={`text-xs font-medium truncate max-w-[180px] transition-colors ${isH ? "text-slate-900" : "text-slate-600"}`}>
                {d.label}
              </span>
              <span className={`text-xs font-bold ml-2 transition-colors ${isH ? "text-amber-700" : "text-slate-700"}`}>
                {fmtMoney(d.saved)}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.max(1.5, pct)}%`, background: "#f59e0b", opacity: isH ? 1 : 0.65 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Donut chart: top discounted categories ─────────────────── */
function CategoryDonut({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const R = 54, r = 32, cx = 70, cy = 70, W = 220, H = 140;
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (!total) return null;

  let angle = -Math.PI / 2;
  const arcs = segments.map((seg, idx) => {
    const sweep = (seg.value / total) * 2 * Math.PI;
    const sA = angle + 0.025, eA = angle + sweep - 0.025;
    angle += sweep;
    const eR = hover === idx ? R + 7 : R;
    const cos = Math.cos, sin = Math.sin;
    const d = [
      `M${(cx + eR * cos(sA)).toFixed(2)},${(cy + eR * sin(sA)).toFixed(2)}`,
      `A${eR},${eR} 0 ${sweep > Math.PI ? 1 : 0} 1 ${(cx + eR * cos(eA)).toFixed(2)},${(cy + eR * sin(eA)).toFixed(2)}`,
      `L${(cx + r * cos(eA)).toFixed(2)},${(cy + r * sin(eA)).toFixed(2)}`,
      `A${r},${r} 0 ${sweep > Math.PI ? 1 : 0} 0 ${(cx + r * cos(sA)).toFixed(2)},${(cy + r * sin(sA)).toFixed(2)}Z`,
    ].join(" ");
    return { ...seg, idx, d, pct: ((seg.value / total) * 100).toFixed(0) };
  });

  const LX = cx * 2 + 12;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      {arcs.map(a => (
        <path key={a.idx} d={a.d} fill={a.color}
          opacity={hover === null || hover === a.idx ? 1 : 0.4}
          style={{ transition: "opacity 0.15s, d 0.15s", cursor: "pointer" }}
          onMouseEnter={() => setHover(a.idx)} onMouseLeave={() => setHover(null)} />
      ))}
      <circle cx={cx} cy={cy} r={r - 2} fill="white" />
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="9" fill="#94a3b8" fontWeight="600">Savings</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize="12" fill="#0f172a" fontWeight="700">
        {hover !== null ? arcs[hover]?.pct + "%" : arcs.length}
      </text>
      {arcs.slice(0, 6).map((a, i) => {
        const ly = 16 + i * 20, isH = hover === a.idx;
        return (
          <g key={i} style={{ cursor: "pointer" }}
            onMouseEnter={() => setHover(a.idx)} onMouseLeave={() => setHover(null)}>
            <rect x={LX} y={ly - 7} width="9" height="9" rx="2.5" fill={a.color} opacity={isH ? 1 : 0.8} />
            <text x={LX + 14} y={ly + 1} fontSize="9.5" fill={isH ? "#0f172a" : "#64748b"} fontWeight={isH ? "700" : "400"}>
              {a.label.length > 12 ? a.label.slice(0, 12) + "…" : a.label}
            </text>
            <text x={W - 4} y={ly + 1} textAnchor="end" fontSize="9.5"
              fill={isH ? a.color : "#94a3b8"} fontWeight={isH ? "700" : "400"}>{a.pct}%</text>
          </g>
        );
      })}
    </svg>
  );
}

const CAT_PALETTE = ["#f59e0b","#3b82f6","#8b5cf6","#10b981","#ef4444","#06b6d4","#f97316","#ec4899"];

/* ════════════════════════════════════════════════════════════════
   PAGE
════════════════════════════════════════════════════════════════ */
export default function DiscountsReportPage() {
  const [orgId,   setOrgId]   = useState<string | null>(null);
  const [rows,    setRows]    = useState<DiscountReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState("");
  const [from,    setFrom]    = useState("");
  const [to,      setTo]      = useState("");
  const [q,       setQ]       = useState("");

  useEffect(() => {
    (async () => {
      try { const o = await bootstrapOrg(); setOrgId(o); }
      catch (e: any) { setErr(e.message ?? String(e)); }
    })();
  }, []);

  async function run() {
    if (!orgId) return;
    setLoading(true); setErr("");
    try {
      const res = await getDiscountReport(orgId, { from: from || undefined, to: to || undefined });
      setRows(res.rows);
    } catch (e: any) { setErr(e.message ?? String(e)); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (orgId) run(); }, [orgId]);

  /* ── Filtered rows ── */
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(r =>
      [r.name, r.sku, r.category, r.sale_no, r.customer_name]
        .some(v => (v ?? "").toLowerCase().includes(term))
    );
  }, [rows, q]);

  /* ── By-product aggregation ── */
  const byProduct = useMemo(() => {
    const map = new Map<string, { name: string; sku: string | null; category: string | null; qty: number; saved: number }>();
    for (const r of filtered) {
      const cur = map.get(r.product_id) ?? { name: r.name, sku: r.sku ?? null, category: r.category ?? null, qty: 0, saved: 0 };
      cur.qty += r.qty; cur.saved += r.saved_total;
      map.set(r.product_id, cur);
    }
    return Array.from(map.entries()).map(([pid, v]) => ({ product_id: pid, ...v }))
      .sort((a, b) => b.saved - a.saved);
  }, [filtered]);

  /* ── KPIs ── */
  const totals = useMemo(() => ({
    lines: filtered.length,
    qty:   filtered.reduce((s, r) => s + Number(r.qty ?? 0), 0),
    saved: filtered.reduce((s, r) => s + Number(r.saved_total ?? 0), 0),
  }), [filtered]);

  /* ── Bar chart data ── */
  const barData = useMemo(() =>
    byProduct.slice(0, 8).map(p => ({ label: p.name, saved: p.saved, qty: p.qty }))
  , [byProduct]);

  /* ── Category donut data ── */
  const catSegs = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of filtered) {
      const cat = r.category ?? "Uncategorised";
      map.set(cat, (map.get(cat) ?? 0) + r.saved_total);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([label, value], i) => ({ label, value, color: CAT_PALETTE[i % CAT_PALETTE.length] }));
  }, [filtered]);

  /* ── CSV ── */
  const csvRows = useMemo(() => filtered.map(r => ({
    sale_no: r.sale_no, customer_name: r.customer_name ?? "",
    sold_at: r.sold_at, product_name: r.name,
    sku: r.sku ?? "", category: r.category ?? "",
    qty: r.qty, base_price: r.base_price,
    discount_per_unit: r.discount_per_unit,
    final_price: r.final_price, saved_total: r.saved_total,
  })), [filtered]);

  return (
    <div className="flex flex-col gap-5">

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Discounts Report</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Discounted items, savings totals, and which products were marked down
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Link href="/dashboard/reports" className={S.btnGhost}>← Reports</Link>
          <button className={S.btnGhost} onClick={run} disabled={loading || !orgId}>↻ Refresh</button>
          <button className={S.btnGhost} disabled={!csvRows.length}
            onClick={() => downloadCSV(`discounts_${new Date().toISOString().slice(0,10)}.csv`, csvRows)}>
            ⬇ CSV
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className={`${S.card} p-4`}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
            <input className={`${S.input} pl-8`} placeholder="Search product / sale / customer…"
              value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-500 whitespace-nowrap">From</label>
            <input className={S.input} type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-500 whitespace-nowrap">To</label>
            <input className={S.input} type="date" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <button className={S.btnPrimary} onClick={run} disabled={loading || !orgId}>
            {loading ? "Running…" : "Apply Filters"}
          </button>
        </div>
        {(from || to || q) && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {q && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-semibold text-amber-700">
                "{q}" <button onClick={() => setQ("")} className="hover:text-amber-900 leading-none">×</button>
              </span>
            )}
            {from && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                From {from} <button onClick={() => setFrom("")} className="hover:text-slate-900 leading-none">×</button>
              </span>
            )}
            {to && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                To {to} <button onClick={() => setTo("")} className="hover:text-slate-900 leading-none">×</button>
              </span>
            )}
            <span className="text-xs text-slate-400">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
          </div>
        )}
      </div>

      {/* ── Error ── */}
      {err && (
        <div className={S.alert}>
          <span>⚠️</span><span className="flex-1">{err}</span>
          <button onClick={() => setErr("")} className="ml-auto text-red-400 hover:text-red-600 leading-none">×</button>
        </div>
      )}

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-50 text-lg mb-3">🧾</div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Discounted Lines</div>
          <div className="text-3xl font-bold text-slate-900">{totals.lines}</div>
          <div className="mt-1 text-xs text-slate-400">Individual sale line items</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-lg mb-3">📦</div>
          <div className="text-xs font-semibold uppercase tracking-wider text-blue-500 mb-1.5">Units Discounted</div>
          <div className="text-3xl font-bold text-slate-900">{totals.qty}</div>
          <div className="mt-1 text-xs text-slate-400">Total quantity across all lines</div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-100 text-lg mb-3">💰</div>
          <div className="text-xs font-semibold uppercase tracking-wider text-amber-600 mb-1.5">Total Saved</div>
          <div className="text-3xl font-bold text-amber-800">{fmtMoney(totals.saved)}</div>
          <div className="mt-1 text-xs text-amber-600">Customer savings given</div>
        </div>
      </div>

      {/* ── Charts row: bar + donut ── */}
      {!loading && byProduct.length > 0 && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Discount by product bar */}
          <div className={`${S.card} overflow-hidden`}>
            <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-amber-50 text-base shrink-0">📊</div>
              <div>
                <div className="font-bold text-slate-900">Top Discounted Products</div>
                <div className="text-xs text-slate-500 mt-0.5">Ranked by savings · hover rows</div>
              </div>
            </div>
            <div className="px-5 py-5">
              <DiscountBar data={barData} />
            </div>
          </div>

          {/* Category donut */}
          <div className={`${S.card} overflow-hidden`}>
            <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-purple-50 text-base shrink-0">🍩</div>
              <div>
                <div className="font-bold text-slate-900">Savings by Category</div>
                <div className="text-xs text-slate-500 mt-0.5">Hover segments to highlight</div>
              </div>
            </div>
            <div className="px-5 py-4">
              <CategoryDonut segments={catSegs} />
            </div>
          </div>
        </div>
      )}

      {/* ── By-product table ── */}
      <div className={`${S.card} overflow-hidden`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <div className="font-bold text-slate-900">Products Given Discounts</div>
            <div className="text-xs text-slate-500 mt-0.5">Grouped · highest savings first</div>
          </div>
          <span className="text-xs text-slate-400">{byProduct.length} product{byProduct.length !== 1 ? "s" : ""}</span>
        </div>

        <div className={`${S.tableHead} hidden sm:grid`} style={{ gridTemplateColumns: "2fr 1.2fr 0.8fr 1fr" }}>
          <div>Product</div>
          <div>Category</div>
          <div className="text-right">Qty</div>
          <div className="text-right">Saved</div>
        </div>

        <div className="divide-y divide-slate-100">
          {loading ? <Spinner />
          : byProduct.length === 0
            ? <div className="py-14 text-center text-sm text-slate-400">No discounts in this range.</div>
            : byProduct.map(p => (
              <div key={p.product_id}
                className="grid items-center gap-4 px-5 py-3.5 text-sm hover:bg-slate-50 transition-colors"
                style={{ gridTemplateColumns: "2fr 1.2fr 0.8fr 1fr" }}>
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 truncate">{p.name}</div>
                  {p.sku && <div className="text-xs text-slate-400 mt-0.5">SKU: {p.sku}</div>}
                </div>
                <div className="text-slate-500 truncate">{p.category ?? "—"}</div>
                <div className="text-right font-bold text-slate-900">{p.qty}</div>
                <div className="text-right">
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                    {fmtMoney(p.saved)}
                  </span>
                </div>
              </div>
            ))
          }
        </div>

        {byProduct.length > 0 && !loading && (
          <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 flex items-center justify-between">
            <span className="text-xs text-slate-500">{byProduct.length} products · {totals.qty} units</span>
            <span className="text-sm font-bold text-amber-700">{fmtMoney(totals.saved)} total saved</span>
          </div>
        )}
      </div>

      {/* ── Line items table ── */}
      <div className={`${S.card} overflow-hidden`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <div className="font-bold text-slate-900">All Discounted Lines</div>
            <div className="text-xs text-slate-500 mt-0.5">Every individual discounted sale item</div>
          </div>
          <span className="text-xs text-slate-400">{filtered.length} line{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        <div className={`${S.tableHead} hidden sm:grid`}
          style={{ gridTemplateColumns: "1fr 1.2fr 1.8fr 0.5fr 1fr 1fr" }}>
          <div>Sale</div>
          <div>Date</div>
          <div>Product</div>
          <div className="text-right">Qty</div>
          <div className="text-right">Disc / unit</div>
          <div className="text-right">Saved</div>
        </div>

        <div className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
          {loading ? <Spinner />
          : filtered.length === 0
            ? <div className="py-14 text-center text-sm text-slate-400">No discounted lines found.</div>
            : filtered.map((r, idx) => (
              <div key={`${r.sale_id}-${r.product_id}-${idx}`}
                className="grid items-center gap-4 px-5 py-3.5 text-sm hover:bg-slate-50 transition-colors"
                style={{ gridTemplateColumns: "1fr 1.2fr 1.8fr 0.5fr 1fr 1fr" }}>
                {/* Sale */}
                <div>
                  <div className="font-bold text-slate-900">{r.sale_no}</div>
                  {r.customer_name && <div className="text-xs text-slate-400 truncate">{r.customer_name}</div>}
                </div>
                {/* Date */}
                <div className="text-xs text-slate-500">{fmtDate(r.sold_at)}</div>
                {/* Product */}
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 truncate">{r.name}</div>
                  {r.category && <div className="text-xs text-slate-400">{r.category}</div>}
                </div>
                {/* Qty */}
                <div className="text-right font-bold text-slate-900">{r.qty}</div>
                {/* Discount per unit */}
                <div className="text-right">
                  <span className="text-xs font-bold text-red-500">−{fmtMoney(r.discount_per_unit)}</span>
                </div>
                {/* Saved */}
                <div className="text-right">
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                    {fmtMoney(r.saved_total)}
                  </span>
                </div>
              </div>
            ))
          }
        </div>

        {filtered.length > 0 && !loading && (
          <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 flex items-center justify-between">
            <span className="text-xs text-slate-500">{filtered.length} lines shown</span>
            <span className="text-sm font-bold text-amber-700">{fmtMoney(totals.saved)} total saved</span>
          </div>
        )}
      </div>

    </div>
  );
}