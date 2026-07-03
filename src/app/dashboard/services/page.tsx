"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import {
  createService,
  createServicePayment,
  deleteService,
  dismissReminder,
  listDueReminders,
  listServices,
  listUpcomingScheduled,
  markServiceCompleted,
  paymentProgress,
  planLabel,
  PRESET_SERVICE_TYPES,
  updateService,
  type PaymentMethod,
  type PaymentPlan,
  type PeriodicInterval,
  type ServiceRow,
} from "@/lib/api/services";
import * as S from "./page.styles";

type Tab = "income" | "scheduled" | "all";
type FormMode = "none" | "record" | "schedule";

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}
function fmtMoney(v: number) {
  return `Ksh ${Number(v || 0).toLocaleString("en-KE", { minimumFractionDigits: 0 })}`;
}
function fmtDateTime(isoStr: string) {
  try {
    return new Date(isoStr).toLocaleString("en-KE", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoStr;
  }
}
function defaultRange() {
  const to = new Date(),
    from = new Date();
  from.setDate(to.getDate() - 29);
  return { from: iso(from), to: iso(to) };
}
function toReminderIso(date: string, time: string) {
  if (!date) return null;
  return new Date(`${date}T${time || "09:00"}:00`).toISOString();
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "mpesa", label: "M-Pesa" },
  { value: "card", label: "Card" },
  { value: "credit", label: "Credit" },
];

const PAYMENT_PLANS: { value: PaymentPlan; label: string }[] = [
  { value: "full", label: "Full payment" },
  { value: "installment", label: "Installments" },
  { value: "periodic", label: "Periodic" },
];

const PERIODIC_INTERVALS: { value: PeriodicInterval; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
];

const TYPE_COLORS: Record<string, string> = {
  Training: "#3B82F6",
  Inspection: "#8B5CF6",
  Tenders: "#D97706",
  "Bee removal / relocation": "#DC2626",
  "Honey harvesting": "#CA8A04",
  "Bee hive installation": "#16A34A",
  "Apiary siting": "#0D9488",
  Pollination: "#DB2777",
  Apitourism: "#6366F1",
};
function typeColor(t: string) {
  return TYPE_COLORS[t] ?? "#D97706";
}

function statusBadge(status: string) {
  if (status === "completed") return "border-green-200 bg-green-50 text-green-700";
  if (status === "scheduled") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "in_progress") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "cancelled" || status === "voided") return "border-red-200 bg-red-50 text-red-700";
  return "border-[#EADFC2] bg-[#FFFDF8] text-slate-600";
}

function StatCard({
  label,
  value,
  sub,
  variant = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  variant?: "neutral" | "success" | "warning" | "accent";
}) {
  const cfg = {
    neutral: { border: "#EADFC2", bg: "#FFFFFF", valueColor: "#1F2937", subColor: "#64748B" },
    success: { border: "#BBF7D0", bg: "#FBFEFC", valueColor: "#166534", subColor: "#16A34A" },
    warning: { border: "#FDE68A", bg: "#FFFDF5", valueColor: "#92400E", subColor: "#B45309" },
    accent: { border: "#F0D48A", bg: "#FFFBEB", valueColor: "#78350F", subColor: "#B45309" },
  }[variant];

  return (
    <div
      className="rounded-[24px] p-5 transition hover:-translate-y-0.5"
      style={{
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        boxShadow: "0 12px 30px rgba(92,64,16,0.055)",
      }}
    >
      <div className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: cfg.subColor }}>
        {label}
      </div>
      <div className="mt-3 text-[22px] font-black leading-tight tracking-tight truncate" style={{ color: cfg.valueColor }}>
        {value}
      </div>
      {sub && (
        <div className="mt-2 text-xs font-medium truncate" style={{ color: cfg.subColor }}>
          {sub}
        </div>
      )}
    </div>
  );
}

const IconSearch = () => (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" className="shrink-0 text-slate-400">
    <circle cx="9" cy="9" r="5.5" />
    <line x1="13.5" y1="13.5" x2="18" y2="18" />
  </svg>
);
const IconX = () => (
  <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="5" y1="5" x2="15" y2="15" />
    <line x1="15" y1="5" x2="5" y2="15" />
  </svg>
);

