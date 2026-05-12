export const card =
  "rounded-[24px] border border-slate-200 bg-white shadow-[0_12px_36px_rgba(15,23,42,0.05)]";

export const input =
  "w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition " +
  "focus:border-slate-400 focus:ring-2 focus:ring-slate-100 placeholder:text-slate-400";

/** Primary actions — matches `/dashboard/sales` list */
export const btnPrimary =
  "inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white " +
  "transition hover:bg-slate-800 active:scale-[.97] disabled:opacity-50 disabled:pointer-events-none shadow-sm whitespace-nowrap " +
  "sm:w-auto sm:min-h-0";

export const btnGhost =
  "inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 py-2.5 " +
  "text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[.97] whitespace-nowrap sm:w-auto sm:min-h-0";

export const btnDanger =
  "inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-5 py-2.5 " +
  "text-sm font-semibold text-red-800 transition hover:bg-red-100 hover:border-red-300 disabled:opacity-50 disabled:pointer-events-none sm:w-auto sm:min-h-0";

export const badge =
  "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide";

export const tableHead =
  "grid text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 bg-slate-50 border-b border-slate-200";

export const alert =
  "flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800";

export const bannerSuccess =
  "flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-900";

export const overlayWrap =
  "fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-6";

export const overlayBackdrop =
  "absolute inset-0 bg-slate-900/50 backdrop-blur-[1px] transition-opacity";

export const modalSheet =
  "relative z-[81] flex max-h-[min(92vh,720px)] w-full max-w-lg flex-col rounded-t-[24px] border border-slate-200 bg-white shadow-[0_-8px_40px_rgba(15,23,42,0.12)] sm:max-h-[min(85vh,640px)] sm:rounded-2xl sm:shadow-[0_24px_48px_rgba(15,23,42,0.14)]";

export const modalSheetBody = "flex flex-col overflow-y-auto px-5 pb-5 pt-6 sm:px-6";

/** Payment method chips — fixed palette */
export const pillCash = "bg-emerald-100 text-emerald-800";
export const pillMpesa = "bg-sky-100 text-sky-800";
export const pillCard = "bg-violet-100 text-violet-800";
export const pillCredit = "bg-amber-100 text-amber-900";
export const pillNeutral = "bg-slate-100 text-slate-700";

/** Sale status */
export const statusPaid = "bg-emerald-100 text-emerald-800";
export const statusPending = "bg-amber-100 text-amber-900";
export const statusBad = "bg-red-100 text-red-800";
export const statusNeutral = "bg-slate-100 text-slate-700";

export const noPrint = "print:hidden";
export const printWrap = "flex flex-col gap-5 print:gap-3";

/* updated to match your detailed sale page columns */
export const itemsGrid = "1.5fr 0.5fr 0.9fr 0.9fr 0.9fr 0.9fr 0.9fr 1fr";

/* Print CSS */
if (typeof document !== "undefined") {
  const id = "__sale_print_css__";
  if (!document.getElementById(id)) {
    const style = document.createElement("style");
    style.id = id;
    style.innerHTML = `
      @media print {
        @page { size: A4; margin: 14mm; }
        html, body { background: #fff !important; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .shadow-sm, .shadow, .shadow-md, .shadow-lg { box-shadow: none !important; }
        .rounded-2xl, .rounded-\\[24px\\] { border-radius: 12px !important; }
        .printWrap > div { break-inside: avoid; }
        a { color: inherit !important; text-decoration: none !important; }
        .print\\:hidden { display: none !important; }
      }
    `;
    document.head.appendChild(style);
  }
}