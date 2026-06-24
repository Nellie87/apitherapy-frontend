"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import { createSupplier, listSuppliers } from "@/lib/api/lookups";
import { createClient } from "@/lib/supabase/client";
import * as S from "./page.styles";

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

  if (!form.name.trim()) {
    errors.name = "Supplier name is required.";
  }

  if (
    form.email.trim() &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
  ) {
    errors.email = "Enter a valid email address.";
  }

  return errors;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;

  return <p className="mt-1.5 text-xs font-semibold text-rose-600">{message}</p>;
}

function Label({
  children,
  required,
  hint,
}: {
  children: React.ReactNode;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div className="mb-2">
      <label className="block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
        {children}
        {required ? <span className="ml-1 text-rose-500">*</span> : null}
      </label>

      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

function StatusBadge({ active }: { active?: boolean }) {
  const isArchived = active === false;

  return (
    <span
      className={
        isArchived
          ? "inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500"
          : "inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700"
      }
    >
      {isArchived ? "Archived" : "Active"}
    </span>
  );
}

function Toast({
  message,
  type = "success",
  onClose,
}: {
  message: string;
  type?: "success" | "error";
  onClose: () => void;
}) {
  useEffect(() => {
    const t = window.setTimeout(onClose, 4000);
    return () => window.clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className={`fixed bottom-4 left-4 right-4 z-[100] rounded-2xl px-4 py-3 text-sm font-bold text-white shadow-xl sm:left-auto sm:right-5 sm:max-w-sm ${
        type === "success" ? "bg-emerald-600" : "bg-rose-600"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="leading-snug">{message}</p>

        <button
          type="button"
          onClick={onClose}
          className="text-lg leading-none text-white/80 transition hover:text-white"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}

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
    <div className={S.modalOverlay} onClick={onCancel}>
      <div className="w-full max-w-md overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-5 sm:px-6">
          <p className={S.sectionTitle}>{isArchive ? "Archive supplier" : "Restore supplier"}</p>

          <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950">
            {isArchive ? "Move this supplier to archived?" : "Restore this supplier?"}
          </h2>

          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {isArchive
              ? "The supplier will no longer appear as an active option, but their records will remain available."
              : "The supplier will become active again and appear in supplier selections."}
          </p>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-black text-slate-950">{supplier.name}</p>
            <p className="mt-1 text-xs text-slate-500">
              {supplier.contact_person || supplier.email || supplier.phone || "No extra contact details"}
            </p>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={onCancel} disabled={loading} className={S.btnGhost}>
              Cancel
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className={
                isArchive
                  ? "inline-flex w-full items-center justify-center rounded-2xl bg-rose-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-rose-700 disabled:pointer-events-none disabled:opacity-50 sm:w-auto"
                  : "inline-flex w-full items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:pointer-events-none disabled:opacity-50 sm:w-auto"
              }
            >
              {loading ? "Saving…" : isArchive ? "Archive supplier" : "Restore supplier"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

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

  function inputClass(field: keyof SupplierForm) {
    return submitAttempted && errors[field] ? S.inputError : S.input;
  }

  return (
    <div className={S.modalOverlay} onClick={onClose}>
      <div className={S.modalPanel} onClick={(e) => e.stopPropagation()}>
        <div className={S.modalHeader}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className={S.sectionTitle}>New supplier</p>
              <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950">
                Add supplier
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                Save supplier details for purchases, stock, and business records.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-slate-200 bg-white text-xl leading-none text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        <form onSubmit={onSubmit}>
          <div className="max-h-[70vh] space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
            {submitAttempted && hasErrors ? (
              <div className={S.alertErr}>
                Please fix the highlighted fields before saving.
              </div>
            ) : null}

            <div>
              <Label required>Supplier name</Label>
              <input
                autoFocus
                className={inputClass("name")}
                placeholder="e.g. Nairobi Packaging Ltd"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              <FieldError message={submitAttempted ? errors.name : undefined} />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label>Contact person</Label>
                <input
                  className={S.input}
                  placeholder="e.g. Jane Doe"
                  value={form.contact_person}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, contact_person: e.target.value }))
                  }
                />
              </div>

              <div>
                <Label>Phone</Label>
                <input
                  className={S.input}
                  placeholder="e.g. +254712345678"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label>Email</Label>
              <input
                type="email"
                className={inputClass("email")}
                placeholder="supplier@example.com"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
              <FieldError message={submitAttempted ? errors.email : undefined} />
            </div>

            <div>
              <Label hint="Separate multiple items with commas.">What they supply</Label>
              <input
                className={S.input}
                placeholder="Packaging, bottles, labels"
                value={form.what_they_supply}
                onChange={(e) =>
                  setForm((f) => ({ ...f, what_they_supply: e.target.value }))
                }
              />
            </div>

            <div>
              <Label>Notes</Label>
              <textarea
                rows={4}
                className={S.textarea}
                placeholder="Payment terms, delivery notes, or extra details"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            <button type="button" onClick={onClose} disabled={saving} className={S.btnGhost}>
              Cancel
            </button>

            <button type="submit" disabled={saving} className={S.btnPrimary}>
              {saving ? "Saving…" : "Save supplier"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function KpiCard({ label, value, accent }: { label: string; value: number; accent: "slate" | "emerald" | "amber" }) {
  const styles = {
    amber: "border-amber-200 bg-gradient-to-br from-amber-50 to-white",
    emerald: "border-emerald-200 bg-white",
    slate: "border-slate-200 bg-white",
  };

  const valueStyles = {
    amber: "text-amber-900",
    emerald: "text-emerald-700",
    slate: "text-slate-700",
  };

  return (
    <div className={`rounded-3xl border p-5 shadow-sm ${styles[accent]}`}>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className={`mt-2 text-3xl font-black tabular-nums ${valueStyles[accent]}`}>
        {value}
      </p>
    </div>
  );
}

function SupplyTags({ value }: { value?: string | null }) {
  if (!value) return <span className="text-slate-300">—</span>;

  const tags = value
    .split(/[,;]/)
    .map((t) => t.trim())
    .filter(Boolean);

  if (tags.length === 0) return <span className="text-slate-300">—</span>;

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag, i) => (
        <span key={`${tag}-${i}`} className={S.supplyTag}>
          {tag}
        </span>
      ))}
    </div>
  );
}

function SupplierAvatar({ name, active }: { name: string; active?: boolean }) {
  const initials =
    name
      .split(" ")
      .slice(0, 2)
      .map((w) => w.charAt(0))
      .join("")
      .toUpperCase() || "S";

  return (
    <div className={active === false ? S.avatarArchived : S.avatarActive}>
      {initials}
    </div>
  );
}

function EmptyState({ hasItems, onAdd }: { hasItems: boolean; onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
      <p className={S.sectionTitle}>{hasItems ? "No results" : "No suppliers"}</p>

      <h3 className="mt-2 text-xl font-black tracking-tight text-slate-950">
        {hasItems ? "No matching suppliers found" : "Add your first supplier"}
      </h3>

      <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-600">
        {hasItems
          ? "Try adjusting your search or include archived suppliers."
          : "Keep supplier contacts, supply categories, and notes in one clean place."}
      </p>

      {!hasItems ? (
        <button type="button" onClick={onAdd} className={`mt-6 ${S.btnPrimary}`}>
          Add supplier
        </button>
      ) : null}
    </div>
  );
}

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

  const refresh = useCallback(async (o: string) => {
    const data = await listSuppliers(o);
    setItems(data as SupplierLookup[]);
  }, []);

  useEffect(() => {
    async function loadSuppliers() {
      try {
        const o = await bootstrapOrg();
        setOrgId(o);
        await refresh(o);
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : "Failed to load suppliers.");
      }
    }

    loadSuppliers();
  }, [refresh]);

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
    if (Object.keys(validationErrors).length > 0 || !orgId) return;

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
      setToast({ message: `"${supplierName}" added successfully.`, type: "success" });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to create supplier.");
      setToast({ message: "Failed to create supplier.", type: "error" });
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
        message:
          modalMode === "archive"
            ? `"${supplierName}" archived.`
            : `"${supplierName}" restored.`,
        type: "success",
      });
    } catch (e: unknown) {
      setErr(
        e instanceof Error
          ? e.message
          : modalMode === "archive"
            ? "Failed to archive supplier."
            : "Failed to restore supplier."
      );
      setToast({
        message:
          modalMode === "archive"
            ? "Failed to archive supplier."
            : "Failed to restore supplier.",
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
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-amber-500" />
          <p className="mt-3 text-sm font-semibold text-slate-500">
            Loading suppliers…
          </p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        {toast ? (
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        ) : null}

        {err ? <div className={S.alertErr}>{err}</div> : null}

        <section className={S.card}>
          <div className="border-b border-slate-100 bg-gradient-to-br from-amber-50 via-white to-white px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className={S.sectionTitle}>Procurement</p>
                <h1 className={`mt-2 ${S.pageTitle}`}>Suppliers</h1>
                <p className={S.pageSubtitle}>
                  Manage supplier contacts, supplied items, and archive status from one simple workspace.
                </p>
              </div>

              <button onClick={openCreateModal} type="button" className={S.btnPrimary}>
                Add supplier
              </button>
            </div>
          </div>

          <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
            <KpiCard label="Total suppliers" value={counts.total} accent="amber" />
            <KpiCard label="Active" value={counts.active} accent="emerald" />
            <KpiCard label="Archived" value={counts.archived} accent="slate" />
          </div>
        </section>

        <section className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <input
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-4 focus:ring-amber-100 lg:max-w-xl"
            placeholder="Search by name, contact, phone, email, or supply…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:justify-end">
            <button
              type="button"
              onClick={() => setShowArchived((v) => !v)}
              className={
                showArchived
                  ? "inline-flex items-center justify-center rounded-2xl bg-amber-500 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-amber-600"
                  : "inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              }
            >
              {showArchived ? "Archived shown" : "Show archived"}
            </button>

            <p className="text-center text-xs font-semibold text-slate-500 sm:text-right">
              {filteredItems.length} of {items.length} supplier{items.length === 1 ? "" : "s"}
            </p>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="hidden border-b border-slate-100 bg-slate-50 px-5 py-3 lg:grid lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.5fr)_110px] lg:items-center lg:gap-4">
            {["Supplier", "Contact", "Phone", "Email", "What they supply", "Action"].map((col, i) => (
              <div key={col} className={`${S.tableHead} ${i === 5 ? "text-right" : ""}`}>
                {col}
              </div>
            ))}
          </div>

          {filteredItems.length === 0 ? (
            <EmptyState hasItems={items.length > 0} onAdd={openCreateModal} />
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredItems.map((s) => {
                const isArchived = s.active === false;

                return (
                  <article
                    key={s.id}
                    className={isArchived ? "bg-slate-50/70" : "bg-white transition hover:bg-slate-50/60"}
                  >
                    <div className="hidden px-5 py-4 lg:grid lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.5fr)_110px] lg:items-start lg:gap-4">
                      <div className="flex min-w-0 items-start gap-3">
                        <SupplierAvatar name={s.name} active={s.active} />

                        <div className="min-w-0">
                          <p className={`truncate text-sm font-black ${isArchived ? "text-slate-400" : "text-slate-950"}`}>
                            {s.name}
                          </p>
                          <div className="mt-2">
                            <StatusBadge active={s.active} />
                          </div>
                        </div>
                      </div>

                      <p className={`text-sm ${isArchived ? "text-slate-400" : "text-slate-600"}`}>
                        {s.contact_person || "—"}
                      </p>

                      <p className={`text-sm ${isArchived ? "text-slate-400" : "text-slate-600"}`}>
                        {s.phone || "—"}
                      </p>

                      <p className={`break-all text-sm ${isArchived ? "text-slate-400" : "text-slate-600"}`}>
                        {s.email || "—"}
                      </p>

                      <div>
                        {isArchived ? (
                          <span className="text-xs text-slate-300">
                            {s.what_they_supply || "—"}
                          </span>
                        ) : (
                          <SupplyTags value={s.what_they_supply} />
                        )}
                      </div>

                      <div className="flex justify-end">
                        {isArchived ? (
                          <button
                            onClick={() => openRestoreModal(s)}
                            type="button"
                            className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100"
                          >
                            Restore
                          </button>
                        ) : (
                          <button
                            onClick={() => openArchiveModal(s)}
                            type="button"
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                          >
                            Archive
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4 p-4 lg:hidden">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <SupplierAvatar name={s.name} active={s.active} />

                          <div className="min-w-0">
                            <p className={`truncate text-sm font-black ${isArchived ? "text-slate-400" : "text-slate-950"}`}>
                              {s.name}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {s.contact_person || "No contact person"}
                            </p>
                            <div className="mt-2">
                              <StatusBadge active={s.active} />
                            </div>
                          </div>
                        </div>

                        {isArchived ? (
                          <button
                            onClick={() => openRestoreModal(s)}
                            type="button"
                            className="shrink-0 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700"
                          >
                            Restore
                          </button>
                        ) : (
                          <button
                            onClick={() => openArchiveModal(s)}
                            type="button"
                            className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600"
                          >
                            Archive
                          </button>
                        )}
                      </div>

                      <div className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-xs sm:grid-cols-2">
                        <div>
                          <p className="font-bold uppercase tracking-[0.16em] text-slate-400">Phone</p>
                          <p className="mt-1 text-slate-700">{s.phone || "—"}</p>
                        </div>

                        <div>
                          <p className="font-bold uppercase tracking-[0.16em] text-slate-400">Email</p>
                          <p className="mt-1 break-all text-slate-700">{s.email || "—"}</p>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-100 bg-white p-3">
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                          What they supply
                        </p>
                        <SupplyTags value={s.what_they_supply} />
                      </div>

                      {s.notes ? (
                        <p className="rounded-2xl border border-amber-100 bg-amber-50/60 px-3 py-2 text-xs leading-relaxed text-slate-600">
                          {s.notes}
                        </p>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {showModal ? (
          <SupplierModal
            form={form}
            setForm={setForm}
            saving={saving}
            errors={errors}
            submitAttempted={submitAttempted}
            onClose={() => setShowModal(false)}
            onSubmit={handleCreate}
          />
        ) : null}

        {supplierToArchive ? (
          <ArchiveConfirmModal
            supplier={supplierToArchive}
            mode={modalMode}
            loading={archiving}
            onCancel={() => setSupplierToArchive(null)}
            onConfirm={handleArchiveConfirm}
          />
        ) : null}
      </div>
    </main>
  );
}
