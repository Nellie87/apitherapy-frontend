"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/dist/style.css";

import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import { createClient } from "@/lib/supabase/client";
import {
  getInventoryValuation,
  reportPnL,
  reportExpenses,
  type InventoryValuationRow,
} from "@/lib/api/reports";
import {
  isScheduledJob,
  listDueReminders,
  listServices,
  paymentProgress,
  type ServiceRow,
} from "@/lib/api/services";

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */
type RangePreset =
  | "all"
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "month"
  | "lastMonth"
  | "custom";

type RecentSale = {
  id: string;
  sale_no: string;
  customer_name: string | null;
  total: number;
  discount_total: number;
  status: string;
  edit_count: number;
  cancelled_at: string | null;
  created_at: string;
  sold_at: string | null;
};

type RecentExpense = {
  id: string;
  category: string;
  amount: number;
  expense_date: string;
  created_at: string;
};

type RecentServicePayment = {
  id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  created_at: string;
  service_type: string;
  customer_name: string | null;
};

type ActivityItem = {
  id: string;
  type: "sale" | "expense" | "service";
  title: string;
  sub: string;
  amount: number;
  at: string;
  href: string;
  status?: string;
  edit_count?: number;
  discount_total?: number;
};

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */
const iso = (d: Date) => d.toISOString().slice(0, 10);

const dateToLocalIso = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const localIsoToDate = (value?: string) => {
  if (!value) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const startOfMonth = (d = new Date()) =>
  new Date(d.getFullYear(), d.getMonth(), 1);

const endOfMonth = (d = new Date()) =>
  new Date(d.getFullYear(), d.getMonth() + 1, 0);

const startOfLastMonth = (d = new Date()) =>
  new Date(d.getFullYear(), d.getMonth() - 1, 1);

const endOfLastMonth = (d = new Date()) =>
  new Date(d.getFullYear(), d.getMonth(), 0);

const getPresetRange = (preset: Exclude<RangePreset, "custom">) => {
  const today = new Date();
  const from = new Date(today);
  const to = new Date(today);

  if (preset === "all") {
    return {
      from: "1970-01-01",
      to: dateToLocalIso(today),
      label: "All time",
    };
  }

  if (preset === "today") {
    return {
      from: dateToLocalIso(today),
      to: dateToLocalIso(today),
      label: "Today",
    };
  }

  if (preset === "yesterday") {
    from.setDate(today.getDate() - 1);
    to.setDate(today.getDate() - 1);
    return {
      from: dateToLocalIso(from),
      to: dateToLocalIso(to),
      label: "Yesterday",
    };
  }

  if (preset === "7d") {
    from.setDate(today.getDate() - 6);
    return {
      from: dateToLocalIso(from),
      to: dateToLocalIso(today),
      label: "Last 7 Days",
    };
  }

  if (preset === "30d") {
    from.setDate(today.getDate() - 29);
    return {
      from: dateToLocalIso(from),
      to: dateToLocalIso(today),
      label: "Last 30 Days",
    };
  }

  if (preset === "month") {
    return {
      from: dateToLocalIso(startOfMonth(today)),
      to: dateToLocalIso(today),
      label: "This Month",
    };
  }

  return {
    from: dateToLocalIso(startOfLastMonth(today)),
    to: dateToLocalIso(endOfLastMonth(today)),
    label: "Last Month",
  };
};

const fmtMoney = (v: number) =>
  `Ksh ${Number(v || 0).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;

const fmtPercent = (v: number) =>
  `${Number(v || 0).toLocaleString("en-KE", {
    maximumFractionDigits: 1,
  })}%`;

const num = (value: unknown) => Number(value ?? 0) || 0;

const isCancelledSale = (status?: string | null) =>
  ["cancelled", "voided", "void", "refunded"].includes(
    String(status ?? "").toLowerCase(),
  );

const fmtK = (v: number) => {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return String(Math.round(v));
};

const fmtDateTime = (v: string) => {
  try {
    return new Date(v).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return v;
  }
};

const fmtDateOnly = (v: string) => {
  try {
    return new Date(v).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return v;
  }
};

const fmtRangeLabel = (from: string, to: string, label?: string) => {
  if (label === "All time") return "All time";

  try {
    const f = new Date(`${from}T00:00:00`);
    const t = new Date(`${to}T00:00:00`);

    const sameYear = f.getFullYear() === t.getFullYear();
    const sameMonth = sameYear && f.getMonth() === t.getMonth();
    const sameDay = sameMonth && f.getDate() === t.getDate();

    if (sameDay) {
      return f.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    }

    if (sameYear) {
      if (sameMonth) {
        return `${f.getDate()}-${t.getDate()} ${t.toLocaleDateString("en-GB", {
          month: "short",
          year: "numeric",
        })}`;
      }

      return `${f.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      })} - ${t.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })}`;
    }

    return `${f.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })} - ${t.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })}`;
  } catch {
    return `${from} - ${to}`;
  }
};

/* ─────────────────────────────────────────────
   Animated counter
───────────────────────────────────────────── */
function Counter({ to, duration = 600 }: { to: number; duration?: number }) {
  const [v, setV] = useState(0);
  const raf = useRef<number>(0);
  const prevTo = useRef(0);

  useEffect(() => {
    const t0 = performance.now();
    const from = prevTo.current;
    prevTo.current = to;

    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setV(Math.round(from + (to - from) * ease));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };

    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [to, duration]);

  return <>{v.toLocaleString("en-KE")}</>;
}

/* ─────────────────────────────────────────────
   Sparkline
───────────────────────────────────────────── */
function Sparkline({
  data,
  color = "#f59e0b",
  w = 72,
  h = 32,
}: {
  data: number[];
  color?: string;
  w?: number;
  h?: number;
}) {
  if (data.length < 2) return null;

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;

  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const lastPt = pts.split(" ").pop()!.split(",").map(Number);

  return (
    <svg width={w} height={h} style={{ overflow: "visible", flexShrink: 0 }}>
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.75"
      />
      <circle cx={lastPt[0]} cy={lastPt[1]} r="3" fill={color} />
    </svg>
  );
}

/* ─────────────────────────────────────────────
   Skeleton
───────────────────────────────────────────── */
function Skeleton({
  w = "100%",
  h = 20,
  radius = 8,
}: {
  w?: string | number;
  h?: number;
  radius?: number;
}) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: radius,
        background:
          "linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.4s infinite",
      }}
    />
  );
}

/* ─────────────────────────────────────────────
   Quick actions
───────────────────────────────────────────── */
function QuickActions() {
  const actions = [
    { href: "/dashboard/sales/new", label: "New Sale", primary: true },
  
  ];

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap">
      {actions.map((a) => (
        <Link
          key={a.label}
          href={a.href}
          className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-150 hover:-translate-y-0.5 hover:shadow-sm ${
            a.primary
              ? "bg-slate-950 text-white hover:bg-slate-800"
              : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
          }`}
        >
          {a.label}
        </Link>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────
   KPI Card
