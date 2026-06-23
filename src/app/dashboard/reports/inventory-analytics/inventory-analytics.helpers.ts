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
  return Number((r.qty_on_hand / r.reorder_level).toFixed(2));
}

export function getRowDateMs(row: unknown): number | null {
  const r = row as Record<string, unknown>;

  const raw =
    r.created_at ??
    r.createdAt ??
    r.updated_at ??
    r.updatedAt ??
    r.date ??
    r.stock_date ??
    r.inventory_date;

  if (!raw) return null;

  const ms = new Date(String(raw)).getTime();
  return Number.isNaN(ms) ? null : ms;
}

export function isWithinDateRange(row: unknown, from: string, to: string) {
  if (!from && !to) return true;

  const ms = getRowDateMs(row);
  if (!ms) return false;

  const fromMs = from ? new Date(`${from}T00:00:00`).getTime() : null;
  const toMs = to ? new Date(`${to}T23:59:59`).getTime() : null;

  if (fromMs && ms < fromMs) return false;
  if (toMs && ms > toMs) return false;

  return true;
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

  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8;" })
  );

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}