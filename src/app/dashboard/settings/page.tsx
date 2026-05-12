"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import { getOrgId } from "@/lib/org/org";
import { useOrgRole } from "@/contexts/OrgRoleContext";
import type { User } from "@supabase/supabase-js";

function initialsFromUser(user: User) {
  const meta =
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    "";
  const fromMeta = meta
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  if (fromMeta) return fromMeta.slice(0, 2);
  const em = user.email ?? "?";
  return em.slice(0, 2).toUpperCase();
}

function formatWhen(iso: string | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export default function SettingsPage() {
  const { isAdmin, loading: roleLoading } = useOrgRole();
  const [user, setUser] = useState<User | null>(null);
  const [loadError, setLoadError] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const refreshUser = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      setLoadError(error.message);
      setUser(null);
      return;
    }
    const u = data.user;
    setUser(u);
    setLoadError("");
    const meta =
      (u?.user_metadata?.full_name as string | undefined) ||
      (u?.user_metadata?.name as string | undefined) ||
      "";
    setDisplayName(meta.trim());
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const id = await bootstrapOrg();
        if (cancelled) return;
        setOrgId(id);
        if (!id) {
          setOrgName(null);
          return;
        }
        const supabase = createClient();
        const { data } = await supabase
          .from("my_orgs")
          .select("name")
          .eq("id", id)
          .maybeSingle();
        if (!cancelled) setOrgName(data?.name ?? null);
      } catch {
        if (!cancelled) {
          setOrgId(getOrgId());
          setOrgName(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileMsg(null);
    const name = displayName.trim();
    setSavingProfile(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        data: { full_name: name, name: name || undefined },
      });
      if (error) throw error;
      setProfileMsg({ type: "ok", text: "Profile updated." });
      await refreshUser();
    } catch (e: unknown) {
      setProfileMsg({
        type: "err",
        text: e instanceof Error ? e.message : "Could not update profile.",
      });
    } finally {
      setSavingProfile(false);
    }
  }

  async function onChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordMsg(null);
    if (newPassword.length < 8) {
      setPasswordMsg({ type: "err", text: "Use at least 8 characters for your password." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: "err", text: "Passwords do not match." });
      return;
    }
    setSavingPassword(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPasswordMsg({ type: "ok", text: "Password updated. You remain signed in on this device." });
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: unknown) {
      setPasswordMsg({
        type: "err",
        text: e instanceof Error ? e.message : "Could not update password.",
      });
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <p
          className="text-[10px] font-extrabold uppercase tracking-[0.2em]"
          style={{ color: "var(--text-muted)" }}
        >
          Account
        </p>
        <h1
          className="font-display mt-1 text-3xl tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          Settings and profile
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          Manage how you appear in the workspace, review your organization context, and keep your sign-in
          details up to date. Styling matches your Pollinator dashboard theme.
        </p>
      </header>

      {loadError ? (
        <div
          className="rounded-2xl border px-4 py-3 text-sm"
          style={{
            borderColor: "rgba(248, 113, 113, 0.35)",
            background: "rgba(254, 242, 242, 0.9)",
            color: "#991B1B",
          }}
        >
          {loadError}
        </div>
      ) : null}

      {!user && !loadError ? (
        <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Loading your profile…
        </div>
      ) : null}

      {user ? (
        <>
          <section
            className="relative overflow-hidden rounded-[22px] border p-6 sm:p-8"
            style={{
              borderColor: "var(--card-border)",
              background: "linear-gradient(145deg, #FFFFFF 0%, #FFFCF3 100%)",
              boxShadow: "var(--card-shadow)",
            }}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-90"
              style={{
                background:
                  "radial-gradient(circle at top right, rgba(245, 197, 24, 0.12), transparent 42%)",
              }}
            />
            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start">
              <div
                className="flex h-[88px] w-[88px] flex-shrink-0 items-center justify-center rounded-2xl text-2xl font-bold"
                style={{
                  background:
                    "linear-gradient(135deg, #F8D54A 0%, #E2B11A 55%, #C9920A 100%)",
                  color: "#2B2100",
                  boxShadow:
                    "0 12px 28px rgba(245,197,24,0.25), inset 0 1px 0 rgba(255,255,255,0.35)",
                }}
                aria-hidden
              >
                {initialsFromUser(user)}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                  Your profile
                </h2>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  This is how teammates recognize you in invitations and future in-app mentions.
                </p>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                      Email
                    </dt>
                    <dd className="mt-0.5 font-medium break-all" style={{ color: "var(--text-primary)" }}>
                      {user.email ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                      User ID
                    </dt>
                    <dd className="mt-0.5 font-mono text-xs break-all" style={{ color: "var(--text-secondary)" }}>
                      {user.id}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                      Member since
                    </dt>
                    <dd className="mt-0.5 font-medium" style={{ color: "var(--text-primary)" }}>
                      {formatWhen(user.created_at)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                      Last sign-in
                    </dt>
                    <dd className="mt-0.5 font-medium" style={{ color: "var(--text-primary)" }}>
                      {formatWhen(user.last_sign_in_at)}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            <form onSubmit={onSaveProfile} className="relative mt-8 space-y-4 border-t pt-6" style={{ borderColor: "var(--card-border-soft)" }}>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                  Display name
                </span>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="mt-2 w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition focus:ring-2"
                  style={{
                    borderColor: "var(--card-border)",
                    background: "#FFFEF9",
                    color: "var(--text-primary)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6)",
                  }}
                  placeholder="e.g. Jane Mwangi"
                  autoComplete="name"
                />
              </label>
              {profileMsg ? (
                <div
                  className="rounded-xl px-3 py-2 text-sm"
                  style={
                    profileMsg.type === "ok"
                      ? {
                          border: "1px solid rgba(16, 185, 129, 0.35)",
                          background: "rgba(236, 253, 245, 0.95)",
                          color: "#065F46",
                        }
                      : {
                          border: "1px solid rgba(248, 113, 113, 0.35)",
                          background: "rgba(254, 242, 242, 0.95)",
                          color: "#991B1B",
                        }
                  }
                >
                  {profileMsg.text}
                </div>
              ) : null}
              <button
                type="submit"
                disabled={savingProfile}
                className="inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-bold text-[#2E2200] transition hover:brightness-105 disabled:opacity-50"
                style={{
                  background: "linear-gradient(180deg, #FFE78A 0%, var(--accent) 55%, #E2B11A 100%)",
                  boxShadow: "0 8px 22px rgba(245,197,24,0.28), inset 0 1px 0 rgba(255,255,255,0.45)",
                }}
              >
                {savingProfile ? "Saving…" : "Save profile"}
              </button>
            </form>
          </section>

          <section
            className="rounded-[22px] border p-6 sm:p-7"
            style={{
              borderColor: "var(--card-border)",
              background: "var(--card-bg)",
              boxShadow: "var(--card-shadow)",
            }}
          >
            <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
              Workspace
            </h2>
            <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
              Your browser remembers the active organization for inventory, sales, and reports.
            </p>
            <div
              className="mt-5 flex flex-col gap-4 rounded-2xl border px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              style={{ borderColor: "var(--card-border-soft)", background: "rgba(245, 197, 24, 0.06)" }}
            >
              <div>
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                  Active organization
                </p>
                <p className="mt-1 text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                  {orgName ?? (orgId ? "Unnamed organization" : "None selected")}
                </p>
                {orgId ? (
                  <p className="mt-0.5 font-mono text-xs" style={{ color: "var(--text-muted)" }}>
                    {orgId}
                  </p>
                ) : (
                  <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                    Choose an organization to sync data across the app.
                  </p>
                )}
              </div>
              <Link
                href="/dashboard/org"
                className="inline-flex items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-semibold transition hover:bg-white/80"
                style={{
                  borderColor: "rgba(245, 197, 24, 0.45)",
                  color: "#7A5A00",
                  background: "rgba(255,255,255,0.75)",
                }}
              >
                Switch organization
              </Link>
            </div>

            {!roleLoading && isAdmin ? (
              <div className="mt-6">
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                  Admin shortcuts
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    { href: "/dashboard/team", label: "Team & invites" },
                    { href: "/dashboard/summarydashboard", label: "Dashboard" },
                    { href: "/dashboard/reports", label: "Reports" },
                    { href: "/dashboard/products", label: "Products" },
                  ].map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      className="rounded-full border px-3.5 py-1.5 text-xs font-semibold transition hover:border-amber-400/60 hover:bg-amber-50"
                      style={{ borderColor: "var(--card-border)", color: "var(--text-secondary)" }}
                    >
                      {l.label}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <section
            className="rounded-[22px] border p-6 sm:p-7"
            style={{
              borderColor: "var(--card-border)",
              background: "var(--card-bg)",
              boxShadow: "var(--card-shadow)",
            }}
          >
            <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
              Security
            </h2>
            <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
              Set a new password while signed in. Use a unique phrase you do not reuse on other sites.
            </p>
            <form onSubmit={onChangePassword} className="mt-5 space-y-4 max-w-md">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                  New password
                </span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-2 w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition focus:ring-2"
                  style={{
                    borderColor: "var(--card-border)",
                    background: "#FFFEF9",
                    color: "var(--text-primary)",
                  }}
                  autoComplete="new-password"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                  Confirm password
                </span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-2 w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition focus:ring-2"
                  style={{
                    borderColor: "var(--card-border)",
                    background: "#FFFEF9",
                    color: "var(--text-primary)",
                  }}
                  autoComplete="new-password"
                />
              </label>
              {passwordMsg ? (
                <div
                  className="rounded-xl px-3 py-2 text-sm"
                  style={
                    passwordMsg.type === "ok"
                      ? {
                          border: "1px solid rgba(16, 185, 129, 0.35)",
                          background: "rgba(236, 253, 245, 0.95)",
                          color: "#065F46",
                        }
                      : {
                          border: "1px solid rgba(248, 113, 113, 0.35)",
                          background: "rgba(254, 242, 242, 0.95)",
                          color: "#991B1B",
                        }
                  }
                >
                  {passwordMsg.text}
                </div>
              ) : null}
              <button
                type="submit"
                disabled={savingPassword}
                className="inline-flex items-center justify-center rounded-xl border px-5 py-2.5 text-sm font-bold transition disabled:opacity-50"
                style={{
                  borderColor: "var(--card-border)",
                  background: "#1E1B16",
                  color: "#FFFEF5",
                }}
              >
                {savingPassword ? "Updating…" : "Update password"}
              </button>
            </form>
          </section>

          <section
            className="rounded-[22px] border p-6 sm:p-7"
            style={{
              borderColor: "var(--card-border)",
              background: "linear-gradient(180deg, #FFFBF0 0%, #FFFFFF 55%)",
              boxShadow: "var(--card-shadow)",
            }}
          >
            <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
              Appearance and experience
            </h2>
            <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
              The console uses a warm paper background, honey-gold accents, and high-contrast type tuned for
              long sessions at the hive. Theme controls may land here in a future update.
            </p>
            <div
              className="mt-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
              style={{
                borderColor: "rgba(245, 197, 24, 0.35)",
                background: "rgba(245, 197, 24, 0.12)",
                color: "#7A5A00",
              }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: "var(--accent)", boxShadow: "0 0 12px rgba(245,197,24,0.7)" }}
              />
              Warm dashboard theme (default)
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
