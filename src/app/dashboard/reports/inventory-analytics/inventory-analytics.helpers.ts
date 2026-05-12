import type { InventoryValuationRow } from "@/lib/api/reports";

export const fmtMoney = (v: number) =>
  `Ksh ${Number(v || 0).toLocaleString("en-KE", {
    maximumFractionDigits: 0,
  })}`;

export const fmtK = (v: number) =>
  v >= 1_000_000
    ? `${(v / 1_000_000).toFixed(1)}M`
    : v >= 1_000
    ? `${(v / 1_000).toFixed(0)}k`
    : String(Math.round(v));

export function urgencyScore(r: InventoryValuationRow): number {
  if (r.status === "out") return 100;
  if (r.status === "critical") return 75;
  if (r.status === "low") return 45;

  const buffer = r.reorder_level > 0 ? r.qty_on_hand / r.reorder_level : 10;
  return Math.max(0, Math.min(20, Math.round(20 / buffer)));
}

export function coverageRatio(r: InventoryValuationRow): number {
  if (!r.reorder_level) return r.qty_on_hand > 0 ? 99 : 0;
  return parseFloat((r.qty_on_hand / r.reorder_level).toFixed(2));
}

export function downloadCSV(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;

  const headers = Object.keys(rows[0]);

  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => esc(r[h])).join(",")),
  ].join("\n");

  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" })
    ),
    download: filename,
  });

  a.click();
  URL.revokeObjectURL(a.href);
}