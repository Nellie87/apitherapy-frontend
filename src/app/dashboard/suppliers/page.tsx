"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import { listSuppliers, createSupplier } from "@/lib/api/lookups";
import { createClient } from "@/lib/supabase/client";

// ─── Types ───────────────────────────────────────────────────────────────────

type SupplierLookup = {
  id: string;
  name: string;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  what_they_supply?: string | null;
  active?: boolean;
};

type SupplierForm = {
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  what_they_supply: string;
  notes: string;
};

type SupplierFormErrors = Partial<Record<keyof SupplierForm, string>>;

const BLANK_FORM: SupplierForm = {
  name: "",
  contact_person: "",
  phone: "",
  email: "",
  what_they_supply: "",
  notes: "",
};

function validateSupplierForm(form: SupplierForm): SupplierFormErrors {
  const errors: SupplierFormErrors = {};
  if (!form.name.trim()) errors.name = "Supplier name is required";
  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
    errors.email = "Enter a valid email address";
  return errors;
}

// ─── Primitives ──────────────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-rose-600">
      <svg className="h-3 w-3 shrink-0" viewBox="0 0 12 12" fill="currentColor">
        <path d="M6 1a5 5 0 1 0 0 10A5 5 0 0 0 6 1zm0 7.5a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5zm.75-3a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 1 1.5 0v2z" />
      </svg>
      {message}
    </p>
  );
}

