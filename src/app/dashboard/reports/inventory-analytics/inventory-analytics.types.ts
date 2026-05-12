import type { InventoryValuationRow } from "@/lib/api/reports";

export type StockHealth = "out" | "critical" | "low" | "ok";
export type NavTab = "overview" | "reorder" | "valuation" | "insights";
export type SortCol = "urgency" | "value" | "qty" | "coverage";

export type Enriched = InventoryValuationRow & {
  urgency: number;
  coverage: number;
};

export type Totals = {
  out: number;
  critical: number;
  low: number;
  ok: number;
  totalVal: number;
  atRiskVal: number;
  avgCoverage: number;
  totalQty: number;
};

export type CategoryData = {
  name: string;
  value: number;
  qty: number;
  count: number;
  atRisk: number;
};

export type InventoryInsight = {
  type: "critical" | "warning" | "ok" | "neutral";
  icon: string;
  title: string;
  detail: string;
};