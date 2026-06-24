"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import "../login/login.css";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="login-page mode-login">
      <div className="top-accent" />

      <section className="auth-card reset-card">
        <div className="card-top-bar" />

        <p className="card-kicker">Account Recovery</p>

        <h4 className="card-title">Set New Password</h4>

        <p className="card-subtitle">
          Enter a new password for your Pollinator Beekeeping &amp; Apitherapy account.
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
  );
}