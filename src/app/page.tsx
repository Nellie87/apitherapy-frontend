"use client";

import { useState } from "react";
import Link from "next/link"; // ← added for navigation

const products = [
  { id: 1, name: "Raw Wildflower Honey", desc: "Unfiltered, cold-extracted from free-ranging hives in alpine meadows. Rich in enzymes and antioxidants.", price: "$24.99", badge: "Best Seller" },
  { id: 2, name: "Beeswax Candles", desc: "Hand-poured pure beeswax candles. Purify air with subtle honey fragrance. 40+ hour burn.", price: "$18.99", badge: "Eco Choice" },
  { id: 3, name: "Royal Jelly Capsules", desc: "Premium freeze-dried royal jelly for maximum bioavailability. Nature’s most potent superfood.", price: "$39.99", badge: "Premium" },
  { id: 4, name: "Propolis Tincture", desc: "Ethanol-extracted from single-origin apiary. Powerful natural antimicrobial.", price: "$29.99", badge: "Immunity" },
  { id: 5, name: "Honeycomb Slabs", desc: "Raw comb honey in pure beeswax — eat the whole piece. Wildflower or clover varieties.", price: "$34.99", badge: "Artisan" },
  { id: 6, name: "Bee Pollen Granules", desc: "Hand-harvested multifloral pollen. Complete protein with essential amino acids & B vitamins.", price: "$21.99", badge: "Superfood" },
];

const stats = [
  { value: "12+", label: "Hive Locations" },
  { value: "50k+", label: "Happy Customers" },
  { value: "100%", label: "Natural & Raw" },
  { value: "15yrs", label: "Beekeeping Legacy" },
];

