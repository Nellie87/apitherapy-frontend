"use client";

import React, { useMemo, useRef, useState } from "react";
import { fmtK, fmtMoney } from "../components/report-ui";
import type {
  CompareMetric,
  DailyStat,
  ProductStat,
  SortBy,
  WeekdayStat,
} from "./sales-analytics.types";
import {
  fillDailyGaps,
  fmtPct,
  fmtShortDate,
  fmtValue,
} from "./sales-analytics.helpers";

export function SimpleLineChart({
  daily,
  from,
  to,
}: {
  daily: DailyStat[];
  from?: string;
  to?: string;
}) {
  const series = useMemo(() => fillDailyGaps(daily, from, to), [daily, from, to]);
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gradId = React.useId().replace(/:/g, "");

  const W = 600;
  const H = 230;
  const P = { t: 16, r: 16, b: 32, l: 48 };
  const iW = W - P.l - P.r;
  const iH = H - P.t - P.b;

  const maxV = Math.max(...series.map((d) => d.total), 1);

  const x = (i: number) =>
    P.l + (series.length < 2 ? iW / 2 : (i / (series.length - 1)) * iW);

  const y = (v: number) => P.t + iH - (v / maxV) * iH;

  const path = series
    .map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d.total)}`)
    .join(" ");

  const area = series.length
    ? `${path} L${x(series.length - 1)},${P.t + iH} L${x(0)},${P.t + iH} Z`
    : "";

  const grids = [0, 0.25, 0.5, 0.75, 1].map((f) => maxV * f);

  const labels = useMemo(() => {
    if (!series.length) return [];
    const step = Math.max(1, Math.floor(series.length / 6));

    return series
      .map((d, i) => ({ d, i }))
      .filter(({ i }) => i % step === 0 || i === series.length - 1);
  }, [series]);

  if (!series.length) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-[#9a9386]">
        No chart data for this range.
      </div>
    );
  }

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full cursor-crosshair"
        style={{ height: H }}
        onMouseMove={(e) => {
          if (!svgRef.current || series.length < 2) return;
          const rect = svgRef.current.getBoundingClientRect();
          const mx = ((e.clientX - rect.left) / rect.width) * W;
          let best = 0;
          let bd = Infinity;
          series.forEach((_, i) => {
            const d = Math.abs(x(i) - mx);
            if (d < bd) {
              bd = d;
              best = i;
            }
          });
          setHover(best);
        }}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d7a820" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#d7a820" stopOpacity="0" />
          </linearGradient>
        </defs>

        {grids.map((v, i) => (
          <g key={i}>
            <line
              x1={P.l}
              x2={W - P.r}
              y1={y(v)}
              y2={y(v)}
              stroke="#efe8d8"
              strokeWidth="1"
            />
            <text
              x={P.l - 8}
              y={y(v) + 4}
              textAnchor="end"
              fontSize="10"
              fill="#9a9386"
            >
              {fmtK(v)}
            </text>
          </g>
        ))}

        {hover !== null ? (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={P.t}
            y2={P.t + iH}
            stroke="#d6c9a8"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        ) : null}

        <path d={area} fill={`url(#${gradId})`} />
        <path
          d={path}
          fill="none"
          stroke="#c9a227"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {hover !== null ? (
          <circle
            cx={x(hover)}
            cy={y(series[hover].total)}
            r="4.5"
            fill="#ffffff"
            stroke="#c9a227"
            strokeWidth="2"
          />
        ) : null}

        {labels.map(({ d, i }) => (
          <text
            key={d.day}
            x={x(i)}
            y={H - 8}
            textAnchor="middle"
            fontSize="10"
            fill="#9a9386"
          >
            {fmtShortDate(d.day)}
          </text>
        ))}
      </svg>

      {hover !== null && series[hover] ? (
        <div className="pointer-events-none absolute left-14 top-2 z-10 w-44 rounded-xl border border-[rgba(80,61,25,0.1)] bg-white/95 p-3 text-xs shadow-lg">
          <div className="font-semibold text-[#1f1b14]">
            {fmtShortDate(series[hover].day)}
          </div>
          <div className="mt-1 flex justify-between text-[#766b59]">
            <span>Revenue</span>
            <span className="font-semibold text-[#1f1b14]">
              {fmtMoney(series[hover].total)}
            </span>
          </div>
          <div className="mt-0.5 flex justify-between text-[#766b59]">
            <span>Sales</span>
            <span className="font-semibold text-[#1f1b14]">
              {series[hover].sales_count}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function WeekdayBars({ weekdays }: { weekdays: WeekdayStat[] }) {
  const max = Math.max(...weekdays.map((d) => d.revenue), 1);
  const withSales = weekdays.filter((d) => d.sales_count > 0);
  const bestId = withSales.length
    ? [...withSales].sort((a, b) => b.revenue - a.revenue)[0].weekday
    : null;
  const worstId =
    withSales.length > 1
      ? [...withSales].sort((a, b) => a.revenue - b.revenue)[0].weekday
      : null;

  if (!withSales.length) {
    return (
      <div className="py-12 text-center text-sm text-[#9a9386]">
        No weekday pattern in this range.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {weekdays.map((d) => {
        const pct = (d.revenue / max) * 100;
        const isBest = d.weekday === bestId;
        const isWorst = d.weekday === worstId;

        return (
          <div key={d.weekday} className="flex items-center gap-4">
            <div className="w-10 shrink-0 text-xs font-semibold text-[#766b59]">
              {d.shortLabel}
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#1f1b14]">
                    {d.label}
                  </span>
                  {isBest && (
                    <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                      Best
                    </span>
                  )}
                  {isWorst && (
                    <span className="text-[10px] font-bold uppercase tracking-wide text-rose-700">
                      Slowest
                    </span>
                  )}
                </div>
                <span className="text-sm font-semibold tabular-nums text-[#1f1b14]">
                  {fmtMoney(d.revenue)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#f3eee4]">
                <div
                  className="h-full rounded-full bg-[#d7a820]"
                  style={{ width: `${Math.max(d.sales_count ? 3 : 0, pct)}%` }}
                />
              </div>
              <div className="mt-1 text-[11px] text-[#9a9386]">
                {d.sales_count} sale{d.sales_count !== 1 ? "s" : ""}
                {d.sales_count ? ` · avg ${fmtMoney(d.avgBasket)}` : ""}
              </div>
            </div>
          </div>
        );
      })}
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
      <div className="py-12 text-center text-sm text-[#9a9386]">
        No product data available.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {data.slice(0, 10).map((p, i) => {
        const value = Number(p[valueKey] ?? 0);
        const pct = (value / max) * 100;

        return (
          <div key={p.product_id}>
            <div className="mb-1.5 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-[#1f1b14]">
                  {p.name}
                </div>
                <div className="mt-0.5 text-xs text-[#9a9386]">
                  {p.qty.toLocaleString("en-KE")} unit{p.qty === 1 ? "" : "s"} · #
                  {i + 1}
                </div>
              </div>
              <div className="shrink-0 text-sm font-semibold tabular-nums text-[#1f1b14]">
                {fmtMoney(p.revenue)}
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#f3eee4]">
              <div
                className="h-full rounded-full bg-[#d7a820]"
                style={{
                  width: `${Math.max(3, pct)}%`,
                  opacity: Math.max(0.35, 1 - i * 0.08),
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
      <div className="py-12 text-center text-sm text-[#9a9386]">
        No comparison data available.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-4 text-xs text-[#766b59]">
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#2d2417]" />
          Reference
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#d7a820]" />
          Comparison
        </span>
      </div>

      {metrics.map((m) => {
        const max = Math.max(Math.abs(m.a), Math.abs(m.b), 1);
        const aPct = (Math.abs(m.a) / max) * 100;
        const bPct = (Math.abs(m.b) / max) * 100;
        const positive = m.diff >= 0;

        return (
          <div key={m.label} className="border-b border-[#f1e6c9] pb-5 last:border-0 last:pb-0">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-[#1f1b14]">{m.label}</div>
                <div className="mt-0.5 text-xs text-[#9a9386]">
                  {fmtValue(m.a, m.money)} → {fmtValue(m.b, m.money)}
                </div>
              </div>
              <div
                className={`text-xs font-bold ${
                  positive ? "text-emerald-700" : "text-rose-700"
                }`}
              >
                {positive ? "+" : ""}
                {fmtValue(m.diff, m.money)} · {fmtPct(m.pct)}
              </div>
            </div>

            <div className="space-y-2.5">
              <div>
                <div className="mb-1 flex justify-between text-xs text-[#766b59]">
                  <span>Reference</span>
                  <span className="font-semibold text-[#1f1b14]">
                    {fmtValue(m.a, m.money)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#f3eee4]">
                  <div
                    className="h-full rounded-full bg-[#2d2417]"
                    style={{ width: `${Math.max(3, aPct)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs text-[#766b59]">
                  <span>Comparison</span>
                  <span className="font-semibold text-[#1f1b14]">
                    {fmtValue(m.b, m.money)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#f3eee4]">
                  <div
                    className="h-full rounded-full bg-[#d7a820]"
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
