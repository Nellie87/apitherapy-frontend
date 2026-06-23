"use client";

import React from "react";
import * as S from "../page.styles";
import type { SortCol, StockHealth } from "./inventory-analytics.types";

export const STATUS_CFG: Record<
  StockHealth,
  { label: string; dot: string; cls: string }
> = {
  out: {
    label: "Out of Stock",
    dot: "#ef4444",
    cls: "bg-red-50 text-red-700 border-red-200",
  },
  critical: {
    label: "Critical",
    dot: "#f97316",
    cls: "bg-orange-50 text-orange-700 border-orange-200",
  },
  low: {
    label: "Low",
    dot: "#f59e0b",
    cls: "bg-amber-50 text-amber-700 border-amber-200",
  },
  ok: {
    label: "Healthy",
    dot: "#22c55e",
    cls: "bg-green-50 text-green-700 border-green-200",
  },
};

export function StatusBadge({ status }: { status: StockHealth }) {
  const c = STATUS_CFG[status] ?? STATUS_CFG.ok;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${c.cls}`}
    >
      {c.label}
    </span>
  );
}

export function Spinner({ h = 120 }: { h?: number }) {
  return (
    <div
      className="flex items-center justify-center gap-3 text-slate-400"
      style={{ height: h }}
    >
      <svg
        className="h-4 w-4 animate-spin"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="10" strokeOpacity="0.2" />
        <path d="M12 2a10 10 0 0110 10" />
      </svg>
      <span className="text-sm">Loading…</span>
    </div>
  );
}

export function UrgencyBar({ score }: { score: number }) {
  const color =
    score >= 75
      ? "#ef4444"
      : score >= 45
      ? "#f97316"
      : score >= 20
      ? "#f59e0b"
      : "#22c55e";

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
      <span className="w-7 text-right text-xs font-semibold text-slate-500">
        {score}
      </span>
    </div>
  );
}

export function SegControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex w-full gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-sm sm:w-fit">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition ${
            value === o.value
              ? "bg-amber-500 text-white shadow-sm"
              : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  sub,
  variant = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  variant?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  const cfg = {
    neutral: "border-slate-200 bg-white text-slate-900",
    success: "border-green-200 bg-green-50 text-green-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    danger: "border-red-200 bg-red-50 text-red-800",
    info: "border-blue-200 bg-blue-50 text-blue-800",
  }[variant];

  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${cfg}`}>
      <div className="text-xs font-semibold uppercase tracking-wide opacity-70">
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold leading-tight">{value}</div>
      {sub && <div className="mt-1 text-xs opacity-70">{sub}</div>}
    </div>
  );
}

export function Card({
  title,
  sub,
  action,
  children,
  noPad,
}: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  noPad?: boolean;
}) {
  return (
    <div className={`${S.card} overflow-hidden`}>
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-bold text-slate-900">{title}</div>
          {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
        </div>
        {action}
      </div>
      {noPad ? children : <div className="px-5 py-4">{children}</div>}
    </div>
  );
}

export function InsightCard({
  type,
  title,
  detail,
}: {
  type: string;
  title: string;
  detail: string;
}) {
  const cfg: Record<string, string> = {
    critical: "border-red-200 bg-red-50",
    warning: "border-amber-200 bg-amber-50",
    ok: "border-green-200 bg-green-50",
    neutral: "border-slate-200 bg-white",
  };

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${cfg[type] ?? cfg.neutral}`}>
      <div className="text-sm font-bold text-slate-900">{title}</div>
      <div className="mt-1 text-xs leading-relaxed text-slate-600">{detail}</div>
    </div>
  );
}

export function SortTh({
  col,
  active,
  dir,
  onSort,
  align = "left",
  children,
}: {
  col: SortCol;
  active: SortCol;
  dir: "asc" | "desc";
  onSort: (c: SortCol) => void;
  align?: "left" | "right";
  children: React.ReactNode;
}) {
  const isA = active === col;

  return (
    <button
      type="button"
      className={`flex w-full cursor-pointer select-none items-center gap-1 text-xs font-semibold uppercase tracking-wide ${
        align === "right" ? "justify-end" : ""
      } ${isA ? "text-amber-600" : "text-slate-500 hover:text-slate-700"}`}
      onClick={() => onSort(col)}
    >
      {children}
      <span className="opacity-60">{isA ? (dir === "desc" ? "↓" : "↑") : "↕"}</span>
    </button>
  );
}