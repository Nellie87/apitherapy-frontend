"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );

  async function handleSubmit() {
    setMsg(null);

    if (password.length < 8) {
      setMsg({ type: "err", text: "Password must be at least 8 characters." });
      return;
    }

    if (password !== confirmPassword) {
      setMsg({ type: "err", text: "Passwords do not match." });
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.updateUser({ password });

      if (error) throw error;

      setMsg({ type: "ok", text: "Password created. Taking you to your dashboard..." });

      setTimeout(() => {
        window.location.href = "/dashboard/summarydashboard";
      }, 900);
    } catch (e: any) {
      setMsg({
        type: "err",
        text: e?.message || "Could not create password. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F5F7FB] px-4 py-10">
      <div className="absolute -left-32 top-10 h-72 w-72 rounded-full bg-amber-200/40 blur-3xl" />
      <div className="absolute -right-32 bottom-10 h-72 w-72 rounded-full bg-yellow-300/30 blur-3xl" />

      <section className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl">
        <div className="h-2 bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500" />

        <div className="p-7 sm:p-8">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-amber-100 text-3xl shadow-sm">
            🔐
          </div>

          <div className="mt-6 text-center">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-amber-600">
              Staff Access
            </p>

            <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
              Create your password
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-500">
              Your invite has been accepted. Set a password so you can sign in
              normally next time.
            </p>
          </div>

          <div className="mt-7 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">
                New password
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                placeholder="Minimum 8 characters"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">
                Confirm password
              </span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                placeholder="Re-enter your password"
              />
            </label>

            {msg && (
              <div
                className={
                  msg.type === "ok"
                    ? "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"
                    : "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
                }
              >
                {msg.text}
              </div>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="w-full rounded-2xl bg-amber-500 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-amber-600 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
            >
              {loading ? "Creating password..." : "Create password"}
            </button>
          </div>

          <p className="mt-5 text-center text-xs leading-5 text-slate-400">
            Use this password with your email whenever you log in later.
          </p>
        </div>
      </section>
    </main>
  );
}