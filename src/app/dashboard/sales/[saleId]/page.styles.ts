// src/app/(dashboard)/sales/[saleId]/page.styles.ts

export const card =
  "rounded-2xl border border-slate-200 bg-white shadow-sm";

export const input =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition " +
  "focus:border-amber-500 focus:ring-2 focus:ring-amber-100 placeholder:text-slate-400";

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white " +
  "transition hover:bg-amber-600 active:scale-[.97] disabled:opacity-50 disabled:pointer-events-none shadow-sm whitespace-nowrap";

export const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 " +
  "text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[.97] whitespace-nowrap";

export const btnDanger =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 " +
  "text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50 disabled:pointer-events-none";

export const badge =
  "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide";

export const tableHead =
  "grid text-xs font-semibold uppercase tracking-wider text-slate-500 bg-slate-50 border-b border-slate-200";

export const alert =
  "flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700";

export const noPrint = "print:hidden";
export const printWrap = "space-y-5 print:space-y-3";

// Shared grid columns for line items table header + rows
export const itemsGrid = "2fr 0.5fr 1fr 1fr 1fr 1fr";

/* ── Print CSS — injected once on client ── */
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
        .rounded-2xl { border-radius: 12px !important; }
        .printWrap > div { break-inside: avoid; }
        a { color: inherit !important; text-decoration: none !important; }
        .print\\:hidden { display: none !important; }
      }
    `;
    document.head.appendChild(style);
  }
}