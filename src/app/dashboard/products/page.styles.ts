// ── Inputs / Selects ──────────────────────────────────────────
export const fieldBase =
  "w-full rounded-2xl border border-[#E7D9B8] bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 " +
  "shadow-[0_1px_2px_rgba(15,23,42,0.025)] outline-none transition-all " +
  "focus:border-amber-400 focus:ring-4 focus:ring-amber-100/70";

export const inputCls = fieldBase;

export const selectCls =
  "w-full appearance-none rounded-2xl border border-[#E7D9B8] bg-white px-4 py-2.5 pr-10 text-sm text-slate-900 " +
  "shadow-[0_1px_2px_rgba(15,23,42,0.025)] outline-none transition-all cursor-pointer " +
  "focus:border-amber-400 focus:ring-4 focus:ring-amber-100/70";

// ── Table ─────────────────────────────────────────────────────
export const tableGridCols =
  "3fr 1.25fr 1.25fr 1fr 0.9fr 0.9fr 0.85fr 1.35fr 132px";

export const tableGap = "gap-5";

export const tableRowCls =
  "grid items-center gap-5 px-6 py-4 text-sm";

export const tableHeaderCls =
  "grid items-center gap-5 px-6 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400";

export const cellLeft = "text-left truncate";
export const cellRight = "text-right tabular-nums";
export const cellCenter = "text-center";

// ── Select chevron ────────────────────────────────────────────
export const selectChevronBg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%23716b5f' fill='none' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`;

export const selectChevronStyle = {
  backgroundImage: selectChevronBg,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 14px center",
  backgroundSize: "12px 12px",
} as const;

// ── Cards ─────────────────────────────────────────────────────
export const cardCls =
  "rounded-[28px] border border-[#E9DDBF] bg-white shadow-[0_18px_44px_rgba(92,64,16,0.055)]";

export const softCardCls =
  "rounded-2xl border border-[#F0E5CA] bg-[#FFFBF2]";

export const panelCls =
  "rounded-[28px] border border-[#E9DDBF] bg-white shadow-[0_18px_44px_rgba(92,64,16,0.055)] overflow-hidden";

export const panelHeaderCls =
  "border-b border-[#F0E5CA] bg-[linear-gradient(180deg,#FFFDF8_0%,#FFF9EC_100%)] px-5 py-4 lg:px-6";

// ── Buttons ───────────────────────────────────────────────────
export const btnPrimary =
  "inline-flex items-center justify-center rounded-2xl bg-[#D9A900] px-4 py-2.5 text-sm font-bold text-white " +
  "shadow-[0_12px_26px_rgba(217,169,0,0.20)] hover:bg-[#C79A00] hover:shadow-[0_16px_32px_rgba(217,169,0,0.24)] " +
  "active:scale-[.98] transition-all whitespace-nowrap";

export const btnGhost =
  "inline-flex items-center justify-center rounded-2xl border border-[#E7D9B8] bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 " +
  "hover:bg-[#FFF9EC] active:scale-[.98] transition-all whitespace-nowrap";

export const btnDanger =
  "inline-flex items-center justify-center rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 " +
  "hover:bg-red-100 active:scale-[.98] transition-all whitespace-nowrap";

export const btnSoft =
  "inline-flex items-center justify-center rounded-2xl border border-[#E7D9B8] bg-[#FFF9EC] px-4 py-2.5 text-sm font-semibold text-[#725612] " +
  "hover:bg-[#FFF4D6] active:scale-[.98] transition-all whitespace-nowrap";

// Kept only so older imports do not break; no visual icon chip should be used.
export const iconChip = "hidden";
