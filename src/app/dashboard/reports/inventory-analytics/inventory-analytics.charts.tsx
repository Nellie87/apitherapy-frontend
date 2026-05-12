"use client";

import React, { useState } from "react";
import type { StockHealth } from "./inventory-analytics.types";
import { fmtMoney } from "./inventory-analytics.helpers";

export function StatusDonut({
  segs,
}: {
  segs: { label: string; value: number; color: string }[];
}) {
  const [hover, setHover] = useState<number | null>(null);

  const R = 70;
  const r = 42;
  const cx = 90;
  const cy = 90;
  const W = 280;
  const H = 180;

  const total = segs.reduce((s, x) => s + x.value, 0);

  if (!total) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-slate-400">
        No data
      </div>
    );
  }

  let angle = -Math.PI / 2;

  const arcs = segs.map((seg, idx) => {
    const sweep = (seg.value / total) * 2 * Math.PI;
    const sA = angle + 0.025;
    const eA = angle + sweep - 0.025;
    angle += sweep;

    const eR = hover === idx ? R + 8 : R;
    const cos = Math.cos;
    const sin = Math.sin;

    const d = [
      `M${(cx + eR * cos(sA)).toFixed(2)},${(cy + eR * sin(sA)).toFixed(2)}`,
      `A${eR},${eR} 0 ${sweep > Math.PI ? 1 : 0} 1 ${(
        cx +
        eR * cos(eA)
      ).toFixed(2)},${(cy + eR * sin(eA)).toFixed(2)}`,
      `L${(cx + r * cos(eA)).toFixed(2)},${(cy + r * sin(eA)).toFixed(2)}`,
      `A${r},${r} 0 ${sweep > Math.PI ? 1 : 0} 0 ${(
        cx +
        r * cos(sA)
      ).toFixed(2)},${(cy + r * sin(sA)).toFixed(2)}Z`,
    ].join(" ");

    return {
      ...seg,
      idx,
      d,
      pct: ((seg.value / total) * 100).toFixed(0),
    };
  });

  const LX = cx * 2 + 12;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      {arcs.map((a) => (
        <path
          key={a.idx}
          d={a.d}
          fill={a.color}
          opacity={hover === null || hover === a.idx ? 1 : 0.4}
          style={{ transition: "opacity 0.15s", cursor: "pointer" }}
          onMouseEnter={() => setHover(a.idx)}
          onMouseLeave={() => setHover(null)}
        />
      ))}

      <circle cx={cx} cy={cy} r={r - 2} fill="white" />

      <text
        x={cx}
        y={cy - 6}
        textAnchor="middle"
        fontSize="9"
        fill="#94a3b8"
        fontWeight="600"
      >
        Products
      </text>

      <text
        x={cx}
        y={cy + 10}
        textAnchor="middle"
        fontSize="15"
        fill="#0f172a"
        fontWeight="700"
      >
        {total}
      </text>

      {hover !== null && (
        <text
          x={cx}
          y={cy + 26}
          textAnchor="middle"
          fontSize="9.5"
          fill={arcs[hover]?.color}
          fontWeight="700"
        >
          {arcs[hover]?.pct}%
        </text>
      )}

      {arcs.map((a, i) => {
        const ly = 16 + i * 36;
        const isH = hover === a.idx;

        return (
          <g
            key={i}
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setHover(a.idx)}
            onMouseLeave={() => setHover(null)}
          >
            <rect
              x={LX}
              y={ly - 8}
              width="10"
              height="10"
              rx="3"
              fill={a.color}
              opacity={isH ? 1 : 0.8}
            />
            <text
              x={LX + 15}
              y={ly + 1}
              fontSize="11"
              fill={isH ? "#0f172a" : "#64748b"}
              fontWeight={isH ? "700" : "400"}
            >
              {a.label}
            </text>
            <text
              x={W - 4}
              y={ly + 1}
              textAnchor="end"
              fontSize="11"
              fill={isH ? a.color : "#94a3b8"}
              fontWeight={isH ? "700" : "400"}
            >
              {a.value} ({a.pct}%)
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function CoverageBar({
  data,
}: {
  data: { name: string; count: number }[];
}) {
  const [hover, setHover] = useState<number | null>(null);

  const W = 400;
  const H = 160;
  const P = { t: 14, r: 12, b: 32, l: 40 };
  const iW = W - P.l - P.r;
  const iH = H - P.t - P.b;
  const maxV = Math.max(...data.map((d) => d.count), 1);
  const bW = iW / data.length - 10;

  const colors = ["#ef4444", "#f97316", "#f59e0b", "#3b82f6", "#22c55e"];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      <line
        x1={P.l}
        y1={P.t + iH}
        x2={W - P.r}
        y2={P.t + iH}
        stroke="#e2e8f0"
      />

      {data.map((d, i) => {
        const x = P.l + i * (bW + 10) + 4;
        const bH = Math.max(3, (d.count / maxV) * iH * 0.92);
        const y = P.t + iH - bH;
        const mid = x + bW / 2;
        const isH = hover === i;
        const c = colors[i] ?? "#3b82f6";

        return (
          <g
            key={d.name}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <rect
              x={x}
              y={y}
              width={bW}
              height={bH}
              rx="4"
              fill={c}
              opacity={hover === null || isH ? 0.85 : 0.35}
            />

            {isH && (
              <rect
                x={x - 1}
                y={y - 1}
                width={bW + 2}
                height={bH + 2}
                rx="5"
                fill="none"
                stroke={c}
                strokeWidth="1.5"
              />
            )}

            <text
              x={mid}
              y={P.t + iH + 16}
              textAnchor="middle"
              fontSize="9"
              fill={isH ? "#475569" : "#94a3b8"}
              fontWeight={isH ? "700" : "400"}
            >
              {d.name}
            </text>

            {d.count > 0 && (
              <text
                x={mid}
                y={y - 5}
                textAnchor="middle"
                fontSize="9"
                fill={c}
                fontWeight="700"
              >
                {d.count}
              </text>
            )}
          </g>
        );
      })}

      {[0, Math.round(maxV / 2), maxV].map((v, i) => {
        const y = P.t + iH - (v / maxV) * iH * 0.92;

        return (
          <text
            key={i}
            x={P.l - 5}
            y={y + 4}
            textAnchor="end"
            fontSize="8.5"
            fill="#94a3b8"
          >
            {v}
          </text>
        );
      })}
    </svg>
  );
}

export function CategoryValueBars({
  data,
}: {
  data: { name: string; value: number; atRisk: number; count: number }[];
}) {
  const [hover, setHover] = useState<number | null>(null);

  const max = Math.max(...data.map((d) => d.value), 1);
  const colors = [
    "#f59e0b",
    "#3b82f6",
    "#8b5cf6",
    "#10b981",
    "#ef4444",
    "#06b6d4",
    "#f97316",
    "#ec4899",
  ];

  return (
    <div className="space-y-3">
      {data.slice(0, 8).map((d, i) => {
        const pct = (d.value / max) * 100;
        const riskP = d.count > 0 ? (d.atRisk / d.count) * 100 : 0;
        const isH = hover === i;

        return (
          <div
            key={d.name}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            className="cursor-default"
          >
            <div className="mb-1 flex items-center justify-between">
              <span
                className={`max-w-[180px] truncate text-xs font-medium transition-colors ${
                  isH ? "text-slate-900" : "text-slate-600"
                }`}
              >
                {d.name}
              </span>

              <span
                className={`ml-2 text-xs font-bold transition-colors ${
                  isH ? "text-slate-900" : "text-slate-700"
                }`}
              >
                {fmtMoney(d.value)}
              </span>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.max(1.5, pct)}%`,
                  background: colors[i % colors.length],
                  opacity: isH ? 1 : 0.7,
                }}
              />
            </div>

            {isH && (
              <div className="mt-1 text-xs text-slate-400">
                {d.count} products ·{" "}
                {riskP > 0 ? (
                  <span className="font-semibold text-red-500">
                    {riskP.toFixed(0)}% at risk
                  </span>
                ) : (
                  <span className="text-green-600">all healthy</span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ValueBars({
  data,
}: {
  data: { name: string; value: number; status: StockHealth }[];
}) {
  const [hover, setHover] = useState<number | null>(null);

  const max = Math.max(...data.map((d) => d.value), 1);

  const statusColor = (s: StockHealth) =>
    s === "out"
      ? "#ef4444"
      : s === "critical"
      ? "#f97316"
      : s === "low"
      ? "#f59e0b"
      : "#22c55e";

  return (
    <div className="space-y-2.5">
      {data.map((d, i) => {
        const pct = (d.value / max) * 100;
        const isH = hover === i;
        const col = statusColor(d.status);

        return (
          <div
            key={`${d.name}-${i}`}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            className="cursor-default"
          >
            <div className="mb-1 flex items-center justify-between">
              <span
                className={`flex max-w-[200px] items-center gap-1.5 truncate text-xs font-medium transition-colors ${
                  isH ? "text-slate-900" : "text-slate-600"
                }`}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: col }}
                />
                {d.name}
              </span>

              <span
                className={`ml-2 text-xs font-bold transition-colors ${
                  isH ? "text-slate-900" : "text-slate-700"
                }`}
              >
                {fmtMoney(d.value)}
              </span>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.max(1.5, pct)}%`,
                  background: col,
                  opacity: isH ? 1 : 0.72,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ParetoChart({
  data,
}: {
  data: { rank: number; cumPct: number; name: string }[];
}) {
  const [hover, setHover] = useState<number | null>(null);

  const W = 500;
  const H = 150;
  const P = { t: 14, r: 16, b: 30, l: 44 };
  const iW = W - P.l - P.r;
  const iH = H - P.t - P.b;
  const bW = data.length > 0 ? iW / data.length - 3 : 0;

  const ys = (v: number) => P.t + iH - (v / 100) * iH * 0.92;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      <line
        x1={P.l}
        y1={P.t + iH}
        x2={W - P.r}
        y2={P.t + iH}
        stroke="#e2e8f0"
      />

      {[0, 25, 50, 80, 100].map((v) => {
        const y = ys(v);

        return (
          <g key={v}>
            <line
              x1={P.l}
              y1={y}
              x2={W - P.r}
              y2={y}
              stroke={v === 80 ? "#fde68a" : "#f8fafc"}
              strokeDasharray={v === 80 ? "4 3" : "none"}
            />
            <text
              x={P.l - 5}
              y={y + 4}
              textAnchor="end"
              fontSize="8.5"
              fill="#94a3b8"
            >
              {v}%
            </text>
          </g>
        );
      })}

      {data.map((d, i) => {
        const x = P.l + i * (bW + 3) + 1;
        const bH = Math.max(3, (d.cumPct / 100) * iH * 0.92);
        const y = P.t + iH - bH;
        const mid = x + bW / 2;
        const isH = hover === i;
        const isA = d.cumPct <= 80;

        return (
          <g
            key={d.rank}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <rect
              x={x}
              y={y}
              width={bW}
              height={bH}
              rx="2"
              fill={isA ? "#3b82f6" : "#cbd5e1"}
              opacity={hover === null || isH ? (isA ? 0.85 : 0.6) : 0.3}
            />

            {isH && (
              <text
                x={mid}
                y={y - 5}
                textAnchor="middle"
                fontSize="8.5"
                fill={isA ? "#3b82f6" : "#94a3b8"}
                fontWeight="700"
              >
                {d.cumPct}%
              </text>
            )}
          </g>
        );
      })}

      {[1, Math.round(data.length / 2), data.length]
        .filter(Boolean)
        .map((rank) => {
          const idx = rank - 1;

          if (idx < 0 || idx >= data.length) return null;

          const x = P.l + idx * (bW + 3) + (bW + 3) / 2;

          return (
            <text
              key={rank}
              x={x}
              y={H - 6}
              textAnchor="middle"
              fontSize="8.5"
              fill="#94a3b8"
            >
              #{rank}
            </text>
          );
        })}
    </svg>
  );
}