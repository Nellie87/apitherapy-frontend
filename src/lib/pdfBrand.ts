/** Shared brand tokens for downloadable invoices and PDF reports. */

export const PDF_COMPANY_NAME = "Pollinator Beekeeping & Apitherapy";
export const PDF_COMPANY_TAGLINE = "Beekeeping · Apitherapy · Natural Care";

/** Paths under /public — prefer mark for compact jsPDF headers, wordmark for HTML reports. */
export const PDF_LOGO_MARK = "/icons/icon-mark.png";
export const PDF_LOGO_WORDMARK = "/brand-wordmark.png";

/** RGB tuples for jsPDF */
export const PDF_RGB = {
  honey: [215, 168, 32] as [number, number, number], // #d7a820 dashboard accent
  honeyBright: [245, 194, 0] as [number, number, number], // #f5c200
  honeyDark: [138, 106, 0] as [number, number, number], // #8a6a00
  amber: [212, 131, 10] as [number, number, number], // #d4830a
  amberDark: [146, 64, 14] as [number, number, number],
  dark: [45, 36, 23] as [number, number, number], // #2d2417
  body: [74, 63, 47] as [number, number, number],
  muted: [118, 107, 89] as [number, number, number],
  cream: [253, 248, 239] as [number, number, number], // #fdf8ef
  creamSoft: [255, 253, 248] as [number, number, number],
  line: [234, 223, 194] as [number, number, number], // #eadfc2
  softLine: [241, 230, 201] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

/** Hex tokens for HTML / print templates */
export const PDF_HEX = {
  honey: "#d7a820",
  honeyBright: "#f5c200",
  honeyDark: "#8a6a00",
  amber: "#d4830a",
  dark: "#2d2417",
  body: "#4a3f2f",
  muted: "#766b59",
  lightMuted: "#9a9386",
  cream: "#fdf8ef",
  creamSoft: "#fffdf8",
  cream2: "#fff8e6",
  line: "#eadfc2",
  softLine: "#f1e6c9",
  green: "#15803d",
  red: "#b91c1c",
  white: "#ffffff",
};

export function pdfAssetUrl(path: string): string {
  if (typeof window === "undefined") return path;
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) {
    return path;
  }
  const base = window.location.origin.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

let logoMarkDataUrlCache: string | null = null;

async function fetchAsDataUrl(path: string): Promise<string | null> {
  try {
    const res = await fetch(pdfAssetUrl(path));
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Load brand mark as data URL (cached) for embedding in jsPDF. */
export async function loadPdfLogoMarkDataUrl(): Promise<string | null> {
  if (logoMarkDataUrlCache) return logoMarkDataUrlCache;
  logoMarkDataUrlCache = await fetchAsDataUrl(PDF_LOGO_MARK);
  return logoMarkDataUrlCache;
}