───────────────────────────────────────────── */
function KpiCard({
  label,
  rawValue,
  sub,
  variant = "neutral",
  loading,
  spark,
  sparkColor,
  isCurrency = true,
  displayValue,
}: {
  label: string;
  rawValue: number;
  sub?: string;
  variant?: "neutral" | "success" | "warning" | "danger";
  loading?: boolean;
  spark?: number[];
  sparkColor?: string;
  isCurrency?: boolean;
  displayValue?: string;
}) {
  const cfg = {
    neutral: {
      border: "#e5e7eb",
      bg: "#ffffff",
      val: "#0f172a",
      sub: "#64748b",
      accent: "#94a3b8",
    },
    success: {
      border: "#bbf7d0",
      bg: "#f7fef9",
      val: "#166534",
      sub: "#16a34a",
      accent: "#22c55e",
    },
    warning: {
      border: "#fde68a",
      bg: "#fffdf4",
      val: "#92400e",
      sub: "#d97706",
      accent: "#f59e0b",
    },
    danger: {
      border: "#fecaca",
      bg: "#fffafa",
      val: "#991b1b",
      sub: "#ef4444",
      accent: "#ef4444",
    },
  }[variant];

  return (
    <div
      className="rounded-2xl p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div
            className="text-xs font-semibold uppercase tracking-wide opacity-80"
            style={{ color: cfg.sub }}
          >
            {label}
          </div>

          <div
            className="mt-2 text-2xl font-bold leading-tight tracking-tight"
            style={{ color: cfg.val }}
          >
            {loading ? (
              <Skeleton w="80%" h={26} />
            ) : displayValue ? (
              displayValue
            ) : isCurrency ? (
              <span>
                Ksh <Counter to={rawValue} />
              </span>
            ) : (
              <Counter to={rawValue} />
            )}
          </div>
        </div>

        {spark && spark.length > 1 && !loading && (
          <div className="hidden shrink-0 pt-1 sm:block">
            <Sparkline data={spark} color={sparkColor ?? cfg.accent} w={56} h={28} />
          </div>
        )}
      </div>

      {sub && (
        <div className="mt-1 text-xs font-medium leading-relaxed opacity-80" style={{ color: cfg.sub }}>
          {loading ? <Skeleton w="60%" h={14} /> : sub}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Card shell
───────────────────────────────────────────── */
function Card({
  title,
  sub,
  action,
  children,
  className = "",
}: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md ${className}`}
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <div>
          <div className="text-base font-bold text-slate-900">{title}</div>
          {sub && (
            <div className="mt-0.5 text-xs font-medium text-slate-400">
              {sub}
            </div>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Clean date range picker
───────────────────────────────────────────── */
function SummaryDateRangePicker({
  valuePreset,
  valueFrom,
  valueTo,
  onApply,
  onClose,
}: {
  valuePreset: RangePreset;
  valueFrom: string;
  valueTo: string;
  onApply: (preset: RangePreset, from: string, to: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const [tempPreset, setTempPreset] = useState<RangePreset>(valuePreset);
  const [tempRange, setTempRange] = useState<DateRange | undefined>({
    from: localIsoToDate(valueFrom),
    to: localIsoToDate(valueTo),
  });

  const presetItems: { id: RangePreset; label: string }[] = [
    { id: "all", label: "All time" },
    { id: "today", label: "Today" },
    { id: "yesterday", label: "Yesterday" },
    { id: "7d", label: "Last 7 days" },
    { id: "30d", label: "Last 30 days" },
    { id: "month", label: "This month" },
    { id: "lastMonth", label: "Last month" },
    { id: "custom", label: "Custom" },
  ];

  useEffect(() => {
    setTempPreset(valuePreset);
    setTempRange(
      valuePreset === "all"
        ? undefined
        : {
            from: localIsoToDate(valueFrom),
            to: localIsoToDate(valueTo),
          },
    );
  }, [valuePreset, valueFrom, valueTo]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const handlePresetClick = (preset: RangePreset) => {
    setTempPreset(preset);

    if (preset === "all") {
      setTempRange(undefined);
      return;
    }

    if (preset !== "custom") {
      const next = getPresetRange(preset);
      setTempRange({
        from: localIsoToDate(next.from),
        to: localIsoToDate(next.to),
      });
    }
  };

  const handleApply = () => {
    if (tempPreset === "all") {
      const next = getPresetRange("all");
      onApply("all", next.from, next.to);
      onClose();
      return;
    }

    if (!tempRange?.from) return;

    const nextFrom = dateToLocalIso(tempRange.from);
    const nextTo = dateToLocalIso(tempRange.to ?? tempRange.from);

    onApply(tempPreset, nextFrom, nextTo);
    onClose();
  };

  const handleCancel = () => {
    setTempPreset(valuePreset);
    setTempRange(
      valuePreset === "all"
        ? undefined
        : {
            from: localIsoToDate(valueFrom),
            to: localIsoToDate(valueTo),
          },
    );
    onClose();
  };

  const footerLabel =
    tempPreset === "all"
      ? "All available records"
      : tempRange?.from
      ? `${dateToLocalIso(tempRange.from)} → ${dateToLocalIso(tempRange.to ?? tempRange.from)}`
      : "Select a date range";

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full z-50 mt-3 overflow-hidden rounded-3xl border border-amber-100 bg-white shadow-2xl"
      style={{
        width: 700,
        maxWidth: "calc(100vw - 32px)",
        boxShadow: "0 24px 70px rgba(15, 23, 42, 0.14)",
      }}
    >
      <div className="grid grid-cols-1 md:grid-cols-[170px_1fr]">
        <div className="border-b border-slate-100 bg-amber-50/40 p-2 md:border-b-0 md:border-r">
          {presetItems.map((item) => {
            const active = tempPreset === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handlePresetClick(item.id)}
                className={`mb-1 flex w-full rounded-xl px-3 py-2.5 text-left text-sm font-bold transition ${
                  active
                    ? "bg-slate-950 text-white shadow-sm"
                    : "text-slate-600 hover:bg-white hover:text-slate-950"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="bg-white p-5">
          <DayPicker
            mode="range"
            selected={tempRange}
            onSelect={(nextRange) => {
              setTempPreset("custom");
              setTempRange(nextRange);
            }}
            numberOfMonths={2}
            defaultMonth={tempPreset === "all" ? new Date() : tempRange?.from ?? new Date()}
            showOutsideDays
            disabled={{ after: new Date() }}
            className="rdp-summary"
            classNames={{
              months: "flex flex-col gap-8 sm:flex-row",
              month: "space-y-4",
              caption: "relative flex items-center justify-center",
              caption_label: "text-sm font-black text-slate-900",
              nav: "flex items-center gap-2",
              nav_button:
                "h-8 w-8 rounded-full text-slate-500 transition hover:bg-amber-50 hover:text-slate-900",
              table: "w-full border-collapse",
              head_row: "flex",
              head_cell:
                "w-10 text-center text-[11px] font-black uppercase text-slate-400",
              row: "mt-1 flex w-full",
              cell: "relative h-10 w-10 p-0 text-center text-sm",
              day: "h-10 w-10 rounded-xl text-sm font-bold text-slate-700 transition hover:bg-amber-50 hover:text-slate-950",
              day_selected:
                "bg-slate-950 text-white hover:bg-slate-950 hover:text-white",
              day_today: "border border-amber-300 bg-amber-50 text-amber-800",
              day_outside: "text-slate-300",
              day_disabled: "text-slate-300 opacity-40",
              day_range_middle:
                "rounded-none bg-amber-100 text-slate-900 hover:bg-amber-100",
              day_range_start:
                "rounded-l-xl rounded-r-none bg-slate-950 text-white hover:bg-slate-950",
              day_range_end:
                "rounded-l-none rounded-r-xl bg-slate-950 text-white hover:bg-slate-950",
            }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/80 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm font-bold text-slate-600">{footerLabel}</div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCancel}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
          >
            Cancel
          </button>

          <button
            onClick={handleApply}
            disabled={tempPreset !== "all" && !tempRange?.from}
            className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Area chart
───────────────────────────────────────────── */
function AreaChart({
  points,
  height = 220,
  loading,
}: {
  points: { period: string; revenue: number; expenses: number }[];
  height?: number;
  loading?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const W = 600;
  const H = height;
  const P = { t: 16, r: 16, b: 36, l: 56 };
  const iW = W - P.l - P.r;
  const iH = H - P.t - P.b;

  const maxV = useMemo(
    () => Math.max(...points.map((p) => Math.max(p.revenue, p.expenses)), 1),
    [points],
  );

  const niceMax = useMemo(() => {
    const mag = Math.pow(10, Math.floor(Math.log10(maxV)));
    return Math.ceil(maxV / mag) * mag;
  }, [maxV]);

  const xs = useCallback(
    (i: number) =>
      P.l + (points.length < 2 ? iW / 2 : (i / (points.length - 1)) * iW),
    [points.length, iW],
  );

  const ys = useCallback(
    (v: number) => P.t + iH - (v / niceMax) * iH,
    [niceMax, iH],
  );

  const linePath = (key: "revenue" | "expenses") =>
    points
      .map(
        (p, i) =>
          `${i === 0 ? "M" : "L"}${xs(i).toFixed(1)},${ys(p[key]).toFixed(1)}`,
      )
      .join(" ");

  const areaPath = (key: "revenue" | "expenses") =>
    points.length === 0
      ? ""
      : `${linePath(key)} L${xs(points.length - 1).toFixed(1)},${(
          P.t + iH
        ).toFixed(1)} L${xs(0).toFixed(1)},${(P.t + iH).toFixed(1)} Z`;

  const onMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current || points.length < 2) return;
      const rect = svgRef.current.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width) * W;

      let best = 0;
      let bd = Infinity;

      points.forEach((_, i) => {
        const d = Math.abs(xs(i) - mx);
        if (d < bd) {
          bd = d;
          best = i;
        }
      });

      setHover(best);
    },
    [points, xs],
  );

  const gridCount = 5;
  const gridVals = Array.from(
    { length: gridCount + 1 },
    (_, i) => (niceMax / gridCount) * i,
  );

  const xLabels = useMemo(() => {
    if (!points.length) return [];
    const step = Math.max(1, Math.floor(points.length / 6));
    return points
      .map((p, i) => ({ p, i }))
      .filter(({ i }) => i % step === 0 || i === points.length - 1);
  }, [points]);

  if (loading) {
    return (
      <div className="flex flex-col gap-3 px-6 py-4">
        {[100, 70, 85, 55, 90].map((w, i) => (
          <Skeleton key={i} w={`${w}%`} h={16} />
        ))}
      </div>
    );
  }

  if (!points.length) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 text-slate-400"
        style={{ height }}
      >
        <span className="text-3xl">📭</span>
        <span className="text-sm font-semibold">No data for this period</span>
      </div>
    );
  }

  const hp = hover !== null ? points[hover] : null;
  const net = hp ? hp.revenue - hp.expenses : 0;

  return (
    <div className="relative select-none">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full cursor-crosshair"
        style={{ height }}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="gr-rev-summary" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="gr-exp-summary" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.02" />
          </linearGradient>
          <filter id="shadow-dot-summary">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.3" />
          </filter>
        </defs>

        {gridVals.map((v, i) => (
          <g key={i}>
            <line
              x1={P.l}
              y1={ys(v)}
              x2={W - P.r}
              y2={ys(v)}
              stroke={i === 0 ? "#e2e8f0" : "#f1f5f9"}
              strokeWidth={i === 0 ? "1.5" : "1"}
            />
            <text
              x={P.l - 8}
              y={ys(v) + 4}
              textAnchor="end"
              fontSize="10"
              fill="#94a3b8"
              fontWeight="600"
            >
              {fmtK(v)}
            </text>
          </g>
        ))}

        {hover !== null && (
          <line
            x1={xs(hover)}
            y1={P.t - 4}
            x2={xs(hover)}
            y2={P.t + iH}
            stroke="#cbd5e1"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
        )}

        <path d={areaPath("expenses")} fill="url(#gr-exp-summary)" />
        <path d={areaPath("revenue")} fill="url(#gr-rev-summary)" />

        <path
          d={linePath("expenses")}
          fill="none"
          stroke="#ef4444"
          strokeWidth="2"
          strokeDasharray="6 3"
          strokeLinejoin="round"
        />
        <path
          d={linePath("revenue")}
          fill="none"
          stroke="#f59e0b"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {points.map((p, i) =>
          hover === i ? (
            <circle
              key={i}
              cx={xs(i)}
              cy={ys(p.revenue)}
              r="6"
              fill="#fff"
              stroke="#f59e0b"
              strokeWidth="2.5"
              filter="url(#shadow-dot-summary)"
            />
          ) : null,
        )}

        {hover !== null && hp && (
          <circle
            cx={xs(hover)}
            cy={ys(hp.expenses)}
            r="5"
            fill="#fff"
            stroke="#ef4444"
            strokeWidth="2.5"
            filter="url(#shadow-dot-summary)"
          />
        )}

        {xLabels.map(({ p, i }) => (
          <text
            key={i}
            x={xs(i)}
            y={H - 8}
            textAnchor="middle"
            fontSize="10"
            fill={hover === i ? "#475569" : "#94a3b8"}
            fontWeight={hover === i ? "700" : "500"}
          >
            {p.period.length > 5 ? p.period.slice(5) : p.period}
          </text>
        ))}

        <line
          x1={P.l}
          y1={P.t + iH}
          x2={W - P.r}
          y2={P.t + iH}
          stroke="#e2e8f0"
          strokeWidth="1.5"
        />
      </svg>

      {hover !== null && hp && (
        <div
          className="pointer-events-none absolute left-14 top-3 z-10 rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-2xl"
          style={{ width: 176, boxShadow: "0 12px 40px -8px rgba(0,0,0,0.18)" }}
        >
          <div className="mb-3 border-b border-slate-100 pb-2 text-xs font-bold uppercase tracking-wider text-slate-700">
            {hp.period}
          </div>

          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              Revenue
            </span>
            <span className="text-sm font-bold text-slate-900">
              {fmtMoney(hp.revenue)}
            </span>
          </div>

          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <span className="h-2 w-2 rounded-full bg-red-400" />
              Expenses
            </span>
            <span className="text-sm font-bold text-slate-900">
              {fmtMoney(hp.expenses)}
            </span>
          </div>

          <div
            className={`flex items-center justify-between border-t border-slate-100 pt-2.5 font-extrabold ${
              net >= 0 ? "text-emerald-600" : "text-red-500"
            }`}
          >
            <span className="text-xs uppercase tracking-wider">Net</span>
            <span className="text-sm">{fmtMoney(net)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Stock badge
───────────────────────────────────────────── */
function StockBadge({ status }: { status: InventoryValuationRow["status"] }) {
  if (status === "out") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
        Out of stock
      </span>
    );
  }

  if (status === "critical") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-bold text-orange-700">
        <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
        Critical
      </span>
    );
  }

  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      Low stock
    </span>
  );
}

/* ─────────────────────────────────────────────
   Income breakdown
───────────────────────────────────────────── */
function IncomeBreakdown({
  loading,
  revenue,
  productRevenue,
  serviceIncome,
  expenses,
  net,
}: {
  loading?: boolean;
  revenue: number;
  productRevenue: number;
  serviceIncome: number;
  expenses: number;
  net: number;
}) {
  const salesPct = revenue > 0 ? (productRevenue / revenue) * 100 : 0;
  const svcPct = revenue > 0 ? (serviceIncome / revenue) * 100 : 0;
  const expRatio = revenue > 0 ? (expenses / revenue) * 100 : 0;

  return (
    <Card
      title="Income Breakdown"
      sub="Sales, services, expenses & profit"
      className="h-fit"
      action={
        <Link
          href="/dashboard/reports/revenue-health"
          className="text-xs font-bold text-amber-500 transition-colors hover:text-amber-600"
        >
          Details →
        </Link>
      }
    >
      {loading ? (
        <div className="flex flex-col gap-3 p-5">
          <Skeleton w="100%" h={12} />
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} w="100%" h={48} />
            ))}
          </div>
        </div>
      ) : revenue <= 0 && expenses <= 0 ? (
        <div className="py-10 text-center text-sm font-semibold text-slate-400">
          No financial activity in this period
        </div>
      ) : (
        <>
          {revenue > 0 && (
            <div className="border-b border-slate-100 px-5 py-4">
              <div className="mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <span>Revenue mix</span>
                <span>{fmtMoney(revenue)} total</span>
              </div>
              <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100">
                {salesPct > 0 && (
                  <div className="h-full bg-amber-400" style={{ width: `${salesPct}%` }} />
                )}
                {svcPct > 0 && (
                  <div className="h-full bg-green-500" style={{ width: `${svcPct}%` }} />
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  Sales {fmtMoney(productRevenue)} ({salesPct.toFixed(0)}%)
                </span>
                {serviceIncome > 0 && (
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                    Services {fmtMoney(serviceIncome)} ({svcPct.toFixed(0)}%)
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 sm:grid-cols-4 sm:divide-y-0">
            {[
              { label: "Product Sales", value: fmtMoney(productRevenue), color: "#92400e" },
              { label: "Service Income", value: fmtMoney(serviceIncome), color: "#166534" },
              {
                label: "Expenses",
                value: fmtMoney(expenses),
                color: "#0f172a",
                sub: expRatio > 0 ? `${expRatio.toFixed(0)}% of revenue` : undefined,
              },
              {
                label: "Net Profit",
                value: fmtMoney(net),
                color: net >= 0 ? "#059669" : "#dc2626",
                sub: net >= 0 ? "After all costs" : "Loss this period",
              },
            ].map(({ label, value, color, sub }) => (
              <div key={label} className="px-4 py-4 sm:px-5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {label}
                </div>
                <div className="mt-1 text-base font-extrabold" style={{ color }}>
                  {value}
                </div>
                {sub && (
                  <div className="mt-0.5 text-[11px] font-medium text-slate-400">{sub}</div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

/* ─────────────────────────────────────────────
   Main Page
───────────────────────────────────────────── */
export default function DashboardPage() {
  const initialToday = getPresetRange("today");

  const [orgId, setOrgId] = useState<string | null>(null);
  const [preset, setPreset] = useState<RangePreset>("today");
  const [customFrom, setCustomFrom] = useState(initialToday.from);
  const [customTo, setCustomTo] = useState(initialToday.to);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState("");
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const [pnl, setPnl] = useState<Awaited<ReturnType<typeof reportPnL>> | null>(
    null,
  );
  const [expData, setExpData] = useState<Awaited<
    ReturnType<typeof reportExpenses>
  > | null>(null);
  const [inventory, setInventory] = useState<Awaited<
    ReturnType<typeof getInventoryValuation>
  > | null>(null);
  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<RecentExpense[]>([]);
  const [recentServicePayments, setRecentServicePayments] = useState<RecentServicePayment[]>([]);
  const [upcomingServices, setUpcomingServices] = useState<ServiceRow[]>([]);
  const [dueReminders, setDueReminders] = useState<ServiceRow[]>([]);
  const [serviceOutstanding, setServiceOutstanding] = useState(0);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [outstandingJobCount, setOutstandingJobCount] = useState(0);

  const range = useMemo(() => {
    if (preset === "custom") {
      return {
        from: customFrom,
        to: customTo,
        label: "Custom Range",
      };
    }

    return getPresetRange(preset);
  }, [preset, customFrom, customTo]);

  const chartGranularity = preset === "all" ? "month" : "day";

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

  const loadAll = useCallback(
    async (isRefresh = false) => {
      if (!orgId) return;

      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      setErr("");

      try {
        const [pl, inv, ex] = await Promise.all([
          reportPnL(orgId, {
            from: range.from,
            to: range.to,
            granularity: chartGranularity,
          }),
          getInventoryValuation(orgId),
          reportExpenses(orgId, {
            from: range.from,
            to: range.to,
            granularity: chartGranularity,
          }),
        ]);

        const supabase = createClient();

        const fromStart = `${range.from}T00:00:00`;
        const toEnd = `${range.to}T23:59:59.999`;

        const salesQuery = supabase
          .from("sales")
          .select(
            "id,sale_no,customer_name,total,discount_total,status,edit_count,cancelled_at,sold_at,created_at",
          )
          .eq("org_id", orgId)
          .gte("sold_at", fromStart)
          .lte("sold_at", toEnd)
          .order("sold_at", { ascending: false })
          .limit(6);

        const expensesQuery = supabase
          .from("expenses")
          .select("id,category,amount,expense_date,created_at")
          .eq("org_id", orgId)
          .gte("expense_date", range.from)
          .lte("expense_date", range.to)
          .order("expense_date", { ascending: false })
          .limit(6);

        const servicePaymentsQuery = supabase
          .from("service_payments")
          .select(
            "id,amount,payment_date,payment_method,created_at,services:service_id(service_type,customer_name)",
          )
          .eq("org_id", orgId)
          .gte("payment_date", range.from)
          .lte("payment_date", range.to)
          .order("payment_date", { ascending: false })
          .limit(6);

        const [
          { data: sData, error: sErr },
          { data: eData, error: eErr },
          { data: spData, error: spErr },
          allServices,
          reminders,
        ] = await Promise.all([
          salesQuery,
          expensesQuery,
          servicePaymentsQuery,
          listServices(orgId, { mode: "all" }),
          listDueReminders(orgId),
        ]);

        if (sErr) throw new Error(sErr.message);
        if (eErr) throw new Error(eErr.message);
        if (spErr) throw new Error(spErr.message);

        const mappedPayments: RecentServicePayment[] = (spData ?? []).map((row: any) => {
          const svc = Array.isArray(row.services) ? row.services[0] : row.services;
          return {
            id: String(row.id),
            amount: Number(row.amount ?? 0),
            payment_date: String(row.payment_date),
            payment_method: String(row.payment_method ?? "cash"),
            created_at: String(row.created_at),
            service_type: String(svc?.service_type ?? "Service"),
            customer_name: svc?.customer_name ?? null,
          };
        });

        const outstandingRows = allServices.filter(
          (r) =>
            !["cancelled", "voided"].includes(String(r.status)) &&
            paymentProgress(r).remaining > 0,
        );
        const outstanding = outstandingRows.reduce(
          (sum, r) => sum + paymentProgress(r).remaining,
          0,
        );

        const scheduled = allServices.filter(isScheduledJob);
        const today = new Date().toISOString().slice(0, 10);
        const reminderIds = new Set(reminders.map((r) => r.id));
        const upcomingPreview = [...scheduled]
          .filter((r) => !reminderIds.has(r.id))
          .sort((a, b) => {
            const da = String(a.scheduled_date ?? a.service_date ?? "");
            const db = String(b.scheduled_date ?? b.service_date ?? "");
            // Prefer soonest upcoming dates; undated/past fall later
            const aUpcoming = da >= today ? 0 : 1;
            const bUpcoming = db >= today ? 0 : 1;
            if (aUpcoming !== bUpcoming) return aUpcoming - bUpcoming;
            return da.localeCompare(db);
          });

        setPnl(pl);
        setInventory(inv);
        setExpData(ex);
        setRecentSales((sData ?? []) as any);
        setRecentExpenses((eData ?? []) as any);
        setRecentServicePayments(mappedPayments);
        setUpcomingServices(upcomingPreview);
        setDueReminders(reminders);
        setServiceOutstanding(outstanding);
        setScheduledCount(scheduled.length);
        setOutstandingJobCount(outstandingRows.length);
        setLastRefreshed(new Date());
      } catch (e: any) {
        setErr(e.message ?? String(e));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [orgId, range.from, range.to, chartGranularity],
  );

  useEffect(() => {
    if (orgId) loadAll();
  }, [orgId, range.from, range.to, loadAll]);

  const kpis = useMemo(() => {
    const rows = ((inventory?.rows ?? []) as any[]);
    const totals = (inventory?.totals ?? {}) as any;

    const inventoryCostFromRows = rows.reduce((sum, row) => {
      const product = row.products ?? row.product ?? {};
      const qty = num(
        row.qty_on_hand ??
          row.qty ??
          row.quantity ??
          row.stock_qty ??
          row.current_stock,
      );

      const rowCostValue = num(
        row.cost_value ?? row.total_cost_value ?? row.stock_cost_value,
      );
      if (rowCostValue > 0) return sum + rowCostValue;

      const costPrice = num(
        row.cost_price ??
          row.purchase_price ??
          row.buying_price ??
          product.cost_price ??
          product.purchase_price ??
          product.buying_price,
      );

      return sum + qty * costPrice;
    }, 0);

    const retailValueFromRows = rows.reduce((sum, row) => {
      const product = row.products ?? row.product ?? {};
      const qty = num(
        row.qty_on_hand ??
          row.qty ??
          row.quantity ??
          row.stock_qty ??
          row.current_stock,
      );

      const rowRetailValue = num(
        row.retail_value ?? row.total_retail_value ?? row.stock_retail_value,
      );
      if (rowRetailValue > 0) return sum + rowRetailValue;

      const sellingPrice = num(
        row.unit_price ??
          row.selling_price ??
          row.sale_price ??
          row.retail_price ??
          product.unit_price ??
          product.selling_price ??
          product.sale_price ??
          product.retail_price,
      );

      return sum + qty * sellingPrice;
    }, 0);

    // Important: older getInventoryValuation() versions used total_value as retail value.
    // So the dashboard should prefer explicit cost fields or row calculations for cost,
    // otherwise inventory cost can incorrectly become equal to retail value.
    const inventoryCost =
      num(totals.total_cost_value ?? totals.stock_cost_value ?? totals.cost_value) ||
      inventoryCostFromRows;

    const retailValue =
      num(
        totals.total_retail_value ??
          totals.stock_retail_value ??
          totals.retail_value ??
          totals.potential_sales_value,
      ) || retailValueFromRows;

    const potentialGrossProfit = retailValue - inventoryCost;
    const grossMargin =
      retailValue > 0 ? (potentialGrossProfit / retailValue) * 100 : 0;

    return {
      revenue: num(pnl?.totals?.revenue),
      productRevenue: num((pnl?.totals as any)?.product_revenue),
      serviceIncome: num((pnl?.totals as any)?.service_income),
      expenses: num(pnl?.totals?.expenses),
      net: num(pnl?.totals?.net_profit),
      inventoryCost,
      retailValue,
      potentialGrossProfit,
      grossMargin,
      lowCount: num(totals.low_count),
      outCount: num(totals.out_count),
    };
  }, [pnl, inventory]);

  const areaPoints = useMemo(() => {
    const rM = new Map(
      (pnl?.points ?? []).map((p: any) => [p.period, Number(p.revenue ?? 0)]),
    );
    const eM = new Map(
      (expData?.trend ?? []).map((t: any) => [t.period, Number(t.total ?? 0)]),
    );
    return Array.from(new Set([...rM.keys(), ...eM.keys()]))
      .sort()
      .map((period) => ({
        period,
        revenue: rM.get(period) ?? 0,
        expenses: eM.get(period) ?? 0,
      }));
  }, [pnl, expData]);

  const revSpark = useMemo(
    () =>
      (pnl?.points ?? []).slice(-10).map((p: any) => Number(p.revenue ?? 0)),
    [pnl],
  );

  const expSpark = useMemo(
    () =>
      (expData?.trend ?? []).slice(-10).map((t: any) => Number(t.total ?? 0)),
    [expData],
  );

  const svcSpark = useMemo(
    () =>
      (pnl?.points ?? []).slice(-10).map((p: any) => Number(p.service_income ?? 0)),
    [pnl],
  );

  const alertRows = useMemo(() => {
    const rank = (r: InventoryValuationRow) =>
      r.status === "out" ? 0 : r.status === "critical" ? 1 : 2;

    return (inventory?.rows ?? [])
      .filter((r) => r.status !== "ok")
      .sort((a, b) => rank(a) - rank(b))
      .slice(0, 5);
  }, [inventory]);

  const activity = useMemo<ActivityItem[]>(() => {
    const sales: ActivityItem[] = recentSales.map((s) => {
      const cancelled = isCancelledSale(s.status);
      const editCount = Number(s.edit_count ?? 0);
      const discountTotal = Number(s.discount_total ?? 0);

      return {
        id: `sale-${s.id}`,
        type: "sale",
        title: s.sale_no,
        sub: cancelled
          ? "Cancelled sale"
          : editCount > 0
          ? `Edited ${editCount} time${editCount === 1 ? "" : "s"}`
          : discountTotal > 0
          ? `Discount given · ${fmtMoney(discountTotal)}`
          : s.customer_name ?? "Walk-in customer",
        amount: Number(s.total ?? 0),
        at: s.cancelled_at ?? s.sold_at ?? s.created_at,
        href: `/dashboard/sales/${s.id}`,
        status: s.status,
        edit_count: editCount,
        discount_total: discountTotal,
      };
    });

    const expenses: ActivityItem[] = recentExpenses.map((e) => ({
      id: `expense-${e.id}`,
      type: "expense",
      title: e.category,
      sub: `Expense · ${fmtDateOnly(e.expense_date)}`,
      amount: Number(e.amount ?? 0),
      at: e.created_at,
      href: "/dashboard/expenses",
    }));

    const services: ActivityItem[] = recentServicePayments.map((p) => ({
      id: `service-${p.id}`,
      type: "service",
      title: p.service_type,
      sub: p.customer_name
        ? `${p.customer_name} · ${fmtDateOnly(p.payment_date)}`
        : `Service payment · ${fmtDateOnly(p.payment_date)}`,
      amount: Number(p.amount ?? 0),
      at: p.created_at || `${p.payment_date}T12:00:00`,
      href: "/dashboard/services",
    }));

    return [...sales, ...expenses, ...services]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 8);
  }, [recentSales, recentExpenses, recentServicePayments]);

  if (!orgId && !err) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <svg
            className="h-6 w-6 animate-spin text-amber-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <circle cx="12" cy="12" r="10" strokeOpacity="0.2" />
            <path d="M12 2a10 10 0 0110 10" />
          </svg>
          <span className="text-sm font-bold">Starting up…</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <style jsx global>{`
        @keyframes shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .fade-in {
          animation: fadeIn 0.3s ease forwards;
        }

        .rdp-summary {
          margin: 0;
        }

        .rdp-summary .rdp-button_previous,
        .rdp-summary .rdp-button_next {
          color: inherit;
        }

        .rdp-summary .rdp-chevron {
          fill: currentColor;
        }

        .rdp-summary .rdp-day_button {
          width: 40px;
          height: 40px;
          border-radius: 0;
          font-weight: 500;
        }

        .rdp-summary .rdp-range_start .rdp-day_button,
        .rdp-summary .rdp-range_end .rdp-day_button,
        .rdp-summary .rdp-selected .rdp-day_button {
          background: #1d8ed8;
          color: white;
        }

        .rdp-summary .rdp-range_middle .rdp-day_button {
          background: #dbeafe;
          color: #0f172a;
        }

        .rdp-summary .rdp-today .rdp-day_button {
          border: 1px solid #cbd5e1;
        }

        .rdp-summary .rdp-disabled .rdp-day_button {
          opacity: 0.35;
        }
      `}</style>

      <div className="flex flex-col gap-6">
        {err && (
          <div className="fade-in flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            <span className="text-base">⚠️</span>
            <span className="flex-1 font-semibold">{err}</span>
            <button
              onClick={() => setErr("")}
              className="text-lg font-bold leading-none text-red-400 hover:text-red-600"
            >
              ×
            </button>
          </div>
        )}

        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            
            <p className="mt-1 text-sm font-medium text-slate-400">
              {/* {range.label} · {fmtRangeLabel(range.from, range.to)} */}
              {lastRefreshed && (
                <span className="ml-2 text-slate-300">
                  · Updated{" "}
                  {lastRefreshed.toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setShowDatePicker((v) => !v)}
                className="inline-flex items-center rounded-2xl border border-amber-100 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:border-amber-200 hover:bg-amber-50/40"
              >
                <span>{fmtRangeLabel(range.from, range.to, range.label)}</span>
              </button>

              {showDatePicker && (
                <SummaryDateRangePicker
                  valuePreset={preset}
                  valueFrom={range.from}
                  valueTo={range.to}
                  onApply={(nextPreset, from, to) => {
                    setCustomFrom(from);
                    setCustomTo(to);
                    setPreset(nextPreset);
                  }}
                  onClose={() => setShowDatePicker(false)}
                />
              )}
            </div>

            <button
              onClick={() => loadAll(true)}
              disabled={loading || refreshing}
              className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        <QuickActions />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Revenue"
            rawValue={kpis.revenue}
            loading={loading}
            spark={revSpark}
            sparkColor="#f59e0b"
            sub={
              kpis.serviceIncome > 0
                ? `${fmtMoney(kpis.productRevenue)} sales · ${fmtMoney(kpis.serviceIncome)} services`
                : "Sales + services in selected period"
            }
          />
          <KpiCard
            label="Service income"
            rawValue={kpis.serviceIncome}
            variant="success"
            loading={loading}
            spark={svcSpark}
            sparkColor="#16a34a"
            sub="Payments received for services"
          />
          <KpiCard
            label="Net profit"
            rawValue={kpis.net}
            variant={kpis.net < 0 ? "danger" : "success"}
            loading={loading}
            sub={kpis.net < 0 ? "Loss in selected period" : "Profit in selected period"}
          />
          <KpiCard
            label="Expenses"
            rawValue={kpis.expenses}
            variant="warning"
            loading={loading}
            spark={expSpark}
            sparkColor="#f97316"
            sub="Expenses in selected period"
          />
          <KpiCard
            label="Outstanding services"
            rawValue={serviceOutstanding}
            variant={serviceOutstanding > 0 ? "warning" : "neutral"}
            loading={loading}
            sub={
              outstandingJobCount > 0
                ? `${outstandingJobCount} job${outstandingJobCount !== 1 ? "s" : ""} awaiting collection`
                : "Awaiting collection on open jobs"
            }
          />
          <KpiCard
            label="Scheduled"
            rawValue={scheduledCount}
            loading={loading}
            isCurrency={false}
            sub={
              dueReminders.length > 0
                ? `${dueReminders.length} reminder${dueReminders.length !== 1 ? "s" : ""} due`
                : "Open scheduled jobs"
            }
          />
          <KpiCard
            label="Inventory cost"
            rawValue={kpis.inventoryCost}
            loading={loading}
            sub="Current stock at purchase cost"
          />
          <KpiCard
            label="Retail value"
            rawValue={kpis.retailValue}
            loading={loading}
            sub="Current stock at selling prices"
          />
          <KpiCard
            label="Potential profit"
            rawValue={kpis.potentialGrossProfit}
            variant={kpis.potentialGrossProfit < 0 ? "danger" : "success"}
            loading={loading}
            sub="Retail value minus inventory cost"
          />
          <KpiCard
            label="Gross margin"
            rawValue={kpis.grossMargin}
            displayValue={fmtPercent(kpis.grossMargin)}
            variant={kpis.grossMargin < 0 ? "danger" : "neutral"}
            loading={loading}
            isCurrency={false}
            sub="Potential margin on current stock"
          />
          <KpiCard
            label="Stock alerts"
            rawValue={kpis.lowCount + kpis.outCount}
            variant={kpis.outCount > 0 ? "danger" : kpis.lowCount > 0 ? "warning" : "neutral"}
            loading={loading}
            isCurrency={false}
            sub={`${kpis.lowCount} low / critical · ${kpis.outCount} out of stock`}
          />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_340px] lg:items-start">
          <Card
            title="Revenue vs Expenses"
            className="h-fit"
            sub={`${range.label} · hover the chart for breakdown`}
            action={
              <Link
                href="/dashboard/reports/revenue-health"
                className="text-xs font-bold text-amber-500 transition-colors hover:text-amber-600"
              >
                Full report →
              </Link>
            }
          >
            <div className="flex items-center gap-6 px-6 pb-2 pt-5">
              <span className="flex items-center gap-2 text-xs font-bold text-slate-600">
                <span className="h-3 w-3 rounded-sm bg-amber-400" />
                Revenue
              </span>
              <span className="flex items-center gap-2 text-xs font-bold text-slate-600">
                <span
                  className="h-3 w-3 rounded-sm bg-red-400 opacity-70"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(90deg, #f87171 0, #f87171 4px, transparent 4px, transparent 7px)",
                  }}
                />
                Expenses
              </span>
              {!loading && areaPoints.length > 0 && (
                <span
                  className={`flex items-center gap-2 text-xs font-bold ${
                    kpis.net >= 0 ? "text-emerald-600" : "text-red-500"
                  }`}
                >
                  <span
                    className={`h-3 w-3 rounded-sm ${
                      kpis.net >= 0 ? "bg-emerald-400" : "bg-red-400"
                    }`}
                  />
                  Net: {fmtMoney(kpis.net)}
                </span>
              )}
            </div>

            <div className="px-4 pb-4">
              <AreaChart points={areaPoints} loading={loading} height={220} />
            </div>
          </Card>

          <Card
            title="Needs Attention"
            className="h-fit"
            sub="Low, critical & out-of-stock items"
            action={
              <Link
                href="/dashboard/inventory"
                className="text-xs font-bold text-amber-500 transition-colors hover:text-amber-600"
              >
                Manage →
              </Link>
            }
          >
            {loading ? (
              <div className="flex flex-col gap-4 p-5">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex flex-col gap-2">
                    <Skeleton w="65%" h={16} />
                    <Skeleton w="40%" h={12} />
                  </div>
                ))}
              </div>
            ) : alertRows.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm font-bold text-slate-600">
                  All stocked up
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  No urgent stock alerts
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {alertRows.map((r) => (
                  <div
                    key={r.product_id}
                    className="flex items-start justify-between gap-3 px-5 py-4 transition-colors duration-150 hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-slate-900">
                        {r.name}
                      </div>
                      <div className="mt-1 text-xs font-medium text-slate-400">
                        On hand:{" "}
                        <span className="font-extrabold text-slate-700">
                          {r.qty_on_hand}
                        </span>
                        <span className="mx-1.5 text-slate-200">·</span>
                        Reorder at:{" "}
                        <span className="font-extrabold text-slate-700">
                          {r.reorder_level}
                        </span>
                      </div>
                      {r.category && (
                        <div className="mt-0.5 text-xs text-slate-400">
                          {r.category}
                          {r.sku ? ` · SKU ${r.sku}` : ""}
                        </div>
                      )}
                    </div>
                    <StockBadge status={r.status} />
                  </div>
                ))}

                <div className="bg-slate-50 px-5 py-3.5 text-center">
                  <Link
                    href="/dashboard/inventory?filter=low"
                    className="text-xs font-bold text-amber-500 transition-colors hover:text-amber-600"
                  >
                    View all alerts →
                  </Link>
                </div>
              </div>
            )}
          </Card>

          <IncomeBreakdown
            loading={loading}
            revenue={kpis.revenue}
            productRevenue={kpis.productRevenue}
            serviceIncome={kpis.serviceIncome}
            expenses={kpis.expenses}
            net={kpis.net}
          />

          <Card
            title="Services"
            className="h-fit"
            sub="Scheduled jobs, reminders & collections"
            action={
              <Link
                href="/dashboard/services"
                className="text-xs font-bold text-amber-500 transition-colors hover:text-amber-600"
              >
                View all →
              </Link>
            }
          >
            {loading ? (
              <div className="flex flex-col gap-4 p-5">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex flex-col gap-2">
                    <Skeleton w="65%" h={16} />
                    <Skeleton w="40%" h={12} />
                  </div>
                ))}
              </div>
            ) : dueReminders.length === 0 && upcomingServices.length === 0 && serviceOutstanding <= 0 ? (
              <div className="py-14 text-center">
                <p className="text-sm font-bold text-slate-600">No open service items</p>
                <p className="mt-1 text-xs text-slate-400">
                  Schedule a job or record service income
                </p>
                <Link
                  href="/dashboard/services"
                  className="mt-4 inline-flex rounded-xl bg-slate-950 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
                >
                  Go to Services
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {dueReminders.slice(0, 3).map((r) => (
                  <div
                    key={r.id}
                    className="flex items-start justify-between gap-3 px-5 py-4 bg-amber-50/50"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">🔔</span>
                        <div className="truncate text-sm font-bold text-slate-900">
                          {r.service_type}
                        </div>
                      </div>
                      <div className="mt-1 text-xs font-medium text-amber-800">
                        Reminder due · {r.scheduled_date ?? r.service_date}
                        {r.customer_name ? ` · ${r.customer_name}` : ""}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-800">
                      Due
                    </span>
                  </div>
                ))}

                {upcomingServices.slice(0, dueReminders.length > 0 ? 2 : 4).map((r) => (
                  <div
                    key={r.id}
                    className="flex items-start justify-between gap-3 px-5 py-4 transition-colors hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-slate-900">
                        {r.service_type}
                      </div>
                      <div className="mt-1 text-xs font-medium text-slate-400">
                        {r.scheduled_date}
                        {r.customer_name ? ` · ${r.customer_name}` : ""}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-700">
                      Scheduled
                    </span>
                  </div>
                ))}

                {serviceOutstanding > 0 && (
                  <div className="bg-[#FFFDF5] px-5 py-3.5 text-center">
                    <div className="text-xs font-bold uppercase tracking-wider text-amber-700">
                      {fmtMoney(serviceOutstanding)} outstanding
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      {outstandingJobCount} job
                      {outstandingJobCount !== 1 ? "s" : ""} with balance due
                    </div>
                  </div>
                )}

                <div className="bg-slate-50 px-5 py-3.5 text-center">
                  <Link
                    href="/dashboard/services"
                    className="text-xs font-bold text-amber-500 transition-colors hover:text-amber-600"
                  >
                    Manage services →
                  </Link>
                </div>
              </div>
            )}
          </Card>
        </div>

        <Card
          title="Recent Activity"
          sub="Sales, services, and expenses — newest first"
          action={
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard/sales"
                className="text-xs font-bold text-amber-500 transition-colors hover:text-amber-600"
              >
                Sales →
              </Link>
              <Link
                href="/dashboard/services"
                className="text-xs font-bold text-amber-500 transition-colors hover:text-amber-600"
              >
                Services →
              </Link>
              <Link
                href="/dashboard/expenses"
                className="text-xs font-bold text-amber-500 transition-colors hover:text-amber-600"
              >
                Expenses →
              </Link>
            </div>
          }
        >
          {loading ? (
            <div className="flex flex-col gap-4 p-5">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex flex-1 flex-col gap-2">
                    <Skeleton w="55%" h={14} />
                    <Skeleton w="35%" h={11} />
                  </div>
                  <Skeleton w={80} h={20} />
                </div>
              ))}
            </div>
          ) : activity.length === 0 ? (
            <div className="py-14 text-center text-sm font-semibold text-slate-400">
              No recent activity.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {[...activity]
                .sort(
                  (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
                )
                .slice(0, 10)
                .map((a) => (
                  <Link
                    key={a.id}
                    href={a.href}
                    className={`grid items-center gap-4 px-6 py-4 transition-colors duration-150 ${
                      a.type === "sale"
                        ? isCancelledSale(a.status)
                          ? "hover:bg-red-50"
                          : "hover:bg-amber-50"
                        : a.type === "service"
                        ? "hover:bg-green-50"
                        : "hover:bg-slate-50"
                    }`}
                    style={{ gridTemplateColumns: "1fr auto" }}
                  >
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="truncate text-sm font-bold text-slate-900">
                          {a.title}
                        </div>

                        {a.type === "sale" && isCancelledSale(a.status) && (
                          <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-red-600">
                            Cancelled
                          </span>
                        )}

                        {a.type === "sale" &&
                          !isCancelledSale(a.status) &&
                          Number(a.edit_count ?? 0) > 0 && (
                            <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-600">
                              Edited
                            </span>
                          )}

                        {a.type === "sale" &&
                          !isCancelledSale(a.status) &&
                          Number(a.discount_total ?? 0) > 0 && (
                            <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-600">
                              Discount
                            </span>
                          )}

                        {a.type === "service" && (
                          <span className="shrink-0 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-green-700">
                            Service
                          </span>
                        )}
                      </div>

                      <div className="mt-0.5 truncate text-xs font-medium text-slate-400">
                        {a.sub}
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <div
                        className={`text-sm font-extrabold ${
                          a.type === "expense"
                            ? "text-red-500"
                            : a.type === "service"
                            ? "text-green-700"
                            : isCancelledSale(a.status)
                            ? "text-slate-400"
                            : "text-slate-900"
                        }`}
                      >
                        {a.type === "expense"
                          ? "−"
                          : isCancelledSale(a.status)
                          ? ""
                          : "+"}
                        <span
                          className={
                            isCancelledSale(a.status)
                              ? "line-through decoration-2"
                              : ""
                          }
                        >
                          {fmtMoney(a.amount)}
                        </span>
                      </div>

                      <div className="mt-0.5 text-xs font-medium text-slate-400">
                        {fmtDateTime(a.at)}
                      </div>
                    </div>
                  </Link>
                ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
