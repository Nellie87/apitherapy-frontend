"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const BeeSVG = () => (
  <svg
    viewBox="0 0 64 64"
    xmlns="http://www.w3.org/2000/svg"
    style={{ width: 56, height: 56, animation: "float 4s ease-in-out infinite" }}
  >
    <ellipse
      cx="18"
      cy="26"
      rx="13"
      ry="7"
      fill="rgba(255,255,255,0.65)"
      style={{ transformOrigin: "center", animation: "wingFlap 0.14s ease-in-out infinite" }}
    />
    <ellipse
      cx="46"
      cy="26"
      rx="13"
      ry="7"
      fill="rgba(255,255,255,0.65)"
      style={{
        transformOrigin: "center",
        animation: "wingFlap 0.14s ease-in-out infinite",
        animationDelay: "0.07s",
      }}
    />
    <ellipse cx="32" cy="34" rx="12" ry="16" fill="#F5C518" />
    <rect x="20" y="30" width="24" height="5" rx="2" fill="#1a1a0a" opacity="0.9" />
    <rect x="20" y="39" width="24" height="5" rx="2" fill="#1a1a0a" opacity="0.9" />
    <circle cx="32" cy="18" r="9" fill="#F5C518" />
    <circle cx="28" cy="15" r="2.5" fill="#1a1a0a" />
    <circle cx="36" cy="15" r="2.5" fill="#1a1a0a" />
    <circle cx="28.8" cy="14.2" r="0.8" fill="white" />
    <circle cx="36.8" cy="14.2" r="0.8" fill="white" />
    <line x1="28" y1="10" x2="22" y2="3" stroke="#1a1a0a" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="22" cy="3" r="2" fill="#F5C518" />
    <line x1="36" y1="10" x2="42" y2="3" stroke="#1a1a0a" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="42" cy="3" r="2" fill="#F5C518" />
    <polygon points="32,50 29,56 35,56" fill="#c89a00" />
  </svg>
);

