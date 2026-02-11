// src/app/(dashboard)/inventory/page.styles.ts

export const card = [
  "rounded-2xl border border-zinc-200/80 bg-white shadow-sm",
].join(" ");

export const soft = "rounded-xl border border-zinc-100 bg-white shadow-sm";

export const input =
  "w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm outline-none " +
  "focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition placeholder:text-zinc-400";

export const inputSoft =
  "w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm outline-none " +
  "focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100 transition placeholder:text-zinc-400";

export const btnPrimary =
  "inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-white " +
  "hover:bg-amber-600 active:scale-[.98] transition shadow-sm shadow-amber-200 whitespace-nowrap";

export const btnGhost =
  "inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 " +
  "text-sm font-semibold text-zinc-700 hover:bg-zinc-50 active:scale-[.98] transition whitespace-nowrap";

export const btnIcon =
  "grid h-9 w-9 place-items-center rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 transition text-zinc-500 hover:text-zinc-800";

export const badge = "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold";

export const overlay =
  "fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4";

export const modal =
  "w-full sm:max-w-2xl rounded-t-3xl sm:rounded-2xl border-t sm:border border-zinc-200 bg-white shadow-2xl overflow-hidden max-h-[90vh] flex flex-col";

export const modalHead =
  "flex items-center justify-between border-b border-zinc-100 px-5 py-4 shrink-0";

export const modalBody = "px-5 py-5 overflow-y-auto";

export const modalFoot =
  "flex items-center justify-end gap-3 border-t border-zinc-100 px-5 py-4 shrink-0";

// Table layout — responsive via CSS grid
// Desktop: Product(2fr) | Category(1fr) | OnHand(1fr) | Reorder(1fr) | Status(1fr) | Actions(1.5fr)
export const tableGrid = "grid-cols-[2fr_1fr_1fr_1.2fr_1fr_1.6fr]";
export const tableGridMobile = "grid-cols-[1fr_auto]";