"use client";

import { useState } from "react";
import Image from "next/image";

export default function PollinatorsBeekepersApitherapyPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <main
      style={{
        fontFamily: "'Georgia', 'Times New Roman', serif",
        backgroundColor: "#ffffff",
        color: "#1a1a1a",
        margin: 0,
        padding: 0,
        overflowX: "hidden",
      }}
    >
      {/* ── NAV ── */}
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          backgroundColor: "#ffffff",
          borderBottom: "1px solid #f5e6c8",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 5%",
          height: "64px",
          boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
        }}
      >
        {/* Logo */}
        <span
          style={{
            fontSize: "1.35rem",
            fontWeight: "700",
            letterSpacing: "0.04em",
            color: "#1a1a1a",
          }}
        >
          Pollinators Beekepers Apitherapy
        </span>

        {/* Desktop links */}
        <ul
          style={{
            display: "flex",
            gap: "2rem",
            listStyle: "none",
            margin: 0,
            padding: 0,
            fontSize: "0.85rem",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
          className="desktop-nav"
        >
          {["Home", "Blog", "Categories", "Products"].map((item) => (
            <li key={item}>
              <a
                href="#"
                style={{
                  color: "#555",
                  textDecoration: "none",
                  transition: "color 0.2s",
                }}
                onMouseEnter={(e) =>
                  ((e.target as HTMLAnchorElement).style.color = "#e8a000")
                }
                onMouseLeave={(e) =>
                  ((e.target as HTMLAnchorElement).style.color = "#555")
                }
              >
                {item}
              </a>
            </li>
          ))}
        </ul>

        <a
          href="#"
          style={{
            backgroundColor: "#e8a000",
            color: "#fff",
            padding: "0.55rem 1.4rem",
            borderRadius: "4px",
            textDecoration: "none",
            fontSize: "0.8rem",
            fontFamily: "sans-serif",
            fontWeight: "700",
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            transition: "background 0.2s",
          }}
          onMouseEnter={(e) =>
            ((e.target as HTMLAnchorElement).style.backgroundColor = "#c88a00")
          }
          onMouseLeave={(e) =>
            ((e.target as HTMLAnchorElement).style.backgroundColor = "#e8a000")
          }
          className="desktop-cta"
        >
          Contact Us
        </a>

        {/* Hamburger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          style={{
            display: "none",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: "1.5rem",
            color: "#1a1a1a",
          }}
          className="hamburger"
          aria-label="Toggle menu"
        >
          {menuOpen ? "✕" : "☰"}
        </button>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div
          style={{
            backgroundColor: "#fff",
            borderBottom: "1px solid #f5e6c8",
            padding: "1.5rem 5%",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          {["Home", "Blog", "Categories", "Products", "Contact Us"].map(
            (item) => (
              <a
                key={item}
                href="#"
                style={{
                  color: "#1a1a1a",
                  textDecoration: "none",
                  fontSize: "1rem",
                  fontFamily: "sans-serif",
                  letterSpacing: "0.05em",
                }}
              >
                {item}
              </a>
            )
          )}
        </div>
      )}

      {/* ── HERO ── */}
      <section
        style={{
          background: "linear-gradient(135deg, #fffef5 0%, #fff9e6 60%, #fff3cc 100%)",
          padding: "5rem 5% 4rem",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          alignItems: "center",
          gap: "3rem",
          minHeight: "80vh",
        }}
        className="hero-section"
      >
        {/* Text */}
        <div>
          <p
            style={{
              fontSize: "0.78rem",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#e8a000",
              fontFamily: "sans-serif",
              marginBottom: "0.75rem",
              fontWeight: 600,
            }}
          >
            Artisan Honey Products
          </p>
          <h1
            style={{
              fontSize: "clamp(2.4rem, 5vw, 3.8rem)",
              fontWeight: "800",
              lineHeight: 1.1,
              margin: "0 0 1.25rem",
              color: "#1a1a1a",
            }}
          >
            Crafting Sweet
            <br />
            Moments Just
            <br />
            <span style={{ color: "#e8a000" }}>For You!</span>
          </h1>
          <p
            style={{
              fontSize: "1rem",
              lineHeight: 1.7,
              color: "#666",
              maxWidth: "420px",
              fontFamily: "sans-serif",
              fontWeight: 400,
              marginBottom: "2rem",
            }}
          >
            Our passion for honey is woven into every product we curate, ensuring you
            receive nothing but the finest and most exquisite offerings.
          </p>
          <a
            href="#products"
            style={{
              display: "inline-block",
              backgroundColor: "#e8a000",
              color: "#fff",
              padding: "0.85rem 2.2rem",
              borderRadius: "4px",
              textDecoration: "none",
              fontFamily: "sans-serif",
              fontWeight: "700",
              fontSize: "0.9rem",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              transition: "background 0.2s, transform 0.15s",
              boxShadow: "0 4px 16px rgba(232,160,0,0.3)",
            }}
            onMouseEnter={(e) => {
              const el = e.target as HTMLAnchorElement;
              el.style.backgroundColor = "#c88a00";
              el.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              const el = e.target as HTMLAnchorElement;
              el.style.backgroundColor = "#e8a000";
              el.style.transform = "translateY(0)";
            }}
          >
            Shop Now
          </a>
        </div>

        {/* Hero image placeholder */}
        <div
  style={{
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  }}
>
  <div
    style={{
      position: "relative",
      width: "100%",
      maxWidth: "480px",
      aspectRatio: "4/3",
      borderRadius: "16px",
      overflow: "hidden",
    }}
  >
    <Image
      src="/images/honey drip.jpeg"
      alt="Honey products"
      fill
      style={{ objectFit: "cover" }}
    />
  </div>
</div>
      </section>
      

      {/* ── ABOUT ── */}
      <section
        style={{
          padding: "5rem 5%",
          backgroundColor: "#ffffff",
        }}
      >
        <h2
          style={{
            textAlign: "center",
            fontSize: "clamp(1.8rem, 4vw, 2.6rem)",
            marginBottom: "3.5rem",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "#1a1a1a",
          }}
        >
          About Us
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "4rem",
            alignItems: "center",
            maxWidth: "1100px",
            margin: "0 auto",
          }}
          className="about-grid"
        >
          {/* About image placeholder */}
          <div
            style={{
              width: "100%",
              aspectRatio: "4/3",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #fff9e6, #ffe8a0)",
              border: "2px dashed #e8c870",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.6rem",
              color: "#b8860b",
              fontFamily: "sans-serif",
              fontSize: "0.85rem",
              textAlign: "center",
              padding: "2rem",
            }}
          >
            <span style={{ fontSize: "2.5rem" }}>📸</span>
            <strong style={{ fontWeight: 700 }}>About Image</strong>
            <span style={{ opacity: 0.7 }}>Replace with your brand / process photo</span>
          </div>

          {/* Text */}
          <div>
            <div
              style={{
                width: "40px",
                height: "3px",
                backgroundColor: "#e8a000",
                marginBottom: "1.5rem",
                borderRadius: "2px",
              }}
            />
            <p
              style={{
                fontSize: "1.05rem",
                lineHeight: 1.85,
                color: "#444",
                fontFamily: "sans-serif",
                marginBottom: "1.25rem",
              }}
            >
              Welcome to Pollinators Beekepers Apitherapy, where we craft sweet moments for you to savor
              and cherish. Our passion for honey is woven into every product we curate,
              ensuring you receive nothing but the finest and most exquisite offerings.
            </p>
            <p
              style={{
                fontSize: "1.05rem",
                lineHeight: 1.85,
                color: "#444",
                fontFamily: "sans-serif",
              }}
            >
              From golden liquid honey to delectable honey-based confections, each
              creation embodies the essence of{" "}
              <strong style={{ color: "#1a1a1a" }}>
                craftsmanship and dedication
              </strong>
              .
            </p>
          </div>
        </div>
      </section>

      {/* ── DECORATIVE DIVIDER ── */}
      <div
        style={{
          height: "2px",
          background: "linear-gradient(90deg, transparent, #ffe08a, transparent)",
          margin: "0 5%",
        }}
      />

      {/* ── BEST SELLING PRODUCTS ── */}
      <section
        id="products"
        style={{
          padding: "5rem 5%",
          backgroundColor: "#fffef8",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
          <h2
            style={{
              fontSize: "clamp(1.8rem, 4vw, 2.6rem)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "#1a1a1a",
              marginBottom: "0.75rem",
            }}
          >
            Best Selling Products
          </h2>
          <p
            style={{
              color: "#888",
              fontFamily: "sans-serif",
              fontSize: "0.95rem",
              maxWidth: "540px",
              margin: "0 auto",
              lineHeight: 1.65,
            }}
          >
            Handcrafted honey delights, carefully designed to elevate your everyday
            indulgences and make every moment sweeter.
          </p>
        </div>

        {/* Product grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "2rem",
            maxWidth: "1100px",
            margin: "0 auto",
          }}
          className="products-grid"
        >
          {[
            { name: "Pure Raw Honey", price: "$20.00", desc: "Honey is a sweet, liquid food, heaven-sent product by bees." },
            { name: "Wildflower", price: "$100.00", desc: "Honey is a sweet, liquid food, heaven-sent product by bees." },
            { name: "Forest Honey", price: "$100.00", desc: "Honey is a sweet-scented honey, heaven-sent product by bees." },
          ].map((product) => (
            <div
              key={product.name}
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "12px",
                overflow: "hidden",
                border: "1px solid #f0e0b0",
                transition: "transform 0.25s, box-shadow 0.25s",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.transform = "translateY(-6px)";
                el.style.boxShadow = "0 12px 32px rgba(232,160,0,0.18)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.transform = "translateY(0)";
                el.style.boxShadow = "none";
              }}
            >
              {/* Product image placeholder */}
              <div
                style={{
                  width: "100%",
                  aspectRatio: "1/1",
                  background: "linear-gradient(135deg, #fff9e6, #ffe8a0)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  borderBottom: "1px dashed #e8c870",
                  gap: "0.4rem",
                  color: "#b8860b",
                  fontFamily: "sans-serif",
                  fontSize: "0.75rem",
                  textAlign: "center",
                  padding: "1rem",
                }}
              >
                <span style={{ fontSize: "2.5rem" }}>🫙</span>
                <strong style={{ fontWeight: 700, fontSize: "0.8rem" }}>Product Image</strong>
                <span style={{ opacity: 0.65 }}>Replace with product photo</span>
              </div>

              {/* Product info */}
              <div style={{ padding: "1.25rem" }}>
                <h3
                  style={{
                    fontSize: "0.85rem",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    margin: "0 0 0.3rem",
                    fontFamily: "sans-serif",
                    fontWeight: 700,
                    color: "#1a1a1a",
                  }}
                >
                  {product.name}
                </h3>
                <p
                  style={{
                    color: "#e8a000",
                    fontWeight: "700",
                    fontSize: "1.05rem",
                    margin: "0 0 0.6rem",
                    fontFamily: "sans-serif",
                  }}
                >
                  {product.price}
                </p>
                <p
                  style={{
                    fontSize: "0.82rem",
                    color: "#888",
                    lineHeight: 1.55,
                    fontFamily: "sans-serif",
                    margin: 0,
                  }}
                >
                  {product.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* View all button */}
        <div style={{ textAlign: "center", marginTop: "3rem" }}>
          <a
            href="#"
            style={{
              display: "inline-block",
              border: "2px solid #e8a000",
              color: "#e8a000",
              padding: "0.75rem 2rem",
              borderRadius: "4px",
              textDecoration: "none",
              fontFamily: "sans-serif",
              fontWeight: "700",
              fontSize: "0.85rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              transition: "background 0.2s, color 0.2s",
            }}
            onMouseEnter={(e) => {
              const el = e.target as HTMLAnchorElement;
              el.style.backgroundColor = "#e8a000";
              el.style.color = "#fff";
            }}
            onMouseLeave={(e) => {
              const el = e.target as HTMLAnchorElement;
              el.style.backgroundColor = "transparent";
              el.style.color = "#e8a000";
            }}
          >
            View All Products
          </a>
        </div>
      </section>

      {/* ── BANNER ── */}
      <section
        style={{
          background: "linear-gradient(135deg, #e8a000, #ffcc44)",
          padding: "4rem 5%",
          textAlign: "center",
          color: "#fff",
        }}
      >
        <h2
          style={{
            fontSize: "clamp(1.8rem, 4vw, 2.8rem)",
            fontWeight: "800",
            margin: "0 0 1rem",
            textShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}
        >
          Pure. Natural. Crafted with Love.
        </h2>
        <p
          style={{
            fontFamily: "sans-serif",
            fontSize: "1.05rem",
            opacity: 0.92,
            marginBottom: "2rem",
            maxWidth: "500px",
            margin: "0 auto 2rem",
            lineHeight: 1.65,
          }}
        >
          Join thousands of honey lovers who trust Pollinators Beekepers Apitherapy for their daily sweetness.
        </p>
        <a
          href="#"
          style={{
            display: "inline-block",
            backgroundColor: "#fff",
            color: "#e8a000",
            padding: "0.85rem 2.4rem",
            borderRadius: "4px",
            textDecoration: "none",
            fontFamily: "sans-serif",
            fontWeight: "800",
            fontSize: "0.9rem",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            transition: "transform 0.15s",
            boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
          }}
          onMouseEnter={(e) =>
            ((e.target as HTMLAnchorElement).style.transform = "scale(1.04)")
          }
          onMouseLeave={(e) =>
            ((e.target as HTMLAnchorElement).style.transform = "scale(1)")
          }
        >
          Explore Collection
        </a>
      </section>

      {/* ── FOOTER ── */}
      <footer
        style={{
          backgroundColor: "#1a1a1a",
          color: "#ccc",
          padding: "3rem 5% 2rem",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr 1fr",
            gap: "3rem",
            maxWidth: "1100px",
            margin: "0 auto 2rem",
          }}
          className="footer-grid"
        >
          <div>
            <h3
              style={{
                color: "#fff",
                fontSize: "1.2rem",
                marginBottom: "0.75rem",
                fontFamily: "Georgia, serif",
              }}
            >
              Pollinators Beekepers Apitherapy
            </h3>
            <p style={{ lineHeight: 1.7, fontSize: "0.88rem", color: "#aaa" }}>
              Crafting sweet moments with the finest artisan honey products since 2010.
            </p>
          </div>
          <div>
            <h4
              style={{
                color: "#fff",
                fontSize: "0.8rem",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: "1rem",
              }}
            >
              Links
            </h4>
            {["Home", "Blog", "Categories", "Products", "Contact"].map((l) => (
              <div key={l} style={{ marginBottom: "0.5rem" }}>
                <a
                  href="#"
                  style={{
                    color: "#aaa",
                    textDecoration: "none",
                    fontSize: "0.88rem",
                    transition: "color 0.2s",
                  }}
                  onMouseEnter={(e) =>
                    ((e.target as HTMLAnchorElement).style.color = "#e8a000")
                  }
                  onMouseLeave={(e) =>
                    ((e.target as HTMLAnchorElement).style.color = "#aaa")
                  }
                >
                  {l}
                </a>
              </div>
            ))}
          </div>
          <div>
            <h4
              style={{
                color: "#fff",
                fontSize: "0.8rem",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: "1rem",
              }}
            >
              Contact
            </h4>
            <p style={{ fontSize: "0.88rem", color: "#aaa", lineHeight: 1.7 }}>
              hello@pollinatorsbeekepersapitherapy.com
              <br />
              +1 (800) 555-HONEY
              <br />
              Mon–Fri, 9am–5pm
            </p>
          </div>
        </div>
        <div
          style={{
            borderTop: "1px solid #333",
            paddingTop: "1.25rem",
            textAlign: "center",
            fontSize: "0.78rem",
            color: "#666",
          }}
        >
          © {new Date().getFullYear()} Pollinators Beekepers Apitherapy. All rights reserved.
        </div>
      </footer>

      {/* ── RESPONSIVE STYLES ── */}
      <style>{`
        @media (max-width: 768px) {
          .desktop-nav,
          .desktop-cta {
            display: none !important;
          }
          .hamburger {
            display: block !important;
          }
          .hero-section {
            grid-template-columns: 1fr !important;
            text-align: center;
            padding: 3rem 5% !important;
            min-height: auto !important;
          }
          .hero-section > div:first-child {
            align-items: center;
            display: flex;
            flex-direction: column;
          }
          .about-grid {
            grid-template-columns: 1fr !important;
            gap: 2rem !important;
          }
          .products-grid {
            grid-template-columns: 1fr !important;
          }
          .footer-grid {
            grid-template-columns: 1fr !important;
            gap: 2rem !important;
          }
        }
        @media (min-width: 769px) and (max-width: 1024px) {
          .products-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .footer-grid {
            grid-template-columns: 1fr 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}