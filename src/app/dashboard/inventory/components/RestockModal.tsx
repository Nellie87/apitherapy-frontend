"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  restockProductUnit,
  type InventoryProductUnit,
  type InventoryRow,
} from "@/lib/api/inventory";

type RestockModalProps = {
  open: boolean;
  orgId: string;
  inventoryRow: InventoryRow | null;
  onClose: () => void;
  onRestocked: () => void | Promise<void>;
};

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

function formatMoney(value: number) {
  return `Ksh ${Number(value || 0).toLocaleString("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function saleTypeLabel(value: InventoryProductUnit["sale_type"]) {
  if (value === "wholesale") return "Wholesale package";
  if (value === "stock_only") return "Stock only";
  return "Retail unit";
}

export default function RestockModal({
  open,
  orgId,
  inventoryRow,
  onClose,
  onRestocked,
}: RestockModalProps) {
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [reorderLevel, setReorderLevel] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const product = inventoryRow?.products ?? null;

  const restockUnits = useMemo(() => {
    return (product?.product_units ?? [])
      .filter((unit: InventoryProductUnit) => unit.active !== false && unit.can_restock !== false)
      .sort((a: InventoryProductUnit, b: InventoryProductUnit) => {
        if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
        const orderA = a.sort_order ?? Number.MAX_SAFE_INTEGER;
        const orderB = b.sort_order ?? Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) return orderA - orderB;
        return a.base_quantity - b.base_quantity;
      });
  }, [product?.product_units]);

  const selectedUnit = useMemo(() => {
    return restockUnits.find((unit) => unit.id === selectedUnitId) ?? null;
  }, [restockUnits, selectedUnitId]);

  const enteredQty = Number(quantity || 0);
  const baseQtyToAdd =
    selectedUnit && Number.isFinite(enteredQty)
      ? enteredQty * selectedUnit.base_quantity
      : 0;
  const stockAfter = Number(inventoryRow?.qty_on_hand ?? 0) + baseQtyToAdd;
  const estimatedCost =
    selectedUnit && Number.isFinite(enteredQty)
      ? enteredQty * selectedUnit.cost_price
      : 0;

  useEffect(() => {
    if (!open || !inventoryRow) return;

    const defaultUnit =
      restockUnits.find((unit) => unit.is_default) ?? restockUnits[0] ?? null;

    setSelectedUnitId(defaultUnit?.id ?? "");
    setQuantity("1");
    setReorderLevel(String(inventoryRow.reorder_level ?? 0));
    setNote("");
    setError("");
    setSaving(false);
  }, [open, inventoryRow, restockUnits]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open || !inventoryRow || !product) return null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!selectedUnit) {
      setError("Select the unit you are restocking.");
      return;
    }

    if (!Number.isFinite(enteredQty) || enteredQty <= 0) {
      setError("Enter a restock quantity greater than zero.");
      return;
    }

    const nextReorderLevel = reorderLevel.trim() === "" ? null : Number(reorderLevel);

    if (
      nextReorderLevel !== null &&
      (!Number.isFinite(nextReorderLevel) || nextReorderLevel < 0)
    ) {
      setError("Reorder level must be zero or a positive number.");
      return;
    }

    setSaving(true);

    try {
      await restockProductUnit(orgId, inventoryRow.product_id, {
        product_unit_id: selectedUnit.id,
        unit_label: selectedUnit.label,
        unit_base_quantity: selectedUnit.base_quantity,
        quantity: enteredQty,
        reorder_level: nextReorderLevel,
        note: note.trim() || null,
      });

      await onRestocked();
      onClose();
    } catch (caughtError: unknown) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to restock this product.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={() => {
        if (!saving) onClose();
      }}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-[26px] bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Restock product</h2>
            <p className="mt-1 text-sm text-slate-500">{product.name}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto">
          <div className="space-y-6 px-6 py-5">
            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Current stock
                </div>
                <div className="mt-1 text-2xl font-bold text-slate-900">
                  {formatNumber(Number(inventoryRow.qty_on_hand ?? 0))}
                </div>
                <div className="mt-1 text-xs text-slate-500">base units</div>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
                  Will add
                </div>
                <div className="mt-1 text-2xl font-bold text-amber-900">
                  {formatNumber(baseQtyToAdd)}
                </div>
                <div className="mt-1 text-xs text-amber-700">base units</div>
              </div>

              <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-green-700">
                  Stock after
                </div>
                <div className="mt-1 text-2xl font-bold text-green-900">
                  {formatNumber(stockAfter)}
                </div>
                <div className="mt-1 text-xs text-green-700">base units</div>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-800">
                Restock as
              </label>

              {restockUnits.length === 0 ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  This product has no active restock units. Add a product unit that allows restocking.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {restockUnits.map((unit) => {
                    const selected = selectedUnitId === unit.id;

                    return (
                      <button
                        key={unit.id}
                        type="button"
                        onClick={() => setSelectedUnitId(unit.id)}
                        className={`rounded-2xl border p-4 text-left transition ${
                          selected
                            ? "border-amber-400 bg-amber-50 ring-2 ring-amber-100"
                            : "border-slate-200 bg-white hover:border-amber-200 hover:bg-amber-50/40"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-bold text-slate-900">{unit.label}</div>
                            <div className="mt-1 text-xs text-slate-500">
                              {saleTypeLabel(unit.sale_type)}
                            </div>
                          </div>

                          {unit.is_default && (
                            <span className="rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-green-700">
                              Base
                            </span>
                          )}
                        </div>

                        <div className="mt-3 text-sm text-slate-700">
                          1 {unit.label} adds <strong>{formatNumber(unit.base_quantity)}</strong>{" "}
                          base unit{unit.base_quantity === 1 ? "" : "s"}
                        </div>

                        <div className="mt-2 text-xs text-slate-500">
                          Cost: {formatMoney(unit.cost_price)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-bold text-slate-800">
                  Quantity
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0.001"
                  step="any"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                  placeholder="e.g. 10"
                />

                {selectedUnit && (
                  <p className="mt-1.5 text-xs text-slate-500">
                    {formatNumber(enteredQty || 0)} {selectedUnit.label} ×{" "}
                    {formatNumber(selectedUnit.base_quantity)} = {formatNumber(baseQtyToAdd)} base units
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-bold text-slate-800">
                  Reorder level
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={reorderLevel}
                  onChange={(event) => setReorderLevel(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                  placeholder="e.g. 5"
                />
                <p className="mt-1.5 text-xs text-slate-500">Stored in base units.</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Restock summary
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                <div>
                  <div className="text-slate-500">Unit selected</div>
                  <div className="mt-0.5 font-bold text-slate-900">
                    {selectedUnit?.label ?? "—"}
                  </div>
                </div>

                <div>
                  <div className="text-slate-500">Base quantity added</div>
                  <div className="mt-0.5 font-bold text-slate-900">
                    {formatNumber(baseQtyToAdd)}
                  </div>
                </div>

                <div>
                  <div className="text-slate-500">Estimated stock cost</div>
                  <div className="mt-0.5 font-bold text-slate-900">
                    {formatMoney(estimatedCost)}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-bold text-slate-800">
                Note
              </label>
              <textarea
                rows={3}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                placeholder="Supplier, invoice number, batch details…"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving || !selectedUnit || restockUnits.length === 0}
              className="rounded-2xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-amber-200 hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Restocking…" : "Confirm restock"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
