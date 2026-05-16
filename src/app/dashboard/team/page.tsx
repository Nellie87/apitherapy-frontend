"use client";

import { useEffect, useState } from "react";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import { getOrgId } from "@/lib/org/org";
import { useOrgRole } from "@/contexts/OrgRoleContext";
import Link from "next/link";
import * as S from "./page.styles";

const ROLES = [
  { value: "sales_clerk", label: "Sales (POS only)" },
  { value: "cashier", label: "Cashier" },
  { value: "pos", label: "POS" },
] as const;

export default function TeamPage() {
  const { isSalesClerk, loading: roleLoading } = useOrgRole();

  const [orgId, setOrgId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<string>("sales_clerk");

  const [msg, setMsg] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const id = await bootstrapOrg();
        setOrgId(id);
      } catch (e: unknown) {
        setMsg({
          type: "err",
          text:
            e instanceof Error
              ? e.message
              : "Could not load organization.",
        });
      }
    })();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    setMsg(null);

    const oid = orgId ?? getOrgId();

    if (!oid) {
      setMsg({
        type: "err",
        text: "No organization selected.",
      });

      return;
    }

    const em = email.trim().toLowerCase();

    if (!em || !em.includes("@")) {
      setMsg({
        type: "err",
        text: "Enter a valid email address.",
      });

      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/admin/invite-staff", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          org_id: oid,
          email: em,
          full_name: fullName.trim(),
          role,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMsg({
          type: "err",
          text: data.error ?? `Request failed (${res.status})`,
        });

        return;
      }

      setMsg({
        type: "ok",
        text: data.message ?? "Invitation sent.",
      });

      setEmail("");
      setFullName("");
    } catch (e: unknown) {
      setMsg({
        type: "err",
        text: e instanceof Error ? e.message : "Network error.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (roleLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <Spinner />
          Loading team…
        </div>
      </div>
    );
  }

  if (isSalesClerk) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className={S.gateCard}>
          <p className="font-bold text-slate-900">
            Team invites are for organization owners.
          </p>

          <p className="mt-2 text-sm text-slate-600">
            Your account is limited to sales. Ask an owner to change your role
            if you need access here.
          </p>

          <Link
            href="/dashboard/sales"
            className="mt-5 inline-flex items-center rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-50"
          >
            Back to sales
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen justify-center px-4 py-10">
      <div className="w-full max-w-2xl flex flex-col gap-6">
        <header className="text-center">
          <p className={S.sectionTitle}>Organization</p>

          <h1 className={`mt-2 ${S.pageTitle}`}>Team</h1>

          <p className={S.pageSubtitle}>
            Invite staff by email. They receive a Supabase link to set a
            password — no public sign-up page required if you disable sign-ups
            in the Supabase dashboard.
          </p>
        </header>

        <section className={`${S.card} p-6 sm:p-7`}>
          <div className="flex items-start gap-3 border-b border-slate-100 pb-4">
            <div
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-lg"
              style={{
                background:
                  "linear-gradient(135deg, #F8D54A 0%, #E2B11A 55%, #C9920A 100%)",
                color: "#2B2100",
                boxShadow: "0 8px 18px rgba(245,197,24,0.22)",
              }}
              aria-hidden
            >
              ⎔
            </div>

            <div>
              <h2 className="text-base font-bold text-slate-900">
                Invite staff member
              </h2>

              <p className="mt-0.5 text-sm text-slate-500">
                New teammates join this workspace with the role you choose
                below.
              </p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className={S.label}>Email</span>

              <input
                type="email"
                required
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={S.input}
                placeholder="name@company.com"
              />
            </label>

            <label className="block">
              <span className={S.label}>Display name (optional)</span>

              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={S.input}
                placeholder="Jane Doe"
              />
            </label>

            <label className="block">
              <span className={S.label}>Role in this organization</span>

              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className={S.input}
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>

            {msg ? (
              <div className={msg.type === "ok" ? S.alertOk : S.alertErr}>
                {msg.text}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={submitting || !orgId}
              className={S.btnPrimary}
            >
              {submitting ? "Sending…" : "Send invitation"}
            </button>
          </form>
        </section>

        
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" strokeOpacity="0.2" />
      <path d="M12 2a10 10 0 0110 10" />
    </svg>
  );
}