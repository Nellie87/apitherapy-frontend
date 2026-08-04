"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import "../login/login.css";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function establishRecoverySession() {
      const supabase = createClient();
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const token_hash = url.searchParams.get("token_hash");
      const type = url.searchParams.get("type");
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));

      try {
        if (token_hash && type) {
          const { error } = await supabase.auth.verifyOtp({
            type: type as "recovery",
            token_hash,
          });
          if (error) throw error;
          window.history.replaceState(null, "", "/reset-password");
        } else if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          window.history.replaceState(null, "", "/reset-password");
        } else if (hash.get("access_token") && hash.get("refresh_token")) {
          const { error } = await supabase.auth.setSession({
            access_token: hash.get("access_token")!,
            refresh_token: hash.get("refresh_token")!,
          });
          if (error) throw error;
          window.history.replaceState(null, "", "/reset-password");
        } else {
          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (!session) {
            throw new Error(
              "This password reset link is invalid or has expired. Please request a new one from the login page."
            );
          }
        }

        if (!cancelled) setReady(true);
      } catch (e: unknown) {
        if (cancelled) return;
        setLinkError(
          e instanceof Error
            ? e.message
            : "Could not verify your reset link. Please request a new one."
        );
      }
    }

    establishRecoverySession();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleResetPassword() {
    setMsg("");

    if (!password.trim()) {
      setMsg("Please enter your new password.");
      return;
    }

    if (password.length < 6) {
      setMsg("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setMsg("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) throw error;

      setMsg("Password updated successfully. Redirecting...");

      setTimeout(() => {
        router.push("/login");
      }, 1200);
    } catch (e: any) {
      setMsg(e?.message || "Could not update password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const isSuccess = msg.toLowerCase().includes("success");

  if (linkError) {
    return (
      <div className="login-page mode-login">
        <div className="top-accent" />
        <div className="shell reset-shell">
          <section className="auth-card">
            <div className="card-top-bar" />
            <p className="card-kicker">Account Recovery</p>
            <h4 className="card-title">Reset link issue</h4>
            <p className="card-subtitle">{linkError}</p>
            <div className="divider" />
            <a href="/login" className="back-link">
              Back to sign in
            </a>
          </section>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="login-page mode-login">
        <div className="top-accent" />
        <div className="shell reset-shell">
          <section className="auth-card">
            <div className="card-top-bar" />
            <p className="card-kicker">Account Recovery</p>
            <h4 className="card-title">Verifying reset link...</h4>
            <p className="card-subtitle">
              Please wait while we confirm your password reset request.
            </p>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page mode-login">
      <div className="top-accent" />

      <div className="shell reset-shell">
        <section className="auth-card">
          <div className="card-top-bar" />

          <p className="card-kicker">Account Recovery</p>

          <h4 className="card-title">Set New Password</h4>

          <p className="card-subtitle">
            Enter a new password for your Pollinator Beekeeping &amp; Apitherapy
            account.
          </p>

          <div className="divider" />

          <div className="form-group">
            <div className="field">
              <label htmlFor="password">New password</label>
              <div className="input-group">
                <input
                  id="password"
                  type="password"
                  placeholder="Enter your new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleResetPassword()}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="confirmPassword">Confirm password</label>
              <div className="input-group">
                <input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleResetPassword()}
                />
              </div>
            </div>

            {msg && (
              <div className={`message ${isSuccess ? "success" : "error"}`}>
                {msg}
              </div>
            )}

            <button
              type="button"
              className="btn-submit"
              onClick={handleResetPassword}
              disabled={loading}
            >
              {loading ? "Updating..." : "Update Password"}
            </button>
          </div>

          <a href="/login" className="back-link">
            Back to sign in
          </a>
        </section>
      </div>
    </div>
  );
}