const HexBg = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    style={{
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      opacity: 0.1,
      pointerEvents: "none",
    }}
  >
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
          stroke="#1a1a0a"
          strokeWidth="0.8"
        />
        <polygon
          points="28,52 54,66 54,94 28,108 2,94 2,66"
          fill="none"
          stroke="#1a1a0a"
          strokeWidth="0.8"
        />
        <polygon
          points="56,27 82,41 82,69 56,83 30,69 30,41"
          fill="none"
          stroke="#1a1a0a"
          strokeWidth="0.8"
        />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#hexlogin)" />
  </svg>
);

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setMsg("");
    setLoading(true);

    try {
      const supabase = createClient();
      if (mode === "signup") {
        
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMsg("Check your email to confirm your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/dashboard/dashboard/");
      }
    } catch (e: any) {
      setMsg(e.message || "An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;700;900&family=Inter:wght@300;400;500;600&display=swap');

        :root {
          --cream: #fdfaf5;
          --honey: #f8e8b0;
          --gold: #d4a017;
          --charcoal: #1f1f1b;
          --sage: #4a7048;
          --sage-dark: #3a5a38;
          --gray: #6b6b5e;
          --light-gray: #e8e5d9;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }

        body {
          background: var(--cream);
          color: var(--charcoal);
          font-family: 'Inter', system-ui, sans-serif;
          line-height: 1.65;
        }

        h1, h2, h3 { font-family: 'Playfair Display', serif; font-weight: 700; }

        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #FFF9DC 0%, #FFEE88 38%, #FFF8D0 70%, #FFFEF8 100%);
          position: relative;
          overflow: hidden;
          padding: 2rem;
        }

        .glow {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
        }

        .glow-1 {
          width: 600px;
          height: 600px;
          top: -150px;
          right: -120px;
          background: radial-gradient(circle, rgba(245,197,24,0.45) 0%, transparent 65%);
          filter: blur(80px);
        }

        .glow-2 {
          width: 400px;
          height: 400px;
          bottom: -100px;
          left: -100px;
          background: radial-gradient(circle, rgba(58,125,68,0.12) 0%, transparent 70%);
          filter: blur(60px);
        }

        .card {
          position: relative;
          width: 100%;
          max-width: 440px;
          background: rgba(255, 255, 255, 0.92);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1.5px solid rgba(245,197,24,0.4);
          border-radius: 12px;
          padding: 3rem 2.5rem;
          box-shadow: 0 20px 60px rgba(26,26,10,0.12), 0 8px 32px rgba(245,197,24,0.15);
          z-index: 2;
          animation: fadeUp 0.7s ease both;
        }

        .card-top-bar {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(90deg, var(--gold), var(--honey), var(--gold));
          border-radius: 12px 12px 0 0;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .brand-name {
          font-size: 2.1rem;
          font-weight: 900;
          letter-spacing: -0.02em;
          color: var(--charcoal);
        }

        .brand-name span {
          color: var(--sage);
        }

        .subtitle {
          font-size: 1rem;
          color: var(--gray);
          margin-top: 0.3rem;
        }

        .divider {
          height: 1px;
          background: rgba(245,197,24,0.35);
          margin: 1.8rem 0 2rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 1.4rem;
        }

        .input-group {
          position: relative;
        }

        .input-icon {
          position: absolute;
          left: 1.1rem;
          top: 50%;
          transform: translateY(-50%);
          font-size: 1.1rem;
          color: var(--gray);
          pointer-events: none;
        }

        input {
          width: 100%;
          background: #FFFEF5;
          border: 1.5px solid var(--light-gray);
          border-radius: 8px;
          padding: 0.95rem 1rem 0.95rem 3rem;
          font-size: 0.98rem;
          color: var(--charcoal);
          outline: none;
          transition: all 0.25s;
        }

        input:focus {
          border-color: var(--gold);
          box-shadow: 0 0 0 4px rgba(212,160,23,0.15);
          background: white;
        }

        input::placeholder {
          color: var(--gray);
        }

        .message {
          font-size: 0.9rem;
          padding: 0.8rem 1rem;
          border-radius: 6px;
          border-left: 4px solid;
        }

        .error {
          background: rgba(192,57,43,0.08);
          border-left-color: #c0392b;
          color: #c0392b;
        }

        .success {
          background: rgba(58,125,68,0.08);
          border-left-color: var(--sage);
          color: var(--sage);
        }

        .btn-submit {
          width: 100%;
          background: var(--charcoal);
          color: var(--gold);
          border: none;
          border-radius: 8px;
          padding: 1rem;
          font-size: 1rem;
          font-weight: 600;
          letter-spacing: 0.05em;
          cursor: pointer;
          transition: all 0.25s;
          position: relative;
          overflow: hidden;
        }

        .btn-submit:hover {
          background: var(--sage);
          color: white;
        }

        .btn-submit:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .toggle-btn {
          width: 100%;
          background: none;
          border: none;
          color: var(--gray);
          font-size: 0.95rem;
          padding: 0.6rem;
          cursor: pointer;
          transition: color 0.2s;
        }

        .toggle-btn:hover {
          color: var(--sage);
        }

        .toggle-btn strong {
          color: var(--charcoal);
          font-weight: 600;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(-3deg); }
          50% { transform: translateY(-16px) rotate(3deg); }
        }

        @keyframes wingFlap {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(0.2) scaleX(1.1); }
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 480px) {
          .card { padding: 2.2rem 1.8rem; }
          .brand-name { font-size: 1.8rem; }
        }
      `}</style>

      <div className="login-page">
        <div className="glow glow-1" />
        <div className="glow glow-2" />
        <HexBg />

        <div className="card">
          <div className="card-top-bar" />

          <div className="brand">
            <BeeSVG />
            <div>
              <div className="brand-name">
                Pollinators <span>Apitherapy</span>
              </div>
              <div className="subtitle">
                {mode === "login" ? "Welcome back to the hive" : "Join our community"}
              </div>
            </div>
          </div>

          <div className="divider" />

          <div className="form-group">
            <div className="input-group">
              <span className="input-icon">✉️</span>
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
            </div>

            <div className="input-group">
              <span className="input-icon">🔑</span>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
            </div>

            {msg && (
              <div className={`message ${msg.includes("Check") || msg.includes("success") ? "success" : "error"}`}>
                {msg}
              </div>
            )}

            <button className="btn-submit" onClick={handleSubmit} disabled={loading}>
              {loading ? "Processing..." : mode === "login" ? "Sign In" : "Create Account"}
            </button>

            <button
              className="toggle-btn"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setMsg("");
              }}
            >
              {mode === "login" ? (
                <>
                  Don&apos;t have an account? <strong>Sign up</strong>
                </>
              ) : (
                <>
                  Already have an account? <strong>Sign in</strong>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}