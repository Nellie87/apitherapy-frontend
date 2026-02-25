// src/app/(dashboard)/products/page.styles.ts

// ── Input / Select ────────────────────────────────────────────
export const inputCls =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400 " +
  "focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100 transition-colors";

export const selectCls =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 pr-9 text-sm text-slate-900 " +
  "appearance-none bg-no-repeat focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100 " +
  "transition-colors cursor-pointer";

// ── Table ─────────────────────────────────────────────────────
// 9 columns: Product | Category | Supplier | Barcode | Cost | Sell | Margin | Status | Actions
export const tableGridCols = "2fr 1fr 1fr 1fr 0.8fr 0.8fr 0.7fr 1fr auto";

// ── Select chevron ────────────────────────────────────────────
export const selectChevronBg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%236b7280' fill='none' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E")`;

export const selectChevronStyle = {
  backgroundImage: selectChevronBg,
  backgroundPosition: "right 12px center",
} as const;

// ── Cards ─────────────────────────────────────────────────────
export const cardCls = "rounded-2xl border border-slate-200 bg-white shadow-sm";
export const softCardCls = "rounded-xl border border-slate-100 bg-slate-50";

// ── Buttons ───────────────────────────────────────────────────
export const btnPrimary =
  "inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow-sm " +
  "hover:bg-amber-600 active:scale-[.97] transition-all whitespace-nowrap";

export const btnGhost =
  "inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 " +
  "hover:bg-slate-50 active:scale-[.97] transition-all whitespace-nowrap";

export const btnDanger =
  "inline-flex items-center gap-1.5 rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white " +
  "hover:bg-red-600 active:scale-[.97] transition-all whitespace-nowrap";

export const iconChip =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600";