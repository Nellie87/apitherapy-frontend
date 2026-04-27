"use client";

import React, { useMemo } from "react";
import { fmtK, fmtMoney } from "../components/report-ui";
import type {
  CompareMetric,
  DailyStat,
  ProductStat,
  SortBy,
} from "./sales-analytics.types";
import { fmtPct, fmtShortDate, fmtValue } from "./sales-analytics.helpers";

const CAT_PALETTE = [
  "#f59e0b",
  "#fbbf24",
  "#92400e",
  "#111827",
  "#d97706",
  "#fde68a",
  "#78350f",
  "#f97316",
];

export function SimpleLineChart({ daily }: { daily: DailyStat[] }) {
  const W = 600;
  const H = 230;
  const P = { t: 18, r: 18, b: 34, l: 58 };
  const iW = W - P.l - P.r;
  const iH = H - P.t - P.b;

  const maxV = Math.max(...daily.map((d) => d.total), 1);

  const x = (i: number) =>
    P.l + (daily.length < 2 ? iW / 2 : (i / (daily.length - 1)) * iW);

  const y = (v: number) => P.t + iH - (v / maxV) * iH;

  const path = daily
    .map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d.total)}`)
    .join(" ");

  const area = daily.length
    ? `${path} L${x(daily.length - 1)},${P.t + iH} L${x(0)},${
        P.t + iH
      } Z`
    : "";

  const grids = [0, 0.25, 0.5, 0.75, 1].map((f) => maxV * f);

  const labels = useMemo(() => {
    if (!daily.length) return [];
    const step = Math.max(1, Math.floor(daily.length / 6));
    return daily
      .map((d, i) => ({ d, i }))
      .filter(({ i }) => i % step === 0 || i === daily.length - 1);
  }, [daily]);

  if (!daily.length) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-slate-400">
        No chart data for this range
      </div>
    );
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      <defs>
        <linearGradient id="salesAreaAmber" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#fef3c7" stopOpacity="0.08" />
        </linearGradient>
      </defs>

      {grids.map((v, i) => (
        <g key={i}>
          <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} stroke="#f1f5f9" />
          <text
            x={P.l - 8}
            y={y(v) + 4}
            textAnchor="end"
            fontSize="9"
            fill="#94a3b8"
          >
            {fmtK(v)}
          </text>
        </g>
      ))}

      <path d={area} fill="url(#salesAreaAmber)" />
      <path
        d={path}
        fill="none"
        stroke="#d97706"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {daily.map((d, i) => (
        <circle
          key={d.day}
          cx={x(i)}
          cy={y(d.total)}
          r="3.6"
          fill="#fff"
          stroke="#d97706"
          strokeWidth="2"
        />
      ))}

      {labels.map(({ d, i }) => (
        <text
          key={d.day}
          x={x(i)}
          y={H - 8}
          textAnchor="middle"
          fontSize="9"
          fill="#94a3b8"
        >
          {fmtShortDate(d.day)}
        </text>
      ))}
    </svg>
  );
}

export function ProductBar({
  data,
  valueKey,
}: {
  data: ProductStat[];
  valueKey: SortBy;
}) {
  const max = Math.max(...data.map((d) => Number(d[valueKey] ?? 0)), 1);

  if (!data.length) {
    return (
      <div className="py-12 text-center text-sm text-slate-400">
        No product data available.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {data.slice(0, 10).map((p, i) => {
        const value = Number(p[valueKey] ?? 0);
        const pct = (value / max) * 100;
        const color = CAT_PALETTE[i % CAT_PALETTE.length];

        return (
          <div
            key={p.product_id}
            className="rounded-2xl border border-amber-100 bg-white p-3 shadow-sm"
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="truncate text-sm font-bold text-slate-900">
                {i === 0 ? "🏆 " : ""}
                {p.name}
              </span>
              <span className="shrink-0 text-xs font-black text-slate-900">
                {valueKey === "revenue" ? fmtMoney(p.revenue) : `${p.qty} units`}
              </span>
            </div>

            <div className="h-2.5 overflow-hidden rounded-full bg-amber-50">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(3, pct)}%`,
                  background: color,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function CompareBars({ metrics }: { metrics: CompareMetric[] }) {
  return (
    <div className="space-y-4">
      {metrics.map((m) => {
        const max = Math.max(Math.abs(m.a), Math.abs(m.b), 1);
        const aPct = (Math.abs(m.a) / max) * 100;
        const bPct = (Math.abs(m.b) / max) * 100;
        const positive = m.diff >= 0;

        return (
          <div
            key={m.label}
            className="rounded-3xl border border-amber-100 bg-white p-5 shadow-sm"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-black text-slate-950">{m.label}</div>
                <div className="mt-1 text-xs text-slate-400">
                  Period A vs Period B
                </div>
              </div>

              <div
                className={`rounded-full border px-3 py-1 text-xs font-black ${
                  positive
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-red-200 bg-red-50 text-red-700"
                }`}
              >
                {positive ? "+" : ""}
                {fmtValue(m.diff, m.money)} · {fmtPct(m.pct)}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-semibold text-slate-500">Period A</span>
                  <span className="font-black text-slate-700">
                    {fmtValue(m.a, m.money)}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-slate-800"
                    style={{ width: `${Math.max(3, aPct)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-semibold text-amber-700">Period B</span>
                  <span className="font-black text-slate-950">
                    {fmtValue(m.b, m.money)}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-amber-50">
                  <div
                    className="h-full rounded-full bg-amber-500"
                    style={{ width: `${Math.max(3, bPct)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}