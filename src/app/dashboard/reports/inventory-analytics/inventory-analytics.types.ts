import type { InventoryValuationRow } from "@/lib/api/reports";

export type StockHealth = "out" | "critical" | "low" | "ok";

export type NavTab =
  | "overview"
  | "reorder"
  | "valuation"
  | "insights"
  | "history";

export type SortCol = "urgency" | "value" | "qty" | "coverage";

export type InventoryMovementType =
  | "sale"
  | "sale_edit"
  | "void"
  | "restock"
  | "adjustment"
  | "initial"
  | string;

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
  title: string;
  detail: string;
};

export type InventoryMovementRow = {
  id: string;
  org_id: string;
  product_id: string;
  ref_sale_id: string | null;
  type: InventoryMovementType;
  qty_delta: number;
  qty_before: number;
  qty_after: number;
  note: string | null;
  created_at: string;
  product_name?: string | null;
  sale_no?: string | null;
};

export type MovementFilter =
  | "all"
  | "sale"
  | "sale_edit"
  | "void"
  | "restock"
  | "adjustment";

export type MovementDisplay = {
  label: string;
  tone: "green" | "blue" | "red" | "amber" | "slate";
};

export function getMovementDisplay(type?: string | null): MovementDisplay {
  switch (String(type ?? "").toLowerCase()) {
    case "sale":
      return {
        label: "Sale",
        tone: "red",
      };

    case "sale_edit":
      return {
        label: "Sale edited",
        tone: "blue",
      };

    case "void":
      return {
        label: "Sale cancelled",
        tone: "green",
      };

    case "restock":
      return {
        label: "Restock",
        tone: "green",
      };

    case "adjustment":
      return {
        label: "Adjustment",
        tone: "amber",
      };

    case "initial":
      return {
        label: "Opening stock",
        tone: "slate",
      };

    default:
      return {
        label: "Stock movement",
        tone: "slate",
      };
  }
}

export function isSaleEditMovement(type?: string | null) {
  return String(type ?? "").toLowerCase() === "sale_edit";
}

export function isSaleCancelMovement(type?: string | null) {
  return ["void", "cancelled", "cancellation"].includes(
    String(type ?? "").toLowerCase()
  );
}