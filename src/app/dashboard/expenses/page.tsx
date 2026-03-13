"use client";

import React, { useEffect, useMemo, useState } from "react";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import {
  createExpense, deleteExpense, listExpenses, updateExpense, type ExpenseRow,
} from "@/lib/api/expenses";
import * as S from "./page.styles";

/* ─── Helpers ────────────────────────────────────────────────── */
function iso(d: Date) { return d.toISOString().slice(0, 10); }
function fmtMoney(v: number) {
  return `Ksh ${Number(v || 0).toLocaleString("en-KE", { minimumFractionDigits: 0 })}`;
}
function defaultRange() {
  const to = new Date(), from = new Date();
  from.setDate(to.getDate() - 29);
  return { from: iso(from), to: iso(to) };
}

/* ─── CATEGORIES ─────────────────────────────────────────────── */
const PRESET_CATEGORIES = [
  "Transport", "Supplies", "Equipment", "Rent", "Utilities",
  "Labour", "Marketing", "Packaging", "Veterinary", "Other",
];

const CAT_COLORS: Record<string, string> = {
  Transport:  "bg-blue-500",  Supplies:  "bg-amber-500", Equipment: "bg-purple-500",
  Rent:       "bg-red-500",   Utilities: "bg-cyan-500",  Labour:    "bg-green-500",
  Marketing:  "bg-pink-500",  Packaging: "bg-orange-500",Veterinary:"bg-teal-500",
  Other:      "bg-slate-400",
};
function catColor(cat: string) { return CAT_COLORS[cat] ?? "bg-indigo-500"; }

/* ─── Icons ──────────────────────────────────────────────────── */
const IconSearch = () => (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" className="shrink-0 text-slate-400">
    <circle cx="9" cy="9" r="5.5" /><line x1="13.5" y1="13.5" x2="18" y2="18" />
  </svg>
);
const IconEdit = () => (
  <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M13.5 3.5L16.5 6.5L8 15H5v-3L13.5 3.5z" />
  </svg>
);
const IconTrash = () => (
  <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 6h12M8 6V4a1 1 0 011-1h2a1 1 0 011 1v2m-6 0v10a1 1 0 001 1h6a1 1 0 001-1V6" />
  </svg>
);
const IconCheck = () => (
  <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="4,10 8,14 16,6" />
  </svg>
);
const IconX = () => (
  <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="5" y1="5" x2="15" y2="15" /><line x1="15" y1="5" x2="5" y2="15" />
  </svg>
);

