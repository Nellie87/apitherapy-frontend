// ─── Hexhive Dashboard · Sale Detail Styles ──────────────────────────────────

export const card =
  "rounded-sm border border-yellow-100 bg-white shadow-[0_2px_12px_rgba(245,197,24,0.08)]";

export const input =
  "w-full rounded-sm border border-yellow-200 bg-[#FFFEF5] px-4 py-2.5 text-sm font-light outline-none transition focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 placeholder:text-[#aaa990]";

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-sm bg-[#1a1a0a] px-5 py-2.5 text-sm font-medium tracking-wide text-[#F5C518] transition hover:bg-[#2e2e18] hover:-translate-y-px hover:shadow-md disabled:opacity-50 disabled:pointer-events-none";

export const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-sm border border-[#1a1a0a]/15 bg-white px-5 py-2.5 text-sm font-medium text-[#555540] transition hover:bg-[#FFF9DC] hover:border-yellow-300 hover:text-[#1a1a0a]";

export const btnDanger =
  "inline-flex items-center justify-center gap-2 rounded-sm border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:opacity-50 disabled:pointer-events-none";

export const badge =
  "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium tracking-wide";

export const tableHead =
  "grid text-[10.5px] font-medium uppercase tracking-widest text-[#999977]";

export const alert =
  "rounded-sm border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700";

export const noPrint = "print:hidden";

export const printWrap = "space-y-4 print:space-y-3";

/* Global print CSS (injected once) */
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
        .shadow, .shadow-sm, .shadow-md, .shadow-lg,
        .shadow-xl, .shadow-2xl { box-shadow: none !important; }
        .rounded-sm { border-radius: 2px !important; }
        .printWrap > div { break-inside: avoid; }
        a { color: inherit !important; text-decoration: none !important; }
      }
    `;
    document.head.appendChild(style);
  }
}