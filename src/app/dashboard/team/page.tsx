"use client";

import { useEffect, useState } from "react";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import { getOrgId } from "@/lib/org/org";
import { useOrgRole } from "@/contexts/OrgRoleContext";
import Link from "next/link";
import * as S from "./page.styles";

const ROLES = [
  { value: "sales_clerk", label: "Sales POS only" },
  { value: "cashier", label: "Cashier" },
  { value: "pos", label: "POS" },
] as const;

type TeamMember = {
  user_id: string;
  role: string;
  created_at: string;
  full_name: string | null;
};

export default function TeamPage() {
  const { isSalesClerk, loading: roleLoading } = useOrgRole();

  const [orgId, setOrgId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<string>("sales_clerk");

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const [msg, setMsg] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  const [submitting, setSubmitting] = useState(false);

  async function loadMembers(oid: string) {
    setLoadingMembers(true);

    try {
      const res = await fetch("/api/admin/team-members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: oid }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMsg({
          type: "err",
          text: data.error ?? "Could not load team members.",
        });
        return;
      }

      setMembers(data.members ?? []);
    } catch (e: unknown) {
      setMsg({
        type: "err",
        text: e instanceof Error ? e.message : "Could not load team members.",
      });
    } finally {
      setLoadingMembers(false);
    }
  }

  useEffect(() => {
    async function loadOrg() {
      try {
        const id = await bootstrapOrg();
        setOrgId(id);
        await loadMembers(id);
      } catch (e: unknown) {
        setMsg({
          type: "err",
          text: e instanceof Error ? e.message : "Could not load organization.",
        });
      }
    }

    loadOrg();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    const oid = orgId ?? (await getOrgId());

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
      setRole("sales_clerk");

      await loadMembers(oid);
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
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-amber-500" />
          <p className="mt-3 text-sm font-medium text-slate-500">
            Loading team…
          </p>
        </div>
      </div>
    );
  }

  if (isSalesClerk) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
        <section className={S.gateCard}>
          <p className={S.sectionTitle}>Restricted access</p>

          <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-950">
            Team invites are for organization owners.
          </h1>

          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Your account is limited to sales. Ask an owner to update your role
            if you need access to team management.
          </p>

          <Link href="/dashboard/sales" className={`mt-6 ${S.btnGhost}`}>
            Back to sales
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <header className="text-center">
          <p className={S.sectionTitle}>Organization</p>
          <h1 className={`mt-2 ${S.pageTitle}`}>Team</h1>
          <p className={S.pageSubtitle}>
            Invite staff members to your workspace and assign the correct access
            level for daily sales operations.
          </p>
        </header>

        <section className={`${S.card} overflow-hidden`}>
          <div className="border-b border-slate-100 bg-gradient-to-br from-amber-50 via-white to-white px-5 py-5 sm:px-8 sm:py-6">
            <h2 className="text-lg font-black tracking-tight text-slate-950">
              Invite staff member
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              The staff member will receive an email invitation and complete
              their password setup securely.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-5 p-5 sm:p-8">
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className={S.label}>Email address</span>
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
                <span className={S.label}>Display name</span>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={S.input}
                  placeholder="Jane Doe"
                />
              </label>

              <label className="block">
                <span className={S.label}>Role</span>
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
            </div>

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
              {submitting ? "Sending invitation…" : "Send invitation"}
            </button>
          </form>
        </section>

        <section className={`${S.card} overflow-hidden`}>
          <div className="border-b border-slate-100 bg-white px-5 py-5 sm:px-8">
            <h2 className="text-lg font-black tracking-tight text-slate-950">
              Team members
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              People currently linked to this organization.
            </p>
          </div>

          <div className="p-5 sm:p-8">
            {loadingMembers ? (
              <p className="text-sm font-medium text-slate-500">
                Loading team members…
              </p>
            ) : members.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                <p className="text-sm font-bold text-slate-700">
                  No team members yet.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {members.map((member) => (
                  <div
                    key={`${member.user_id}-${member.role}`}
                    className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-bold text-slate-950">
{member.full_name?.trim() || "Unnamed staff"}              </p>

                      <p className="mt-1 text-sm text-slate-500">
                        Joined{" "}
                        {new Date(member.created_at).toLocaleDateString(
                          "en-KE",
                          {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          }
                        )}
                      </p>
                    </div>

                    <span className="w-fit rounded-full bg-amber-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-amber-700">
                      {member.role.replaceAll("_", " ")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}