/* ─── Delete Confirm Modal ───────────────────────────────────── */
function DeleteModal({ expense, onConfirm, onCancel, loading }: {
  expense: ExpenseRow; onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-4 mb-4">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-red-100 text-2xl">🗑️</div>
          <div>
            <div className="font-bold text-slate-900">Delete Expense?</div>
            <div className="text-sm text-slate-500 mt-0.5">This cannot be undone.</div>
          </div>
        </div>
        <div className="rounded-xl bg-slate-50 px-4 py-3 mb-5 text-sm">
          <div className="font-semibold text-slate-900">{expense.category}</div>
          <div className="text-slate-500 mt-0.5">{fmtMoney(Number(expense.amount))} · {expense.expense_date}</div>
          {expense.note && <div className="text-slate-400 text-xs mt-0.5 truncate">{expense.note}</div>}
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className={S.btnGhost + " flex-1 justify-center"}>Cancel</button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 justify-center inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-50 transition">
            {loading ? "Deleting…" : "Yes, delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Category Bar ───────────────────────────────────────────── */
function CategoryBars({ data, total }: { data: { category: string; amount: number }[]; total: number }) {
  if (data.length === 0) return (
    <div className="py-12 text-center text-sm text-slate-400">No data for this period.</div>
  );
  return (
    <div className="divide-y divide-slate-100">
      {data.slice(0, 10).map((c) => {
        const pct = total > 0 ? (c.amount / total) * 100 : 0;
        return (
          <div key={c.category} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 transition-colors">
            <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${catColor(c.category)}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-sm font-semibold text-slate-800 truncate">{c.category}</span>
                <span className="text-sm font-bold text-slate-900 shrink-0">{fmtMoney(c.amount)}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${catColor(c.category)}`}
                  style={{ width: `${Math.max(2, pct)}%` }}
                />
              </div>
            </div>
            <span className="text-xs font-semibold text-slate-400 w-9 text-right shrink-0">{pct.toFixed(0)}%</span>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */
export default function ExpensesPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [rows, setRows]   = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // filters
  const [range, setRange] = useState(() => defaultRange());
  const [q, setQ] = useState("");
  const [filterCat, setFilterCat] = useState("");

  // create form
  const [showForm, setShowForm] = useState(false);
  const [expenseDate, setExpenseDate] = useState(() => iso(new Date()));
  const [category, setCategory] = useState("");
  const [customCat, setCustomCat] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  // edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ expense_date: string; category: string; amount: string; note: string } | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // delete confirm
  const [deletingExpense, setDeletingExpense] = useState<ExpenseRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function refresh(o: string) {
    setLoading(true);
    try {
      const data = await listExpenses(o, { ...range, q });
      setRows(data);
    } catch (e: any) { setErr(e.message ?? String(e)); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    (async () => {
      try { const o = await bootstrapOrg(); setOrgId(o); }
      catch (e: any) { setErr(e.message ?? String(e)); }
    })();
  }, []);

  useEffect(() => {
    if (!orgId) return;
    setErr("");
    refresh(orgId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, range.from, range.to, q]);

  const kpis = useMemo(() => {
    const count = rows.length;
    const total = rows.reduce((s, r) => s + Number(r.amount ?? 0), 0);
    const avg   = count > 0 ? total / count : 0;
    const map = new Map<string, number>();
    for (const r of rows) {
      const c = r.category || "Uncategorized";
      map.set(c, (map.get(c) ?? 0) + Number(r.amount ?? 0));
    }
    const byCategory = Array.from(map.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
    return { count, total, avg, byCategory };
  }, [rows]);

  // Derived: unique cats for filter dropdown
  const allCats = useMemo(() =>
    Array.from(new Set(rows.map((r) => r.category).filter(Boolean))).sort(),
  [rows]);

  // Filtered rows for table
  const filtered = useMemo(() => {
    if (!filterCat) return rows;
    return rows.filter((r) => r.category === filterCat);
  }, [rows, filterCat]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    setSaving(true); setErr("");
    try {
      const finalCat = category === "__custom__" ? customCat.trim() : category.trim();
      const amt = Number(amount);
      if (!expenseDate)        throw new Error("Date is required.");
      if (!finalCat)           throw new Error("Category is required.");
      if (!Number.isFinite(amt) || amt <= 0) throw new Error("Amount must be greater than 0.");
      await createExpense(orgId, { expense_date: expenseDate, category: finalCat, amount: amt, note: note.trim() || null });
      setCategory(""); setCustomCat(""); setAmount(""); setNote(""); setShowForm(false);
      await refresh(orgId);
    } catch (e: any) { setErr(e.message ?? String(e)); }
    finally { setSaving(false); }
  }

  function startEdit(r: ExpenseRow) {
    setEditingId(r.id);
    setEditDraft({ expense_date: r.expense_date, category: r.category, amount: String(Number(r.amount ?? 0)), note: r.note ?? "" });
  }
  function cancelEdit() { setEditingId(null); setEditDraft(null); }

  async function saveEdit(id: string) {
    if (!orgId || !editDraft) return;
    setSavingEdit(true); setErr("");
    try {
      const amt = Number(editDraft.amount);
      if (!editDraft.expense_date)      throw new Error("Date is required.");
      if (!editDraft.category.trim())   throw new Error("Category is required.");
      if (!Number.isFinite(amt) || amt <= 0) throw new Error("Amount must be > 0.");
      await updateExpense(orgId, id, { expense_date: editDraft.expense_date, category: editDraft.category.trim(), amount: amt, note: editDraft.note.trim() || null });
      cancelEdit();
      await refresh(orgId);
    } catch (e: any) { setErr(e.message ?? String(e)); }
    finally { setSavingEdit(false); }
  }

  async function confirmDelete() {
    if (!orgId || !deletingExpense) return;
    setDeleting(true);
    try { await deleteExpense(orgId, deletingExpense.id); setDeletingExpense(null); await refresh(orgId); }
    catch (e: any) { setErr(e.message ?? String(e)); }
    finally { setDeleting(false); }
  }

  if (!orgId && !err) return (
    <div className="flex h-64 items-center justify-center">
      <div className="flex items-center gap-3 text-slate-500">
        <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" strokeOpacity="0.2" /><path d="M12 2a10 10 0 0110 10" />
        </svg>
        <span className="text-sm font-medium">Loading expenses…</span>
      </div>
    </div>
  );

  const GRID = "1fr 1.2fr 0.9fr 1.8fr auto";

  return (
    <div className="flex flex-col gap-6">

      {/* ── Error ── */}
      {err && (
        <div className={S.alert}>
          <span className="shrink-0 mt-0.5">⚠️</span>
          <span className="flex-1">{err}</span>
          <button onClick={() => setErr("")} className="ml-auto shrink-0 text-red-400 hover:text-red-600"><IconX /></button>
        </div>
      )}

      {/* ── Page Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Expenses</h1>
          <p className="mt-1 text-sm text-slate-500">Record and track operating costs by category</p>
        </div>
        <button className={S.btnPrimary} onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "+ Add Expense"}
        </button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Total Expenses",  value: fmtMoney(kpis.total), icon: "💸", variant: "warning" as const },
          { label: "Transactions",    value: String(kpis.count),   icon: "📋", variant: "neutral" as const },
          { label: "Average",         value: fmtMoney(kpis.avg),   icon: "📊", variant: "neutral" as const },
          { label: "Top Category",    value: kpis.byCategory[0]?.category ?? "—", icon: "🏷️", variant: "info" as const,
            sub: kpis.byCategory[0] ? fmtMoney(kpis.byCategory[0].amount) : undefined },
        ].map(({ label, value, icon, variant, sub }) => {
          const cfg = {
            neutral: { bg: "#fff",    border: "#e2e8f0", iconBg: "#f8fafc", iconColor: "#475569", valueColor: "#0f172a", subColor: "#64748b" },
            warning: { bg: "#fffbeb", border: "#fde68a", iconBg: "#fef3c7", iconColor: "#92400e", valueColor: "#92400e", subColor: "#d97706" },
            info:    { bg: "#eff6ff", border: "#bfdbfe", iconBg: "#dbeafe", iconColor: "#1e40af", valueColor: "#1e40af", subColor: "#3b82f6" },
          }[variant];
          return (
            <div key={label} className="rounded-2xl p-5 transition-all hover:shadow-md"
              style={{ background: cfg.bg, border: `1.5px solid ${cfg.border}` }}>
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl text-lg shrink-0"
                  style={{ background: cfg.iconBg, color: cfg.iconColor }}>{icon}</div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-wider truncate" style={{ color: cfg.subColor }}>{label}</div>
                  <div className="mt-1 text-xl font-bold leading-tight truncate" style={{ color: cfg.valueColor }}>{value}</div>
                  {sub && <div className="text-xs font-medium mt-0.5" style={{ color: cfg.subColor }}>{sub}</div>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Add Form ── */}
      {showForm && (
        <div className={`${S.card} p-5`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-amber-50 text-amber-600 text-lg">💸</div>
            <div>
              <div className="font-bold text-slate-900">New Expense</div>
              <div className="text-xs text-slate-500">Record a cost like transport, supplies, rent, etc.</div>
            </div>
          </div>
          <form onSubmit={onCreate} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Date *</label>
              <input className={S.input} type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Category *</label>
              <select className={S.input} value={category} onChange={(e) => setCategory(e.target.value)} required>
                <option value="">— Select —</option>
                {PRESET_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                <option value="__custom__">+ Custom…</option>
              </select>
            </div>
            {category === "__custom__" && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Custom Category *</label>
                <input className={S.input} placeholder="Enter category name" value={customCat} onChange={(e) => setCustomCat(e.target.value)} required />
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Amount (Ksh) *</label>
              <input className={S.input} type="number" min={0} step="1" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
            <div className={category === "__custom__" ? "" : "sm:col-span-2 lg:col-span-1"}>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Note</label>
              <input className={S.input} placeholder="Optional details…" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div className="sm:col-span-2 lg:col-span-4 flex justify-end gap-3 pt-1">
              <button type="button" onClick={() => setShowForm(false)} className={S.btnGhost}>Cancel</button>
              <button type="submit" disabled={saving} className={S.btnPrimary}>
                {saving ? "Saving…" : "Add Expense"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Two-column: filters+table | category breakdown ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">

        {/* ── Left: Search/filter + Table ── */}
        <div className="flex flex-col gap-4">

          {/* Filters bar */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <label className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-100 transition flex-1 min-w-[180px] max-w-xs shadow-sm">
              <IconSearch />
              <input className="flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 min-w-0"
                placeholder="Search category or note…" value={q} onChange={(e) => setQ(e.target.value)} />
              {q && <button onClick={() => setQ("")} className="text-slate-400 hover:text-slate-600 shrink-0"><IconX /></button>}
            </label>

            {/* Date range */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">From</span>
              <input className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
              <span className="text-xs font-semibold text-slate-500">To</span>
              <input className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
            </div>

            {/* Category filter */}
            <select
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
              value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
              <option value="">All categories</option>
              {allCats.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>

            <span className="ml-auto text-xs text-slate-400 whitespace-nowrap">
              {filtered.length} / {rows.length} expense{rows.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Table */}
          <div className={`${S.card} overflow-hidden`}>
            {/* Header */}
            <div className="hidden lg:grid items-center gap-4 px-5 py-3"
              style={{ gridTemplateColumns: GRID, background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
              {["Date", "Category", "Amount", "Note", ""].map((h) => (
                <div key={h} className={`text-xs font-semibold uppercase tracking-wider text-slate-500 ${h === "Amount" ? "text-right" : ""}`}>{h}</div>
              ))}
            </div>

            <div className="divide-y divide-slate-100">
              {loading ? (
                <div className="flex items-center justify-center gap-3 py-14 text-slate-400">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" strokeOpacity="0.2" /><path d="M12 2a10 10 0 0110 10" />
                  </svg>
                  <span className="text-sm">Loading…</span>
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="text-4xl mb-3">💸</div>
                  <p className="text-sm font-semibold text-slate-600">{rows.length === 0 ? "No expenses yet" : "No matching expenses"}</p>
                  <p className="text-xs text-slate-400 mt-1">{rows.length === 0 ? "Click \"+ Add Expense\" to get started" : "Try adjusting your filters"}</p>
                </div>
              ) : filtered.map((r) => {
                const isEditing = editingId === r.id && editDraft;
                return (
                  <div key={r.id} className={`transition-colors hover:bg-slate-50 ${isEditing ? "bg-amber-50" : ""}`}>
                    {/* Desktop row */}
                    <div className="hidden lg:grid items-center gap-4 px-5 py-3"
                      style={{ gridTemplateColumns: GRID }}>
                      {/* Date */}
                      <div>
                        {isEditing
                          ? <input className={S.inputSm} type="date" value={editDraft!.expense_date}
                              onChange={(e) => setEditDraft((d) => d ? { ...d, expense_date: e.target.value } : d)} />
                          : <span className="text-sm text-slate-600">{r.expense_date}</span>}
                      </div>
                      {/* Category */}
                      <div>
                        {isEditing
                          ? <input className={S.inputSm} value={editDraft!.category}
                              onChange={(e) => setEditDraft((d) => d ? { ...d, category: e.target.value } : d)} />
                          : (
                            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                              <span className={`h-2 w-2 rounded-full shrink-0 ${catColor(r.category)}`} />
                              {r.category}
                            </span>
                          )}
                      </div>
                      {/* Amount */}
                      <div className="text-right">
                        {isEditing
                          ? <input className={S.inputSm + " text-right"} type="number" min={0} step="1" value={editDraft!.amount}
                              onChange={(e) => setEditDraft((d) => d ? { ...d, amount: e.target.value } : d)} />
                          : <span className="text-sm font-bold text-slate-900">{fmtMoney(Number(r.amount ?? 0))}</span>}
                      </div>
                      {/* Note */}
                      <div className="min-w-0">
                        {isEditing
                          ? <input className={S.inputSm} placeholder="Optional note…" value={editDraft!.note}
                              onChange={(e) => setEditDraft((d) => d ? { ...d, note: e.target.value } : d)} />
                          : <span className="text-sm text-slate-500 truncate block">{r.note || <span className="text-slate-300">—</span>}</span>}
                      </div>
                      {/* Actions */}
                      <div className="flex items-center justify-end gap-1">
                        {isEditing ? (
                          <>
                            <button onClick={cancelEdit}
                              className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 transition"><IconX /></button>
                            <button onClick={() => saveEdit(r.id)} disabled={savingEdit}
                              className="grid h-8 w-8 place-items-center rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition disabled:opacity-50"><IconCheck /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(r)}
                              className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"><IconEdit /></button>
                            <button onClick={() => setDeletingExpense(r)}
                              className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition"><IconTrash /></button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Mobile card */}
                    <div className="lg:hidden px-5 py-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className={`h-2 w-2 rounded-full ${catColor(r.category)}`} />
                            <span className="text-sm font-bold text-slate-900">{r.category}</span>
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">{r.expense_date}</div>
                        </div>
                        <div className="font-bold text-slate-900">{fmtMoney(Number(r.amount ?? 0))}</div>
                      </div>
                      {r.note && <div className="text-xs text-slate-400 mb-3 truncate">{r.note}</div>}
                      <div className="flex gap-2">
                        <button onClick={() => startEdit(r)} className={S.btnGhost + " text-xs py-1.5 px-3"}>
                          <IconEdit /> Edit
                        </button>
                        <button onClick={() => setDeletingExpense(r)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition">
                          <IconTrash /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {filtered.length > 0 && (
              <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
                <span className="text-xs text-slate-400">{filtered.length} of {rows.length} expense{rows.length !== 1 ? "s" : ""}</span>
                <span className="text-xs font-bold text-slate-900">
                  {fmtMoney(filtered.reduce((s, r) => s + Number(r.amount ?? 0), 0))}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Category Breakdown ── */}
        <div className={`${S.card} overflow-hidden h-fit`}>
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="text-sm font-bold text-slate-900">Category Breakdown</div>
            <div className="text-xs text-slate-500 mt-0.5">Selected period · {kpis.count} expense{kpis.count !== 1 ? "s" : ""}</div>
          </div>
          <CategoryBars data={kpis.byCategory} total={kpis.total} />
          {kpis.total > 0 && (
            <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-between">
              <span className="text-xs text-slate-500">Total</span>
              <span className="text-sm font-bold text-slate-900">{fmtMoney(kpis.total)}</span>
            </div>
          )}
        </div>

      </div>

      {/* ── Delete Modal ── */}
      {deletingExpense && (
        <DeleteModal
          expense={deletingExpense}
          onConfirm={confirmDelete}
          onCancel={() => setDeletingExpense(null)}
          loading={deleting}
        />
      )}
    </div>
  );
}