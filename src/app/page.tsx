"use client";

import { useEffect, useRef, useState } from "react";

// Hex pattern SVG component
const HexGrid = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="100%"
    height="100%"
    style={{ position: "absolute", inset: 0, opacity: 0.12, pointerEvents: "none" }}
  >
    <defs>
      <pattern id="hex" x="0" y="0" width="56" height="100" patternUnits="userSpaceOnUse" patternTransform="scale(1.5)">
        <polygon points="28,2 54,16 54,44 28,58 2,44 2,16" fill="none" stroke="#1a1a0a" strokeWidth="1" />
        <polygon points="28,52 54,66 54,94 28,108 2,94 2,66" fill="none" stroke="#1a1a0a" strokeWidth="1" />
        <polygon points="56,27 82,41 82,69 56,83 30,69 30,41" fill="none" stroke="#1a1a0a" strokeWidth="1" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#hex)" />
  </svg>
);

// Animated bee SVG
const BeeSVG = ({ style }: { style?: React.CSSProperties }) => (
  <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" style={style} className="bee-float">
    <ellipse cx="18" cy="26" rx="14" ry="8" fill="rgba(255,255,255,0.65)" className="wing wing-left" />
    <ellipse cx="46" cy="26" rx="14" ry="8" fill="rgba(255,255,255,0.65)" className="wing wing-right" />
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

// Leaf accent SVG
const LeafAccent = ({ style }: { style?: React.CSSProperties }) => (
  <svg viewBox="0 0 40 60" xmlns="http://www.w3.org/2000/svg" style={style}>
    <path d="M20 58 C20 58 2 40 2 22 C2 10 10 2 20 2 C30 2 38 10 38 22 C38 40 20 58 20 58Z" fill="#3a7d44" opacity="0.75" />
    <line x1="20" y1="2" x2="20" y2="58" stroke="#2d6035" strokeWidth="1.5" opacity="0.5" />
    <line x1="20" y1="20" x2="10" y2="30" stroke="#2d6035" strokeWidth="1" opacity="0.4" />
    <line x1="20" y1="30" x2="30" y2="40" stroke="#2d6035" strokeWidth="1" opacity="0.4" />
    <line x1="20" y1="15" x2="30" y2="25" stroke="#2d6035" strokeWidth="1" opacity="0.4" />
  </svg>
);

const products = [
  { id: 1, name: "Raw Wildflower Honey", desc: "Unfiltered, cold-extracted from free-ranging hives nestled in alpine meadows. Rich in enzymes and antioxidants.", price: "$24.99", badge: "Best Seller", icon: "🍯", accent: "green" },
  { id: 2, name: "Beeswax Candles", desc: "Hand-poured pure beeswax candles that purify the air while releasing a subtle honey fragrance. 40+ hour burn time.", price: "$18.99", badge: "Eco Choice", icon: "🕯️", accent: "black" },
  { id: 3, name: "Royal Jelly Capsules", desc: "Premium freeze-dried royal jelly concentrated for maximum bioavailability. Nature's most potent superfood.", price: "$39.99", badge: "Premium", icon: "💎", accent: "green" },
  { id: 4, name: "Propolis Tincture", desc: "Ethanol-extracted propolis from a single origin apiary. Nature's powerful antimicrobial defender.", price: "$29.99", badge: "Immunity", icon: "🌿", accent: "black" },
  { id: 5, name: "Honeycomb Slabs", desc: "Raw comb honey served in pure beeswax — eat the whole thing. Wildflower, clover or buckwheat varieties.", price: "$34.99", badge: "Artisan", icon: "🧇", accent: "green" },
  { id: 6, name: "Bee Pollen Granules", desc: "Hand-harvested multifloral pollen. A complete protein with all essential amino acids and B vitamins.", price: "$21.99", badge: "Superfood", icon: "⚡", accent: "black" },
];

const stats = [
  { value: "12+", label: "Hive Locations" },
  { value: "50k+", label: "Happy Customers" },
  { value: "100%", label: "Natural & Raw" },
  { value: "15yrs", label: "Beekeeping Legacy" },
];

export default function HomePage() {
  const [activeProduct, setActiveProduct] = useState<number | null>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {};
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Syne:wght@400;600;800&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --yellow: #F5C518;
          --yellow-light: #FFE066;
          --yellow-pale: #FFF8D6;
          --yellow-mid: #FFDB4D;
          --white: #FFFFFF;
          --off-white: #FFFEF5;
          --black: #1a1a0a;
          --black-soft: #2d2d1a;
          --green: #3a7d44;
          --green-light: #5aad66;
          --green-pale: #e8f5eb;
          --text-dark: #1a1a0a;
          --text-mid: #4a4a2a;
          --text-muted: #8a8a5a;
        }

        html { scroll-behavior: smooth; }

        body {
          background: var(--off-white);
          color: var(--text-dark);
          font-family: 'Syne', sans-serif;
          overflow-x: hidden;
        }

        /* ── NAV ── */
        .nav {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.1rem 4rem;
          background: rgba(255, 252, 210, 0.9);
          backdrop-filter: blur(20px);
          border-bottom: 2px solid var(--yellow);
        }

        .nav-logo {
          font-family: 'Orbitron', monospace;
          font-weight: 900;
          font-size: 1.35rem;
          color: var(--black);
          letter-spacing: 0.08em;
          text-decoration: none;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .nav-logo .logo-green { color: var(--green); }

        .nav-links {
          display: flex;
          gap: 2.5rem;
          list-style: none;
        }

        .nav-links a {
          color: var(--text-mid);
          text-decoration: none;
          font-size: 0.82rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          transition: color 0.2s;
          position: relative;
        }

        .nav-links a::after {
          content: '';
          position: absolute;
          bottom: -3px; left: 0; right: 0;
          height: 2px;
          background: var(--green);
          transform: scaleX(0);
          transition: transform 0.2s;
        }

        .nav-links a:hover { color: var(--black); }
        .nav-links a:hover::after { transform: scaleX(1); }

        .nav-cta {
          background: var(--black);
          color: var(--yellow);
          border: none;
          padding: 0.65rem 1.6rem;
          font-family: 'Orbitron', monospace;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          cursor: pointer;
          clip-path: polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%);
          transition: all 0.2s;
          text-transform: uppercase;
        }

        .nav-cta:hover { background: var(--black-soft); transform: translateY(-1px); }

        /* ── HERO ── */
        .hero {
          min-height: 100vh;
          position: relative;
          display: flex;
          align-items: center;
          overflow: hidden;
          padding: 0 4rem;
          background: linear-gradient(135deg, #FFF8D6 0%, #FFEE99 35%, #FFF5C0 65%, #FFFEF5 100%);
        }

        .hero-blob {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
        }

        .hero-blob-1 {
          width: 700px; height: 700px;
          right: -80px; top: -120px;
          background: radial-gradient(circle, rgba(245,197,24,0.5) 0%, transparent 65%);
          filter: blur(70px);
        }

        .hero-blob-2 {
          width: 280px; height: 280px;
          left: 4%; bottom: 10%;
          background: radial-gradient(circle, rgba(58,125,68,0.1) 0%, transparent 70%);
          filter: blur(40px);
        }

        .hero-content {
          position: relative;
          z-index: 2;
          max-width: 620px;
          animation: fadeSlideUp 0.9s ease both;
        }

        .hero-eyebrow {
          font-family: 'Orbitron', monospace;
          font-size: 0.68rem;
          letter-spacing: 0.4em;
          color: var(--green);
          text-transform: uppercase;
          margin-bottom: 1.4rem;
          display: flex;
          align-items: center;
          gap: 0.8rem;
          font-weight: 700;
        }

        .hero-eyebrow::before {
          content: '';
          display: block;
          width: 36px; height: 2px;
          background: var(--green);
        }

        .hero-title {
          font-family: 'Orbitron', monospace;
          font-size: clamp(2.8rem, 5.5vw, 5rem);
          font-weight: 900;
          line-height: 1.0;
          letter-spacing: -0.01em;
          margin-bottom: 1.6rem;
          color: var(--black);
        }

        .hero-title .highlight {
          color: var(--yellow);
          -webkit-text-stroke: 2.5px var(--black);
          text-shadow: 5px 5px 0px var(--black);
          display: inline-block;
        }

        .hero-sub {
          font-size: 1.05rem;
          color: var(--text-mid);
          line-height: 1.75;
          margin-bottom: 2.8rem;
          max-width: 480px;
        }

        .hero-btns {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .btn-primary {
          background: var(--black);
          color: var(--yellow);
          border: none;
          padding: 0.95rem 2.2rem;
          font-family: 'Orbitron', monospace;
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          cursor: pointer;
          clip-path: polygon(10px 0%, 100% 0%, calc(100% - 10px) 100%, 0% 100%);
          transition: all 0.25s;
          text-transform: uppercase;
          text-decoration: none;
          display: inline-block;
        }

        .btn-primary:hover {
          background: var(--black-soft);
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(26,26,10,0.2);
        }

        .btn-green {
          background: var(--green);
          color: white;
          border: none;
          padding: 0.95rem 2.2rem;
          font-family: 'Orbitron', monospace;
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          cursor: pointer;
          text-transform: uppercase;
          transition: all 0.25s;
          text-decoration: none;
          display: inline-block;
        }

        .btn-green:hover {
          background: var(--green-light);
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(58,125,68,0.3);
        }

        .btn-outline {
          background: transparent;
          color: var(--black);
          border: 2px solid var(--black);
          padding: 0.9rem 2.2rem;
          font-family: 'Orbitron', monospace;
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          cursor: pointer;
          text-transform: uppercase;
          transition: all 0.25s;
          text-decoration: none;
          display: inline-block;
        }

        .btn-outline:hover {
          background: var(--black);
          color: var(--yellow);
          transform: translateY(-2px);
        }

        /* Hero visual hex */
        .hero-visual {
          position: absolute;
          right: 5%;
          top: 50%;
          transform: translateY(-50%);
          width: 370px; height: 370px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .hero-hex-ring {
          position: absolute;
          inset: 0;
          border: 3px solid rgba(26,26,10,0.15);
          clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
          animation: rotateSlow 22s linear infinite;
        }

        .hero-hex-ring-2 {
          position: absolute;
          inset: 22px;
          border: 2px solid rgba(245,197,24,0.6);
          clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
          animation: rotateSlow 15s linear infinite reverse;
        }

        .hero-hex-fill {
          position: absolute;
          inset: 44px;
          clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
          background: rgba(245,197,24,0.15);
        }

        /* Animations */
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(-4deg); }
          50% { transform: translateY(-20px) rotate(4deg); }
        }

        @keyframes wingFlap {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(0.2) scaleX(1.1); }
        }

        @keyframes rotateSlow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(28px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }

        .bee-float { animation: float 4s ease-in-out infinite; }
        .wing { transform-origin: center; animation: wingFlap 0.14s ease-in-out infinite; }
        .wing-right { animation-delay: 0.07s; }

        /* ── STATS BAR ── */
        .stats-bar {
          background: var(--black);
          padding: 2.2rem 4rem;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
        }

        .stat-item {
          text-align: center;
          padding: 1rem;
          border-right: 1px solid rgba(245,197,24,0.12);
        }

        .stat-item:last-child { border-right: none; }

        .stat-value {
          font-family: 'Orbitron', monospace;
          font-size: 2.4rem;
          font-weight: 900;
          color: var(--yellow);
          display: block;
          line-height: 1;
          margin-bottom: 0.4rem;
        }

        .stat-label {
          font-size: 0.7rem;
          color: rgba(255,255,255,0.4);
          letter-spacing: 0.15em;
          text-transform: uppercase;
          font-weight: 600;
        }

        /* ── MARQUEE BANNER ── */
        .banner-strip {
          background: var(--yellow);
          border-top: 3px solid var(--black);
          border-bottom: 3px solid var(--black);
          padding: 1rem 0;
          overflow: hidden;
        }

        .banner-inner {
          display: flex;
          gap: 3rem;
          white-space: nowrap;
          animation: marquee 20s linear infinite;
        }

        .banner-item {
          font-family: 'Orbitron', monospace;
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.22em;
          color: var(--black);
          text-transform: uppercase;
          display: flex;
          align-items: center;
          gap: 0.9rem;
          flex-shrink: 0;
        }

        .banner-sep { color: var(--green); font-size: 1rem; }

        /* ── PRODUCTS ── */
        .section-products {
          padding: 7rem 4rem;
          background: var(--white);
          position: relative;
          overflow: hidden;
        }

        .section-products::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 4px;
          background: linear-gradient(90deg, var(--yellow), var(--yellow-light), var(--yellow));
        }

        .section-header {
          margin-bottom: 4rem;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
        }

        .section-label {
          font-family: 'Orbitron', monospace;
          font-size: 0.64rem;
          letter-spacing: 0.42em;
          color: var(--green);
          text-transform: uppercase;
          margin-bottom: 0.7rem;
          display: block;
          font-weight: 700;
        }

        .section-title {
          font-family: 'Orbitron', monospace;
          font-size: clamp(1.8rem, 3.5vw, 2.8rem);
          font-weight: 900;
          line-height: 1.1;
          color: var(--black);
        }

        .product-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 2px;
          background: rgba(26,26,10,0.07);
          border: 2px solid rgba(26,26,10,0.1);
        }

        .product-card {
          background: var(--off-white);
          padding: 2.2rem;
          position: relative;
          cursor: pointer;
          overflow: hidden;
          transition: background 0.3s, box-shadow 0.3s, transform 0.2s;
        }

        .product-card:hover {
          background: var(--yellow-pale);
          transform: translateY(-2px);
          z-index: 2;
          box-shadow: 0 10px 36px rgba(245,197,24,0.22);
        }

        .product-card-stripe {
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 0.35s;
        }

        .green-stripe { background: var(--green); }
        .black-stripe { background: var(--black); }

        .product-card:hover .product-card-stripe { transform: scaleX(1); }

        .product-badge {
          display: inline-block;
          font-family: 'Orbitron', monospace;
          font-size: 0.58rem;
          letter-spacing: 0.15em;
          padding: 0.22rem 0.75rem;
          text-transform: uppercase;
          margin-bottom: 1.2rem;
          font-weight: 700;
          clip-path: polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%);
        }

        .green-badge {
          background: var(--green-pale);
          color: var(--green);
          border: 1px solid rgba(58,125,68,0.3);
        }

        .black-badge {
          background: #eeebd8;
          color: var(--black);
          border: 1px solid rgba(26,26,10,0.18);
        }

        .product-icon {
          font-size: 2.8rem;
          margin-bottom: 1rem;
          display: block;
          line-height: 1;
          filter: drop-shadow(0 4px 8px rgba(0,0,0,0.08));
        }

        .product-name {
          font-family: 'Orbitron', monospace;
          font-size: 0.92rem;
          font-weight: 700;
          color: var(--black);
          margin-bottom: 0.75rem;
          line-height: 1.35;
        }

        .product-desc {
          font-size: 0.84rem;
          color: var(--text-muted);
          line-height: 1.72;
          margin-bottom: 1.6rem;
        }

        .product-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .product-price {
          font-family: 'Orbitron', monospace;
          font-size: 1.3rem;
          font-weight: 900;
          color: var(--black);
        }

        .product-add {
          background: var(--yellow);
          border: 2px solid var(--black);
          color: var(--black);
          padding: 0.45rem 1.1rem;
          font-family: 'Orbitron', monospace;
          font-size: 0.62rem;
          letter-spacing: 0.1em;
          cursor: pointer;
          text-transform: uppercase;
          font-weight: 700;
          transition: all 0.2s;
          clip-path: polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%);
        }

        .product-add:hover {
          background: var(--black);
          color: var(--yellow);
        }

        /* ── ABOUT ── */
        .section-about {
          padding: 7rem 4rem;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6rem;
          align-items: center;
          background: var(--yellow-pale);
          position: relative;
          overflow: hidden;
        }

        .about-visual {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .about-hex-frame {
          width: 300px; height: 340px;
          clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
          background: linear-gradient(160deg, var(--yellow) 0%, var(--yellow-mid) 100%);
          border: 3px solid var(--black);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 8px 8px 0px var(--black);
        }

        .about-hex-inner {
          font-size: 7rem;
          filter: drop-shadow(0 4px 16px rgba(0,0,0,0.12));
          animation: float 5s ease-in-out infinite;
        }

        .about-desc {
          font-size: 1rem;
          color: var(--text-mid);
          line-height: 1.82;
          margin-top: 1.2rem;
          margin-bottom: 2rem;
        }

        .about-features {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
          margin-bottom: 2.5rem;
        }

        .about-feature {
          display: flex;
          align-items: flex-start;
          gap: 0.85rem;
          font-size: 0.9rem;
          color: var(--text-dark);
          font-weight: 600;
        }

        .dot-green {
          width: 10px; height: 10px;
          background: var(--green);
          border-radius: 50%;
          flex-shrink: 0;
          margin-top: 5px;
        }

        .dot-black {
          width: 10px; height: 10px;
          background: var(--black);
          clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
          flex-shrink: 0;
          margin-top: 5px;
        }

        /* ── PROCESS ── */
        .section-process {
          padding: 7rem 4rem;
          background: var(--white);
          position: relative;
          overflow: hidden;
        }

        /* bee stripe pattern subtle bg */
        .section-process::before {
          content: '';
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(
            -45deg,
            transparent,
            transparent 50px,
            rgba(245,197,24,0.03) 50px,
            rgba(245,197,24,0.03) 51px
          );
          pointer-events: none;
        }

        .process-steps {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0;
          margin-top: 4.5rem;
          position: relative;
          z-index: 1;
        }

        .process-steps::before {
          content: '';
          position: absolute;
          top: 39px; left: 12.5%; right: 12.5%;
          height: 3px;
          background: linear-gradient(90deg, var(--yellow), var(--yellow-light), var(--yellow));
        }

        .process-step { text-align: center; padding: 0 1.5rem; }

        .step-num {
          width: 80px; height: 80px;
          border: 3px solid var(--black);
          background: var(--yellow);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Orbitron', monospace;
          font-size: 1.3rem;
          font-weight: 900;
          color: var(--black);
          margin: 0 auto 1.5rem;
          position: relative;
          z-index: 1;
          box-shadow: 4px 4px 0px var(--black);
          transition: all 0.25s;
        }

        .process-step:hover .step-num {
          background: var(--black);
          color: var(--yellow);
          box-shadow: 4px 4px 0px var(--green);
        }

        .step-title {
          font-family: 'Orbitron', monospace;
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--black);
          margin-bottom: 0.7rem;
          letter-spacing: 0.04em;
        }

        .step-desc {
          font-size: 0.82rem;
          color: var(--text-muted);
          line-height: 1.7;
        }

        /* ── FOOTER ── */
        .footer {
          background: var(--black);
          padding: 4rem;
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1fr;
          gap: 3rem;
          border-top: 4px solid var(--yellow);
        }

        .footer-logo {
          font-family: 'Orbitron', monospace;
          font-weight: 900;
          font-size: 1.2rem;
          color: var(--yellow);
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }

        .footer-brand p {
          font-size: 0.85rem;
          color: rgba(255,255,255,0.38);
          line-height: 1.78;
          margin-top: 1rem;
          max-width: 280px;
        }

        .footer-col h4 {
          font-family: 'Orbitron', monospace;
          font-size: 0.66rem;
          letter-spacing: 0.22em;
          color: var(--yellow);
          text-transform: uppercase;
          margin-bottom: 1.2rem;
          font-weight: 700;
        }

        .footer-col ul {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
        }

        .footer-col ul a {
          font-size: 0.85rem;
          color: rgba(255,255,255,0.38);
          text-decoration: none;
          transition: color 0.2s;
          font-weight: 600;
        }

        .footer-col ul a:hover { color: var(--yellow); }

        .eco-tag {
          display: inline-block;
          background: var(--green);
          color: white;
          font-size: 0.58rem;
          font-family: 'Orbitron', monospace;
          letter-spacing: 0.1em;
          padding: 0.16rem 0.5rem;
          margin-left: 0.4rem;
          font-weight: 700;
          vertical-align: middle;
        }

        .footer-bottom {
          padding: 1.4rem 4rem;
          border-top: 1px solid rgba(245,197,24,0.1);
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.74rem;
          color: rgba(255,255,255,0.25);
          background: var(--black);
        }

        .footer-eco { color: var(--green); font-weight: 700; }

        /* ── RESPONSIVE ── */
        @media (max-width: 900px) {
          .nav { padding: 1rem 1.5rem; }
          .nav-links, .nav-cta { display: none; }
          .hero { padding: 6rem 1.5rem 3rem; }
          .hero-visual { display: none; }
          .stats-bar { grid-template-columns: repeat(2, 1fr); padding: 2rem 1.5rem; }
          .section-products, .section-process { padding: 4rem 1.5rem; }
          .section-about { padding: 4rem 1.5rem; grid-template-columns: 1fr; }
          .about-visual { display: none; }
          .product-grid { grid-template-columns: 1fr 1fr; }
          .process-steps { grid-template-columns: repeat(2, 1fr); }
          .footer { grid-template-columns: 1fr 1fr; padding: 3rem 1.5rem; }
          .footer-bottom { padding: 1.5rem; flex-direction: column; gap: 0.5rem; text-align: center; }
          .section-header { flex-direction: column; align-items: flex-start; gap: 1.5rem; }
        }

        @media (max-width: 600px) {
          .product-grid { grid-template-columns: 1fr; }
          .process-steps { grid-template-columns: 1fr 1fr; }
        }
      `}</style>

      {/* ── NAV ── */}
      <nav className="nav">
        <a href="#" className="nav-logo">
          🍯 POLLINATORS<span className="logo-green">APITHERAPY</span>
        </a>
        <ul className="nav-links">
          {["Products", "Our Process", "About", "Journal"].map((l) => (
            <li key={l}><a href="#">{l}</a></li>
          ))}
        </ul>
        <button className="nav-cta">Shop Now</button>
      </nav>

      {/* ── HERO ── */}
      <section className="hero" ref={heroRef}>
        <div className="hero-blob hero-blob-1" />
        <div className="hero-blob hero-blob-2" />
        <HexGrid />

        {/* ambient drifting bees */}
        <BeeSVG style={{ position: "absolute", top: "14%", right: "28%", width: 46, opacity: 0.65 }} />
        <BeeSVG style={{ position: "absolute", top: "66%", right: "8%", width: 30, opacity: 0.5, animationDelay: "-2s" }} />
        <BeeSVG style={{ position: "absolute", top: "28%", right: "4%", width: 24, opacity: 0.38, animationDelay: "-4s" }} />

        {/* green leaf nature accents */}
        <LeafAccent style={{ position: "absolute", bottom: "7%", left: "1.5%", width: 64, transform: "rotate(12deg)" }} />
        <LeafAccent style={{ position: "absolute", top: "18%", left: "36%", width: 34, transform: "rotate(-38deg)", opacity: 0.45 }} />

        <div className="hero-content">
          <div className="hero-eyebrow">Pure From Nature</div>
          <h1 className="hero-title">
            THE HIVE<br />
            <span className="highlight">AWAKENS</span>
          </h1>
          <p className="hero-sub">
            Premium bee-derived products harvested with reverence for nature.
            Raw honey, beeswax, propolis and royal jelly — the earth's oldest superfoods,
            redefined for the modern world.
          </p>
          <div className="hero-btns">
            <a href="#products" className="btn-primary">Explore Products</a>
            <a href="#about" className="btn-outline">Our Story</a>
          </div>
        </div>

        {/* Hexagon visual with big bee */}
        <div className="hero-visual">
          <div className="hero-hex-ring" />
          <div className="hero-hex-ring-2" />
          <div className="hero-hex-fill" />
          <BeeSVG style={{ width: "62%", filter: "drop-shadow(0 10px 30px rgba(26,26,10,0.18))" }} />
        </div>
      </section>

      {/* ── STATS BAR (dark contrast) ── */}
      <div className="stats-bar">
        {stats.map((s) => (
          <div className="stat-item" key={s.label}>
            <span className="stat-value">{s.value}</span>
            <span className="stat-label">{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── MARQUEE BANNER (yellow) ── */}
      <div className="banner-strip">
        <div className="banner-inner">
          {[...Array(2)].map((_, i) =>
            ["Raw & Unfiltered", "Single Origin", "Cold Extracted", "Zero Additives", "Certified Organic", "Free-Range Hives", "Lab Tested Pure", "Eco Packaged"].map((t) => (
              <div className="banner-item" key={`${i}-${t}`}>
                <span className="banner-sep">✦</span> {t}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── PRODUCTS (white bg) ── */}
      <section className="section-products" id="products">
        <div className="section-header">
          <div>
            <span className="section-label">From The Hive</span>
            <h2 className="section-title">Our Products</h2>
          </div>
          <a href="#" className="btn-outline" style={{ fontSize: "0.72rem", padding: "0.65rem 1.4rem" }}>
            View All →
          </a>
        </div>

        <div className="product-grid">
          {products.map((p) => (
            <div
              key={p.id}
              className={`product-card ${activeProduct === p.id ? "active" : ""}`}
              onMouseEnter={() => setActiveProduct(p.id)}
              onMouseLeave={() => setActiveProduct(null)}
            >
              <div className={`product-card-stripe ${p.accent === "green" ? "green-stripe" : "black-stripe"}`} />
              <span className={`product-badge ${p.accent === "green" ? "green-badge" : "black-badge"}`}>
                {p.badge}
              </span>
              <span className="product-icon">{p.icon}</span>
              <div className="product-name">{p.name}</div>
              <p className="product-desc">{p.desc}</p>
              <div className="product-footer">
                <span className="product-price">{p.price}</span>
                <button className="product-add">Add to Cart</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── ABOUT (pale yellow bg) ── */}
      <section className="section-about" id="about">
        <div className="about-visual">
          <LeafAccent style={{ position: "absolute", top: "6%", left: "4%", width: 52, transform: "rotate(-22deg)" }} />
          <LeafAccent style={{ position: "absolute", bottom: "8%", right: "6%", width: 40, transform: "rotate(38deg)" }} />
          <div className="about-hex-frame">
            <span className="about-hex-inner">🍯</span>
          </div>
        </div>

        <div>
          <span className="section-label">Why Pollinators Apitherapy</span>
          <h2 className="section-title">Rooted in Nature.<br />Powered by Bees.</h2>
          <p className="about-desc">
            We partner with small-scale apiaries across alpine, coastal, and forest ecosystems.
            Every product is cold-extracted, unfiltered, and tested for purity — because the bee
            knows best. No additives. No heat processing. Just the hive's finest.
          </p>
          <div className="about-features">
            {[
              { text: "Single-origin sourcing — traceability from hive to home", dot: "green" },
              { text: "No heat treatment — enzymes and nutrients fully intact", dot: "black" },
              { text: "Certified organic apiaries with zero pesticide exposure", dot: "green" },
              { text: "Regenerative beekeeping practices that support biodiversity", dot: "black" },
            ].map((f) => (
              <div className="about-feature" key={f.text}>
                <div className={f.dot === "green" ? "dot-green" : "dot-black"} />
                <span>{f.text}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <a href="#" className="btn-primary">Learn Our Process</a>
            <a href="#" className="btn-green">Shop Now</a>
          </div>
        </div>
      </section>

      {/* ── PROCESS (white bg) ── */}
      <section className="section-process" id="process">
        <div style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
          <span className="section-label" style={{ display: "flex", justifyContent: "center" }}>
            How It Works
          </span>
          <h2 className="section-title">From Flower to You</h2>
        </div>

        <div className="process-steps">
          {[
            { n: "01", title: "Flower Power", desc: "Bees forage from certified organic, pesticide-free meadows and forests carefully chosen for biodiversity." },
            { n: "02", title: "Hive Magic", desc: "Nectar transforms in the hive over 21 days through enzymatic activity and evaporation until perfect." },
            { n: "03", title: "Cold Extraction", desc: "Honey is extracted below 35°C, preserving all enzymes, pollen, propolis, and antioxidants." },
            { n: "04", title: "Delivered Pure", desc: "Packaged in UV-blocking glass and shipped temperature-controlled directly to your door." },
          ].map((s) => (
            <div className="process-step" key={s.n}>
              <div className="step-num">{s.n}</div>
              <div className="step-title">{s.title}</div>
              <p className="step-desc">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FOOTER (dark) ── */}
      <footer>
        <div className="footer">
          <div className="footer-brand">
            <div className="footer-logo">🍯 HEX<span style={{ color: "#5aad66" }}>HIVE</span></div>
            <p>Premium bee products harvested with care for nature, for bees, and for you. Sustainably sourced. Scientifically respected.</p>
          </div>
          <div className="footer-col">
            <h4>Products</h4>
            <ul>
              {["Raw Honey", "Beeswax Candles", "Royal Jelly", "Propolis", "Honeycomb", "Bee Pollen"].map(l => (
                <li key={l}><a href="#">{l}</a></li>
              ))}
            </ul>
          </div>
          <div className="footer-col">
            <h4>Company</h4>
            <ul>
              <li><a href="#">About Us</a></li>
              <li><a href="#">Our Apiaries</a></li>
              <li><a href="#">Sustainability <span className="eco-tag">ECO</span></a></li>
              <li><a href="#">Journal</a></li>
              <li><a href="#">Press</a></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>Support</h4>
            <ul>
              {["Contact", "Shipping", "Returns", "FAQ", "Wholesale"].map(l => (
                <li key={l}><a href="#">{l}</a></li>
              ))}
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2025 Pollinators Apitherapy. All rights reserved.</span>
          <span>Made with 🍯 &amp; <span className="footer-eco">🌿 zero compromise</span></span>
        </div>
      </footer>
    </>
  );
}