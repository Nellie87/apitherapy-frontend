"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import "./login.css";

/* ─── Hex watermark ─────────────────────────────────────────────── */
const HexBg = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="hex-bg">
    <defs>
      <pattern
        id="hexlogin"
        x="0"
        y="0"
        width="56"
        height="100"
        patternUnits="userSpaceOnUse"
        patternTransform="scale(1.5)"
      >
        <polygon
          points="28,2 54,16 54,44 28,58 2,44 2,16"
          fill="none"
          stroke="#1f2937"
          strokeWidth="0.8"
        />
        <polygon
          points="28,52 54,66 54,94 28,108 2,94 2,66"
          fill="none"
          stroke="#1f2937"
          strokeWidth="0.8"
        />
        <polygon
          points="56,27 82,41 82,69 56,83 30,69 30,41"
          fill="none"
          stroke="#1f2937"
          strokeWidth="0.8"
        />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#hexlogin)" />
  </svg>
);

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const isSignup = mode === "signup";
  const isSuccess =
    msg.toLowerCase().includes("check") ||
    msg.toLowerCase().includes("success");

  function switchMode(next: "login" | "signup") {
    setMode(next);
    setMsg("");
  }
  async function handleForgotPassword() {
  setMsg("");

  if (!email.trim()) {
    setMsg("Please enter your email address first.");
    return;
  }

  setLoading(true);

  try {
    const supabase = createClient();

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    if (error) throw error;

    setMsg("Check your email for the password reset link.");
  } catch (e: any) {
    setMsg(e?.message || "Could not send reset email. Please try again.");
  } finally {
    setLoading(false);
  }
}

  async function handleSubmit() {
    setMsg("");

    if (isSignup && !name.trim()) {
      setMsg("Please enter your full name.");
      return;
    }

    if (!email.trim()) {
      setMsg("Please enter your email address.");
      return;
    }

    if (!password.trim()) {
      setMsg("Please enter your password.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      if (isSignup) {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: name.trim(),
            },
          },
        });

        if (error) throw error;

        setMsg("Check your email to confirm your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;

        async function handleForgotPassword() {
  setMsg("");

  if (!email.trim()) {
    setMsg("Please enter your email address first.");
    return;
  }

  setLoading(true);

  try {
    const supabase = createClient();

   const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
  redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
    "/reset-password"
  )}`,
});

    if (error) throw error;

    setMsg("Check your email for the password reset link.");
  } catch (e: any) {
    setMsg(e?.message || "Could not send reset email. Please try again.");
  } finally {
    setLoading(false);
  }
}

window.location.href = "/dashboard/summarydashboard";      }
    } catch (e: any) {
      setMsg(e?.message || "An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`login-page ${isSignup ? "mode-signup" : "mode-login"}`}>
      <div className="top-accent" />

      <div className="glow glow-1" />
      <div className="glow glow-2" />
      <div className="glow glow-3" />

      <HexBg />

      <div className="shell">
        <section className="showcase">
          <div className="showcase-glow" />

          <div className="hero-copy">
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              Pure Honey · Beekeeping · Apitherapy
            </div>

            <h2 className="hero-title">
              {isSignup ? (
                <>
                  Join the <span>Hive.</span>
                </>
              ) : (
                <>
                  Back to the <span>Hive.</span>
                </>
              )}
            </h2>

            <p className="hero-desc">
              {isSignup
                ? "Create your account and start exploring pure honey, bee products, and apitherapy resources from our farm in Ruiru, Kenya."
                : "Sign in to manage your orders, track deliveries, and access exclusive honey-care guides from Pollinator Beekeeping & Apitherapy."}
            </p>

            <div className="stats">
              <div className="stat">
                <strong>100%</strong>
                <span>Raw honey</span>
              </div>
              <div className="stat">
                <strong>3 yrs</strong>
                <span>Beekeeping</span>
              </div>
              <div className="stat">
                <strong>Kenya</strong>
                <span>Ruiru farm</span>
              </div>
            </div>
          </div>
        </section>

        <section className="auth-card">
          <div className="card-top-bar" />

          <p className="card-kicker">Kenya · Ruiru</p>

          <h4 className="card-title">
            Pollinator Beekeeping &amp; Apitherapy
          </h4>

          <p className="card-subtitle">
            {isSignup
              ? "Create your account — it only takes a moment."
              : "Welcome back. Sign in to continue."}
          </p>

          <div
            className="mode-pill"
            role="tablist"
            aria-label="Authentication mode"
          >
            <button
              type="button"
              role="tab"
              aria-selected={!isSignup}
              className={`pill-btn ${!isSignup ? "active" : ""}`}
              onClick={() => switchMode("login")}
            >
              Sign In
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={isSignup}
              className={`pill-btn ${isSignup ? "active" : ""}`}
              onClick={() => switchMode("signup")}
            >
              Create Account
            </button>
          </div>

          <div className="divider" />

          <div className="form-group">
            {isSignup && (
              <div className="field">
                <label htmlFor="name">Full name</label>
                <div className="input-group">
                  <input
                    id="name"
                    type="text"
                    placeholder="Jane Wanjiku"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  />
                </div>
              </div>
            )}

            <div className="field">
              <label htmlFor="email">Email address</label>
              <div className="input-group">
                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <div className="input-group">
                <input
                  id="password"
                  type="password"
                  placeholder={
                    isSignup ? "Choose a strong password" : "Enter your password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                />
              </div>

             {!isSignup && (
    <button
      type="button"
      className="forgot-link"
      onClick={handleForgotPassword}
      disabled={loading}
    >
      Forgot password?
    </button>
  )}
            </div>

            {msg && (
              <div className={`message ${isSuccess ? "success" : "error"}`}>
                {msg}
              </div>
            )}

            <button
              type="button"
              className="btn-submit"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading
                ? "Processing..."
                : isSignup
                  ? "Create My Account"
                  : "Sign In"}
            </button>

            <p className="micro-note">
              Pure honey, bee products, and a warm local experience.
            </p>
          </div>

          <a href="/" className="back-link">
            Back to homepage
          </a>
        </section>
      </div>
    </div>
  );
}
