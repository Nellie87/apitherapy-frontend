"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

const BeeSVG = () => (
  <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" style={{ width: 56, height: 56, animation: "float 4s ease-in-out infinite" }}>
    <ellipse cx="18" cy="26" rx="13" ry="7" fill="rgba(255,255,255,0.6)" style={{ transformOrigin: "center", animation: "wingFlap 0.14s ease-in-out infinite" }} />
    <ellipse cx="46" cy="26" rx="13" ry="7" fill="rgba(255,255,255,0.6)" style={{ transformOrigin: "center", animation: "wingFlap 0.14s ease-in-out infinite", animationDelay: "0.07s" }} />
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
  <svg xmlns="http://www.w3.org/2000/svg" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.08, pointerEvents: "none" }}>
    <defs>
      <pattern id="hexlogin" x="0" y="0" width="56" height="100" patternUnits="userSpaceOnUse" patternTransform="scale(1.6)">
        <polygon points="28,2 54,16 54,44 28,58 2,44 2,16" fill="none" stroke="#1a1a0a" strokeWidth="0.8" />
        <polygon points="28,52 54,66 54,94 28,108 2,94 2,66" fill="none" stroke="#1a1a0a" strokeWidth="0.8" />
        <polygon points="56,27 82,41 82,69 56,83 30,69 30,41" fill="none" stroke="#1a1a0a" strokeWidth="0.8" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#hexlogin)" />
  </svg>
);

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [msg, setMsg] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setMsg("");
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMsg("Check your email to confirm your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = "/dashboard";
      }
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=DM+Sans:wght@300;400;500&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          font-family: 'DM Sans', sans-serif;
          font-weight: 300;
        }

        .login-page {
          min-height: 100vh;
          display: grid;
          place-items: center;
          background: linear-gradient(135deg, #FFF9DC 0%, #FFEE88 38%, #FFF8D0 70%, #FFFEF8 100%);
          position: relative;
          overflow: hidden;
          padding: 1.5rem;
        }

        .glow {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
        }

        .glow-1 {
          width: 500px; height: 500px;
          top: -120px; right: -100px;
          background: radial-gradient(circle, rgba(245,197,24,0.4) 0%, transparent 65%);
          filter: blur(60px);
        }

        .glow-2 {
          width: 300px; height: 300px;
          bottom: -60px; left: -60px;
          background: radial-gradient(circle, rgba(58,125,68,0.1) 0%, transparent 70%);
          filter: blur(50px);
        }

        .card {
          position: relative;
          width: 100%;
          max-width: 420px;
          background: rgba(255, 255, 255, 0.88);
          backdrop-filter: blur(20px);
          border: 1.5px solid rgba(245,197,24,0.45);
          border-radius: 4px;
          padding: 2.8rem 2.4rem;
          box-shadow: 0 20px 60px rgba(26,26,10,0.1), 0 4px 16px rgba(245,197,24,0.15);
          z-index: 1;
          animation: fadeUp 0.6s ease both;
        }

        .card-top-bar {
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          background: linear-gradient(90deg, #F5C518, #FFE566, #F5C518);
          border-radius: 4px 4px 0 0;
        }

        .card-brand {
          display: flex;
          align-items: center;
          gap: 0.7rem;
          margin-bottom: 1.8rem;
        }

        .brand-name {
          font-family: 'Playfair Display', serif;
          font-size: 1.6rem;
          font-weight: 700;
          color: #1a1a0a;
          line-height: 1;
        }

        .brand-name em {
          font-style: italic;
          color: #3a7d44;
        }

        .card-subtitle {
          font-size: 0.88rem;
          color: #7a7a55;
          font-weight: 300;
          margin-top: 0.25rem;
        }

        .divider {
          height: 1px;
          background: rgba(245,197,24,0.3);
          margin: 1.6rem 0;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.9rem;
        }

        .input-wrap {
          position: relative;
        }

        .input-icon {
          position: absolute;
          left: 0.9rem;
          top: 50%;
          transform: translateY(-50%);
          font-size: 0.95rem;
          pointer-events: none;
          opacity: 0.5;
        }

        .field {
          width: 100%;
          background: #FFFEF5;
          border: 1.5px solid rgba(26,26,10,0.12);
          border-radius: 2px;
          padding: 0.75rem 0.9rem 0.75rem 2.4rem;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.9rem;
          font-weight: 300;
          color: #1a1a0a;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .field::placeholder { color: #aaa990; }

        .field:focus {
          border-color: #F5C518;
          box-shadow: 0 0 0 3px rgba(245,197,24,0.18);
          background: #FFFFFF;
        }

        .msg-error {
          font-size: 0.8rem;
          color: #c0392b;
          padding: 0.6rem 0.8rem;
          background: rgba(192,57,43,0.06);
          border-left: 2px solid #c0392b;
          border-radius: 2px;
        }

        .msg-success {
          font-size: 0.8rem;
          color: #3a7d44;
          padding: 0.6rem 0.8rem;
          background: rgba(58,125,68,0.06);
          border-left: 2px solid #3a7d44;
          border-radius: 2px;
        }

        .btn-submit {
          width: 100%;
          background: #1a1a0a;
          color: #F5C518;
          border: none;
          border-radius: 2px;
          padding: 0.85rem;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.88rem;
          font-weight: 500;
          letter-spacing: 0.07em;
          cursor: pointer;
          transition: all 0.22s;
          margin-top: 0.3rem;
          position: relative;
          overflow: hidden;
        }

        .btn-submit::before {
          content: '';
          position: absolute;
          inset: 0;
          background: #F5C518;
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 0.3s ease;
          z-index: 0;
        }

        .btn-submit:hover::before { transform: scaleX(1); }
        .btn-submit:hover { color: #1a1a0a; }
        .btn-submit span { position: relative; z-index: 1; }

        .btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }

        .btn-toggle {
          width: 100%;
          background: none;
          border: none;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.82rem;
          color: #7a7a55;
          cursor: pointer;
          padding: 0.4rem;
          transition: color 0.2s;
          font-weight: 400;
        }

        .btn-toggle:hover { color: #3a7d44; }

        .btn-toggle strong { color: #1a1a0a; font-weight: 500; }

        .leaf-decor {
          position: absolute;
          pointer-events: none;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(-4deg); }
          50% { transform: translateY(-14px) rotate(4deg); }
        }

        @keyframes wingFlap {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(0.18) scaleX(1.1); }
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .spinner {
          display: inline-block;
          width: 14px; height: 14px;
          border: 2px solid rgba(245,197,24,0.4);
          border-top-color: #F5C518;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
          vertical-align: middle;
          margin-right: 6px;
        }
      `}</style>

      <div className="login-page">
        <div className="glow glow-1" />
        <div className="glow glow-2" />
        <HexBg />

        {/* floating leaf decorations */}
        <svg className="leaf-decor" style={{ bottom: "12%", left: "4%", width: 52, transform: "rotate(12deg)", opacity: 0.6 }} viewBox="0 0 40 60">
          <path d="M20 58 C20 58 2 40 2 22 C2 10 10 2 20 2 C30 2 38 10 38 22 C38 40 20 58 20 58Z" fill="#3a7d44" opacity="0.7" />
          <line x1="20" y1="2" x2="20" y2="58" stroke="#2d6035" strokeWidth="1.5" opacity="0.4" />
        </svg>
        <svg className="leaf-decor" style={{ top: "8%", right: "6%", width: 36, transform: "rotate(-30deg)", opacity: 0.45 }} viewBox="0 0 40 60">
          <path d="M20 58 C20 58 2 40 2 22 C2 10 10 2 20 2 C30 2 38 10 38 22 C38 40 20 58 20 58Z" fill="#3a7d44" opacity="0.7" />
          <line x1="20" y1="2" x2="20" y2="58" stroke="#2d6035" strokeWidth="1.5" opacity="0.4" />
        </svg>

        <div className="card">
          <div className="card-top-bar" />

          <div className="card-brand">
            <BeeSVG />
            <div>
              <div className="brand-name">Hex<em>hive</em></div>
              <div className="card-subtitle">
                {mode === "login" ? "Welcome back" : "Join the hive"}
              </div>
            </div>
          </div>

          <div className="divider" />

          <div className="form-group">
            <div className="input-wrap">
              <span className="input-icon">✉️</span>
              <input
                className="field"
                placeholder="Email address"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
              />
            </div>

            <div className="input-wrap">
              <span className="input-icon">🔑</span>
              <input
                className="field"
                placeholder="Password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
              />
            </div>

            {msg && (
              <div className={msg.toLowerCase().includes("check") || msg.toLowerCase().includes("success") ? "msg-success" : "msg-error"}>
                {msg}
              </div>
            )}

            <button className="btn-submit" onClick={handleSubmit} disabled={loading}>
              <span>
                {loading && <span className="spinner" />}
                {mode === "login" ? "Sign in" : "Create account"}
              </span>
            </button>

            <button className="btn-toggle" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMsg(""); }}>
              {mode === "login"
                ? <>No account? <strong>Sign up free</strong></>
                : <>Already a member? <strong>Sign in</strong></>}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}