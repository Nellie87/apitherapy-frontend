"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import { getOrgId } from "@/lib/org/org";
import { useOrgRole } from "@/contexts/OrgRoleContext";
import type { User } from "@supabase/supabase-js";
import * as S from "./page.styles";

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

function Notice({ type, text }: { type: "ok" | "err"; text: string }) {
  return (
    <div className={type === "ok" ? S.alertOk : S.alertErr}>{text}</div>
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
    <div className={S.detailItem}>
      <dt className={S.label}>{label}</dt>
      <dd
        className={
          mono
            ? "mt-0.5 break-all font-mono text-[11px] text-slate-600"
            : "mt-0.5 break-words text-sm font-medium text-slate-900"
        }
      >
        {value}
      </dd>
    </div>
  );
}

function CardSection({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`${S.card} ${className}`}>
      <div className={S.cardHeader}>
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
      </div>
      <div className={S.cardBody}>{children}</div>
    </section>
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
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Settings</h1>
        <p className="text-xs text-slate-500">Profile, workspace, and password</p>
      </div>

      {loadError ? <Notice type="err" text={loadError} /> : null}

      {!user && !loadError ? (
        <div className="flex h-40 items-center justify-center">
          <div className="flex items-center gap-3 text-slate-500">
            <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" strokeOpacity="0.2" />
              <path d="M12 2a10 10 0 0110 10" />
            </svg>
            <span className="text-sm font-medium">Loading profile…</span>
          </div>
        </div>
      ) : null}

      {user ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <CardSection title="Profile">
            <div className="space-y-3">
              <div className={S.profileBanner}>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-sm font-bold text-white">
                  {initialsFromUser(user)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900">
                    {displayName || "No display name"}
                  </p>
                  <p className="truncate text-xs text-slate-500">{user.email ?? "—"}</p>
                </div>
              </div>

              <dl className="grid gap-2 sm:grid-cols-2">
                <DetailItem label="Member since" value={formatWhen(user.created_at)} />
                <DetailItem label="Last sign-in" value={formatWhen(user.last_sign_in_at)} />
                <DetailItem label="User ID" value={user.id} mono />
              </dl>

              <form onSubmit={onSaveProfile} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <label className="block flex-1">
                  <span className={S.label}>Display name</span>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className={S.input}
                    placeholder="e.g. Jane Mwangi"
                    autoComplete="name"
                  />
                </label>
                <button type="submit" disabled={savingProfile} className={S.btnPrimary}>
                  {savingProfile ? "Saving…" : "Save"}
                </button>
              </form>

              {profileMsg ? (
                <Notice type={profileMsg.type} text={profileMsg.text} />
              ) : null}
            </div>
          </CardSection>

          <CardSection title="Workspace">
            <div className="space-y-3">
              <div className={S.workspaceBanner}>
                <div className="min-w-0">
                  <p className={S.label}>Current organization</p>
                  <p className="truncate text-sm font-bold text-slate-900">
                    {orgName ?? (orgId ? "Unnamed organization" : "None selected")}
                  </p>
                  {orgId ? (
                    <p className="mt-0.5 truncate font-mono text-[11px] text-slate-400">{orgId}</p>
                  ) : null}
                </div>
                <Link href="/dashboard/org" className={S.btnSecondary}>
                  Switch
                </Link>
              </div>

              {!roleLoading && isAdmin ? (
                <div>
                  <p className={S.label}>Admin shortcuts</p>
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                    {[
                      { href: "/dashboard/team", label: "Team" },
                      { href: "/dashboard/summarydashboard", label: "Dashboard" },
                      { href: "/dashboard/reports", label: "Reports" },
                      { href: "/dashboard/products", label: "Products" },
                    ].map((item) => (
                      <Link key={item.href} href={item.href} className={S.shortcutLink}>
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </CardSection>

          <CardSection title="Password" className="lg:col-span-2">
            <form onSubmit={onChangePassword} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
                <label className="block">
                  <span className={S.label}>New password</span>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={S.input}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                  />
                </label>

                <label className="block">
                  <span className={S.label}>Confirm password</span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={S.input}
                    autoComplete="new-password"
                    placeholder="Repeat password"
                  />
                </label>

                <button type="submit" disabled={savingPassword} className={S.btnPrimary}>
                  {savingPassword ? "Updating…" : "Update password"}
                </button>
              </div>

              {passwordMsg ? (
                <Notice type={passwordMsg.type} text={passwordMsg.text} />
              ) : null}
            </form>
          </CardSection>
        </div>
      ) : null}
    </div>
  );
}