function Label({ children, required, hint }: { children: React.ReactNode; required?: boolean; hint?: string }) {
  return (
    <div className="mb-2">
      <label className="block text-xs font-bold uppercase tracking-widest text-slate-500">
        {children}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </label>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function StatusBadge({ active }: { active?: boolean }) {
  if (active === false) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
        Archived
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
      Active
    </span>
  );
}

// ─── Toast ───────────────────────────────────────────────────────────────────

function Toast({ message, type = "success", onClose }: { message: string; type?: "success" | "error"; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  const isSuccess = type === "success";

  return (
    <div
      className={`fixed bottom-6 right-6 z-[100] flex items-start gap-3 rounded-2xl px-4 py-3.5 shadow-2xl ring-1 ${
        isSuccess
          ? "bg-[#0D2A4A] ring-[#123861] text-white"
          : "bg-rose-600 ring-rose-700 text-white"
      }`}
      style={{ maxWidth: 360, minWidth: 260 }}
    >
      <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${isSuccess ? "bg-emerald-400/20" : "bg-white/20"}`}>
        {isSuccess ? (
          <svg className="h-3 w-3 text-emerald-400" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="2,6 5,9 10,3" />
          </svg>
        ) : (
          <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="3" x2="9" y2="9" /><line x1="9" y1="3" x2="3" y2="9" />
          </svg>
        )}
      </div>
      <p className="flex-1 text-sm font-medium leading-snug">{message}</p>
      <button
        type="button"
        onClick={onClose}
        className="mt-0.5 shrink-0 opacity-60 hover:opacity-100 transition-opacity"
      >
        <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="4" y1="4" x2="12" y2="12" /><line x1="12" y1="4" x2="4" y2="12" />
        </svg>
      </button>
    </div>
  );
}

// ─── Archive / Restore Modal ─────────────────────────────────────────────────

function ArchiveConfirmModal({
  supplier,
  loading,
  mode,
  onCancel,
  onConfirm,
}: {
  supplier: SupplierLookup;
  loading: boolean;
  mode: "archive" | "restore";
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isArchive = mode === "archive";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Color stripe at top */}
        <div className={`h-1.5 w-full ${isArchive ? "bg-rose-500" : "bg-emerald-500"}`} />

        <div className="px-6 pb-6 pt-5">
          <div className="mb-5">
            <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl ${isArchive ? "bg-rose-50" : "bg-emerald-50"}`}>
              {isArchive ? (
                <svg className="h-5 w-5 text-rose-600" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7H4m16 0-2 10H6L4 7m16 0-1-3H5L4 7M9 11v4m6-4v4" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-emerald-600" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4 4 12 12M7.5 7.5 4 11l6 6 9-9" />
                </svg>
              )}
            </div>
            <h3 className="text-base font-bold text-slate-900">
              {isArchive ? "Archive supplier?" : "Restore supplier?"}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">
              {isArchive
                ? "This supplier will be hidden from active selections but remain in your records."
                : "This supplier will become active again and appear in all supplier selections."}
            </p>
          </div>

          {/* Supplier preview card */}
          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white ${isArchive ? "bg-rose-500" : "bg-emerald-500"}`}>
              {supplier.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-900">{supplier.name}</div>
              <div className="mt-0.5 truncate text-xs text-slate-500">
                {supplier.what_they_supply || supplier.contact_person || "No description"}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className={`flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition disabled:opacity-50 ${
                isArchive ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              {loading
                ? isArchive ? "Archiving…" : "Restoring…"
                : isArchive ? "Archive" : "Restore"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Create Supplier Modal ────────────────────────────────────────────────────

function SupplierModal({
  form,
  setForm,
  saving,
  errors,
  submitAttempted,
  onClose,
  onSubmit,
}: {
  form: SupplierForm;
  setForm: React.Dispatch<React.SetStateAction<SupplierForm>>;
  saving: boolean;
  errors: SupplierFormErrors;
  submitAttempted: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const hasErrors = Object.keys(errors).length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-slate-100 bg-gradient-to-br from-[#0D2A4A] to-[#123861] px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-white">Add new supplier</h2>
              <p className="mt-1 text-sm text-slate-300">
                Supplier records can be linked to products and orders.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white/70 transition hover:bg-white/20 hover:text-white"
            >
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="4" y1="4" x2="12" y2="12" /><line x1="12" y1="4" x2="4" y2="12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={onSubmit}>
          <div className="space-y-5 px-6 py-5">
            {submitAttempted && hasErrors && (
              <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">
                <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="8" cy="8" r="6" />
                  <line x1="8" y1="5" x2="8" y2="8.5" strokeLinecap="round" />
                  <circle cx="8" cy="11" r="0.5" fill="currentColor" />
                </svg>
                Please fix the highlighted fields before saving.
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label required>Supplier name</Label>
                <input
                  autoFocus
                  className={`w-full rounded-xl border bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition focus:bg-white ${
                    errors.name && submitAttempted
                      ? "border-rose-400 focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                      : "border-slate-200 focus:border-[#0D2A4A] focus:ring-2 focus:ring-[#0D2A4A]/10"
                  }`}
                  placeholder="e.g. Highlands Honey Distributors"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
                <FieldError message={submitAttempted ? errors.name : undefined} />
              </div>

              <div>
                <Label>Contact person</Label>
                <input
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition focus:bg-white focus:border-[#0D2A4A] focus:ring-2 focus:ring-[#0D2A4A]/10"
                  placeholder="e.g. Jane Wanjiku"
                  value={form.contact_person}
                  onChange={(e) => setForm((f) => ({ ...f, contact_person: e.target.value }))}
                />
              </div>

              <div>
                <Label>Phone number</Label>
                <input
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition focus:bg-white focus:border-[#0D2A4A] focus:ring-2 focus:ring-[#0D2A4A]/10"
                  placeholder="e.g. +254 7XX XXX XXX"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>

              <div className="sm:col-span-2">
                <Label>Email address</Label>
                <input
                  className={`w-full rounded-xl border bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition focus:bg-white ${
                    errors.email && submitAttempted
                      ? "border-rose-400 focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                      : "border-slate-200 focus:border-[#0D2A4A] focus:ring-2 focus:ring-[#0D2A4A]/10"
                  }`}
                  placeholder="e.g. supplies@example.com"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
                <FieldError message={submitAttempted ? errors.email : undefined} />
              </div>
            </div>

            <div>
              <Label hint="Helps your team know what this supplier provides.">What they supply</Label>
              <input
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition focus:bg-white focus:border-[#0D2A4A] focus:ring-2 focus:ring-[#0D2A4A]/10"
                placeholder="e.g. Raw honey, bottles, labels, packaging materials"
                value={form.what_they_supply}
                onChange={(e) => setForm((f) => ({ ...f, what_they_supply: e.target.value }))}
              />
            </div>

            <div>
              <Label hint="Delivery terms, payment notes, reliability observations…">Notes</Label>
              <textarea
                rows={3}
                className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition focus:bg-white focus:border-[#0D2A4A] focus:ring-2 focus:ring-[#0D2A4A]/10"
                placeholder="Any relevant notes about this supplier…"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[#0D2A4A] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#123861] disabled:opacity-50"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeOpacity=".3" strokeWidth="2" />
                    <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  Saving…
                </span>
              ) : "Save supplier"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── KPI Cards ───────────────────────────────────────────────────────────────

function KpiCard({ label, value, accent }: { label: string; value: number; accent: "slate" | "emerald" | "navy" }) {
  const styles = {
    navy: "border-[#0D2A4A]/20 bg-[#0D2A4A] text-white",
    emerald: "border-emerald-200 bg-white text-slate-900",
    slate: "border-slate-200 bg-white text-slate-900",
  };
  const labelStyles = {
    navy: "text-slate-300",
    emerald: "text-emerald-600",
    slate: "text-slate-400",
  };
  const valueStyles = {
    navy: "text-white",
    emerald: "text-emerald-700",
    slate: "text-slate-700",
  };

  return (
    <div className={`rounded-2xl border px-5 py-4 ${styles[accent]}`}>
      <div className={`text-[10px] font-bold uppercase tracking-widest ${labelStyles[accent]}`}>{label}</div>
      <div className={`mt-1.5 text-3xl font-bold tabular-nums ${valueStyles[accent]}`}>{value}</div>
    </div>
  );
}

// ─── Supply Pills ─────────────────────────────────────────────────────────────

function SupplyTags({ value }: { value?: string | null }) {
  if (!value) return <span className="text-slate-300">—</span>;

  const tags = value
    .split(/[,;]/)
    .map((t) => t.trim())
    .filter(Boolean);

  if (tags.length === 0) return <span className="text-slate-300">—</span>;

  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag, i) => (
        <span
          key={i}
          className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function SupplierAvatar({ name, active }: { name: string; active?: boolean }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join("")
    .toUpperCase();

  return (
    <div
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
        active === false
          ? "bg-slate-100 text-slate-400"
          : "bg-[#0D2A4A]/10 text-[#0D2A4A]"
      }`}
    >
      {initials}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ hasItems, onAdd }: { hasItems: boolean; onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
        <svg className="h-8 w-8 text-slate-400" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="4" y="8" width="24" height="18" rx="3" />
          <path d="M4 13h24M11 8V6a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v2" strokeLinecap="round" />
          <line x1="11" y1="18" x2="21" y2="18" strokeLinecap="round" />
          <line x1="11" y1="22" x2="17" y2="22" strokeLinecap="round" />
        </svg>
      </div>
      <h3 className="text-base font-bold text-slate-800">
        {hasItems ? "No matching suppliers" : "No suppliers yet"}
      </h3>
      <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-slate-400">
        {hasItems
          ? "Try adjusting your search or filter to find what you're looking for."
          : "Get started by adding your first supplier. You can link them to products and orders."}
      </p>
      {!hasItems && (
        <button
          type="button"
          onClick={onAdd}
          className="mt-5 rounded-xl bg-[#0D2A4A] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#123861]"
        >
          Add first supplier
        </button>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SuppliersPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [items, setItems] = useState<SupplierLookup[]>([]);
  const [form, setForm] = useState<SupplierForm>(BLANK_FORM);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [modalMode, setModalMode] = useState<"archive" | "restore">("archive");
  const [supplierToArchive, setSupplierToArchive] = useState<SupplierLookup | null>(null);
  const [err, setErr] = useState("");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  async function refresh(o: string) {
    const data = await listSuppliers(o);
    setItems(data as SupplierLookup[]);
  }

  useEffect(() => {
    (async () => {
      try {
        const o = await bootstrapOrg();
        setOrgId(o);
        await refresh(o);
      } catch (e: any) {
        setErr(e.message ?? "Failed to load suppliers");
      }
    })();
  }, []);

  const errors = useMemo(() => validateSupplierForm(form), [form]);

  const filteredItems = useMemo(() => {
    const t = search.trim().toLowerCase();
    return items.filter((s) => {
      const matchesArchived = showArchived ? true : s.active !== false;
      const matchesSearch =
        !t ||
        s.name.toLowerCase().includes(t) ||
        (s.contact_person ?? "").toLowerCase().includes(t) ||
        (s.phone ?? "").toLowerCase().includes(t) ||
        (s.email ?? "").toLowerCase().includes(t) ||
        (s.what_they_supply ?? "").toLowerCase().includes(t);
      return matchesArchived && matchesSearch;
    });
  }, [items, search, showArchived]);

  const counts = useMemo(() => {
    const total = items.length;
    const active = items.filter((s) => s.active !== false).length;
    const archived = items.filter((s) => s.active === false).length;
    return { total, active, archived };
  }, [items]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitAttempted(true);
    const validationErrors = validateSupplierForm(form);
    if (Object.keys(validationErrors).length > 0) return;
    if (!orgId) return;

    setSaving(true);
    setErr("");

    try {
      const supplierName = form.name.trim();
      await createSupplier(orgId, {
        name: supplierName,
        contact_person: form.contact_person.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        what_they_supply: form.what_they_supply.trim() || undefined,
        notes: form.notes.trim() || undefined,
      } as any);

      setForm(BLANK_FORM);
      setSubmitAttempted(false);
      setShowModal(false);
      await refresh(orgId);
      setToast({ message: `"${supplierName}" added successfully`, type: "success" });
    } catch (e: any) {
      setErr(e.message ?? "Failed to create supplier");
      setToast({ message: "Failed to create supplier", type: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleArchiveConfirm() {
    if (!orgId || !supplierToArchive) return;
    try {
      setArchiving(true);
      setErr("");
      const supabase = createClient();
      const nextActive = modalMode === "restore";
      const { error } = await supabase
        .from("suppliers")
        .update({ active: nextActive })
        .eq("org_id", orgId)
        .eq("id", supplierToArchive.id);
      if (error) throw error;

      const supplierName = supplierToArchive.name;
      await refresh(orgId);
      setSupplierToArchive(null);
      setToast({
        message: modalMode === "archive" ? `"${supplierName}" archived` : `"${supplierName}" restored`,
        type: "success",
      });
    } catch (e: any) {
      setErr(e.message ?? (modalMode === "archive" ? "Failed to archive supplier" : "Failed to restore supplier"));
      setToast({
        message: modalMode === "archive" ? "Failed to archive supplier" : "Failed to restore supplier",
        type: "error",
      });
    } finally {
      setArchiving(false);
    }
  }

  function openCreateModal() {
    setForm(BLANK_FORM);
    setSubmitAttempted(false);
    setShowModal(true);
  }

  function openArchiveModal(supplier: SupplierLookup) {
    setModalMode("archive");
    setSupplierToArchive(supplier);
  }

  function openRestoreModal(supplier: SupplierLookup) {
    setModalMode("restore");
    setSupplierToArchive(supplier);
  }

  if (!orgId && !err) {
    return (
      <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-400">
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeOpacity=".2" strokeWidth="2" />
          <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        Loading suppliers…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Toast */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* Error Banner */}
      {err && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="8" cy="8" r="6" />
            <line x1="8" y1="5" x2="8" y2="8.5" strokeLinecap="round" />
            <circle cx="8" cy="11" r="0.5" fill="currentColor" />
          </svg>
          {err}
        </div>
      )}

      {/* ── Page Header ── */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        {/* Top strip */}
        <div className="border-b border-slate-100 px-6 py-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#0D2A4A]">
                <svg className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="2" y="5" width="16" height="13" rx="2" />
                  <path d="M2 9h16M7 5V3.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 .5.5V5" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900">Suppliers</h1>
                <p className="text-sm text-slate-500">Manage suppliers and their contact details.</p>
              </div>
            </div>
            <button
              onClick={openCreateModal}
              type="button"
              className="inline-flex items-center gap-2 rounded-xl bg-[#0D2A4A] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#123861]"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="7" y1="2" x2="7" y2="12" strokeLinecap="round" />
                <line x1="2" y1="7" x2="12" y2="7" strokeLinecap="round" />
              </svg>
              Add supplier
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
          <KpiCard label="Total suppliers" value={counts.total} accent="navy" />
          <KpiCard label="Active" value={counts.active} accent="emerald" />
          <KpiCard label="Archived" value={counts.archived} accent="slate" />
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1" style={{ minWidth: 220 }}>
            <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="6.5" cy="6.5" r="4.5" />
              <line x1="10.5" y1="10.5" x2="14" y2="14" strokeLinecap="round" />
            </svg>
            <input
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#0D2A4A] focus:bg-white focus:ring-2 focus:ring-[#0D2A4A]/10"
              placeholder="Search name, contact, email, supply…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="3" y1="3" x2="11" y2="11" strokeLinecap="round" />
                  <line x1="11" y1="3" x2="3" y2="11" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>

          {/* Archived toggle */}
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
              showArchived
                ? "bg-slate-900 text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 10H9.5a2.5 2.5 0 0 0 0 5H12a2 2 0 0 0 0-4zM2 10h4.5M2 7h10M2 4h10" strokeLinecap="round" />
            </svg>
            {showArchived ? "Showing archived" : "Show archived"}
          </button>
        </div>

        <span className="shrink-0 text-xs text-slate-400">
          {filteredItems.length} of {items.length} supplier{items.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Table ── */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {/* Desktop header */}
        <div className="hidden border-b border-slate-100 bg-slate-50 px-5 py-3 lg:grid lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)_80px]">
          {["Supplier", "Contact", "Phone", "Email", "What they supply", ""].map((col, i) => (
            <div key={i} className={`text-[10px] font-bold uppercase tracking-widest text-slate-400 ${i === 5 ? "text-right" : ""}`}>
              {col}
            </div>
          ))}
        </div>

        {filteredItems.length === 0 ? (
          <EmptyState hasItems={items.length > 0} onAdd={openCreateModal} />
        ) : (
          filteredItems.map((s, idx) => {
            const isArchived = s.active === false;
            return (
              <div
                key={s.id}
                className={`border-b border-slate-100 last:border-b-0 transition-colors ${
                  isArchived ? "bg-slate-50/60" : "hover:bg-slate-50/40"
                }`}
              >
                {/* Desktop row */}
                <div className="hidden items-start gap-4 px-5 py-4 lg:grid lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)_80px]">
                  <div className="flex items-start gap-3">
                    <SupplierAvatar name={s.name} active={s.active} />
                    <div className="min-w-0">
                      <div className={`truncate text-sm font-semibold ${isArchived ? "text-slate-400" : "text-slate-900"}`}>
                        {s.name}
                      </div>
                      <div className="mt-1.5">
                        <StatusBadge active={s.active} />
                      </div>
                    </div>
                  </div>

                  <div className={`pt-0.5 text-sm ${isArchived ? "text-slate-400" : "text-slate-600"}`}>
                    {s.contact_person || <span className="text-slate-300">—</span>}
                  </div>
                  <div className={`pt-0.5 text-sm ${isArchived ? "text-slate-400" : "text-slate-600"}`}>
                    {s.phone || <span className="text-slate-300">—</span>}
                  </div>
                  <div className={`break-all pt-0.5 text-sm ${isArchived ? "text-slate-400" : "text-slate-600"}`}>
                    {s.email || <span className="text-slate-300">—</span>}
                  </div>

                  <div className="pt-0.5">
                    <SupplyTags value={isArchived ? null : s.what_they_supply} />
                    {isArchived && s.what_they_supply && (
                      <span className="text-xs text-slate-300">{s.what_they_supply}</span>
                    )}
                  </div>

                  <div className="flex justify-end pt-0.5">
                    {isArchived ? (
                      <button
                        onClick={() => openRestoreModal(s)}
                        type="button"
                        className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                      >
                        Restore
                      </button>
                    ) : (
                      <button
                        onClick={() => openArchiveModal(s)}
                        type="button"
                        className="rounded-lg border border-transparent px-3 py-1.5 text-xs font-semibold text-slate-400 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                      >
                        Archive
                      </button>
                    )}
                  </div>
                </div>

                {/* Mobile card */}
                <div className="space-y-3 p-4 lg:hidden">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <SupplierAvatar name={s.name} active={s.active} />
                      <div>
                        <div className={`text-sm font-semibold ${isArchived ? "text-slate-400" : "text-slate-900"}`}>
                          {s.name}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {s.contact_person || "No contact person"}
                        </div>
                        <div className="mt-2">
                          <StatusBadge active={s.active} />
                        </div>
                      </div>
                    </div>

                    {isArchived ? (
                      <button
                        onClick={() => openRestoreModal(s)}
                        type="button"
                        className="shrink-0 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"
                      >
                        Restore
                      </button>
                    ) : (
                      <button
                        onClick={() => openArchiveModal(s)}
                        type="button"
                        className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500"
                      >
                        Archive
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs">
                    <div>
                      <div className="font-bold uppercase tracking-widest text-slate-400">Phone</div>
                      <div className="mt-1 text-slate-700">{s.phone || "—"}</div>
                    </div>
                    <div>
                      <div className="font-bold uppercase tracking-widest text-slate-400">Email</div>
                      <div className="mt-1 break-all text-slate-700">{s.email || "—"}</div>
                    </div>
                  </div>

                  {s.what_they_supply && (
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        What they supply
                      </div>
                      <SupplyTags value={s.what_they_supply} />
                    </div>
                  )}

                  {s.notes && (
                    <p className="rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2 text-xs italic text-slate-500">
                      {s.notes}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modals */}
      {showModal && (
        <SupplierModal
          form={form}
          setForm={setForm}
          saving={saving}
          errors={errors}
          submitAttempted={submitAttempted}
          onClose={() => setShowModal(false)}
          onSubmit={handleCreate}
        />
      )}

      {supplierToArchive && (
        <ArchiveConfirmModal
          supplier={supplierToArchive}
          mode={modalMode}
          loading={archiving}
          onCancel={() => setSupplierToArchive(null)}
          onConfirm={handleArchiveConfirm}
        />
      )}
    </div>
  );
}