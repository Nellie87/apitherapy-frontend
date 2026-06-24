"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { setOrgId } from "@/lib/org/org";
import { fetchMyOrgRole } from "@/lib/auth/orgRole";

export default function OrgPage() {
  const [orgs, setOrgs] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");

  async function loadOrgs() {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("my_orgs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    setOrgs(data ?? []);
  }

  useEffect(() => {
    async function init() {
      const supabase = createClient();

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.href = "/login";
        return;
      }

      await loadOrgs();
    }

    init();
  }, []);

  async function goToOrg(orgId: string) {
    setOrgId(orgId);

    try {
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
        setMsg("Enter organization name.");
        return;
      }

      const supabase = createClient();

      const { data, error } = await supabase.rpc("create_org", {
        p_name: name.trim(),
      });

      if (error) throw error;

      await goToOrg(String(data));
    } catch (e: any) {
      setMsg(e.message ?? "Something went wrong.");
    }
  }

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-4xl">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="mb-5 inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-slate-50 active:scale-[.98]"
        >
          Back
        </button>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-gradient-to-br from-amber-300 to-amber-200 px-5 py-6 text-white sm:px-8">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-100">
              Workspace
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              Choose Organization
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-amber-50">
              Create a new business workspace or continue with an existing
              organization.
            </p>
          </div>

          <div className="grid gap-6 p-5 sm:p-8 lg:grid-cols-[1fr_1.2fr]">
            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <h2 className="text-lg font-black text-slate-950">
                Create new organization
              </h2>

              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                Use your business name so it is easy to identify later.
              </p>

              <div className="mt-5 space-y-3">
                <input
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                  placeholder="e.g. BeeShop Nairobi"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />

                {msg ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                    {msg}
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={createOrg}
                  className="w-full rounded-2xl bg-amber-500 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-amber-600 active:scale-[.98]"
                >
                  Create organization
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-slate-950">
                    Your organizations
                  </h2>

                  <p className="mt-1 text-sm text-slate-600">
                    Select where you want to continue working.
                  </p>
                </div>

                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                  {orgs.length}
                </span>
              </div>

              <div className="mt-5 grid gap-3">
                {orgs.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-medium text-slate-600">
                    No organizations yet. Create one using the form.
                  </div>
                ) : (
                  orgs.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => goToOrg(o.id)}
                      className="group rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-amber-300 hover:bg-amber-50/60 active:scale-[.99]"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate text-base font-black text-slate-950">
                            {o.name}
                          </p>

                          <p className="mt-1 truncate text-xs font-medium text-slate-500">
                            {o.id}
                          </p>
                        </div>

                        <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 group-hover:bg-amber-100 group-hover:text-amber-900">
                          Open
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </section>
          </div>
        </section>

        
      </div>
    </main>
  );
}