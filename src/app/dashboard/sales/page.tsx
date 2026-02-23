"use client";

import React, { useEffect, useMemo, useState } from "react";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import { listSales, type SaleRow } from "@/lib/api/sales";
import * as S from "./page.styles";
import Link from "next/link";

function fmtMoney(v: number) {
  return `Ksh ${Number(v || 0).toFixed(2)}`;
}

function fmtDate(d: string) {
  try {
    return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch { return d; }
}

function fmtTime(d: string) {
  try {
    return new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

export default function SalesPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [rows,  setRows]  = useState<SaleRow[]>([]);
  const [q,     setQ]     = useState("");
  const [err,   setErr]   = useState("");

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
    return rows.filter((s) =>
      s.sale_no.toLowerCase().includes(t) ||
      (s.customer_name ?? "").toLowerCase().includes(t)
    );
  }, [rows, q]);

  const kpis = useMemo(() => ({
    totalSales:     rows.length,
    totalRevenue:   rows.reduce((sum, r) => sum + Number(r.total         ?? 0), 0),
    totalDiscounts: rows.reduce((sum, r) => sum + Number(r.discount_total ?? 0), 0),
  }), [rows]);

  if (!orgId && !err) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem", padding: "6rem 0", fontFamily: "'DM Sans', sans-serif" }}>
        <span style={{ fontSize: "2.5rem", animation: "floatBee 3s ease-in-out infinite" }}>🐝</span>
        <p style={{ fontSize: "0.82rem", color: "#999977", letterSpacing: "0.06em" }}>Loading your sales…</p>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=DM+Sans:wght@300;400;500&display=swap');

        .sales-page * { font-family: 'DM Sans', sans-serif; }

        .kpi-card { transition: transform 0.18s, box-shadow 0.18s; }
        .kpi-card:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(245,197,24,0.15); }

        .sale-row { transition: background 0.15s; text-decoration: none; display: grid; align-items: center; }
        .sale-row:hover { background: #FFFBEA; }

        .search-wrap { position: relative; flex: 1; min-width: 200px; max-width: 320px; }
        .search-icon { position: absolute; left: 0.85rem; top: 50%; transform: translateY(-50%); font-size: 0.85rem; pointer-events: none; opacity: 0.4; }

        @keyframes floatBee {
          0%, 100% { transform: translateY(0) rotate(-4deg); }
          50%       { transform: translateY(-10px) rotate(4deg); }
        }
      `}</style>

      <div className="sales-page space-y-5">

        {/* ── HEADER BAR ── */}
        <div className={`${S.card} px-6 py-5`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.6rem", fontWeight: 700, color: "#1a1a0a", lineHeight: 1.2 }}>
                Sales <em style={{ fontStyle: "italic", color: "#3a7d44" }}>log</em>
              </h1>
              <p style={{ fontSize: "0.8rem", color: "#999977", marginTop: "0.3rem" }}>
                Track completed transactions and revenue
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              {/* Search */}
              <div className="search-wrap">
                <span className="search-icon">🔍</span>
                <input
                  className={S.input}
                  style={{ paddingLeft: "2.2rem" }}
                  placeholder="Sale no or customer…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              <a href="/dashboard/sales/new" className={S.btnPrimary}>
                + New Sale
              </a>
            </div>
          </div>
        </div>

        {err && <div className={S.alert}>{err}</div>}

        {/* ── KPI CARDS ── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { label: "Total Sales",    value: String(kpis.totalSales),           sub: "transactions recorded",     icon: "📋" },
            { label: "Revenue",        value: fmtMoney(kpis.totalRevenue),       sub: "across all sales",          icon: "📈", highlight: true },
            { label: "Discounts Given",value: fmtMoney(kpis.totalDiscounts),     sub: "total price reductions",    icon: "🏷️" },
          ].map(({ label, value, sub, icon, highlight }) => (
            <div
              key={label}
              className={`kpi-card ${S.card} px-6 py-5`}
              style={highlight ? { borderColor: "rgba(245,197,24,0.45)", background: "#FFFBEA" } : {}}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.8rem" }}>
                <span style={{ fontSize: "0.62rem", fontWeight: 500, letterSpacing: "0.22em", color: highlight ? "#92700a" : "#999977", textTransform: "uppercase" }}>
                  {label}
                </span>
                <span style={{ fontSize: "1.1rem", opacity: 0.6 }}>{icon}</span>
              </div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.85rem", fontWeight: 700, color: "#1a1a0a", lineHeight: 1.1 }}>
                {value}
              </div>
              <div style={{ fontSize: "0.72rem", color: "#999977", marginTop: "0.35rem" }}>{sub}</div>
              {highlight && <div style={{ marginTop: "0.7rem", height: 2, width: 40, background: "#F5C518", borderRadius: 1 }} />}
            </div>
          ))}
        </div>

        {/* ── SALES TABLE ── */}
        <div className={`${S.card} overflow-hidden`}>

          {/* Card header */}
          <div style={{ padding: "1.1rem 1.5rem", borderBottom: "1.5px solid rgba(245,197,24,0.2)", background: "#FFFEF5", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.05rem", fontWeight: 700, color: "#1a1a0a" }}>
              Transactions
            </div>
            {filtered.length > 0 && (
              <span className={`${S.badge} bg-[#FFF9DC] text-[#92700a]`} style={{ fontSize: "0.68rem" }}>
                {filtered.length} {filtered.length === 1 ? "sale" : "sales"}
              </span>
            )}
          </div>

          {/* Table head */}
          <div
            className={S.tableHead}
            style={{
              gridTemplateColumns: "1fr 1.4fr 1.1fr 0.9fr",
              padding: "0.6rem 1.5rem",
              background: "#FAFAF5",
              borderBottom: "1px solid rgba(26,26,10,0.05)",
            }}
          >
            <div>Sale No</div>
            <div>Customer</div>
            <div>Date</div>
            <div style={{ textAlign: "right" }}>Total</div>
          </div>

          {/* Rows */}
          <div>
            {filtered.length === 0 ? (
              <div style={{ padding: "3.5rem 1.5rem", textAlign: "center" }}>
                <div style={{ fontSize: "2rem", marginBottom: "0.8rem" }}>🍯</div>
                <p style={{ fontSize: "0.85rem", color: "#999977" }}>
                  {q ? "No sales match your search." : "No sales yet. Create one to get started."}
                </p>
              </div>
            ) : filtered.map((s, idx) => (
              <Link
                key={s.id}
                href={`/dashboard/sales/${s.id}`}
                className="sale-row"
                style={{
                  gridTemplateColumns: "1fr 1.4fr 1.1fr 0.9fr",
                  padding: "0.9rem 1.5rem",
                  borderBottom: idx < filtered.length - 1 ? "1px solid rgba(26,26,10,0.05)" : "none",
                  color: "inherit",
                }}
              >
                {/* Sale no */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontSize: "0.6rem", color: "#F5C518", flexShrink: 0 }}>⬡</span>
                  <span style={{ fontWeight: 500, color: "#1a1a0a", fontSize: "0.875rem" }}>
                    {s.sale_no}
                  </span>
                </div>

                {/* Customer */}
                <div style={{ fontSize: "0.875rem", color: "#555540", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.customer_name ?? <span style={{ color: "#bbb" }}>—</span>}
                </div>

                {/* Date */}
                <div>
                  <div style={{ fontSize: "0.82rem", color: "#555540" }}>{fmtDate(s.created_at)}</div>
                  <div style={{ fontSize: "0.7rem", color: "#999977" }}>{fmtTime(s.created_at)}</div>
                </div>

                {/* Total */}
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: "0.95rem", color: "#1a1a0a" }}>
                    {fmtMoney(Number(s.total ?? 0))}
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {/* Footer */}
          {filtered.length > 0 && (
            <div style={{ padding: "0.8rem 1.5rem", borderTop: "1px solid rgba(26,26,10,0.05)", background: "#FAFAF5", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.72rem", color: "#bbb" }}>
                Showing {filtered.length} of {rows.length} sales
              </span>
              <span style={{ fontSize: "0.72rem", color: "#999977" }}>
                Total revenue: <strong style={{ color: "#1a1a0a", fontFamily: "'Playfair Display', serif" }}>{fmtMoney(kpis.totalRevenue)}</strong>
              </span>
            </div>
          )}
        </div>

      </div>
    </>
  );
}