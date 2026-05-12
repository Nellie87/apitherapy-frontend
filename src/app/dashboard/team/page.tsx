"use client";

import { useEffect, useState } from "react";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import { getOrgId } from "@/lib/org/org";
import { useOrgRole } from "@/contexts/OrgRoleContext";
import Link from "next/link";

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
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const id = await bootstrapOrg();
        setOrgId(id);
      } catch (e: unknown) {
        setMsg({
          type: "err",
          text: e instanceof Error ? e.message : "Could not load organization.",
        });
      }
    })();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    const oid = orgId ?? getOrgId();
    if (!oid) {
      setMsg({ type: "err", text: "No organization selected." });
      return;
    }

    const em = email.trim().toLowerCase();
    if (!em || !em.includes("@")) {
      setMsg({ type: "err", text: "Enter a valid email address." });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/invite-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: oid,
          email: em,
          full_name: fullName.trim(),
          role,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ type: "err", text: data.error ?? `Request failed (${res.status})` });
        return;
      }
      setMsg({ type: "ok", text: data.message ?? "Invitation sent." });
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

  if (!roleLoading && isSalesClerk) {
    return (
      <div className="max-w-lg rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <p className="font-semibold">Team invites are for organization owners.</p>
        <p className="mt-2 text-sm text-amber-800">
          Your account is limited to sales. Ask an owner to change your role if you need access here.
        </p>
        <Link href="/dashboard/sales" className="mt-4 inline-block text-sm font-semibold underline">
          Back to sales
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Team</h1>
        <p className="mt-1 text-sm text-slate-600">
          Invite staff by email. They receive a Supabase link to set a password — no public sign-up page
          required for them if you disable sign-ups in the Supabase dashboard.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          Invite staff member
        </h2>
        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Email</span>
            <input
              type="email"
              required
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
              placeholder="name@company.com"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Display name (optional)</span>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
              placeholder="Jane Doe"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Role in this organization</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>

          {msg && (
            <div
              className={`rounded-xl px-3 py-2 text-sm ${
                msg.type === "ok"
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border border-red-200 bg-red-50 text-red-800"
              }`}
            >
              {msg.text}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !orgId}
            className="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {submitting ? "Sending…" : "Send invitation"}
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700 space-y-2">
        <p className="font-semibold text-slate-900">Setup checklist</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Add <code className="rounded bg-white px-1">SUPABASE_SERVICE_ROLE_KEY</code> to your{" "}
            <strong>server</strong> environment (e.g. Vercel env vars). Never put it in client code.
          </li>
          <li>
            Set <code className="rounded bg-white px-1">NEXT_PUBLIC_APP_URL</code> to your site URL
            (e.g. <code className="rounded bg-white px-1">https://your-app.vercel.app</code>) so the
            invite email redirect works.
          </li>
          <li>
            In Supabase → Authentication → Providers: turn <strong>off</strong> public sign-up if you
            only want invited users.
          </li>
          <li>
            Apply the migration <code className="rounded bg-white px-1">20260515100000_handle_new_user_org_invite.sql</code>{" "}
            so invited users get an <code className="rounded bg-white px-1">org_members</code> row
            automatically.
          </li>
        </ul>
      </div>
    </div>
  );
}
