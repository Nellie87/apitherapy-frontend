"use client";

import { useEffect, useState } from "react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export default function AuthConfirmPage() {
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [msg, setMsg] = useState("Preparing your workspace...");
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function confirmAuthLink() {
      const supabase = createClient();
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const token_hash = url.searchParams.get("token_hash");
      const typeParam = url.searchParams.get("type");
      const next = url.searchParams.get("next");
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));

      let recovery =
        typeParam === "recovery" ||
        hash.get("type") === "recovery" ||
        next === "/reset-password";

      setIsRecovery(recovery);

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") {
          recovery = true;
        }
      });

      try {
        // Supabase email links (PKCE): ?token_hash=...&type=recovery|invite
        if (token_hash && typeParam) {
          const { error } = await supabase.auth.verifyOtp({
            type: typeParam as EmailOtpType,
            token_hash,
          });
          if (error) throw error;
          if (typeParam === "recovery") recovery = true;
        } else if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else {
          const access_token = hash.get("access_token");
          const refresh_token = hash.get("refresh_token");

          if (!access_token || !refresh_token) {
            throw new Error(
              recovery
                ? "This password reset link is invalid or has expired. Please request a new one from the login page."
                : "This invite link is missing details. Please request a new invite."
            );
          }

          const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (error) throw error;

          if (hash.get("type") === "recovery") {
            recovery = true;
          }
        }

        if (cancelled) return;

        setIsRecovery(recovery);

        const destination = recovery
          ? next || "/reset-password"
          : next || "/set-password";

        window.history.replaceState(null, "", "/auth/confirm");
        window.location.href = destination;
      } catch (e: unknown) {
        if (cancelled) return;
        setIsRecovery(recovery);
        setStatus("error");
        setMsg(
          e instanceof Error
            ? e.message
            : "Something went wrong with this link."
        );
      } finally {
        subscription.unsubscribe();
      }
    }

    confirmAuthLink();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F5F7FB] px-4">
      <div className="absolute -top-32 -left-32 h-72 w-72 rounded-full bg-amber-200/40 blur-3xl" />
      <div className="absolute -bottom-32 -right-32 h-72 w-72 rounded-full bg-yellow-300/30 blur-3xl" />

      <section className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-3xl">
          {status === "loading" ? "🍯" : "!"}
        </div>

        <h1 className="mt-6 text-2xl font-black tracking-tight text-slate-950">
          {status === "loading"
            ? isRecovery
              ? "Confirming reset"
              : "Confirming invite"
            : isRecovery
              ? "Reset issue"
              : "Invite issue"}
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-500">{msg}</p>

        {status === "loading" ? (
          <div className="mt-7 flex items-center justify-center gap-2 text-sm font-semibold text-amber-700">
            <span className="h-2 w-2 animate-bounce rounded-full bg-amber-500" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-amber-500 [animation-delay:120ms]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-amber-500 [animation-delay:240ms]" />
          </div>
        ) : (
          <a
            href="/login"
            className="mt-7 inline-flex rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-amber-600"
          >
            Back to login
          </a>
        )}
      </section>
    </main>
  );
}
