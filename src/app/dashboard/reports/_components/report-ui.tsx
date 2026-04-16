"use client";

import React from "react";
import Link from "next/link";
import * as S from "../page.styles";

/* ════════════════════════════════════════════════════════════════
   SHARED HELPERS
════════════════════════════════════════════════════════════════ */
export function fmtMoney(v: number) {
  return `Ksh ${Number(v || 0).toLocaleString("en-KE", {
    maximumFractionDigits: 0,
  })}`;
}

export function fmtK(v: number) {
  return v >= 1_000_000
    ? `${(v / 1_000_000).toFixed(1)}M`
    : v >= 1_000
      ? `${(v / 1_000).toFixed(0)}k`
      : String(Math.round(v));
}

export function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function fmtDate(ymd: string) {
  try {
    const [y, m, d] = ymd.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-KE", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return ymd;
  }
}

export function downloadCSV(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;

  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => esc(r[h])).join(",")),
  ].join("\n");

  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" })
    ),
    download: filename,
  });

  a.click();
  URL.revokeObjectURL(a.href);
}

/* ════════════════════════════════════════════════════════════════
   SPINNER
════════════════════════════════════════════════════════════════ */
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

/* ════════════════════════════════════════════════════════════════
   REPORT HEADER
════════════════════════════════════════════════════════════════ */
export function ReportHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          {title}
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   BACK BUTTON
════════════════════════════════════════════════════════════════ */
export function ReportsBackButton() {
  return (
    <Link href="/dashboard/reports" className={S.btnGhost}>
      ← Reports
    </Link>
  );
}

/* ════════════════════════════════════════════════════════════════
   SEGMENTED CONTROL
════════════════════════════════════════════════════════════════ */
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
    <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1 gap-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition whitespace-nowrap ${
            value === o.value
              ? "bg-white border border-slate-200 shadow-sm text-slate-900"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   KPI CARD
════════════════════════════════════════════════════════════════ */
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
      className={`rounded-2xl border p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 ${cfg.bg} ${cfg.border}`}
    >
      <div
        className={`grid h-10 w-10 place-items-center rounded-xl text-lg mb-3 ${cfg.iconBg}`}
      >
        {icon}
      </div>
      <div className={`text-xs font-semibold uppercase tracking-wider mb-1.5 ${cfg.sub}`}>
        {label}
      </div>
      <div className={`text-2xl font-bold leading-tight ${cfg.val}`}>{value}</div>
      {sub && <div className={`mt-1 text-xs ${cfg.sub}`}>{sub}</div>}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   CARD WRAPPER
════════════════════════════════════════════════════════════════ */
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
          {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
        </div>
        {action}
      </div>
      {noPad ? children : <div className="px-5 py-4">{children}</div>}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   EMPTY STATE
════════════════════════════════════════════════════════════════ */
export function EmptyState({
  icon,
  title,
  detail,
}: {
  icon: string;
  title: string;
  detail?: string;
}) {
  return (
    <div className={`${S.card} py-16 text-center`}>
      <div className="text-4xl mb-3">{icon}</div>
      <div className="font-semibold text-slate-600">{title}</div>
      {detail && <div className="text-sm text-slate-400 mt-1">{detail}</div>}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   ERROR BANNER
════════════════════════════════════════════════════════════════ */
export function ErrorBanner({
  message,
  onClose,
}: {
  message: string;
  onClose?: () => void;
}) {
  return (
    <div className={S.alert}>
      <span className="shrink-0 mt-0.5">⚠️</span>
      <span className="flex-1">{message}</span>
      {onClose && (
        <button
          onClick={onClose}
          className="ml-auto text-red-400 hover:text-red-600"
        >
          ✕
        </button>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   INSIGHT CARD
════════════════════════════════════════════════════════════════ */
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
    positive: {
      border: "border-green-200",
      iconBg: "bg-green-50",
      titleColor: "text-green-800",
    },
    negative: {
      border: "border-red-200",
      iconBg: "bg-red-50",
      titleColor: "text-red-800",
    },
    warning: {
      border: "border-amber-200",
      iconBg: "bg-amber-50",
      titleColor: "text-amber-800",
    },
    critical: {
      border: "border-red-200",
      iconBg: "bg-red-50",
      titleColor: "text-red-800",
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
      className={`rounded-2xl border bg-white p-4 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 ${c.border}`}
    >
      <div className="flex gap-3 items-start">
        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-base ${c.iconBg}`}>
          {icon}
        </div>
        <div>
          <div className={`text-sm font-bold mb-1 ${c.titleColor}`}>{title}</div>
          <div className="text-xs text-slate-500 leading-relaxed">{detail}</div>
        </div>
      </div>
    </div>
  );
}