"use client";

import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { clearOrgId, setOrgId } from "@/lib/org/org";
import { fetchMyOrgRole } from "@/lib/auth/orgRole";
import "./org.css";

type OrgRow = {
  id: string;
  name: string | null;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "ORG";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

const HexBg = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="org-hex" aria-hidden>
    <defs>
      <pattern
        id="orghex"
        x="0"
        y="0"
        width="56"
        height="100"
        patternUnits="userSpaceOnUse"
        patternTransform="scale(1.4)"
      >
        <path
          d="M28 66L0 50L0 16L28 0L56 16L56 50L28 66ZM28 100L0 84L0 50L28 34L56 50L56 84L28 100"
          fill="none"
          stroke="#1c1917"
          strokeWidth="1"
        />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#orghex)" />
  </svg>
);

export default function OrgPage() {
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const [creating, setCreating] = useState(false);

  async function loadOrgs() {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("my_orgs")
      .select("id, name")
      .order("created_at", { ascending: false });

    if (error) throw error;
    setOrgs((data as OrgRow[]) ?? []);
  }

  useEffect(() => {
    async function init() {
      try {
        const supabase = createClient();

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          window.location.href = "/login";
          return;
        }

        await loadOrgs();
      } catch (e: unknown) {
        setMsg(e instanceof Error ? e.message : "Could not load organizations.");
      } finally {
        setLoading(false);
      }
    }

    init();
  }, []);

  async function goToOrg(orgId: string) {
    setOpeningId(orgId);
    setMsg("");

    try {
      await setOrgId(orgId);
      const role = await fetchMyOrgRole(String(orgId));

      window.location.href =
        role === "sales_clerk" ? "/dashboard/sales" : "/dashboard/products";
    } catch {
      window.location.href = "/dashboard/products";
    }
  }

  async function createOrg() {
    setMsg("");

    try {
      if (!name.trim()) {
        setMsg("Enter an organization name.");
        return;
      }

      setCreating(true);
      const supabase = createClient();

      const { data, error } = await supabase.rpc("create_org", {
        p_name: name.trim(),
      });

      if (error) throw error;

      await goToOrg(String(data));
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Something went wrong.");
      setCreating(false);
      setOpeningId(null);
    }
  }

  function onCreateSubmit(e: FormEvent) {
    e.preventDefault();
    void createOrg();
  }

  function onCreateKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void createOrg();
    }
  }

  async function logout() {
    await clearOrgId();
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const multiOrg = orgs.length > 1;
  const busy = creating || !!openingId;

  return (
    <main className="org-page">
      <div className="org-accent" />
      <div className="org-glow org-glow-a" />
      <div className="org-glow org-glow-b" />
      <HexBg />

      <div className="org-shell">
        <header className="org-topbar">
          <div className="org-brand">
            <div className="org-mark" aria-hidden>
              PB
            </div>
            <div className="org-brand-copy">
              <div className="org-brand-title">Pollinator Beekeeping</div>
              <div className="org-brand-sub">Apitherapy workspace</div>
            </div>
          </div>

          <button type="button" className="org-logout" onClick={logout}>
            Log out
          </button>
        </header>

        <section className="org-panel">
          <div className="org-hero">
            <p className="org-kicker">Workspace</p>
            <h1 className="org-title">
              {multiOrg ? "Choose your organization" : "Your organization"}
            </h1>
            <p className="org-lead">
              {multiOrg
                ? "Your account belongs to more than one business. Open the one you want to work in today."
                : "Open an existing workspace, or create a new one for your business."}
            </p>
          </div>

          <div className={`org-body${multiOrg ? " multi" : ""}`}>
            <section className="org-section">
              <div className="org-section-head">
                <div>
                  <h2 className="org-section-title">Your organizations</h2>
                  <p className="org-section-copy">
                    {multiOrg
                      ? "Select a workspace to continue."
                      : "Continue where you left off."}
                  </p>
                </div>
                <span className="org-count">
                  {loading ? "…" : `${orgs.length} open`}
                </span>
              </div>

              <div className="org-list">
                {loading ? (
                  <div className="org-loading">
                    <span className="org-spinner" aria-hidden />
                    Loading your workspaces…
                  </div>
                ) : orgs.length === 0 ? (
                  <div className="org-empty">
                    No organizations yet. Create one below to get started.
                  </div>
                ) : (
                  orgs.map((o) => {
                    const label = o.name?.trim() || "Untitled organization";
                    const isOpening = openingId === o.id;

                    return (
                      <button
                        key={o.id}
                        type="button"
                        className={`org-card${isOpening ? " is-busy" : ""}`}
                        onClick={() => goToOrg(o.id)}
                        disabled={busy}
                      >
                        <span className="org-avatar" aria-hidden>
                          {initials(label)}
                        </span>
                        <span className="org-card-copy">
                          <span className="org-card-name">{label}</span>
                          <span className="org-card-meta">
                            {isOpening ? "Opening workspace…" : "Continue to dashboard"}
                          </span>
                        </span>
                        <span className="org-card-action">
                          {isOpening ? (
                            <>
                              <span className="org-spinner" aria-hidden />
                              Opening
                            </>
                          ) : (
                            "Open →"
                          )}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </section>

            <section className="org-section create">
              <div className="org-section-head">
                <div>
                  <h2 className="org-section-title">Create new</h2>
                  <p className="org-section-copy">
                    Start a fresh workspace with your business name.
                  </p>
                </div>
              </div>

              <form className="org-form" onSubmit={onCreateSubmit}>
                <div>
                  <label className="org-label" htmlFor="org-name">
                    Organization name
                  </label>
                  <input
                    id="org-name"
                    className="org-input"
                    placeholder="e.g. BeeShop Nairobi"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={onCreateKeyDown}
                    disabled={busy}
                    autoComplete="organization"
                  />
                </div>

                {msg ? <div className="org-error">{msg}</div> : null}

                <button
                  type="submit"
                  className="org-submit"
                  disabled={busy}
                >
                  {creating ? "Creating…" : "Create organization"}
                </button>

                <p className="org-hint">
                  You’ll be taken straight into the new workspace after it’s created.
                </p>
              </form>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
