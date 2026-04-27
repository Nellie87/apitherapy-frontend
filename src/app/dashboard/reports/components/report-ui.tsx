-"use client";

import React from "react";

/* ─────────────────────────────
   FORMATTERS
───────────────────────────── */

export const fmtMoney = (v: number) =>
  `Ksh ${Number(v || 0).toLocaleString("en-KE")}`;

export const fmtK = (v: number) =>
  v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${Math.round(v)}`;

/* ─────────────────────────────
   BUTTONS
───────────────────────────── */

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

/* ─────────────────────────────
   LAYOUT
───────────────────────────── */

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
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-black text-slate-950">{title}</h1>
        {subtitle && (
          <p className="text-sm text-slate-500">{subtitle}</p>
        )}
      </div>
      <div className="flex gap-2">{actions}</div>
    </div>
  );
}

export function ReportsBackButton() {
  return (
    <button
      onClick={() => window.history.back()}
      className="rounded-xl border px-3 py-2 text-sm"
    >
      ← Back
    </button>
  );
}

/* ─────────────────────────────
   CARDS
───────────────────────────── */

export function Card({
  title,
  sub,
  children,
  action,
  noPad,
}: any) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      {(title || action) && (
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <div className="font-bold text-slate-900">{title}</div>
            {sub && <div className="text-xs text-slate-400">{sub}</div>}
          </div>
          {action}
        </div>
      )}

      <div className={noPad ? "" : "p-5"}>{children}</div>
    </div>
  );
}

/* ─────────────────────────────
   KPI
───────────────────────────── */

export function KpiCard({
  label,
  value,
  sub,
}: any) {
  return (
    <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
      <div className="text-xs uppercase text-amber-600 font-bold">
        {label}
      </div>
      <div className="mt-2 text-xl font-black text-slate-950">
        {value}
      </div>
      <div className="text-xs text-slate-500">{sub}</div>
    </div>
  );
}

/* ─────────────────────────────
   STATES
───────────────────────────── */

export function Spinner({ h = 100 }: { h?: number }) {
  return (
    <div
      className="flex items-center justify-center"
      style={{ height: h }}
    >
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
    </div>
  );
}

export function EmptyState({ title, detail }: any) {
  return (
    <div className="text-center py-10">
      <div className="font-bold text-slate-900">{title}</div>
      <div className="text-sm text-slate-500">{detail}</div>
    </div>
  );
}

export function ErrorBanner({ message }: any) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {message}
    </div>
  );
}

/* ─────────────────────────────
   SEGMENT CONTROL
───────────────────────────── */

export function SegControl({
  value,
  onChange,
  options,
}: any) {
  return (
    <div className="flex rounded-xl border bg-white overflow-hidden">
      {options.map((opt: any) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-2 text-sm font-semibold ${
            value === opt.value
              ? "bg-amber-500 text-white"
              : "text-slate-600"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* ─────────────────────────────
   INSIGHT
───────────────────────────── */

export function InsightCard({ title, detail }: any) {
  return (
    <div className="rounded-2xl border border-amber-100 bg-white p-4">
      <div className="font-bold text-slate-900">{title}</div>
      <div className="text-xs text-slate-500">{detail}</div>
    </div>
  );
}