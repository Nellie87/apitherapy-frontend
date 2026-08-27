"use client";

import React from "react";

export const fmtMoney = (v: number) =>
  `Ksh ${Number(v || 0).toLocaleString("en-KE")}`;

export const fmtK = (v: number) =>
  v >= 1_000_000
    ? `${(v / 1_000_000).toFixed(1)}M`
    : v >= 1000
      ? `${(v / 1000).toFixed(0)}k`
      : `${Math.round(v)}`;

export const downloadCSV = (filename: string, rows: any[]) => {
  const header = Object.keys(rows[0] || {});
  const csv = [
    header.join(","),
    ...rows.map((r) => header.map((h) => r[h]).join(",")),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
};

export function ReportHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="font-display text-[2rem] leading-tight tracking-tight text-[#1f1b14]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1.5 text-sm text-[#766b59]">{subtitle}</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </div>
  );
}

export function ReportsBackButton() {
  return (
    <button
      onClick={() => window.history.back()}
      className="rounded-xl border border-[rgba(80,61,25,0.12)] bg-white px-3 py-2 text-sm font-semibold text-[#3d321c] transition hover:bg-[#fffdf7]"
    >
      ← Back
    </button>
  );
}

export function Card({
  title,
  sub,
  children,
  action,
  noPad,
}: {
  title?: string;
  sub?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  noPad?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[rgba(80,61,25,0.1)] bg-white">
      {(title || action) && (
        <div className="flex flex-col gap-3 px-5 pt-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {title ? (
              <div className="text-[15px] font-semibold tracking-tight text-[#1f1b14]">
                {title}
              </div>
            ) : null}
            {sub ? (
              <div className="mt-0.5 text-xs leading-relaxed text-[#766b59]">
                {sub}
              </div>
            ) : null}
          </div>
          {action}
        </div>
      )}

      <div className={noPad ? "mt-4" : title || action ? "p-5" : "p-5"}>
        {children}
      </div>
    </div>
  );
}

export function KpiCard({
  label,
  value,
  sub,
  tone = "neutral",
  variant,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "neutral" | "success" | "warning" | "danger";
  variant?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  const resolved =
    tone !== "neutral"
      ? tone
      : variant === "info"
        ? "neutral"
        : variant ?? "neutral";

  const accent = {
    neutral: "bg-[#d7a820]",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-rose-500",
  }[resolved];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[rgba(80,61,25,0.1)] bg-white p-5">
      <div className={`absolute inset-x-0 top-0 h-[3px] ${accent}`} />
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a7b5e]">
        {label}
      </div>
      <div className="mt-2.5 text-[1.55rem] font-semibold leading-none tracking-tight text-[#1f1b14]">
        {value}
      </div>
      {sub ? (
        <div className="mt-2 text-xs leading-relaxed text-[#766b59]">{sub}</div>
      ) : null}
    </div>
  );
}

export function Spinner({ h = 100 }: { h?: number }) {
  return (
    <div className="flex items-center justify-center" style={{ height: h }}>
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#d7a820] border-t-transparent" />
    </div>
  );
}

export function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[rgba(80,61,25,0.16)] bg-white px-6 py-16 text-center">
      <div className="font-semibold text-[#1f1b14]">{title}</div>
      {detail ? (
        <div className="mt-1.5 text-sm text-[#766b59]">{detail}</div>
      ) : null}
    </div>
  );
}

export function ErrorBanner({
  message,
  onClose,
}: {
  message: string;
  onClose?: () => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      <span className="flex-1">{message}</span>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="font-semibold text-rose-400 hover:text-rose-700"
        >
          Close
        </button>
      ) : null}
    </div>
  );
}

export function SegControl({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: any) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="inline-flex w-full gap-1 overflow-x-auto rounded-full border border-[rgba(80,61,25,0.12)] bg-[#fffdf8] p-1 sm:w-fit">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
            value === opt.value
              ? "bg-[#2d2417] text-white"
              : "text-[#766b59] hover:bg-white hover:text-[#1f1b14]"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function InsightCard({
  title,
  detail,
  type,
}: {
  title: string;
  detail: string;
  type?: string;
}) {
  const tone =
    type === "positive" || type === "ok"
      ? "border-l-emerald-500"
      : type === "negative" || type === "critical"
        ? "border-l-rose-500"
        : type === "warning"
          ? "border-l-amber-500"
          : "border-l-[#d7a820]";

  return (
    <div
      className={`rounded-2xl border border-[rgba(80,61,25,0.1)] border-l-[3px] bg-white p-4 ${tone}`}
    >
      <div className="text-sm font-semibold text-[#1f1b14]">{title}</div>
      <div className="mt-1.5 text-xs leading-relaxed text-[#766b59]">{detail}</div>
    </div>
  );
}
