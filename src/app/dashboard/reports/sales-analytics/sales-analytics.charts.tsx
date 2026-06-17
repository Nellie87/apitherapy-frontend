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

const BAR_PALETTE = [
  "#D6A324",
  "#E7B93E",
  "#B98612",
  "#7A5A16",
  "#2F2718",
  "#F3D37A",
  "#A16207",
  "#C27A16",
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
    ? `${path} L${x(daily.length - 1)},${P.t + iH} L${x(0)},${P.t + iH} Z`
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
      <div className="flex h-56 items-center justify-center rounded-[24px] border border-[#F1E6C9] bg-[#FFFDF8] text-sm font-semibold text-slate-400">
        No chart data for this range.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[24px] border border-[#F1E6C9] bg-[#FFFDF8] p-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
        <defs>
          <linearGradient id="salesAreaHoney" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#D6A324" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#FFF8E6" stopOpacity="0.06" />
          </linearGradient>
        </defs>

        {grids.map((v, i) => (
          <g key={i}>
            <line
              x1={P.l}
              x2={W - P.r}
              y1={y(v)}
              y2={y(v)}
              stroke="#F1E6C9"
              strokeWidth="1"
            />
            <text
              x={P.l - 8}
              y={y(v) + 4}
              textAnchor="end"
              fontSize="9"
              fill="#9A8B68"
              fontWeight="700"
            >
              {fmtK(v)}
            </text>
          </g>
        ))}

        <path d={area} fill="url(#salesAreaHoney)" />
        <path
          d={path}
          fill="none"
          stroke="#B98612"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {daily.map((d, i) => (
          <circle
            key={d.day}
            cx={x(i)}
            cy={y(d.total)}
            r="3.5"
            fill="#FFFFFF"
            stroke="#B98612"
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
            fill="#9A8B68"
            fontWeight="700"
          >
            {fmtShortDate(d.day)}
          </text>
        ))}
      </svg>
    </div>
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
      <div className="rounded-[24px] border border-[#F1E6C9] bg-[#FFFDF8] py-12 text-center text-sm font-semibold text-slate-400">
        No product data available.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.slice(0, 10).map((p, i) => {
        const value = Number(p[valueKey] ?? 0);
        const pct = (value / max) * 100;
        const color = BAR_PALETTE[i % BAR_PALETTE.length];

        return (
          <div
            key={p.product_id}
            className="rounded-[22px] border border-[#F1E6C9] bg-white p-4 shadow-[0_8px_24px_rgba(92,64,16,0.04)]"
          >
            <div className="mb-2 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="truncate text-sm font-black text-slate-950">
                  {p.name}
                </div>
                <div className="mt-0.5 text-xs font-semibold text-slate-400">
                  {p.appearances.toLocaleString("en-KE")} sale appearance
                  {p.appearances === 1 ? "" : "s"}
                </div>
              </div>

              <div className="shrink-0 text-right">
                <div className="text-xs font-black text-slate-950">
                  {valueKey === "revenue" ? fmtMoney(p.revenue) : `${p.qty} units`}
                </div>
                <div className="mt-0.5 text-[11px] font-semibold text-slate-400">
                  #{i + 1}
                </div>
              </div>
            </div>

            <div className="h-2.5 overflow-hidden rounded-full bg-[#FFF8E6]">
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
  if (!metrics.length) {
    return (
      <div className="rounded-[24px] border border-[#F1E6C9] bg-[#FFFDF8] py-12 text-center text-sm font-semibold text-slate-400">
        No comparison data available.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-[22px] border border-[#F1E6C9] bg-[#FFFDF8] px-4 py-3 text-xs font-bold text-slate-500">
        <span className="rounded-full bg-[#2F2718] px-3 py-1 text-white">
          Period A
        </span>
        <span className="rounded-full bg-[#D6A324] px-3 py-1 text-[#3B2C08]">
          Period B
        </span>
        <span className="text-slate-400">
          Bars compare each metric against the stronger period.
        </span>
      </div>

      {metrics.map((m) => {
        const max = Math.max(Math.abs(m.a), Math.abs(m.b), 1);
        const aPct = (Math.abs(m.a) / max) * 100;
        const bPct = (Math.abs(m.b) / max) * 100;
        const positive = m.diff >= 0;

        return (
          <div
            key={m.label}
            className="rounded-[24px] border border-[#F1E6C9] bg-white p-5 shadow-[0_8px_24px_rgba(92,64,16,0.04)]"
          >
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-sm font-black text-slate-950">{m.label}</div>
                <div className="mt-1 text-xs font-semibold text-slate-400">
                  {fmtValue(m.a, m.money)} to {fmtValue(m.b, m.money)}
                </div>
              </div>

              <div
                className={`w-fit rounded-full border px-3 py-1 text-xs font-black ${
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
                  <span className="font-bold text-slate-500">Period A</span>
                  <span className="font-black text-slate-700">
                    {fmtValue(m.a, m.money)}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-[#2F2718]"
                    style={{ width: `${Math.max(3, aPct)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-bold text-[#7A5A16]">Period B</span>
                  <span className="font-black text-slate-950">
                    {fmtValue(m.b, m.money)}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-[#FFF8E6]">
                  <div
                    className="h-full rounded-full bg-[#D6A324]"
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
