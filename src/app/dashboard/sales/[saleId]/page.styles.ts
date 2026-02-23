export const card =
  "rounded-3xl border border-zinc-200 bg-white shadow-sm";

export const input =
  "w-full rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-200";

export const btnPrimary =
  "inline-flex items-center justify-center rounded-2xl bg-amber-500 px-4 py-2.5 text-sm font-black text-white hover:bg-amber-600 disabled:opacity-50";

export const btnGhost =
  "inline-flex items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-black text-zinc-800 hover:bg-zinc-50";

export const btnDanger =
  "inline-flex items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-black text-rose-700 hover:bg-rose-100 disabled:opacity-50";

export const badge =
  "inline-flex items-center rounded-full px-3 py-1 text-xs font-black";

export const tableHead =
  "grid text-[11px] font-black uppercase tracking-wide text-zinc-500";

export const alert =
  "rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700";

/**
 * PRINT STYLES
 * - hide controls
 * - remove shadows
 * - A4 margins
 * - make tables crisp
 */
export const noPrint = "print:hidden";

/**
 * Wrap the printable content.
 * Note: Tailwind doesn't ship with print CSS defaults for page margins,
 * so we inject a global @media print block below.
 */
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

        /* Reduce chrome */
        html, body { background: #fff !important; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

        /* Remove heavy UI effects */
        .shadow, .shadow-sm, .shadow-md, .shadow-lg,
        .shadow-xl, .shadow-2xl { box-shadow: none !important; }
        .rounded-3xl { border-radius: 16px !important; }

        /* Avoid ugly page breaks in the middle of cards */
        .printWrap > div { break-inside: avoid; }

        /* Make links look like text */
        a { color: inherit !important; text-decoration: none !important; }
      }
    `;
    document.head.appendChild(style);
  }
}