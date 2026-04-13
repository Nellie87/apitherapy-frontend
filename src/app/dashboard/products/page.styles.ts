// src/app/(dashboard)/products/page.styles.ts

// ── Input / Select ────────────────────────────────────────────
export const inputCls =
  "w-full rounded-2xl border border-[#EADFC2] bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 " +
  "shadow-[0_1px_2px_rgba(15,23,42,0.03)] " +
  "focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100 transition-all";

export const selectCls =
  "w-full appearance-none rounded-2xl border border-[#EADFC2] bg-white px-3.5 py-2.5 pr-9 text-sm text-slate-900 " +
  "bg-no-repeat shadow-[0_1px_2px_rgba(15,23,42,0.03)] " +
  "focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100 " +
  "transition-all cursor-pointer";

// ── Table ─────────────────────────────────────────────────────
//
// Column breakdown (total ~12fr + 120px fixed):
//   Product    3fr   — name + subtext, needs the most room
//   Category   1.2fr — single word / short phrase
//   Supplier   1.2fr — same as category
//   Barcode    1fr   — mono, short codes
//   Cost       0.9fr — right-aligned numeric
//   Sell       0.9fr — right-aligned numeric
//   Margin     0.85fr— right-aligned badge
//   Status     1.4fr — badges need breathing room
//   Actions    120px — fixed, prevents squish
//
export const tableGridCols =
  "3fr 1.2fr 1.2fr 1fr 0.9fr 0.9fr 0.85fr 1.4fr 120px";

// Gap between columns — generous enough to breathe, tight enough to fit
export const tableGap = "gap-5";

// Row + header shared className
export const tableRowCls =
  "grid items-center gap-5 px-6 py-4 text-sm";

export const tableHeaderCls =
  "grid items-center gap-5 px-6 py-3 " +
  "text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400";

// Cell alignment helpers — apply these to individual cells
export const cellLeft   = "text-left truncate";
export const cellRight  = "text-right tabular-nums";
export const cellCenter = "text-center";

// ── Select chevron ────────────────────────────────────────────
export const selectChevronBg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%2364748b' fill='none' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`;

export const selectChevronStyle = {
  backgroundImage: selectChevronBg,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 14px center",
  backgroundSize: "12px 12px",
} as const;

// ── Cards ─────────────────────────────────────────────────────
export const cardCls =
  "rounded-[24px] border border-[#EADFC2] bg-white shadow-[0_12px_36px_rgba(245,197,24,0.06)]";

export const softCardCls =
  "rounded-2xl border border-[#F1E6C9] bg-[#FFF9EC]";

// ── Buttons ───────────────────────────────────────────────────
export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-white " +
  "shadow-[0_12px_28px_rgba(245,197,24,0.25)] hover:bg-amber-600 hover:shadow-[0_16px_34px_rgba(245,197,24,0.32)] " +
  "active:scale-[.98] transition-all whitespace-nowrap";

export const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-2xl border border-[#EADFC2] bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 " +
  "hover:bg-[#FFF8E6] active:scale-[.98] transition-all whitespace-nowrap";

export const btnDanger =
  "inline-flex items-center justify-center gap-1.5 rounded-2xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white " +
  "shadow-[0_10px_24px_rgba(239,68,68,0.18)] hover:bg-red-600 active:scale-[.98] transition-all whitespace-nowrap";

export const iconChip =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-100";