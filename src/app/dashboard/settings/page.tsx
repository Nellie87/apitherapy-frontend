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

  const initials = meta
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  if (initials) return initials.slice(0, 2);

  return (user.email ?? "?").slice(0, 2).toUpperCase();
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

const pageShell =
  "min-h-screen bg-slate-50 px-4 py-8 text-slate-950 sm:px-6 lg:px-8";

const sectionCard =
  "rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden";

const sectionHeader =
  "border-b border-slate-100 bg-gradient-to-br from-amber-50 via-white to-white px-5 py-5 sm:px-7";

const sectionBody = "px-5 py-5 sm:px-7 sm:py-6";

const labelClass =
  "mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-slate-500";

const inputClass =
  "w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-4 focus:ring-amber-100";

const primaryButton =
  "inline-flex w-full items-center justify-center rounded-2xl bg-amber-500 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-amber-600 active:scale-[.98] disabled:pointer-events-none disabled:opacity-50 sm:w-auto";

const darkButton =
  "inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 active:scale-[.98] disabled:pointer-events-none disabled:opacity-50 sm:w-auto";

const softButton =
  "inline-flex w-full items-center justify-center rounded-2xl border border-amber-200 bg-white px-4 py-2.5 text-sm font-bold text-amber-900 transition hover:bg-amber-50 active:scale-[.98] sm:w-auto";

function Notice({
  type,
  text,
}: {
  type: "ok" | "err";
  text: string;
}) {
  return (
    <div
      className={
        type === "ok"
          ? "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900"
          : "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"
      }
    >
      {text}
    </div>
  );
}

function DetailItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <dt className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </dt>
      <dd
        className={
          mono
            ? "mt-1 break-all font-mono text-xs text-slate-700"
            : "mt-1 break-words text-sm font-semibold text-slate-950"
        }
      >
        {value}
      </dd>
    </div>
  );
}

