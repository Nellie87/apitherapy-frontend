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

      setOrgId(data);
      const role = await fetchMyOrgRole(String(data));
      window.location.href =
        role === "sales_clerk" ? "/dashboard/sales" : "/dashboard/products";
    } catch (e: any) {
      setMsg(e.message ?? "Something went wrong.");
    }
  }

  return (
    <div className="min-h-screen bg-zinc-100 p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="bg-white border rounded-2xl p-6 shadow">
          <div className="text-2xl font-black">Choose Organization</div>
          <div className="text-sm text-zinc-500 mt-1">
            Create a new business or select an existing one.
          </div>

          <div className="mt-5 flex gap-2">
            <input
              className="w-full border rounded-xl px-3 py-2"
              placeholder="New organization name e.g. BeeShop Nairobi"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button
              className="bg-amber-500 text-white px-4 py-2 rounded-xl font-semibold"
              onClick={createOrg}
            >
              Create
            </button>
          </div>

          {msg ? <div className="text-sm text-rose-600 mt-2">{msg}</div> : null}
        </div>

        <div className="bg-white border rounded-2xl p-6 shadow">
          <div className="text-lg font-black">Your Organizations</div>

          <div className="mt-4 grid gap-3">
            {orgs.length === 0 ? (
              <div className="text-sm text-zinc-500">
                No orgs yet. Create one above.
              </div>
            ) : (
              orgs.map((o) => (
                <button
                  key={o.id}
                  className="border rounded-2xl p-4 hover:bg-zinc-50 text-left"
                  onClick={async () => {
                    setOrgId(o.id);
                    try {
                      const role = await fetchMyOrgRole(String(o.id));
                      window.location.href =
                        role === "sales_clerk" ? "/dashboard/sales" : "/dashboard/products";
                    } catch {
                      window.location.href = "/dashboard/products";
                    }
                  }}
                >
                  <div className="font-bold">{o.name}</div>
                  <div className="text-xs text-zinc-500">{o.id}</div>
                </button>
              ))
            )}
          </div>
        </div>

        <button
          className="text-sm text-zinc-700 underline"
          onClick={async () => {
            const supabase = createClient();
            await supabase.auth.signOut();
            window.location.href = "/login";
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );
}