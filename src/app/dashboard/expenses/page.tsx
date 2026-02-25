"use client";

import React, { useEffect, useMemo, useState } from "react";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import {
  createExpense,
  deleteExpense,
  listExpenses,
  updateExpense,
  type ExpenseRow,
} from "@/lib/api/expenses";
import * as S from "./page.styles";

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function fmtMoney(v: number) {
  return `Ksh ${Number(v || 0).toLocaleString("en-KE", { minimumFractionDigits: 0 })}`;
}

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 29);
  return { from: iso(from), to: iso(to) };
}

export default function ExpensesPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // filters
  const [range, setRange] = useState(() => defaultRange());
  const [q, setQ] = useState("");

  // create form
  const [expenseDate, setExpenseDate] = useState(() => iso(new Date()));
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("0");
  const [note, setNote] = useState("");

  // edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    expense_date: string;
    category: string;
    amount: string;
    note: string;
  } | null>(null);

  async function refresh(o: string) {
    setLoading(true);
    try {
      const data = await listExpenses(o, { ...range, q });
      setRows(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const o = await bootstrapOrg();
        setOrgId(o);
      } catch (e: any) {
        setErr(e.message ?? String(e));
      }
    })();
  }, []);

  useEffect(() => {
    if (!orgId) return;
    setErr("");
    refresh(orgId).catch((e: any) => setErr(e.message ?? String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, range.from, range.to, q]);

  const kpis = useMemo(() => {
    const count = rows.length;
    const total = rows.reduce((s, r) => s + Number(r.amount ?? 0), 0);

    // by category
    const map = new Map<string, number>();
    for (const r of rows) {
      const c = r.category || "Uncategorized";
      map.set(c, (map.get(c) ?? 0) + Number(r.amount ?? 0));
    }
    const byCategory = Array.from(map.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    const top = byCategory.slice(0, 5);
    return { count, total, top, byCategory };
  }, [rows]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    setErr("");

    try {
      const amt = Number(amount);
      if (!expenseDate) throw new Error("Expense date is required.");
      if (!category.trim()) throw new Error("Category is required.");
      if (!Number.isFinite(amt) || amt <= 0) throw new Error("Amount must be > 0.");

      await createExpense(orgId, {
        expense_date: expenseDate,
        category: category.trim(),
        amount: amt,
        note: note.trim() ? note.trim() : null,
      });

      // reset
      setCategory("");
      setAmount("0");
      setNote("");

      await refresh(orgId);
    } catch (e: any) {
      setErr(e.message ?? String(e));
    }
  }

  function startEdit(r: ExpenseRow) {
    setEditingId(r.id);
    setEditDraft({
      expense_date: r.expense_date,
      category: r.category,
      amount: String(Number(r.amount ?? 0)),
      note: r.note ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(null);
  }

  async function saveEdit(id: string) {
    if (!orgId || !editDraft) return;
    setErr("");

    try {
      const amt = Number(editDraft.amount);
      if (!editDraft.expense_date) throw new Error("Expense date is required.");
      if (!editDraft.category.trim()) throw new Error("Category is required.");
      if (!Number.isFinite(amt) || amt <= 0) throw new Error("Amount must be > 0.");

      await updateExpense(orgId, id, {
        expense_date: editDraft.expense_date,
        category: editDraft.category.trim(),
        amount: amt,
        note: editDraft.note.trim() ? editDraft.note.trim() : null,
      });

      cancelEdit();
      await refresh(orgId);
    } catch (e: any) {
      setErr(e.message ?? String(e));
    }
  }

  async function onDelete(id: string) {
    if (!orgId) return;
    setErr("");
    try {
      await deleteExpense(orgId, id);
      await refresh(orgId);
    } catch (e: any) {
      setErr(e.message ?? String(e));
    }
  }

  if (!orgId && !err) return <div className="p-6">Loading…</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`${S.card} p-6`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-3xl font-black text-zinc-900">Expenses</div>
            <div className="mt-1 text-sm text-zinc-500">
              Add expenses, edit, and track category totals.
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-zinc-500">From</label>
              <input
                className={S.input}
                type="date"
                value={range.from}
                onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-zinc-500">To</label>
              <input
                className={S.input}
                type="date"
                value={range.to}
                onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
              />
            </div>

            <input
              className={S.input}
              placeholder="Search category / note…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
      </div>

      {err ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
          {err}
        </div>
      ) : null}

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className={`${S.card} p-6`}>
          <div className="text-[11px] font-black uppercase tracking-wide text-zinc-500">Count</div>
          <div className="mt-3 text-4xl font-black text-zinc-900">{kpis.count}</div>
        </div>

        <div className={`${S.card} p-6`}>
          <div className="text-[11px] font-black uppercase tracking-wide text-zinc-500">Total Expenses</div>
          <div className="mt-3 text-4xl font-black text-zinc-900">{fmtMoney(kpis.total)}</div>
        </div>

        <div className={`${S.card} p-6`}>
          <div className="text-[11px] font-black uppercase tracking-wide text-zinc-500">Top Category</div>
          <div className="mt-3 text-xl font-black text-zinc-900">
            {kpis.top[0]?.category ?? "—"}
          </div>
          <div className="mt-2 text-sm text-zinc-500">
            {kpis.top[0] ? fmtMoney(kpis.top[0].amount) : "No data"}
          </div>
        </div>
      </div>

      {/* Create Form */}
      <div className={`${S.card} p-6`}>
        <div className="text-lg font-black text-zinc-900">Add Expense</div>
        <div className="mt-1 text-sm text-zinc-500">Record costs like transport, supplies, rent, etc.</div>

        <form onSubmit={onCreate} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-bold text-zinc-500">Date</label>
            <input
              className={S.input}
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-zinc-500">Category</label>
            <input
              className={S.input}
              placeholder="e.g. Transport"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-zinc-500">Amount (Ksh)</label>
            <input
              className={S.input}
              type="number"
              min={0}
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="md:col-span-1">
            <label className="mb-1 block text-xs font-bold text-zinc-500">Note (optional)</label>
            <input
              className={S.input}
              placeholder="Optional note…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="md:col-span-4">
            <button className={S.btnPrimary} type="submit" disabled={loading}>
              {loading ? "Saving…" : "+ Add Expense"}
            </button>
          </div>
        </form>
      </div>

      {/* Category Breakdown */}
      <div className={`${S.card} overflow-hidden`}>
        <div className="px-6 py-4">
          <div className="text-lg font-black text-zinc-900">Category Totals</div>
          <div className="mt-1 text-sm text-zinc-500">For the selected period</div>
        </div>

        <div className="divide-y divide-zinc-200">
          {kpis.byCategory.length === 0 ? (
            <div className="px-6 py-10 text-sm text-zinc-500">No totals yet.</div>
          ) : (
            kpis.byCategory.slice(0, 12).map((c) => (
              <div
                key={c.category}
                className="grid items-center px-6 py-3 text-sm text-zinc-800"
                style={{ gridTemplateColumns: "1.6fr 1fr" }}
              >
                <div className="font-black">{c.category}</div>
                <div className="text-right font-black">{fmtMoney(c.amount)}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Table */}
      <div className={`${S.card} overflow-hidden`}>
        <div className="px-6 py-4">
          <div className="text-lg font-black text-zinc-900">Expense List</div>
          <div className="mt-1 text-sm text-zinc-500">Edit or delete entries</div>
        </div>

        <div className="px-6 pb-4">
          <div
            className={S.tableHead}
            style={{ gridTemplateColumns: "1fr 1.3fr 1fr 2fr auto" }}
          >
            <div>Date</div>
            <div>Category</div>
            <div className="text-right">Amount</div>
            <div>Note</div>
            <div />
          </div>
        </div>

        <div className="divide-y divide-zinc-200">
          {loading ? (
            <div className="px-6 py-10 text-sm text-zinc-500">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="px-6 py-10 text-sm text-zinc-500">No expenses found.</div>
          ) : (
            rows.map((r) => {
              const isEditing = editingId === r.id && editDraft;

              return (
                <div
                  key={r.id}
                  className="grid items-center px-6 py-3 text-sm text-zinc-800"
                  style={{ gridTemplateColumns: "1fr 1.3fr 1fr 2fr auto" }}
                >
                  {/* Date */}
                  <div className="text-zinc-600">
                    {isEditing ? (
                      <input
                        className={S.input}
                        type="date"
                        value={editDraft!.expense_date}
                        onChange={(e) =>
                          setEditDraft((d) => (d ? { ...d, expense_date: e.target.value } : d))
                        }
                      />
                    ) : (
                      r.expense_date
                    )}
                  </div>

                  {/* Category */}
                  <div className="font-black">
                    {isEditing ? (
                      <input
                        className={S.input}
                        value={editDraft!.category}
                        onChange={(e) =>
                          setEditDraft((d) => (d ? { ...d, category: e.target.value } : d))
                        }
                      />
                    ) : (
                      r.category
                    )}
                  </div>

                  {/* Amount */}
                  <div className="text-right font-black">
                    {isEditing ? (
                      <input
                        className={S.input}
                        type="number"
                        min={0}
                        step="1"
                        value={editDraft!.amount}
                        onChange={(e) =>
                          setEditDraft((d) => (d ? { ...d, amount: e.target.value } : d))
                        }
                      />
                    ) : (
                      fmtMoney(Number(r.amount ?? 0))
                    )}
                  </div>

                  {/* Note */}
                  <div className="text-zinc-600">
                    {isEditing ? (
                      <input
                        className={S.input}
                        value={editDraft!.note}
                        onChange={(e) =>
                          setEditDraft((d) => (d ? { ...d, note: e.target.value } : d))
                        }
                      />
                    ) : (
                      r.note ?? "—"
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-2">
                    {isEditing ? (
                      <>
                        <button className={S.btnGhost} onClick={cancelEdit} type="button">
                          Cancel
                        </button>
                        <button className={S.btnPrimary} onClick={() => saveEdit(r.id)} type="button">
                          Save
                        </button>
                      </>
                    ) : (
                      <>
                        <button className={S.btnGhost} onClick={() => startEdit(r)} type="button">
                          Edit
                        </button>
                        <button
                          className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-4 rounded"
                          onClick={() => onDelete(r.id)}
                          type="button"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}