export default function SettingsPage() {
  const { isAdmin, loading: roleLoading } = useOrgRole();

  const [user, setUser] = useState<User | null>(null);
  const [loadError, setLoadError] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  const refreshUser = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      setLoadError(error.message);
      setUser(null);
      return;
    }

    const currentUser = data.user;
    setUser(currentUser);
    setLoadError("");

    const meta =
      (currentUser?.user_metadata?.full_name as string | undefined) ||
      (currentUser?.user_metadata?.name as string | undefined) ||
      "";

    setDisplayName(meta.trim());
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    let cancelled = false;

    async function loadOrganization() {
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
          setOrgId(await getOrgId());
          setOrgName(null);
        }
      }
    }

    void loadOrganization();

    return () => {
      cancelled = true;
    };
  }, []);

  async function onSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileMsg(null);
    setSavingProfile(true);

    try {
      const name = displayName.trim();
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
      setPasswordMsg({
        type: "err",
        text: "Use at least 8 characters for your password.",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: "err", text: "Passwords do not match." });
      return;
    }

    setSavingPassword(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setPasswordMsg({
        type: "ok",
        text: "Password updated. You remain signed in on this device.",
      });
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
    <main className={pageShell}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="rounded-3xl border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-white px-5 py-6 shadow-sm sm:px-8 sm:py-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-600">
            Account
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            Settings and profile
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Manage your profile, workspace context, and password from one clean
            settings area.
          </p>
        </header>

        {loadError ? <Notice type="err" text={loadError} /> : null}

        {!user && !loadError ? (
          <section className={sectionCard}>
            <div className="flex min-h-48 items-center justify-center p-8 text-center">
              <div>
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-amber-500" />
                <p className="mt-3 text-sm font-medium text-slate-500">
                  Loading your profile…
                </p>
              </div>
            </div>
          </section>
        ) : null}

        {user ? (
          <>
            <section className={sectionCard}>
              <div className={sectionHeader}>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                  Profile details
                </p>
                <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">
                  Your account information
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  This is the information connected to your signed-in account.
                </p>
              </div>

              <div className={sectionBody}>
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
                  <div className="flex items-center gap-4 rounded-3xl border border-amber-100 bg-amber-50/70 p-4 lg:w-72 lg:flex-col lg:items-start">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-xl font-black text-white shadow-sm">
                      {initialsFromUser(user)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-base font-black text-slate-950">
                        {displayName || "No display name"}
                      </p>
                      <p className="mt-1 break-all text-sm text-slate-600">
                        {user.email ?? "—"}
                      </p>
                    </div>
                  </div>

                  <dl className="grid flex-1 gap-3 sm:grid-cols-2">
                    <DetailItem label="Email" value={user.email ?? "—"} />
                    <DetailItem label="User ID" value={user.id} mono />
                    <DetailItem
                      label="Member since"
                      value={formatWhen(user.created_at)}
                    />
                    <DetailItem
                      label="Last sign-in"
                      value={formatWhen(user.last_sign_in_at)}
                    />
                  </dl>
                </div>
              </div>
            </section>

            <section className={sectionCard}>
              <div className={sectionHeader}>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                  Personal profile
                </p>
                <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">
                  Display name
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  Update the name teammates see in the workspace.
                </p>
              </div>

              <form onSubmit={onSaveProfile} className={`${sectionBody} space-y-5`}>
                <label className="block max-w-xl">
                  <span className={labelClass}>Display name</span>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className={inputClass}
                    placeholder="e.g. Jane Mwangi"
                    autoComplete="name"
                  />
                </label>

                {profileMsg ? (
                  <Notice type={profileMsg.type} text={profileMsg.text} />
                ) : null}

                <button
                  type="submit"
                  disabled={savingProfile}
                  className={primaryButton}
                >
                  {savingProfile ? "Saving…" : "Save profile"}
                </button>
              </form>
            </section>

            <section className={sectionCard}>
              <div className={sectionHeader}>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                  Workspace
                </p>
                <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">
                  Active organization
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  This controls which organization your dashboard uses for sales,
                  products, reports, and inventory.
                </p>
              </div>

              <div className={sectionBody}>
                <div className="flex flex-col gap-4 rounded-3xl border border-amber-100 bg-amber-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">
                      Current workspace
                    </p>
                    <p className="mt-1 truncate text-lg font-black text-slate-950">
                      {orgName ?? (orgId ? "Unnamed organization" : "None selected")}
                    </p>
                    {orgId ? (
                      <p className="mt-1 break-all font-mono text-xs text-slate-500">
                        {orgId}
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-slate-600">
                        Choose an organization to sync data across the app.
                      </p>
                    )}
                  </div>

                  <Link href="/dashboard/org" className={softButton}>
                    Switch organization
                  </Link>
                </div>

                {!roleLoading && isAdmin ? (
                  <div className="mt-6 border-t border-slate-100 pt-5">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                      Admin shortcuts
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      {[
                        { href: "/dashboard/team", label: "Team & invites" },
                        { href: "/dashboard/summarydashboard", label: "Dashboard" },
                        { href: "/dashboard/reports", label: "Reports" },
                        { href: "/dashboard/products", label: "Products" },
                      ].map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-amber-200 hover:bg-amber-50"
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </section>

            <section className={sectionCard}>
              <div className={sectionHeader}>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                  Security
                </p>
                <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">
                  Change password
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  Set a new password for this account while staying signed in on
                  this device.
                </p>
              </div>

              <form onSubmit={onChangePassword} className={`${sectionBody} space-y-5`}>
                <div className="grid max-w-3xl gap-5 sm:grid-cols-2">
                  <label className="block">
                    <span className={labelClass}>New password</span>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className={inputClass}
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
                    />
                  </label>

                  <label className="block">
                    <span className={labelClass}>Confirm password</span>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={inputClass}
                      autoComplete="new-password"
                      placeholder="Repeat password"
                    />
                  </label>
                </div>

                {passwordMsg ? (
                  <Notice type={passwordMsg.type} text={passwordMsg.text} />
                ) : null}

                <button
                  type="submit"
                  disabled={savingPassword}
                  className={darkButton}
                >
                  {savingPassword ? "Updating…" : "Update password"}
                </button>
              </form>
            </section>

           
          </>
        ) : null}
      </div>
    </main>
  );
}