export default function HomePage() {
  const [activeProduct, setActiveProduct] = useState<number | null>(null);

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

        /* Nav */
        .nav {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 100;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem 5rem;
          background: rgba(253,250,245,0.92);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid var(--light-gray);
        }

        .nav-logo {
          font-family: 'Playfair Display', serif;
          font-size: 1.6rem;
          font-weight: 700;
          color: var(--charcoal);
          letter-spacing: -0.02em;
        }

        .nav-links {
          display: flex;
          gap: 2.5rem;
          list-style: none;
        }

        .nav-links a {
          color: var(--gray);
          text-decoration: none;
          font-weight: 500;
          font-size: 0.95rem;
          transition: color 0.2s;
        }

        .nav-links a:hover { color: var(--charcoal); }

        .nav-actions {
          display: flex;
          align-items: center;
          gap: 1.2rem;
        }

        .nav-cta, .nav-login {
          padding: 0.75rem 1.6rem;
          font-weight: 500;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.2s;
          border-radius: 6px;
        }

        .nav-cta {
          background: var(--charcoal);
          color: white;
          border: none;
        }

        .nav-cta:hover { background: var(--sage); }

        .nav-login {
          background: transparent;
          color: var(--charcoal);
          border: 1px solid var(--charcoal);
        }

        .nav-login:hover {
          background: var(--charcoal);
          color: white;
        }

        /* Hero */
        .hero {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 0 5rem;
          background: linear-gradient(to bottom, #fdfaf5, #f8f4eb);
          position: relative;
        }

        .hero-content {
          max-width: 780px;
        }

        .hero-eyebrow {
          font-size: 1rem;
          letter-spacing: 0.18em;
          color: var(--sage);
          text-transform: uppercase;
          margin-bottom: 1.5rem;
          font-weight: 500;
        }

        .hero-title {
          font-size: clamp(3.8rem, 8vw, 7.2rem);
          line-height: 1.05;
          margin-bottom: 1.8rem;
          color: var(--charcoal);
        }

        .hero-sub {
          font-size: 1.25rem;
          color: var(--gray);
          max-width: 620px;
          margin: 0 auto 2.8rem;
        }

        .hero-btns {
          display: flex;
          gap: 1.5rem;
          justify-content: center;
          flex-wrap: wrap;
        }

        .btn {
          padding: 1rem 2.4rem;
          font-weight: 500;
          font-size: 1rem;
          text-decoration: none;
          transition: all 0.25s;
          border-radius: 6px;
        }

        .btn-primary {
          background: var(--charcoal);
          color: white;
          border: 1px solid var(--charcoal);
        }

        .btn-primary:hover { background: var(--sage); border-color: var(--sage); }

        .btn-outline {
          background: transparent;
          color: var(--charcoal);
          border: 1px solid var(--charcoal);
        }

        .btn-outline:hover {
          background: var(--charcoal);
          color: white;
        }

        /* Stats */
        .stats {
          background: var(--charcoal);
          color: white;
          padding: 4rem 5rem;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 2rem;
          text-align: center;
        }

        .stat-value {
          font-family: 'Playfair Display', serif;
          font-size: 3.2rem;
          font-weight: 700;
          color: var(--gold);
          display: block;
          margin-bottom: 0.5rem;
        }

        .stat-label {
          font-size: 0.95rem;
          color: rgba(255,255,255,0.7);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        /* Products */
        .section {
          padding: 10rem 5rem;
        }

        .section-header {
          text-align: center;
          margin-bottom: 5rem;
        }

        .section-eyebrow {
          color: var(--sage);
          font-size: 1.1rem;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          margin-bottom: 1rem;
        }

        .section-title {
          font-size: 3.2rem;
          margin-bottom: 1.2rem;
        }

        .product-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 3rem;
        }

        .product-card {
          background: white;
          padding: 2.5rem;
          border: 1px solid var(--light-gray);
          transition: all 0.3s ease;
        }

        .product-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 20px 40px rgba(0,0,0,0.08);
          border-color: var(--gold);
        }

        .product-badge {
          display: inline-block;
          background: var(--sage);
          color: white;
          font-size: 0.75rem;
          padding: 0.4rem 1rem;
          margin-bottom: 1.2rem;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .product-name {
          font-family: 'Playfair Display', serif;
          font-size: 1.6rem;
          margin-bottom: 1rem;
        }

        .product-desc {
          color: var(--gray);
          font-size: 1rem;
          margin-bottom: 1.8rem;
        }

        .product-price {
          font-size: 1.6rem;
          font-weight: 600;
          margin-bottom: 1.2rem;
          display: block;
        }

        .product-add {
          background: var(--gold);
          color: var(--charcoal);
          border: none;
          padding: 0.9rem 1.8rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          border-radius: 6px;
        }

        .product-add:hover {
          background: var(--charcoal);
          color: white;
        }

        @media (max-width: 1024px) {
          .nav { padding: 1.2rem 2.5rem; }
          .section { padding: 6rem 2.5rem; }
          .hero { padding: 0 2.5rem; }
          .nav-links { gap: 1.8rem; }
        }

        @media (max-width: 640px) {
          .hero-title { font-size: 3.6rem; }
          .product-grid { grid-template-columns: 1fr; }
          .nav { flex-wrap: wrap; justify-content: center; gap: 1rem; padding: 1rem 1.5rem; }
          .nav-links { display: none; } /* or implement mobile menu later */
        }
      `}</style>

      {/* Nav */}
      <nav className="nav">
        <div className="nav-logo">Pollinators Apitherapy</div>

        <div className="nav-links">
          <li><a href="#">Products</a></li>
          <li><a href="#">Process</a></li>
          <li><a href="#">About</a></li>
          <li><a href="#">Journal</a></li>
        </div>

        <div className="nav-actions">
          <Link href="/login" className="nav-login">
            Login
          </Link>
          <button className="nav-cta">Shop Now</button>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-eyebrow">Pure Apitherapy</div>
          <h1 className="hero-title">Nature's Original Superfoods</h1>
          <p className="hero-sub">
            Raw honey, royal jelly, propolis, beeswax and pollen — harvested with care from pristine ecosystems, unprocessed and full of life.
          </p>
          <div className="hero-btns">
            <a href="#products" className="btn btn-primary">Explore Collection</a>
            <a href="#about" className="btn btn-outline">Our Philosophy</a>
            <Link href="/login" className="btn btn-outline">
              Login / Sign Up
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <div className="stats">
        {stats.map((s) => (
          <div key={s.label}>
            <span className="stat-value">{s.value}</span>
            <span className="stat-label">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Products */}
      <section className="section" id="products">
        <div className="section-header">
          <div className="section-eyebrow">From the Hive</div>
          <h2 className="section-title">Our Collection</h2>
        </div>

        <div className="product-grid">
          {products.map((p) => (
            <div
              key={p.id}
              className="product-card"
              onMouseEnter={() => setActiveProduct(p.id)}
              onMouseLeave={() => setActiveProduct(null)}
            >
              <span className="product-badge">{p.badge}</span>
              <h3 className="product-name">{p.name}</h3>
              <p className="product-desc">{p.desc}</p>
              <span className="product-price">{p.price}</span>
              <button className="product-add">Add to Cart</button>
            </div>
          ))}
        </div>
      </section>

      {/* You can add About, Process, Footer sections here later */}
    </>
  );
}