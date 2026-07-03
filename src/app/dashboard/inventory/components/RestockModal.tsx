"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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

const QUICK_QUANTITIES = [1, 5, 10, 25];

function formatNumber(value: number | string | null | undefined) {
  const n = Number(value || 0);
  return n.toLocaleString("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

function getBaseUnit(row: InventoryRow): InventoryProductUnit | null {
  const units = row.products?.product_units ?? [];
  return units.find((u) => u.is_default) ?? units[0] ?? null;
}

function getPackageUnits(row: InventoryRow): InventoryProductUnit[] {
  return (row.products?.product_units ?? [])
    .filter(
      (unit: InventoryProductUnit) =>
        unit.active !== false &&
        unit.can_restock !== false &&
        Number(unit.base_quantity ?? 1) > 1,
    )
    .sort((a: InventoryProductUnit, b: InventoryProductUnit) => {
      const orderA = a.sort_order ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.sort_order ?? Number.MAX_SAFE_INTEGER;

      if (orderA !== orderB) return orderA - orderB;
      return a.base_quantity - b.base_quantity;
    });
}

function getProductName(row: InventoryRow) {
  return row.products?.name?.trim() || "Product";
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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const quantityInputRef = useRef<HTMLInputElement>(null);

  const packageUnits = useMemo(() => {
    return inventoryRow ? getPackageUnits(inventoryRow) : [];
  }, [inventoryRow]);

  const baseUnit = useMemo(() => {
    return inventoryRow ? getBaseUnit(inventoryRow) : null;
  }, [inventoryRow]);

  const selectedUnit = useMemo(() => {
    return packageUnits.find((unit) => unit.id === selectedUnitId) ?? null;
  }, [packageUnits, selectedUnitId]);

  const enteredQty = Number(quantity || 0);
  const isValidQty = Number.isFinite(enteredQty) && enteredQty > 0;
  const baseQtyToAdd =
    selectedUnit && isValidQty ? enteredQty * selectedUnit.base_quantity : 0;

  const currentStock = Number(inventoryRow?.qty_on_hand ?? 0);
  const stockAfter = currentStock + baseQtyToAdd;

  const baseLabel = baseUnit?.label ?? "base units";

  useEffect(() => {
    if (!open || !inventoryRow) return;

    const firstPackage = getPackageUnits(inventoryRow)[0] ?? null;

    setSelectedUnitId(firstPackage?.id ?? "");
    setQuantity("1");
    setShowAdvanced(false);
    setNote("");
    setError("");
    setSaving(false);
  }, [open, inventoryRow]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, saving, onClose]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => quantityInputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open, selectedUnitId]);

  if (!open || !inventoryRow) {
    return null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const row = inventoryRow;
    if (!row) return;

    setError("");

    if (!selectedUnit) {
      setError("Choose the package you are adding.");
      return;
    }

    if (!Number.isFinite(enteredQty) || enteredQty <= 0) {
      setError("Enter a package quantity greater than zero.");
      return;
    }

    setSaving(true);

    try {
      await restockProductUnit(orgId, row.product_id, {
        product_unit_id: selectedUnit.id,
        unit_label: selectedUnit.label,
        unit_base_quantity: selectedUnit.base_quantity,
        quantity: enteredQty,
        reorder_level: row.reorder_level,
        note: note.trim() || null,
      });

      await onRestocked();
      onClose();
    } catch (caughtError: unknown) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to add package stock.",
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
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add boxes or packages"
        className="w-full max-w-lg overflow-hidden rounded-[26px] bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Add boxes / packages
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {getProductName(inventoryRow)}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close dialog"
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-5 px-6 py-5">
            {error && (
              <div
                role="alert"
                className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
              >
                {error}
              </div>
            )}

            {packageUnits.length === 0 ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                This product does not have a box, carton, crate, or package
                unit yet. Add one from the product edit screen first.
              </div>
            ) : (
              <>
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-800">
                    Package type
                  </label>

                  <select
                    value={selectedUnitId}
                    onChange={(event) => setSelectedUnitId(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                  >
                    {packageUnits.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.label} — 1 adds {formatNumber(unit.base_quantity)}{" "}
                        {baseLabel}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="block text-sm font-bold text-slate-800">
                      How many {selectedUnit?.label ?? "packages"}?
                    </label>
                  </div>

                  <input
                    ref={quantityInputRef}
                    type="number"
                    inputMode="decimal"
                    min="0.001"
                    step="any"
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-lg font-bold text-slate-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                    placeholder="e.g. 10"
                  />

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {QUICK_QUANTITIES.map((n) => {
                      const active = quantity === String(n);
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setQuantity(String(n))}
                          className={`rounded-full border px-3 py-1 text-xs font-bold transition ${
                            active
                              ? "border-amber-400 bg-amber-100 text-amber-800"
                              : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                          }`}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-700">
                    Result
                  </div>

                  {isValidQty ? (
                    <>
                      <div className="mt-2 text-lg font-black text-amber-950">
                        {formatNumber(enteredQty)}{" "}
                        {selectedUnit?.label ?? "packages"} ={" "}
                        {formatNumber(baseQtyToAdd)} {baseLabel}
                      </div>

                      <div className="mt-2 text-sm text-amber-800">
                        Stock will change from{" "}
                        <strong>{formatNumber(currentStock)}</strong> to{" "}
                        <strong>{formatNumber(stockAfter)}</strong> {baseLabel}.
                      </div>
                    </>
                  ) : (
                    <div className="mt-2 text-sm text-amber-700">
                      Enter a quantity greater than zero to see the result.
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setShowAdvanced((value) => !value)}
                  className="text-sm font-bold text-slate-500 hover:text-slate-800"
                  aria-expanded={showAdvanced}
                >
                  {showAdvanced ? "Hide advanced options" : "Advanced options"}
                </button>

                {showAdvanced && (
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-800">
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
                )}
              </>
            )}
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
              disabled={saving || packageUnits.length === 0 || !selectedUnit || !isValidQty}
              className="rounded-2xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-amber-200 hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Adding…" : "Add stock"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}