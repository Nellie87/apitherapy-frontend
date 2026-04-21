"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const BeeSVG = () => (
  <svg
    viewBox="0 0 64 64"
    xmlns="http://www.w3.org/2000/svg"
    style={{ width: 52, height: 52, animation: "float 4.2s ease-in-out infinite" }}
  >
    <ellipse cx="18" cy="26" rx="13" ry="7" fill="rgba(255,255,255,0.72)"
      style={{ transformOrigin: "center", animation: "wingFlap 0.14s ease-in-out infinite" }} />
    <ellipse cx="46" cy="26" rx="13" ry="7" fill="rgba(255,255,255,0.72)"
      style={{ transformOrigin: "center", animation: "wingFlap 0.14s ease-in-out infinite", animationDelay: "0.07s" }} />
    <ellipse cx="32" cy="34" rx="12" ry="16" fill="#F5C518" />
    <rect x="20" y="30" width="24" height="5" rx="2" fill="#1a1a0a" opacity="0.92" />
    <rect x="20" y="39" width="24" height="5" rx="2" fill="#1a1a0a" opacity="0.92" />
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
  <svg xmlns="http://www.w3.org/2000/svg"
    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.06, pointerEvents: "none" }}>
    <defs>
      <pattern id="hexlogin" x="0" y="0" width="56" height="100"
        patternUnits="userSpaceOnUse" patternTransform="scale(1.5)">
        <polygon points="28,2 54,16 54,44 28,58 2,44 2,16" fill="none" stroke="#1f2937" strokeWidth="0.8" />
        <polygon points="28,52 54,66 54,94 28,108 2,94 2,66" fill="none" stroke="#1f2937" strokeWidth="0.8" />
        <polygon points="56,27 82,41 82,69 56,83 30,69 30,41" fill="none" stroke="#1f2937" strokeWidth="0.8" />
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
        router.push("/dashboard/summarydashboard");
      }
    } catch (e: any) {
      setMsg(e?.message || "An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const isSuccess = msg.includes("Check") || msg.toLowerCase().includes("success");

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;700;800;900&family=Inter:wght@400;500;600;700&display=swap');

        :root {
          --bg: #ffffff;
          --card: rgba(255,255,255,0.82);
          --text: #1c1917;
          --muted: #78716c;
          --line: #e7e5e4;
          --amber: #f59e0b;
          --amber-deep: #b45309;
          --green: #16a34a;
          --error: #dc2626;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body {
          background: var(--bg);
          color: var(--text);
          font-family: 'Inter', system-ui, sans-serif;
          line-height: 1.65;
        }
        h1, h2, h3 { font-family: 'Playfair Display', serif; }

        /* ── Page shell ── */
        .login-page {
          position: relative;
          min-height: 100vh;
          display: grid;
          place-items: center;
          overflow: hidden;
          padding: 32px 20px;
          background:
            radial-gradient(circle at top left,  rgba(251,191,36,0.18), transparent 34%),
            radial-gradient(circle at top right, rgba(96,165,250,0.12), transparent 28%),
            radial-gradient(circle at bottom center, rgba(251,191,36,0.10), transparent 26%),
            linear-gradient(180deg, #ffffff 0%, #fffdf8 54%, #ffffff 100%);
        }

        .top-accent {
          position: fixed; top: 0; left: 0; right: 0; height: 3px;
          background: linear-gradient(90deg, #f59e0b, #fde68a, #f59e0b);
          z-index: 30;
        }

        .glow {
          position: absolute; border-radius: 999px;
          pointer-events: none; filter: blur(80px);
        }
        .glow-1 { width:520px; height:520px; top:-120px; left:-120px; background:rgba(251,191,36,0.20); }
        .glow-2 { width:420px; height:420px; right:-100px; top:80px; background:rgba(96,165,250,0.15); }
        .glow-3 { width:440px; height:440px; bottom:-140px; left:20%; background:rgba(251,191,36,0.12); }

        /* ── Two-column shell ── */
        .shell {
          position: relative; z-index: 2;
          width: 100%; max-width: 1180px;
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 40px;
          align-items: center;
        }

        /* ── LEFT column: stacked copy → card ── */
        .showcase {
          display: flex;
          flex-direction: column;
          gap: 36px;
          padding: 20px 0;
        }

        /* Hero copy block */
        .hero-copy { position: relative; }

        .eyebrow {
          display: inline-flex; align-items: center; gap: 10px;
          border-radius: 999px; border: 1px solid #fde68a;
          background: #fffaf0; color: #b45309;
          padding: 8px 14px; font-size: 11px; font-weight: 800;
          letter-spacing: 0.28em; text-transform: uppercase;
          margin-bottom: 20px;
        }
        .eyebrow-dot {
          width: 8px; height: 8px; border-radius: 999px;
          background: #f59e0b; box-shadow: 0 0 0 6px rgba(245,158,11,0.16);
        }

        .hero-title {
          font-size: clamp(2.2rem, 4vw, 4rem);
          line-height: 1.0; letter-spacing: -0.03em;
          color: var(--text); font-weight: 900; max-width: 14ch;
        }
        .hero-title .accent { color: #d97706; }

        .hero-desc {
          max-width: 46ch; margin-top: 18px;
          font-size: 15px; line-height: 1.85; color: var(--muted);
        }

        .stats {
          display: flex; flex-wrap: wrap; gap: 10px; margin-top: 22px;
        }
        .stat {
          display: flex; align-items: baseline; gap: 8px;
          padding: 10px 14px; border-radius: 16px;
          background: rgba(255,255,255,0.86); border: 1px solid var(--line);
          box-shadow: 0 4px 14px rgba(28,25,23,0.05);
        }
        .stat strong { font-size: 14px; font-weight: 800; color: var(--text); }
        .stat span   { font-size: 11px; color: #a8a29e; font-weight: 600; }

        /* Product card */
        .showcase-card {
          position: relative;
          width: 100%; max-width: 360px;
          border-radius: 30px; padding: 14px;
          background: linear-gradient(180deg, rgba(255,255,255,0.88), rgba(255,255,255,0.96));
          border: 1px solid rgba(255,255,255,0.9);
          box-shadow: 0 24px 64px rgba(28,25,23,0.12), 0 6px 24px rgba(245,158,11,0.10);
          backdrop-filter: blur(22px); -webkit-backdrop-filter: blur(22px);
        }

        .product-panel {
          overflow: hidden; border-radius: 22px;
          background: linear-gradient(180deg, #fffaf0 0%, #fef3c7 100%);
          padding: 20px 20px 18px;
        }

        .product-badge {
          display: inline-flex; align-items: center; gap: 8px;
          border-radius: 999px;
          background: linear-gradient(90deg, #fbbf24, #f59e0b);
          color: #451a03; padding: 7px 12px;
          font-size: 10px; font-weight: 800;
          letter-spacing: 0.22em; text-transform: uppercase;
        }

        .product-visual {
          position: relative;
          min-height: 220px;
          display: flex; align-items: flex-end; justify-content: center;
          padding-top: 8px;
        }

        .product-shadow {
          position: absolute; bottom: 8px;
          width: 150px; height: 38px; border-radius: 999px;
          background: rgba(245,158,11,0.16); filter: blur(22px);
        }

        .jar {
          position: relative; z-index: 2;
          width: 190px; max-width: 100%;
          animation: float 5s ease-in-out infinite;
          filter: drop-shadow(0 16px 24px rgba(120,76,5,0.22));
        }

        .product-meta {
          display: flex; align-items: flex-end;
          justify-content: space-between; gap: 16px; margin-top: 10px;
        }
        .kicker { font-size: 10px; font-weight: 800; letter-spacing: 0.30em; text-transform: uppercase; color: #b45309; }
        .product-title { margin-top: 4px; font-size: 26px; line-height: 1.0; font-weight: 800; color: var(--text); }
        .price-wrap { text-align: right; }
        .price-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.18em; color: #a8a29e; }
        .price { font-size: 26px; font-weight: 800; color: var(--text); }

        /* Floating notes — positioned relative to the card, NOT the page */
        .notes-layer {
          position: relative;
          height: 0; /* zero-height so it doesn't push layout */
          pointer-events: none;
        }

        .floating-note {
          position: absolute;
          width: 154px;
          border-radius: 20px; border: 1px solid var(--line);
          background: rgba(255,255,255,0.92);
          box-shadow: 0 10px 28px rgba(28,25,23,0.08);
          backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
          padding: 14px;
          pointer-events: auto;
        }
        .floating-note h4 { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.28em; margin-bottom: 6px; }
        .floating-note p  { font-size: 11.5px; line-height: 1.6; color: var(--muted); }

        .note-one   { top: -260px; right: -60px; transform: rotate(6deg); }
        .note-two   { top: -160px; left: -60px;  transform: rotate(-4deg); }
        .note-three { top: -60px;  right: -55px;  transform: rotate(3deg); background: rgba(239,246,255,0.94); border-color: #dbeafe; }

        /* ── RIGHT column: auth card ── */
        .auth-col {
          display: flex; justify-content: center; align-items: center;
        }

        .auth-card {
          position: relative; width: 100%; max-width: 450px;
          background: var(--card);
          border: 1px solid rgba(255,255,255,0.86);
          border-radius: 32px; padding: 28px 28px 24px;
          box-shadow: 0 20px 60px rgba(28,25,23,0.10), 0 8px 28px rgba(245,158,11,0.08);
          backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
          animation: fadeUp 0.7s ease both;
        }
        .auth-card::before {
          content: ""; position: absolute; inset: 0;
          border-radius: 32px; padding: 1px;
          background: linear-gradient(180deg, rgba(255,255,255,0.95), rgba(253,230,138,0.35));
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor; mask-composite: exclude;
          pointer-events: none;
        }

        .card-top-line {
          position: absolute; top: 0; left: 18px; right: 18px;
          height: 4px; border-radius: 999px;
          background: linear-gradient(90deg, #f59e0b, #fde68a, #f59e0b);
        }

        .card-brand { display: flex; align-items: center; gap: 14px; margin-bottom: 18px; }
        .card-mini  { font-size: 10px; font-weight: 800; letter-spacing: 0.30em; text-transform: uppercase; color: #d97706; }
        .card-title { font-family: 'Playfair Display', serif; font-size: 30px; line-height: 1.05; font-weight: 800; color: var(--text); margin-top: 4px; }
        .card-subtitle { margin-top: 6px; font-size: 14px; color: var(--muted); }

        .divider { height: 1px; margin: 18px 0 20px; background: linear-gradient(90deg, transparent, rgba(245,158,11,0.28), transparent); }

        .form-group { display: flex; flex-direction: column; gap: 14px; }

        .field { display: flex; flex-direction: column; gap: 7px; }
        .field label { font-size: 12px; font-weight: 700; color: #57534e; letter-spacing: 0.02em; }

        .input-group { position: relative; }
        .input-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); font-size: 15px; color: #a8a29e; pointer-events: none; }

        input {
          width: 100%; background: rgba(255,255,255,0.88);
          border: 1px solid var(--line); border-radius: 16px;
          padding: 14px 14px 14px 44px;
          font-size: 15px; color: var(--text); outline: none;
          transition: all 0.22s ease;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.55);
        }
        input:focus { border-color: #f59e0b; background: #fff; box-shadow: 0 0 0 4px rgba(245,158,11,0.14); }
        input::placeholder { color: #a8a29e; }

        .message { font-size: 13.5px; padding: 12px 14px; border-radius: 16px; border: 1px solid transparent; line-height: 1.6; }
        .message.error   { background: rgba(220,38,38,0.06); border-color: rgba(220,38,38,0.12); color: #b91c1c; }
        .message.success { background: rgba(22,163,74,0.06);  border-color: rgba(22,163,74,0.12);  color: #15803d; }

        .btn-submit {
          width: 100%; border: none; border-radius: 16px;
          padding: 14px 18px; font-size: 14px; font-weight: 800;
          letter-spacing: 0.04em; color: #451a03;
          background: linear-gradient(180deg, #fbbf24, #f59e0b);
          box-shadow: 0 10px 24px rgba(245,158,11,0.22);
          cursor: pointer; transition: transform 0.22s ease, box-shadow 0.22s ease, filter 0.22s ease;
        }
        .btn-submit:hover   { transform: translateY(-1px); filter: brightness(1.02); box-shadow: 0 16px 32px rgba(245,158,11,0.28); }
        .btn-submit:disabled { opacity: 0.7; cursor: not-allowed; transform: none; }

        .switch-row { display: flex; justify-content: center; margin-top: 6px; }
        .toggle-btn { background: none; border: none; color: var(--muted); font-size: 14px; padding: 8px 10px; cursor: pointer; transition: color 0.2s ease; }
        .toggle-btn:hover { color: #44403c; }
        .toggle-btn strong { color: var(--text); font-weight: 700; }

        .micro-note { margin-top: 14px; text-align: center; font-size: 12px; color: #a8a29e; }

        .back-link {
          display: inline-flex; align-items: center; gap: 8px;
          margin-top: 18px; font-size: 13px; font-weight: 600;
          color: #78716c; text-decoration: none; transition: color 0.2s ease;
        }
        .back-link:hover { color: #d97706; }

        /* ── Keyframes ── */
        @keyframes float { 0%,100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-14px) rotate(2deg); } }
        @keyframes wingFlap { 0%,100% { transform: scaleY(1); } 50% { transform: scaleY(0.2) scaleX(1.1); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }

        /* ── Responsive ── */
        @media (max-width: 1080px) {
          .shell { grid-template-columns: 1fr; max-width: 540px; }
          .hero-copy { text-align: center; }
          .eyebrow { justify-content: center; }
          .hero-title, .hero-desc { margin-left: auto; margin-right: auto; }
          .stats { justify-content: center; }
          .showcase-card { margin: 0 auto; }
          .note-one, .note-two, .note-three { display: none; }
          .auth-col { justify-content: center; }
        }

        @media (max-width: 640px) {
          .login-page { padding: 20px 14px 28px; }
          .showcase-card { max-width: 320px; }
          .auth-card { border-radius: 26px; padding: 22px 18px; }
          .card-title { font-size: 26px; }
        }
      `}</style>

      <div className="login-page">
        <div className="top-accent" />
        <div className="glow glow-1" />
        <div className="glow glow-2" />
        <div className="glow glow-3" />
        <HexBg />

        <div className="shell">
          {/* ── LEFT: copy + product card ── */}
          <section className="showcase">
            {/* Hero copy */}
            <div className="hero-copy">
              <div className="eyebrow">
                <span className="eyebrow-dot" />
                Pure Honey · Beekeeping · Apitherapy
              </div>
              <h1 className="hero-title">
                Welcome<br />
                <span className="accent">Back</span>
              </h1>
              <p className="hero-desc">
                Sign in to manage your orders, explore bee products, and enjoy the best of Kenyan honey.
              </p>
              <div className="stats">
                <div className="stat"><strong>Kenya</strong><span>local brand</span></div>
                <div className="stat"><strong>Ruiru</strong><span>physical shop</span></div>
                <div className="stat"><strong>Honey+</strong><span>bee products</span></div>
              </div>
            </div>

            {/* Product card */}
            <div style={{ position: "relative" }}>
              <div className="showcase-card">
                <div className="product-panel">
                  <div className="product-badge">Local Favourite</div>
                  <div className="product-visual">
                    <div className="product-shadow" />
                    <img src="/images/honey.jpg" alt="Jar of honey" className="jar" />
                  </div>
                  <div className="product-meta">
                    <div>
                      <div className="kicker">Kenyan Honey · Natural</div>
                      <h3 className="product-title">Pure Raw<br />Honey</h3>
                    </div>
                    <div className="price-wrap">
                      <div className="price-label">from</div>
                      <div className="price">KSh 850</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes anchored to the card */}
              <div className="notes-layer">
                <div className="floating-note note-one">
                  <h4 style={{ color: "#d97706" }}>Natural taste</h4>
                  <p>Golden, rich, and made for tea, breakfast, and daily use.</p>
                </div>
                <div className="floating-note note-two">
                  <h4 style={{ color: "#d97706" }}>Apitherapy</h4>
                  <p>Honey, propolis, and bee-based products in one local brand.</p>
                </div>
                <div className="floating-note note-three">
                  <h4 style={{ color: "#2563eb" }}>Location</h4>
                  <p>Visit the Ruiru shop for a closer look at available products.</p>
                </div>
              </div>
            </div>
          </section>

          {/* ── RIGHT: auth card ── */}
          <div className="auth-col">
            <section className="auth-card">
              <div className="card-top-line" />

              <div className="card-brand">
                <BeeSVG />
                <div>
                  <div className="card-mini">Kenya · Ruiru</div>
                  <h2 className="card-title">Pollinator<br />Beekeeping & Apitherapy</h2>
                  <p className="card-subtitle">
                    {mode === "login"
                      ? "Sign in to continue your journey with us."
                      : "Create an account and join our growing community."}
                  </p>
                </div>
              </div>

              <div className="divider" />

              <div className="form-group">
                <div className="field">
                  <label htmlFor="email">Email address</label>
                  <div className="input-group">
                    <span className="input-icon">✉️</span>
                    <input
                      id="email" type="email" placeholder="you@example.com"
                      value={email} onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    />
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="password">Password</label>
                  <div className="input-group">
                    <span className="input-icon">🔑</span>
                    <input
                      id="password" type="password" placeholder="Enter your password"
                      value={password} onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    />
                  </div>
                </div>

                {msg && (
                  <div className={`message ${isSuccess ? "success" : "error"}`}>{msg}</div>
                )}

                <button className="btn-submit" onClick={handleSubmit} disabled={loading}>
                  {loading ? "Processing..." : mode === "login" ? "Sign In" : "Create Account"}
                </button>

                <div className="switch-row">
                  <button className="toggle-btn" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMsg(""); }}>
                    {mode === "login"
                      ? <> Don&apos;t have an account? <strong>Sign up</strong> </>
                      : <> Already have an account? <strong>Sign in</strong> </>}
                  </button>
                </div>

                <div className="micro-note">Pure honey, bee products, and a warm local experience.</div>
              </div>

              <a href="/" className="back-link">← Back to homepage</a>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}