function TypeBars({ data, total }: { data: { service_type: string; amount: number }[]; total: number }) {
  if (!data.length)
    return <div className="py-12 text-center text-sm text-slate-400">No income data for this period.</div>;
  return (
    <div className={`divide-y ${S.divider}`}>
      {data.slice(0, 8).map((c) => {
        const pct = total > 0 ? (c.amount / total) * 100 : 0;
        const color = typeColor(c.service_type);
        return (
          <div key={c.service_type} className={`flex items-center gap-4 px-5 py-3.5 ${S.rowHover}`}>
            <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: color }} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-sm font-semibold text-slate-800 truncate">{c.service_type}</span>
                <span className="text-sm font-bold text-slate-900 shrink-0">{fmtMoney(c.amount)}</span>
              </div>
              <div className={S.progressTrack}>
                <div className={S.progressFill} style={{ width: `${Math.max(3, pct)}%` }} />
              </div>
            </div>
            <span className="text-xs font-bold text-slate-400 w-9 text-right">{pct.toFixed(0)}%</span>
          </div>
        );
      })}
    </div>
  );
}

function PaymentModal({
  service,
  onClose,
  onSaved,
  orgId,
}: {
  service: ServiceRow;
  onClose: () => void;
  onSaved: () => void;
  orgId: string;
}) {
  const [payDate, setPayDate] = useState(iso(new Date()));
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<PaymentMethod>("cash");
  const [payNote, setPayNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const prog = paymentProgress(service);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr("");
    try {
      const amt = Number(payAmount);
      if (!Number.isFinite(amt) || amt <= 0) throw new Error("Amount must be greater than 0.");
      await createServicePayment(orgId, service.id, {
        payment_date: payDate,
        amount: amt,
        payment_method: payMethod,
        note: payNote.trim() || null,
      });
      onSaved();
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F1A10]/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`${S.card} w-full max-w-md p-6`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-5">
          <div className="text-lg font-black text-slate-900">Record Payment</div>
          <div className="text-sm text-slate-500 mt-1">
            {service.service_type}
            {service.customer_name ? ` · ${service.customer_name}` : ""}
          </div>
        </div>

        <div className="rounded-2xl border border-[#EADFC2] bg-[#FFFDF8] px-4 py-4 mb-5 text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-500">Contract total</span>
            <span className="font-bold text-slate-900">{fmtMoney(prog.total)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Collected</span>
            <span className="font-bold text-green-700">{fmtMoney(prog.collected)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Remaining</span>
            <span className="font-bold text-amber-700">{fmtMoney(prog.remaining)}</span>
          </div>
          <div className={S.progressTrack + " mt-1"}>
            <div className={S.progressFill} style={{ width: `${prog.pct}%` }} />
          </div>
        </div>

        {err && <div className="mb-4 text-sm text-red-600 font-medium">{err}</div>}

        <form onSubmit={submit} className="grid gap-4">
          <div>
            <label className={S.label}>Payment date</label>
            <input className={S.input} type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} required />
          </div>
          <div>
            <label className={S.label}>Amount (Ksh)</label>
            <input className={S.input} type="number" min={0} step="1" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} required />
          </div>
          <div>
            <label className={S.label}>Method</label>
            <select className={S.input} value={payMethod} onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}>
              {PAYMENT_METHODS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={S.label}>Note</label>
            <input className={S.input} placeholder="Optional" value={payNote} onChange={(e) => setPayNote(e.target.value)} />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className={S.btnGhost + " flex-1 justify-center"}>Cancel</button>
            <button type="submit" disabled={saving} className={S.btnPrimary + " flex-1 justify-center"}>
              {saving ? "Saving…" : "Add Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ServicesPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("income");
  const [rows, setRows] = useState<ServiceRow[]>([]);
  const [dueReminders, setDueReminders] = useState<ServiceRow[]>([]);
  const [upcoming, setUpcoming] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [range, setRange] = useState(() => defaultRange());
  const [q, setQ] = useState("");
  const [filterType, setFilterType] = useState("");

  const [formMode, setFormMode] = useState<FormMode>("none");
  const [serviceType, setServiceType] = useState("");
  const [customType, setCustomType] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paymentPlan, setPaymentPlan] = useState<PaymentPlan>("full");
  const [periodicInterval, setPeriodicInterval] = useState<PeriodicInterval>("monthly");
  const [totalAmount, setTotalAmount] = useState("");
  const [initialPayment, setInitialPayment] = useState("");
  const [serviceDate, setServiceDate] = useState(() => iso(new Date()));
  const [scheduledDate, setScheduledDate] = useState("");
  const [reminderDate, setReminderDate] = useState("");
  const [reminderTime, setReminderTime] = useState("09:00");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const [payModalService, setPayModalService] = useState<ServiceRow | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const notifiedRef = useRef<Set<string>>(new Set());

  const refresh = useCallback(async (o: string) => {
    setLoading(true);
    try {
      const [data, reminders, sched] = await Promise.all([
        listServices(o, { ...range, q, mode: tab }),
        listDueReminders(o),
        listUpcomingScheduled(o),
      ]);
      setRows(data);
      setDueReminders(reminders);
      setUpcoming(sched);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [range, q, tab]);

  useEffect(() => {
    (async () => {
      try {
        setOrgId(await bootstrapOrg());
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  useEffect(() => {
    if (!orgId) return;
    setErr("");
    refresh(orgId);
  }, [orgId, refresh]);

  useEffect(() => {
    if (!dueReminders.length) return;
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
    for (const r of dueReminders) {
      if (notifiedRef.current.has(r.id)) continue;
      notifiedRef.current.add(r.id);
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("Service reminder", {
          body: `${r.service_type}${r.customer_name ? ` · ${r.customer_name}` : ""}`,
        });
      }
    }
  }, [dueReminders]);

  const kpis = useMemo(() => {
    const incomeRows = tab === "scheduled" ? [] : rows.filter((r) => Number(r.amount ?? 0) > 0);
    const total = incomeRows.reduce((s, r) => s + Number(r.amount ?? 0), 0);
    const map = new Map<string, number>();
    for (const r of incomeRows) {
      const t = r.service_type || "Uncategorized";
      map.set(t, (map.get(t) ?? 0) + Number(r.amount ?? 0));
    }
    const byType = Array.from(map.entries())
      .map(([service_type, amount]) => ({ service_type, amount }))
      .sort((a, b) => b.amount - a.amount);
    const outstanding = rows
      .filter((r) => r.payment_plan !== "full" && !["completed", "cancelled", "voided"].includes(String(r.status)))
      .reduce((s, r) => s + paymentProgress(r).remaining, 0);
    return {
      count: incomeRows.length,
      total,
      byType,
      outstanding,
      scheduledCount: upcoming.length,
    };
  }, [rows, tab, upcoming.length]);

  const allTypes = useMemo(
    () => Array.from(new Set(rows.map((r) => r.service_type).filter(Boolean))).sort(),
    [rows]
  );

  const filtered = useMemo(() => {
    if (!filterType) return rows;
    return rows.filter((r) => r.service_type === filterType);
  }, [rows, filterType]);

  function resetForm() {
    setServiceType("");
    setCustomType("");
    setCustomerName("");
    setPaymentMethod("cash");
    setPaymentPlan("full");
    setPeriodicInterval("monthly");
    setTotalAmount("");
    setInitialPayment("");
    setServiceDate(iso(new Date()));
    setScheduledDate("");
    setReminderDate("");
    setReminderTime("09:00");
    setNote("");
    setFormMode("none");
  }

  function openForm(mode: FormMode) {
    if (formMode === mode) {
      resetForm();
    } else {
      resetForm();
      setFormMode(mode);
    }
  }

  async function onSubmitForm(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    setSaving(true);
    setErr("");
    try {
      const finalType = serviceType === "__custom__" ? customType.trim() : serviceType.trim();
      if (!finalType) throw new Error("Service type is required.");

      if (formMode === "record") {
        const amt = Number(totalAmount);
        if (!serviceDate) throw new Error("Date is required.");
        if (!Number.isFinite(amt) || amt <= 0) throw new Error("Amount must be greater than 0.");
        await createService(orgId, {
          service_date: serviceDate,
          service_type: finalType,
          amount: amt,
          total_amount: amt,
          customer_name: customerName.trim() || null,
          payment_method: paymentMethod,
          note: note.trim() || null,
          payment_plan: "full",
          status: "completed",
        });
      } else {
        if (!scheduledDate) throw new Error("Scheduled date is required.");
        const total = Number(totalAmount);
        if (!Number.isFinite(total) || total <= 0) throw new Error("Contract total must be greater than 0.");
        const initial = initialPayment ? Number(initialPayment) : 0;
        if (initialPayment && (!Number.isFinite(initial) || initial < 0)) throw new Error("Initial payment is invalid.");

        await createService(orgId, {
          service_date: scheduledDate,
          service_type: finalType,
          amount: initial,
          total_amount: total,
          customer_name: customerName.trim() || null,
          payment_method: paymentMethod,
          note: note.trim() || null,
          status: "scheduled",
          scheduled_date: scheduledDate,
          reminder_at: reminderDate ? toReminderIso(reminderDate, reminderTime) : null,
          payment_plan: paymentPlan,
          periodic_interval: paymentPlan === "periodic" ? periodicInterval : null,
          recordPayment: initial > 0,
        });
      }
      resetForm();
      await refresh(orgId);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleDismissReminder(id: string) {
    if (!orgId) return;
    await dismissReminder(orgId, id);
    await refresh(orgId);
  }

  async function handleComplete(id: string) {
    if (!orgId) return;
    await markServiceCompleted(orgId, id);
    await refresh(orgId);
  }

  async function handleCancel(id: string) {
    if (!orgId) return;
    await updateService(orgId, id, { status: "cancelled" });
    await refresh(orgId);
  }

  async function handleDelete(id: string) {
    if (!orgId || !confirm("Delete this service record?")) return;
    await deleteService(orgId, id);
    await refresh(orgId);
  }

  if (!orgId && !err) {
    return (
      <div className="flex h-64 items-center justify-center gap-3 text-slate-500">
        <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" strokeOpacity="0.2" />
          <path d="M12 2a10 10 0 0110 10" />
        </svg>
        <span className="text-sm font-medium">Loading services…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {err && (
        <div className={S.alert}>
          <span className="shrink-0">⚠️</span>
          <span className="flex-1">{err}</span>
          <button onClick={() => setErr("")} className="ml-auto shrink-0 text-red-400 hover:text-red-600"><IconX /></button>
        </div>
      )}

      {dueReminders.length > 0 && (
        <div className={S.reminderBanner}>
          <div className="flex items-center gap-2 mb-3">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-amber-100 text-base">🔔</span>
            <div>
              <div className="text-sm font-black text-amber-950">Reminders due</div>
              <div className="text-xs text-amber-800/70">{dueReminders.length} service{dueReminders.length !== 1 ? "s" : ""} need attention</div>
            </div>
          </div>
          <div className="space-y-2">
            {dueReminders.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#F0D48A]/60 bg-white/90 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="font-bold text-slate-900">{r.service_type}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {r.scheduled_date ?? r.service_date}
                    {r.customer_name ? ` · ${r.customer_name}` : ""}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setPayModalService(r)}
                    className={S.btnSm + " border-[#EADFC2] bg-white text-amber-800 hover:bg-amber-50"}
                  >
                    Add payment
                  </button>
                  <button
                    onClick={() => handleComplete(r.id)}
                    className={S.btnSm + " border-green-200 bg-green-50 text-green-700 hover:bg-green-100"}
                  >
                    Mark done
                  </button>
                  <button
                    onClick={() => handleDismissReminder(r.id)}
                    className={S.btnSm + " border-[#EADFC2] text-slate-500 hover:bg-slate-50"}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Header */}
      <div className={`${S.card} p-5 sm:p-6`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-normal text-[#1f1b14] sm:text-3xl">Services</h1>
            <p className="mt-1 text-sm text-[#766b59]">
              Schedule jobs, record payments, and track service income
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className={S.btnGhost} onClick={() => openForm("schedule")}>
              {formMode === "schedule" ? "Cancel" : "+ Schedule"}
            </button>
            <button className={S.btnPrimary} onClick={() => openForm("record")}>
              {formMode === "record" ? "Cancel" : "+ Record Income"}
            </button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-5">
        <StatCard label="Collected" value={fmtMoney(kpis.total)} sub="Income in view" variant="success" />
        <StatCard
          label={tab === "scheduled" ? "Scheduled" : "Jobs"}
          value={String(tab === "scheduled" ? kpis.scheduledCount : kpis.count)}
          sub={tab === "scheduled" ? "Upcoming work" : "With payments"}
          variant="neutral"
        />
        <StatCard label="Outstanding" value={fmtMoney(kpis.outstanding)} sub="Awaiting collection" variant="warning" />
        <StatCard label="Upcoming" value={String(upcoming.length)} sub="Next 14 days" variant="accent" />
        <StatCard
          label="Top Service"
          value={kpis.byType[0]?.service_type ?? "—"}
          sub={kpis.byType[0] ? fmtMoney(kpis.byType[0].amount) : "No data yet"}
          variant="neutral"
        />
      </div>

      {/* Form */}
      {formMode !== "none" && (
        <div className={`${S.card} p-5 sm:p-6`}>
          <div className="flex items-center gap-3 mb-5">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#FFF8E6] border border-[#F0D48A] text-lg">
              {formMode === "schedule" ? "📅" : "💰"}
            </div>
            <div>
              <div className={S.sectionTitle}>
                {formMode === "schedule" ? "Schedule a Service" : "Record Service Income"}
              </div>
              <div className={S.sectionSub}>
                {formMode === "schedule"
                  ? "Plan a future job with reminder and payment terms"
                  : "Log a completed service paid in full"}
              </div>
            </div>
          </div>

          <form onSubmit={onSubmitForm} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className={S.label}>Service Type *</label>
              <select className={S.input} value={serviceType} onChange={(e) => setServiceType(e.target.value)} required>
                <option value="">— Select —</option>
                {PRESET_SERVICE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                <option value="__custom__">+ Custom…</option>
              </select>
            </div>
            {serviceType === "__custom__" && (
              <div>
                <label className={S.label}>Custom Type *</label>
                <input className={S.input} value={customType} onChange={(e) => setCustomType(e.target.value)} required />
              </div>
            )}
            <div>
              <label className={S.label}>Customer</label>
              <input className={S.input} placeholder="Client or farm name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            </div>

            {formMode === "record" ? (
              <>
                <div>
                  <label className={S.label}>Service Date *</label>
                  <input className={S.input} type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} required />
                </div>
                <div>
                  <label className={S.label}>Amount (Ksh) *</label>
                  <input className={S.input} type="number" min={0} value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} required />
                </div>
                <div>
                  <label className={S.label}>Payment Method</label>
                  <select className={S.input} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
                    {PAYMENT_METHODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className={S.label}>Scheduled Date *</label>
                  <input
                    className={S.input}
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => {
                      setScheduledDate(e.target.value);
                      if (!reminderDate) setReminderDate(e.target.value);
                    }}
                    required
                  />
                </div>
                <div>
                  <label className={S.label}>Contract Total (Ksh) *</label>
                  <input className={S.input} type="number" min={0} value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} required />
                </div>
                <div>
                  <label className={S.label}>Payment Plan</label>
                  <select className={S.input} value={paymentPlan} onChange={(e) => setPaymentPlan(e.target.value as PaymentPlan)}>
                    {PAYMENT_PLANS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                {paymentPlan === "periodic" && (
                  <div>
                    <label className={S.label}>Billing Interval</label>
                    <select className={S.input} value={periodicInterval} onChange={(e) => setPeriodicInterval(e.target.value as PeriodicInterval)}>
                      {PERIODIC_INTERVALS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className={S.label}>Initial Payment</label>
                  <input className={S.input} type="number" min={0} value={initialPayment} onChange={(e) => setInitialPayment(e.target.value)} placeholder="Optional" />
                </div>
                <div>
                  <label className={S.label}>Reminder Date</label>
                  <input className={S.input} type="date" value={reminderDate} onChange={(e) => setReminderDate(e.target.value)} />
                </div>
                <div>
                  <label className={S.label}>Reminder Time</label>
                  <input className={S.input} type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} />
                </div>
              </>
            )}

            <div className="sm:col-span-2 lg:col-span-3">
              <label className={S.label}>Note</label>
              <input className={S.input} placeholder="Optional details…" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div className="sm:col-span-2 lg:col-span-3 flex justify-end gap-3 pt-1">
              <button type="button" onClick={resetForm} className={S.btnGhost}>Cancel</button>
              <button type="submit" disabled={saving} className={S.btnPrimary}>
                {saving ? "Saving…" : formMode === "schedule" ? "Schedule Service" : "Record Income"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-2xl border border-[#EADFC2] bg-white p-1 shadow-[0_4px_16px_rgba(92,64,16,0.04)] w-fit">
        {([
          ["income", "Income"],
          ["scheduled", "Scheduled"],
          ["all", "All Jobs"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${
              tab === id ? "bg-[#2F2718] text-white shadow-sm" : "text-slate-600 hover:bg-[#FFF8E6] hover:text-slate-900"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-4">
          {tab !== "scheduled" && (
            <div className="flex flex-wrap items-center gap-3">
              <label className={`flex items-center gap-2 ${S.filterInput} flex-1 min-w-[180px] max-w-xs`}>
                <IconSearch />
                <input
                  className="flex-1 bg-transparent outline-none placeholder:text-slate-400 min-w-0"
                  placeholder="Search type, customer, note…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                {q && (
                  <button type="button" onClick={() => setQ("")} className="text-slate-400 hover:text-slate-600">
                    <IconX />
                  </button>
                )}
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-400">From</span>
                <input className={S.filterInput + " w-auto"} type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
                <span className="text-xs font-bold uppercase tracking-wide text-slate-400">To</span>
                <input className={S.filterInput + " w-auto"} type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
              </div>
              <select className={S.filterInput + " w-auto"} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                <option value="">All types</option>
                {allTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <span className="ml-auto text-xs font-medium text-slate-400">
                {filtered.length} of {rows.length}
              </span>
            </div>
          )}

          <div className={S.card}>
            {loading ? (
              <div className="flex items-center justify-center gap-3 py-16 text-slate-400">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.2" />
                  <path d="M12 2a10 10 0 0110 10" />
                </svg>
                <span className="text-sm font-medium">Loading…</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-20 text-center">
                <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[#FFF8E6] border border-[#F0D48A] text-2xl">
                  {tab === "scheduled" ? "📅" : "💰"}
                </div>
                <p className="text-sm font-bold text-slate-700">
                  {rows.length === 0 ? "No services yet" : "No matching entries"}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {rows.length === 0
                    ? "Schedule a job or record income to get started"
                    : "Try adjusting your filters"}
                </p>
              </div>
            ) : (
              <div className={`divide-y ${S.divider}`}>
                {filtered.map((r) => {
                  const prog = paymentProgress(r);
                  const isExpanded = expandedId === r.id;
                  const payments = r.service_payments ?? [];
                  const color = typeColor(r.service_type);

                  return (
                    <div key={r.id} className={`px-5 py-4 ${S.rowHover}`}>
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: color }} />
                            <span className="font-bold text-slate-900">{r.service_type}</span>
                            <span className={S.badge + " " + statusBadge(String(r.status))}>
                              {String(r.status).replace("_", " ")}
                            </span>
                            {r.payment_plan !== "full" && (
                              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                                {planLabel(String(r.payment_plan))}
                                {r.periodic_interval ? ` · ${r.periodic_interval}` : ""}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-slate-500 mt-1">
                            {tab === "scheduled" ? r.scheduled_date : r.service_date}
                            {r.customer_name ? ` · ${r.customer_name}` : ""}
                            {r.reminder_at && !r.reminder_dismissed && (
                              <span className="text-amber-700 font-medium ml-1">· 🔔 {fmtDateTime(r.reminder_at)}</span>
                            )}
                          </div>
                          {r.payment_plan !== "full" && prog.total > 0 && (
                            <div className="mt-3 max-w-sm">
                              <div className="flex justify-between text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">
                                <span>{fmtMoney(prog.collected)} collected</span>
                                <span>{fmtMoney(prog.total)} total</span>
                              </div>
                              <div className={S.progressTrack}>
                                <div className={S.progressFill} style={{ width: `${prog.pct}%` }} />
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <div className={S.moneyPositive}>{fmtMoney(Number(r.amount ?? 0))}</div>
                          {prog.total > Number(r.amount ?? 0) && (
                            <div className="text-xs font-medium text-slate-400 mt-0.5">of {fmtMoney(prog.total)}</div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-[#F1E6C9]/80">
                        {r.payment_plan !== "full" && !["cancelled", "voided"].includes(String(r.status)) && (
                          <button
                            onClick={() => setPayModalService(r)}
                            className={S.btnSm + " border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"}
                          >
                            + Payment
                          </button>
                        )}
                        {r.status === "scheduled" && (
                          <>
                            <button
                              onClick={() => handleComplete(r.id)}
                              className={S.btnSm + " border-green-200 bg-green-50 text-green-700 hover:bg-green-100"}
                            >
                              Mark done
                            </button>
                            <button
                              onClick={() => handleCancel(r.id)}
                              className={S.btnSm + " border-[#EADFC2] text-slate-600 hover:bg-[#FFF8E6]"}
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        {payments.length > 0 && (
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : r.id)}
                            className={S.btnSm + " border-[#EADFC2] text-slate-500 hover:bg-[#FFFDF8]"}
                          >
                            {isExpanded ? "Hide" : "View"} payments ({payments.length})
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(r.id)}
                          className={S.btnSm + " border-red-200 text-red-600 hover:bg-red-50 ml-auto"}
                        >
                          Delete
                        </button>
                      </div>

                      {isExpanded && payments.length > 0 && (
                        <div className="mt-3 rounded-2xl border border-[#EADFC2] bg-[#FFFDF8] p-3 text-sm space-y-2">
                          {payments.map((p) => (
                            <div key={p.id} className="flex justify-between items-center gap-3">
                              <span className="text-slate-600">
                                {p.payment_date}
                                <span className="ml-2 text-[11px] font-bold uppercase text-slate-400">{p.payment_method}</span>
                              </span>
                              <span className="font-bold text-slate-900">{fmtMoney(Number(p.amount))}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {filtered.length > 0 && (
              <div className="flex items-center justify-between border-t border-[#F1E6C9] px-5 py-3 bg-[#FFFDF8]">
                <span className="text-xs font-medium text-slate-400">{filtered.length} record{filtered.length !== 1 ? "s" : ""}</span>
                <span className={`text-sm ${S.moneyPositive}`}>
                  {fmtMoney(filtered.reduce((s, r) => s + Number(r.amount ?? 0), 0))}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {tab !== "scheduled" && (
            <div className={S.card}>
              <div className="border-b border-[#F1E6C9] px-5 py-4 bg-[#FFFDF8]">
                <div className={S.sectionTitle}>Income by Type</div>
                <div className={S.sectionSub}>{kpis.count} job{kpis.count !== 1 ? "s" : ""} in period</div>
              </div>
              <TypeBars data={kpis.byType} total={kpis.total} />
              {kpis.total > 0 && (
                <div className="flex items-center justify-between border-t border-[#F1E6C9] px-5 py-3 bg-[#FFFDF8]">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Total</span>
                  <span className={`text-sm ${S.moneyPositive}`}>{fmtMoney(kpis.total)}</span>
                </div>
              )}
            </div>
          )}

          {upcoming.length > 0 && (
            <div className={S.card}>
              <div className="border-b border-[#F1E6C9] px-5 py-4 bg-[#FFFDF8]">
                <div className={S.sectionTitle}>Upcoming</div>
                <div className={S.sectionSub}>Next 14 days</div>
              </div>
              <div className={`divide-y ${S.divider}`}>
                {upcoming.slice(0, 6).map((r) => (
                  <div key={r.id} className={`px-5 py-3.5 ${S.rowHover}`}>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ background: typeColor(r.service_type) }} />
                      <span className="text-sm font-bold text-slate-800 truncate">{r.service_type}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 pl-4">
                      {r.scheduled_date}
                      {r.customer_name ? ` · ${r.customer_name}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {payModalService && orgId && (
        <PaymentModal
          service={payModalService}
          orgId={orgId}
          onClose={() => setPayModalService(null)}
          onSaved={() => refresh(orgId)}
        />
      )}
    </div>
  );
}
