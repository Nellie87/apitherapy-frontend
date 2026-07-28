"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import {
  createService,
  createServicePayment,
  deleteService,
  isScheduledJob,
  dismissReminder,
  listDueReminders,
  listServices,
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

type Tab = "income" | "scheduled" | "pending" | "all";
type ToastKind = "success" | "error" | "info";
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
  return { from: "", to: "" };
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

function statusBadge(status: string) {
  if (status === "completed")
    return "border-green-200 bg-green-50 text-green-700";
  if (status === "scheduled") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "in_progress")
    return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "cancelled" || status === "voided")
    return "border-red-200 bg-red-50 text-red-700";
  return "border-[#EADFC2] bg-[#FFFDF8] text-slate-600";
}

const IconSearch = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    className="shrink-0 text-slate-400"
  >
    <circle cx="9" cy="9" r="5.5" />
    <line x1="13.5" y1="13.5" x2="18" y2="18" />
  </svg>
);
const IconX = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
  >
    <line x1="5" y1="5" x2="15" y2="15" />
    <line x1="15" y1="5" x2="5" y2="15" />
  </svg>
);

function PaymentModal({
  service,
  onClose,
  onSaved,
  orgId,
}: {
  service: ServiceRow;
  onClose: () => void;
  onSaved: (message: string) => void;
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
      if (!Number.isFinite(amt) || amt <= 0)
        throw new Error("Amount must be greater than 0.");
      await createServicePayment(orgId, service.id, {
        payment_date: payDate,
        amount: amt,
        payment_method: payMethod,
        note: payNote.trim() || null,
      });
      onSaved("Payment recorded successfully.");
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F1A10]/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className={`${S.card} w-full max-w-md p-6`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5">
          <div className="text-lg font-black text-slate-900">
            Record Payment
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
            {service.service_type}
            {service.customer_name ? ` · ${service.customer_name}` : ""}
          </div>
        </div>

        <div className="rounded-2xl border border-[#EADFC2] bg-[#FFFDF8] px-4 py-4 mb-5 text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-500">Contract total</span>
            <span className="font-bold text-slate-900">
              {fmtMoney(prog.total)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Collected</span>
            <span className="font-bold text-green-700">
              {fmtMoney(prog.collected)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Remaining</span>
            <span className="font-bold text-amber-700">
              {fmtMoney(prog.remaining)}
            </span>
          </div>
          <div className={S.progressTrack + " mt-1"}>
            <div className={S.progressFill} style={{ width: `${prog.pct}%` }} />
          </div>
        </div>

        {err && (
          <div className="mb-4 text-sm text-red-600 font-medium">{err}</div>
        )}

        <form onSubmit={submit} className="grid gap-4">
          <div>
            <label className={S.label}>Payment date</label>
            <input
              className={S.input}
              type="date"
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label className={S.label}>Amount (Ksh)</label>
            <input
              className={S.input}
              type="number"
              min={0}
              step="1"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              required
            />
          </div>
          <div>
            <label className={S.label}>Method</label>
            <select
              className={S.input}
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
            >
              {PAYMENT_METHODS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={S.label}>Note</label>
            <input
              className={S.input}
              placeholder="Optional"
              value={payNote}
              onChange={(e) => setPayNote(e.target.value)}
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className={S.btnGhost + " flex-1 justify-center"}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className={S.btnPrimary + " flex-1 justify-center"}
            >
              {saving ? "Saving…" : "Add Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CompleteServiceModal({
  service,
  orgId,
  onClose,
  onSaved,
}: {
  service: ServiceRow;
  orgId: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const progress = paymentProgress(service);
  const suggestedAmount =
    progress.remaining > 0
      ? progress.remaining
      : Number(service.total_amount ?? service.amount ?? 0);
  const [paymentChoice, setPaymentChoice] = useState<"paid" | "unpaid">("paid");
  const [paymentDate, setPaymentDate] = useState(iso(new Date()));
  const [paymentAmount, setPaymentAmount] = useState(
    String(Math.max(0, suggestedAmount)),
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paymentNote, setPaymentNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function completeService() {
    setSaving(true);
    setError("");
    try {
      if (paymentChoice === "paid") {
        const amount = Number(paymentAmount);
        if (!Number.isFinite(amount) || amount <= 0) {
          throw new Error("Enter a payment amount greater than 0.");
        }
        await createServicePayment(orgId, service.id, {
          payment_date: paymentDate,
          amount,
          payment_method: paymentMethod,
          note:
            paymentNote.trim() || "Payment recorded when service was completed",
        });
      }

      await markServiceCompleted(orgId, service.id);
      onSaved(
        paymentChoice === "paid"
          ? "Payment recorded and service completed."
          : "Service completed with payment still pending.",
      );
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F1A10]/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`${S.card} w-full max-w-lg p-6`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6">
          <h2 className="text-xl font-black text-slate-900">
            Complete service
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {service.service_type}
            {service.customer_name ? ` for ${service.customer_name}` : ""}
          </p>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-[#EADFC2] bg-[#FFFDF8] p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Contract total
            </div>
            <div className="mt-2 text-lg font-black text-slate-900">
              {fmtMoney(progress.total)}
            </div>
          </div>
          <div className="rounded-2xl border border-[#EADFC2] bg-[#FFFDF8] p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Still outstanding
            </div>
            <div className="mt-2 text-lg font-black text-amber-700">
              {fmtMoney(progress.remaining)}
            </div>
          </div>
        </div>

        <div className="mb-5 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setPaymentChoice("paid")}
            className={`rounded-2xl border p-4 text-left transition ${paymentChoice === "paid" ? "border-amber-400 bg-amber-50 ring-2 ring-amber-100" : "border-[#EADFC2] bg-white hover:bg-[#FFFDF8]"}`}
          >
            <div className="font-bold text-slate-900">Record payment</div>
            <div className="mt-1 text-sm text-slate-500">
              Add a full or partial payment, then complete.
            </div>
          </button>
          <button
            type="button"
            onClick={() => setPaymentChoice("unpaid")}
            className={`rounded-2xl border p-4 text-left transition ${paymentChoice === "unpaid" ? "border-amber-400 bg-amber-50 ring-2 ring-amber-100" : "border-[#EADFC2] bg-white hover:bg-[#FFFDF8]"}`}
          >
            <div className="font-bold text-slate-900">No payment received</div>
            <div className="mt-1 text-sm text-slate-500">
              Complete the job and leave the balance outstanding.
            </div>
          </button>
        </div>

        {paymentChoice === "paid" && (
          <div className="mb-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label className={S.label}>Payment date</label>
              <input
                className={S.input}
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
            <div>
              <label className={S.label}>Amount paid</label>
              <input
                className={S.input}
                type="number"
                min={0}
                step="1"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
            </div>
            <div>
              <label className={S.label}>Payment method</label>
              <select
                className={S.input}
                value={paymentMethod}
                onChange={(e) =>
                  setPaymentMethod(e.target.value as PaymentMethod)
                }
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={S.label}>Note</label>
              <input
                className={S.input}
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className={S.btnGhost}>
            Cancel
          </button>
          <button
            type="button"
            onClick={completeService}
            disabled={saving}
            className={S.btnPrimary}
          >
            {saving
              ? "Completing…"
              : paymentChoice === "paid"
                ? "Record payment and complete"
                : "Complete without payment"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ServicesPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [rows, setRows] = useState<ServiceRow[]>([]);
  const [dueReminders, setDueReminders] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState<{
    message: string;
    kind: ToastKind;
  } | null>(null);

  const [range, setRange] = useState(() => defaultRange());
  const [q, setQ] = useState("");
  const [filterType, setFilterType] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  const [formMode, setFormMode] = useState<FormMode>("none");
  const [serviceType, setServiceType] = useState("");
  const [customType, setCustomType] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paymentPlan, setPaymentPlan] = useState<PaymentPlan>("full");
  const [periodicInterval, setPeriodicInterval] =
    useState<PeriodicInterval>("monthly");
  const [totalAmount, setTotalAmount] = useState("");
  const [initialPayment, setInitialPayment] = useState("");
  const [serviceDate, setServiceDate] = useState(() => iso(new Date()));
  const [scheduledDate, setScheduledDate] = useState("");
  const [reminderDate, setReminderDate] = useState("");
  const [reminderTime, setReminderTime] = useState("09:00");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const [payModalService, setPayModalService] = useState<ServiceRow | null>(
    null,
  );
  const [completeModalService, setCompleteModalService] =
    useState<ServiceRow | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const notifiedRef = useRef<Set<string>>(new Set());

  const showToast = useCallback(
    (message: string, kind: ToastKind = "success") => {
      setToast({ message, kind });
    },
    [],
  );

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const refresh = useCallback(
    async (o: string) => {
      setLoading(true);
      try {
        /*
         * Always load the complete service collection.
         * Tabs and date filters are applied locally below. This prevents
         * future scheduled services from disappearing because of backend
         * mode or reporting-date filters.
         */
        const [data, reminders] = await Promise.all([
          listServices(o, {
            q,
            mode: "all",
          }),
          listDueReminders(o),
        ]);

        setRows(data);
        setDueReminders(reminders);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        setErr(message);
        showToast(message, "error");
      } finally {
        setLoading(false);
      }
    },
    [q, showToast],
  );

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
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "default"
    ) {
      Notification.requestPermission();
    }
    for (const r of dueReminders) {
      if (notifiedRef.current.has(r.id)) continue;
      notifiedRef.current.add(r.id);
      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        new Notification("Service reminder", {
          body: `${r.service_type}${r.customer_name ? ` · ${r.customer_name}` : ""}`,
        });
      }
    }
  }, [dueReminders]);

  const kpis = useMemo(() => {
    const incomeRows =
      tab === "scheduled" ? [] : rows.filter((r) => Number(r.amount ?? 0) > 0);
    const total = incomeRows.reduce((s, r) => s + Number(r.amount ?? 0), 0);
    const outstanding = rows
      .filter(
        (r) =>
          !["cancelled", "voided"].includes(String(r.status)) &&
          paymentProgress(r).remaining > 0,
      )
      .reduce((sum, r) => sum + paymentProgress(r).remaining, 0);

    const scheduledCount = rows.filter(isScheduledJob).length;

    const pendingCount = rows.filter(
      (r) =>
        !["cancelled", "voided"].includes(String(r.status)) &&
        paymentProgress(r).remaining > 0,
    ).length;
    return {
      total,
      outstanding,
      scheduledCount,
      pendingCount,
    };
  }, [rows, tab]);

  const allTypes = useMemo(
    () =>
      Array.from(
        new Set(rows.map((r) => r.service_type).filter(Boolean)),
      ).sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const status = String(r.status);
      const progress = paymentProgress(r);
      const rowDate = r.scheduled_date ?? r.service_date ?? "";

      const matchesTab =
        tab === "all" ||
        (tab === "scheduled" && isScheduledJob(r)) ||
        (tab === "pending" &&
          !["cancelled", "voided"].includes(status) &&
          progress.remaining > 0) ||
        (tab === "income" && progress.collected > 0);

      const matchesType = !filterType || r.service_type === filterType;
      const matchesFrom = !range.from || (rowDate && rowDate >= range.from);
      const matchesTo = !range.to || (rowDate && rowDate <= range.to);

      return matchesTab && matchesType && matchesFrom && matchesTo;
    });
  }, [rows, tab, filterType, range.from, range.to]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [tab, q, filterType, range.from, range.to]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

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
    setShowMoreOptions(false);
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
      const finalType =
        serviceType === "__custom__" ? customType.trim() : serviceType.trim();
      if (!finalType) throw new Error("Service type is required.");

      if (formMode === "record") {
        const amt = Number(totalAmount);
        if (!serviceDate) throw new Error("Date is required.");
        if (!Number.isFinite(amt) || amt <= 0)
          throw new Error("Amount must be greater than 0.");
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
        if (!Number.isFinite(total) || total <= 0)
          throw new Error("Contract total must be greater than 0.");
        const initial = initialPayment ? Number(initialPayment) : 0;
        if (initialPayment && (!Number.isFinite(initial) || initial < 0))
          throw new Error("Initial payment is invalid.");

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
          reminder_at: reminderDate
            ? toReminderIso(reminderDate, reminderTime)
            : null,
          payment_plan: paymentPlan,
          periodic_interval:
            paymentPlan === "periodic" ? periodicInterval : null,
          recordPayment: initial > 0,
        });
      }
      if (formMode === "schedule") {
        // Move straight to Scheduled and explicitly reload that dataset.
        // Passing the override avoids React state timing causing the old
        // Income tab filters to be used immediately after saving.
        setTab("scheduled");
        resetForm();
        await refresh(orgId);
        showToast("Service scheduled successfully.");
      } else {
        setTab("income");
        resetForm();
        await refresh(orgId);
        showToast("Service income recorded successfully.");
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleDismissReminder(id: string) {
    if (!orgId) return;
    try {
      await dismissReminder(orgId, id);
      await refresh(orgId);
      showToast("Reminder dismissed.");
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    }
  }

  function handleComplete(service: ServiceRow) {
    setCompleteModalService(service);
  }

  async function handleCancel(id: string) {
    if (!orgId) return;
    try {
      await updateService(orgId, id, { status: "cancelled" });
      await refresh(orgId);
      showToast("Service cancelled.");
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    }
  }

  async function handleDelete(id: string) {
    if (!orgId || !confirm("Delete this service record?")) return;
    try {
      await deleteService(orgId, id);
      await refresh(orgId);
      showToast("Service deleted.");
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    }
  }

  if (!orgId && !err) {
    return (
      <div className="flex h-64 items-center justify-center gap-3 text-slate-500">
        <svg
          className="h-5 w-5 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" strokeOpacity="0.2" />
          <path d="M12 2a10 10 0 0110 10" />
        </svg>
        <span className="text-sm font-medium">Loading services…</span>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-7 px-4 pb-10 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed right-4 top-4 z-[70] w-[calc(100%-2rem)] max-w-sm rounded-2xl border px-4 py-3 shadow-[0_16px_40px_rgba(15,23,42,0.14)] ${
            toast.kind === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : toast.kind === "info"
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : "border-green-200 bg-green-50 text-green-700"
          }`}
        >
          <div className="flex items-start gap-3">
            <span className="flex-1 text-sm font-semibold">
              {toast.message}
            </span>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="mt-0.5 shrink-0 opacity-60 transition hover:opacity-100"
              aria-label="Close notification"
            >
              <IconX />
            </button>
          </div>
        </div>
      )}

      {err && (
        <div className={S.alert}>
          <span className="flex-1">{err}</span>
          <button
            onClick={() => setErr("")}
            className="ml-auto shrink-0 text-red-400 hover:text-red-600"
          >
            <IconX />
          </button>
        </div>
      )}

      {dueReminders.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="mb-2 text-sm font-semibold text-amber-950">
            {dueReminders.length} reminder
            {dueReminders.length !== 1 ? "s" : ""} due
          </div>
          <div className="space-y-2">
            {dueReminders.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/80 px-3 py-2"
              >
                <div className="min-w-0 text-sm">
                  <span className="font-semibold text-slate-900">
                    {r.service_type}
                  </span>
                  <span className="text-slate-500">
                    {r.customer_name ? ` · ${r.customer_name}` : ""} ·{" "}
                    {r.scheduled_date ?? r.service_date}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleComplete(r)}
                    className={
                      S.btnSm +
                      " border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                    }
                  >
                    Done
                  </button>
                  <button
                    onClick={() => handleDismissReminder(r.id)}
                    className={
                      S.btnSm +
                      " border-[#EADFC2] text-slate-500 hover:bg-slate-50"
                    }
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
      <div className="flex flex-col gap-5 py-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-normal tracking-tight text-[#1f1b14] sm:text-4xl">
            Services
          </h1>
          <p className="mt-2 text-base text-[#766b59]">
            Schedule jobs and track payments
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            className={S.btnGhost + " min-h-12 px-6 text-base"}
            onClick={() => openForm("schedule")}
          >
            {formMode === "schedule" ? "Cancel" : "Schedule"}
          </button>
          <button
            className={S.btnPrimary + " min-h-12 px-6 text-base"}
            onClick={() => openForm("record")}
          >
            {formMode === "record" ? "Cancel" : "Record income"}
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <div className="rounded-[24px] border border-[#EADFC2] bg-white px-6 py-5 shadow-[0_10px_28px_rgba(92,64,16,0.045)]">
          <div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
            Collected
          </div>
          <div className="mt-3 truncate text-2xl font-black text-green-700">
            {fmtMoney(kpis.total)}
          </div>
        </div>
        <div className="rounded-[24px] border border-[#EADFC2] bg-white px-6 py-5 shadow-[0_10px_28px_rgba(92,64,16,0.045)]">
          <div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
            Outstanding
          </div>
          <div className="mt-3 truncate text-2xl font-black text-amber-800">
            {fmtMoney(kpis.outstanding)}
          </div>
        </div>
        <div className="rounded-[24px] border border-[#EADFC2] bg-white px-6 py-5 shadow-[0_10px_28px_rgba(92,64,16,0.045)]">
          <div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
            Scheduled
          </div>
          <div className="mt-3 truncate text-2xl font-black text-slate-900">
            {kpis.scheduledCount}
          </div>
        </div>
      </div>

      {/* Form */}
      {formMode !== "none" && (
        <div className={`${S.card} p-5 sm:p-6`}>
          <div className="mb-5">
            <div className="text-base font-black text-slate-900">
              {formMode === "schedule" ? "Schedule a service" : "Record income"}
            </div>
            <div className="mt-0.5 text-sm text-slate-500">
              {formMode === "schedule"
                ? "Book a future job"
                : "Log a completed paid service"}
            </div>
          </div>

          <form
            onSubmit={onSubmitForm}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          >
            <div>
              <label className={S.label}>Service type *</label>
              <select
                className={S.input}
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                required
              >
                <option value="">— Select —</option>
                {PRESET_SERVICE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
                <option value="__custom__">+ Custom…</option>
              </select>
            </div>
            {serviceType === "__custom__" && (
              <div>
                <label className={S.label}>Custom type *</label>
                <input
                  className={S.input}
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value)}
                  required
                />
              </div>
            )}
            <div>
              <label className={S.label}>Customer</label>
              <input
                className={S.input}
                placeholder="Client or farm name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>

            {formMode === "record" ? (
              <>
                <div>
                  <label className={S.label}>Date *</label>
                  <input
                    className={S.input}
                    type="date"
                    value={serviceDate}
                    onChange={(e) => setServiceDate(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className={S.label}>Amount (Ksh) *</label>
                  <input
                    className={S.input}
                    type="number"
                    min={0}
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className={S.label}>Payment method</label>
                  <select
                    className={S.input}
                    value={paymentMethod}
                    onChange={(e) =>
                      setPaymentMethod(e.target.value as PaymentMethod)
                    }
                  >
                    {PAYMENT_METHODS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className={S.label}>Date *</label>
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
                  <label className={S.label}>Contract total (Ksh) *</label>
                  <input
                    className={S.input}
                    type="number"
                    min={0}
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className={S.label}>Deposit (optional)</label>
                  <input
                    className={S.input}
                    type="number"
                    min={0}
                    value={initialPayment}
                    onChange={(e) => setInitialPayment(e.target.value)}
                    placeholder="0"
                  />
                </div>

                <div className="sm:col-span-2">
                  <button
                    type="button"
                    onClick={() => setShowMoreOptions((v) => !v)}
                    className="text-sm font-semibold text-slate-600 underline-offset-2 hover:underline"
                  >
                    {showMoreOptions
                      ? "Hide payment & reminder options"
                      : "Payment plan & reminder"}
                  </button>
                </div>

                {showMoreOptions && (
                  <>
                    <div>
                      <label className={S.label}>Payment plan</label>
                      <select
                        className={S.input}
                        value={paymentPlan}
                        onChange={(e) =>
                          setPaymentPlan(e.target.value as PaymentPlan)
                        }
                      >
                        {PAYMENT_PLANS.map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    {paymentPlan === "periodic" && (
                      <div>
                        <label className={S.label}>Billing interval</label>
                        <select
                          className={S.input}
                          value={periodicInterval}
                          onChange={(e) =>
                            setPeriodicInterval(
                              e.target.value as PeriodicInterval,
                            )
                          }
                        >
                          {PERIODIC_INTERVALS.map((p) => (
                            <option key={p.value} value={p.value}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div>
                      <label className={S.label}>Reminder date</label>
                      <input
                        className={S.input}
                        type="date"
                        value={reminderDate}
                        onChange={(e) => setReminderDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className={S.label}>Reminder time</label>
                      <input
                        className={S.input}
                        type="time"
                        value={reminderTime}
                        onChange={(e) => setReminderTime(e.target.value)}
                      />
                    </div>
                  </>
                )}
              </>
            )}

            <div className="sm:col-span-2">
              <label className={S.label}>Note</label>
              <input
                className={S.input}
                placeholder="Optional"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-3 sm:col-span-2">
              <button type="button" onClick={resetForm} className={S.btnGhost}>
                Cancel
              </button>
              <button type="submit" disabled={saving} className={S.btnPrimary}>
                {saving
                  ? "Saving…"
                  : formMode === "schedule"
                    ? "Schedule"
                    : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabs + search */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-2 overflow-x-auto rounded-[22px] border border-[#EADFC2] bg-white p-1.5 shadow-[0_6px_18px_rgba(92,64,16,0.035)]">
          {(
            [
              ["all", "All"],
              ["scheduled", "Scheduled"],
              ["pending", "Pending"],
              ["income", "Income"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`shrink-0 rounded-2xl px-6 py-3 text-base font-bold transition-all ${
                tab === id
                  ? "bg-[#2F2718] text-white shadow-sm"
                  : "text-slate-600 hover:bg-[#FFF8E6] hover:text-slate-900"
              }`}
            >
              {label}
              {id === "scheduled" && kpis.scheduledCount > 0
                ? ` (${kpis.scheduledCount})`
                : ""}
              {id === "pending" && kpis.pendingCount > 0
                ? ` (${kpis.pendingCount})`
                : ""}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`flex min-w-[200px] flex-1 items-center gap-2 ${S.filterInput}`}
          >
            <IconSearch />
            <input
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400"
              placeholder="Search…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                className="text-slate-400 hover:text-slate-600"
              >
                <IconX />
              </button>
            )}
          </span>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={S.btnGhost + " h-[48px] px-5"}
          >
            {showFilters || range.from || range.to || filterType
              ? "Hide filters"
              : "Filters"}
          </button>
          <span className="text-xs text-slate-400">
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {(showFilters || range.from || range.to || filterType) && (
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid gap-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                From
              </span>
              <input
                className={S.filterInput + " w-auto"}
                type="date"
                value={range.from}
                onChange={(e) =>
                  setRange((r) => ({ ...r, from: e.target.value }))
                }
              />
            </label>
            <label className="grid gap-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                To
              </span>
              <input
                className={S.filterInput + " w-auto"}
                type="date"
                value={range.to}
                onChange={(e) =>
                  setRange((r) => ({ ...r, to: e.target.value }))
                }
              />
            </label>
            <label className="grid gap-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Type
              </span>
              <select
                className={S.filterInput + " w-auto"}
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="">All types</option>
                {allTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            {(range.from || range.to || filterType) && (
              <button
                type="button"
                onClick={() => {
                  setRange(defaultRange());
                  setFilterType("");
                }}
                className={
                  S.btnSm +
                  " h-[41px] border-[#EADFC2] bg-white text-slate-600 hover:bg-[#FFF8E6]"
                }
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* List */}
      <div className="space-y-4">
        {loading ? (
          <div
            className={`${S.card} flex items-center justify-center gap-3 py-20 text-slate-400`}
          >
            <svg
              className="h-4 w-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" strokeOpacity="0.2" />
              <path d="M12 2a10 10 0 0110 10" />
            </svg>
            <span className="text-sm font-medium">Loading…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className={`${S.card} py-20 text-center`}>
            <p className="text-sm font-bold text-slate-700">
              {rows.length === 0 ? "No services yet" : "Nothing here"}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {rows.length === 0
                ? "Schedule a job or record income to get started"
                : "Try another tab or clear filters"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {paginatedRows.map((r) => {
              const prog = paymentProgress(r);
              const isExpanded = expandedId === r.id;
              const payments = r.service_payments ?? [];
              const dateLabel = r.scheduled_date ?? r.service_date ?? "—";

              return (
                <article
                  key={r.id}
                  className={`${S.card} px-6 py-6 sm:px-7 sm:py-7`}
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-lg font-black text-slate-900">
                          {r.service_type}
                        </h3>
                        <span
                          className={
                            S.badge + " " + statusBadge(String(r.status))
                          }
                        >
                          {String(r.status).replace("_", " ")}
                        </span>
                      </div>
                      <p className="mt-2 text-base text-slate-500">
                        {dateLabel}
                        {r.customer_name ? ` · ${r.customer_name}` : ""}
                        {prog.remaining > 0
                          ? ` · ${fmtMoney(prog.remaining)} due`
                          : prog.collected > 0
                            ? " · Paid"
                            : ""}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-3">
                      <div className="min-w-[150px] text-left lg:mr-2 lg:text-right">
                        <div className="text-xl font-black text-slate-900">
                          {fmtMoney(prog.collected)}
                        </div>
                        {prog.total > prog.collected && (
                          <div className="mt-1 text-sm text-slate-400">
                            of {fmtMoney(prog.total)}
                          </div>
                        )}
                      </div>

                      {isScheduledJob(r) && (
                        <button
                          onClick={() => handleComplete(r)}
                          className={S.btnPrimary + " min-h-12 px-6"}
                        >
                          Complete
                        </button>
                      )}
                      {!["cancelled", "voided"].includes(String(r.status)) &&
                        prog.remaining > 0 && (
                          <button
                            onClick={() => setPayModalService(r)}
                            className={S.btnGhost + " min-h-12 px-6"}
                          >
                            Pay
                          </button>
                        )}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : r.id)}
                        className={S.btnGhost + " min-h-12 px-6"}
                      >
                        {isExpanded ? "Less" : "Details"}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-6 space-y-5 border-t border-[#F1E6C9] pt-5">
                      <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-3">
                        <span>
                          Plan: {planLabel(String(r.payment_plan))}
                          {r.periodic_interval
                            ? ` · ${r.periodic_interval}`
                            : ""}
                        </span>
                        {r.reminder_at && !r.reminder_dismissed && (
                          <span>Reminder: {fmtDateTime(r.reminder_at)}</span>
                        )}
                        {r.note && <span>Note: {r.note}</span>}
                      </div>

                      {prog.total > 0 && prog.remaining > 0 && (
                        <div>
                          <div className="mb-1.5 flex justify-between text-xs font-semibold text-slate-500">
                            <span>{fmtMoney(prog.collected)} collected</span>
                            <span>{fmtMoney(prog.remaining)} left</span>
                          </div>
                          <div className={S.progressTrack}>
                            <div
                              className={S.progressFill}
                              style={{ width: `${prog.pct}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {payments.length > 0 && (
                        <div className="rounded-xl border border-[#EADFC2] bg-[#FFFDF8]">
                          {payments.map((p, index) => (
                            <div
                              key={p.id}
                              className={`flex justify-between gap-3 px-3 py-2 text-sm ${index > 0 ? "border-t border-[#F1E6C9]" : ""}`}
                            >
                              <span className="text-slate-600">
                                {p.payment_date}
                                <span className="ml-2 text-xs uppercase text-slate-400">
                                  {p.payment_method}
                                </span>
                              </span>
                              <span className="font-bold text-slate-900">
                                {fmtMoney(Number(p.amount))}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-3">
                        {isScheduledJob(r) && (
                          <button
                            onClick={() => handleCancel(r.id)}
                            className={S.btnGhost}
                          >
                            Cancel job
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="inline-flex items-center rounded-2xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}

        {filtered.length > 0 && totalPages > 1 && (
          <div
            className={`${S.card} flex items-center justify-between px-5 py-4 sm:px-6`}
          >
            <span className="text-xs text-slate-400">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                className={
                  S.btnSm +
                  " border-[#EADFC2] bg-white text-slate-600 disabled:opacity-40"
                }
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() =>
                  setCurrentPage((page) => Math.min(totalPages, page + 1))
                }
                disabled={currentPage === totalPages}
                className={
                  S.btnSm +
                  " border-[#EADFC2] bg-white text-slate-600 disabled:opacity-40"
                }
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {completeModalService && orgId && (
        <CompleteServiceModal
          service={completeModalService}
          orgId={orgId}
          onClose={() => setCompleteModalService(null)}
          onSaved={async (message) => {
            await refresh(orgId);
            showToast(message);
          }}
        />
      )}

      {payModalService && orgId && (
        <PaymentModal
          service={payModalService}
          orgId={orgId}
          onClose={() => setPayModalService(null)}
          onSaved={async (message) => {
            await refresh(orgId);
            showToast(message);
          }}
        />
      )}
    </div>
  );
}