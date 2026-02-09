// src/app/(dashboard)/products/page.styles.ts

export const inputCls =
  "w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-sm text-zinc-800 placeholder-zinc-400 " +
  "focus:border-amber-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-100 transition-colors";

export const selectCls =
  "w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 pr-9 text-sm text-zinc-800 " +
  "appearance-none bg-no-repeat bg-right focus:border-amber-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-100 transition-colors " +
  "cursor-pointer";

export const tableGridCols = "2.5fr 1.2fr 1fr 1fr .9fr .8fr 1fr auto";

export const selectChevronBg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%239ca3af' fill='none' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E")`;

export const selectChevronStyle = {
  backgroundImage: selectChevronBg,
  backgroundPosition: "right 12px center",
} as const;

export const cardCls = "rounded-2xl border border-zinc-200 bg-white shadow-sm";
export const softCardCls = "rounded-2xl border border-zinc-100 bg-white shadow-sm";

export const btnPrimary =
  "inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-black text-white shadow-sm " +
  "hover:bg-amber-600 active:scale-[.97] transition-all";

export const iconChip = "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-amber-600";
