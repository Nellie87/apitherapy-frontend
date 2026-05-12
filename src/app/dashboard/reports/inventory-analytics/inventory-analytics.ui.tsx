"use client";

import React from "react";
import * as S from "../page.styles";
import type { SortCol, StockHealth } from "./inventory-analytics.types";

export const STATUS_CFG: Record<
  StockHealth,
  { label: string; dot: string; cls: string; icon: string }
> = {
  out: {
    label: "Out of Stock",
    dot: "#ef4444",
    cls: "bg-red-100 text-red-700",
    icon: "🚫",
  },
  critical: {
    label: "Critical",
    dot: "#f97316",
    cls: "bg-orange-100 text-orange-700",
    icon: "🔥",
  },
  low: {
    label: "Low",
    dot: "#f59e0b",
    cls: "bg-amber-100 text-amber-700",
    icon: "📉",
  },
  ok: {
    label: "Healthy",
    dot: "#22c55e",
    cls: "bg-green-100 text-green-700",
    icon: "✅",
  },
};

export function StatusBadge({ status }: { status: StockHealth }) {
  const c = STATUS_CFG[status] ?? STATUS_CFG.ok;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${c.cls}`}
    >
      {c.icon} {c.label}
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
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"
        style={{ minWidth: 56 }}
      >
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
      <span className="w-6 text-right text-xs font-bold text-slate-400">
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
    <div className="flex items-center gap-0.5 rounded-xl border border-slate-200 bg-slate-50 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            value === o.value
              ? "border border-slate-200 bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
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
  icon,
  variant = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  icon: string;
  variant?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  const cfg = {
    neutral: {
      bg: "bg-white",
      border: "border-slate-200",
      iconBg: "bg-slate-50",
      val: "text-slate-900",
      sub: "text-slate-500",
    },
    success: {
      bg: "bg-green-50",
      border: "border-green-200",
      iconBg: "bg-green-100",
      val: "text-green-800",
      sub: "text-green-600",
    },
    warning: {
      bg: "bg-amber-50",
      border: "border-amber-200",
      iconBg: "bg-amber-100",
      val: "text-amber-800",
      sub: "text-amber-600",
    },
    danger: {
      bg: "bg-red-50",
      border: "border-red-200",
      iconBg: "bg-red-100",
      val: "text-red-800",
      sub: "text-red-500",
    },
    info: {
      bg: "bg-blue-50",
      border: "border-blue-200",
      iconBg: "bg-blue-100",
      val: "text-blue-800",
      sub: "text-blue-600",
    },
  }[variant];

  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${cfg.bg} ${cfg.border}`}
    >
      <div
        className={`mb-3 grid h-10 w-10 place-items-center rounded-xl text-lg ${cfg.iconBg}`}
      >
        {icon}
      </div>
      <div className={`mb-1.5 text-xs font-semibold uppercase tracking-wider ${cfg.sub}`}>
        {label}
      </div>
      <div className={`text-2xl font-bold leading-tight ${cfg.val}`}>
        {value}
      </div>
      {sub && <div className={`mt-1 text-xs ${cfg.sub}`}>{sub}</div>}
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
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
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
  icon,
  title,
  detail,
}: {
  type: string;
  icon: string;
  title: string;
  detail: string;
}) {
  const cfg: Record<
    string,
    { border: string; iconBg: string; titleColor: string }
  > = {
    critical: {
      border: "border-red-200",
      iconBg: "bg-red-50",
      titleColor: "text-red-800",
    },
    warning: {
      border: "border-amber-200",
      iconBg: "bg-amber-50",
      titleColor: "text-amber-800",
    },
    ok: {
      border: "border-green-200",
      iconBg: "bg-green-50",
      titleColor: "text-green-800",
    },
    neutral: {
      border: "border-slate-200",
      iconBg: "bg-slate-50",
      titleColor: "text-slate-900",
    },
  };

  const c = cfg[type] ?? cfg.neutral;

  return (
    <div
      className={`rounded-2xl border bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${c.border}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-base ${c.iconBg}`}
        >
          {icon}
        </div>
        <div>
          <div className={`mb-1 text-sm font-bold ${c.titleColor}`}>
            {title}
          </div>
          <div className="text-xs leading-relaxed text-slate-500">
            {detail}
          </div>
        </div>
      </div>
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
    <div
      className={`flex cursor-pointer select-none items-center gap-1 text-xs font-semibold uppercase tracking-wider ${
        align === "right" ? "justify-end" : ""
      } ${
        isA
          ? "text-amber-600"
          : "text-slate-500 hover:text-slate-700"
      }`}
      onClick={() => onSort(col)}
    >
      {children}
      <span className="text-xs opacity-60">
        {isA ? (dir === "desc" ? "↓" : "↑") : "↕"}
      </span>
    </div>
  );
}