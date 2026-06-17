// src/app/(dashboard)/inventory/page.styles.ts

export const card =
  "rounded-[28px] border border-[#EADFC2] bg-white shadow-[0_12px_36px_rgba(92,64,16,0.06)]";

export const soft =
  "rounded-2xl border border-[#F1E6C9] bg-[#FFFDF8] shadow-sm";

export const input =
  "w-full rounded-2xl border border-[#EADFC2] bg-white px-3.5 py-2.5 text-sm outline-none text-slate-900 " +
  "placeholder:text-slate-400 shadow-[0_1px_2px_rgba(15,23,42,0.03)] " +
  "focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all";

export const inputSoft =
  "w-full rounded-2xl border border-[#F1E6C9] bg-[#FFFDF8] px-3.5 py-2.5 text-sm outline-none text-slate-900 " +
  "placeholder:text-slate-400 focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100 transition-all";

export const btnPrimary =
  "inline-flex items-center justify-center rounded-2xl bg-[#2F2718] px-4 py-2.5 text-sm font-bold text-white " +
  "hover:bg-[#1F1A10] active:scale-[.98] transition-all shadow-[0_10px_24px_rgba(47,39,24,0.16)] whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed";

export const btnGhost =
  "inline-flex items-center justify-center rounded-2xl border border-[#EADFC2] bg-white px-4 py-2.5 " +
  "text-sm font-semibold text-slate-700 hover:bg-[#FFF8E6] active:scale-[.98] transition-all whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed";

export const textButton =
  "inline-flex items-center justify-center rounded-xl px-3 py-2 text-xs font-bold text-slate-600 " +
  "hover:bg-[#FFF8E6] hover:text-slate-900 transition-all disabled:opacity-40 disabled:cursor-not-allowed";

export const badge =
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold";

export const overlay =
  "fixed inset-0 z-50 bg-slate-950/35 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4";

export const modal =
  "w-full sm:max-w-2xl rounded-t-3xl sm:rounded-[28px] border-t sm:border border-[#EADFC2] bg-white shadow-2xl overflow-hidden max-h-[90vh] flex flex-col";

export const modalHead =
  "flex items-center justify-between border-b border-[#F1E6C9] bg-[linear-gradient(180deg,#FFFDF8_0%,#FFF8E6_100%)] px-6 py-5 shrink-0";

export const modalBody = "px-6 py-6 overflow-y-auto";

export const modalFoot =
  "flex items-center justify-end gap-3 border-t border-[#F1E6C9] bg-white/95 px-6 py-4 shrink-0 backdrop-blur";

export const pageCard =
  "rounded-[28px] border border-[#EADFC2] bg-white shadow-[0_12px_36px_rgba(92,64,16,0.06)] overflow-hidden";

export const pageCardHead =
  "border-b border-[#F1E6C9] bg-[linear-gradient(180deg,#FFFDF8_0%,#FFF9EC_100%)] px-5 py-4 lg:px-6";

export const rowCard =
  "group rounded-[24px] border border-[#EFE4C6] bg-[linear-gradient(180deg,#FFFFFF_0%,#FFFCF4_100%)] shadow-[0_8px_30px_rgba(92,64,16,0.04)] transition-all duration-200 hover:-translate-y-px hover:shadow-[0_16px_34px_rgba(92,64,16,0.08)]";

export const tableHeader =
  "grid items-center gap-4 px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500";

export const tableRow =
  "hidden lg:grid items-center gap-4 px-6 py-5 text-sm";

// Product | Category | On Hand | Reorder At | Total Value | Status | Actions
export const tableGrid = "2fr 1.05fr 0.85fr 0.95fr 1.1fr 0.95fr 1.6fr";
export const tableGridMobile = "grid-cols-[1fr_auto]";
