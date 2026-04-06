"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Pollinators Beekeepers Apitherapy · Kenya Landing Page
// Design: premium-organic · editorial · warm depth · local brand-first
// Context: Kenyan beekeeping business with a physical shop in Ruiru
// Currency: KSh
// ─────────────────────────────────────────────────────────────────────────────

const PRODUCTS = [
  {
    id: 1,
    name: "Pure Raw Honey",
    subtitle: "Kenyan Harvest · Everyday Favourite",
    desc: "Natural raw honey with a smooth taste and rich golden finish. Great for tea, bread, porridge, and daily home use.",
    price: 850,
    weight: "500g",
    badge: "Best Seller",
    badgeColor: "bg-amber-400 text-amber-950",
    imageBg: "from-amber-50 to-yellow-100",
    accentHex: "#d4920a",
    tags: ["All", "Everyday", "Raw"],
    img: "/honey-.png",
  },
  {
    id: 2,
    name: "Forest Honey",
    subtitle: "Kenyan Forest Regions · Bold",
    desc: "A deeper, fuller-bodied honey with a darker tone and stronger flavour for those who enjoy a richer taste.",
    price: 1100,
    weight: "500g",
    badge: "Bold Taste",
    badgeColor: "bg-stone-800 text-amber-200",
    imageBg: "from-orange-50 to-amber-100",
    accentHex: "#92400e",
    tags: ["All", "Dark", "Raw"],
    img: "/honey-.png",
  },
  {
    id: 3,
    name: "Acacia Honey",
    subtitle: "Light & Floral · Delicate",
    desc: "A lighter honey with a clean floral taste and gentle sweetness, perfect for lighter teas and breakfast tables.",
    price: 950,
    weight: "500g",
    badge: "Light",
    badgeColor: "bg-sky-100 text-sky-800",
    imageBg: "from-slate-50 to-blue-50",
    accentHex: "#4f73c0",
    tags: ["All", "Mild", "Floral"],
    img: "/honey-.png",
  },
  {
    id: 4,
    name: "Honey with Ginger",
    subtitle: "Infused Blend · Warming",
    desc: "A comforting honey blend with ginger notes, loved for warm drinks and soothing daily wellness routines.",
    price: 1000,
    weight: "400g",
    badge: "Popular",
    badgeColor: "bg-orange-100 text-orange-700",
    imageBg: "from-orange-50 to-yellow-50",
    accentHex: "#c2570b",
    tags: ["All", "Infused", "Wellness"],
    img: "/honey-.png",
  },
  {
    id: 5,
    name: "Honey with Lemon",
    subtitle: "Bright Blend · Refreshing",
    desc: "A fresh and vibrant honey blend with lemon-inspired brightness, ideal for warm water, tea, and morning routines.",
    price: 1000,
    weight: "400g",
    badge: "Fresh Pick",
    badgeColor: "bg-yellow-100 text-yellow-800",
    imageBg: "from-yellow-50 to-amber-50",
    accentHex: "#b45309",
    tags: ["All", "Mild", "Wellness"],
    img: "/honey-.png",
  },
  {
    id: 6,
    name: "Bee Pollen",
    subtitle: "Apitherapy Product · Nutrient Rich",
    desc: "Collected bee pollen packed in a convenient jar for customers looking for a natural apitherapy addition to their routine.",
    price: 1200,
    weight: "250g",
    badge: "Apitherapy",
    badgeColor: "bg-emerald-100 text-emerald-800",
    imageBg: "from-emerald-50 to-teal-50",
    accentHex: "#0f766e",
    tags: ["All", "Apitherapy", "Wellness"],
    img: "/honey-.png",
  },
  {
    id: 7,
    name: "Propolis Tincture",
    subtitle: "Bee Product · Herbal Support",
    desc: "A propolis-based apitherapy product for customers interested in natural bee-derived wellness options.",
    price: 1500,
    weight: "30ml",
    badge: "Wellness",
    badgeColor: "bg-violet-100 text-violet-700",
    imageBg: "from-violet-50 to-purple-50",
    accentHex: "#6d28d9",
    tags: ["All", "Apitherapy", "Wellness"],
    img: "/honey-.png",
  },
  {
    id: 8,
    name: "Honey Gift Pack",
    subtitle: "Curated Set · Local Favourite",
    desc: "A simple and beautiful gift set featuring selected honey jars — perfect for families, holidays, and thoughtful gifting.",
    price: 2200,
    weight: "3 jars",
    badge: "Gift Set",
    badgeColor: "bg-rose-100 text-rose-700",
    imageBg: "from-rose-50 to-pink-50",
    accentHex: "#be185d",
    tags: ["All", "Gift"],
    img: "/honey-.png",
  },
  {
    id: 9,
    name: "Comb Honey",
    subtitle: "Natural Cut Comb · Premium",
    desc: "Honey in its most natural form, served with comb for customers who want a more authentic and distinctive experience.",
    price: 1400,
    weight: "300g",
    badge: "Premium",
    badgeColor: "bg-amber-50 text-amber-700",
    imageBg: "from-yellow-50 to-orange-50",
    accentHex: "#a16207",
    tags: ["All", "Premium", "Raw"],
    img: "/honey-.png",
  },
];

const FEATURES = [
  {
    icon: "🐝",
    gradient: "from-amber-200 to-yellow-300",
    glow: "#fbbf24",
    title: "Natural beekeeping focus",
    body: "We are rooted in beekeeping and apitherapy, with products shaped by care, simplicity, and respect for the bees.",
  },
  {
    icon: "🍯",
    gradient: "from-rose-200 to-pink-200",
    glow: "#fb7185",
    title: "Pure honey, local warmth",
    body: "Our honey is prepared for real homes and real routines — from tea and breakfast to gifting and wellness use.",
  },
  {
    icon: "📍",
    gradient: "from-sky-200 to-blue-200",
    glow: "#60a5fa",
    title: "Visit us in Ruiru",
    body: "We are building steadily and serving customers locally through our physical shop in Ruiru, Kenya.",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "The honey tastes natural and clean. You can tell it has not been overprocessed.",
    name: "Wanjiru M.",
    role: "Customer, Ruiru",
    stars: 5,
  },
  {
    quote:
      "I like that the products feel local and genuine. The ginger honey is one of my favourites.",
    name: "Brian K.",
    role: "Customer, Nairobi",
    stars: 5,
  },
  {
    quote:
      "Their shop experience feels personal, and the products make great gifts for family too.",
    name: "Mercy N.",
    role: "Customer, Kiambu",
    stars: 5,
  },
];

const FILTERS = [
  "All",
  "Mild",
  "Dark",
  "Wellness",
  "Gift",
  "Apitherapy",
];

// ─────────────────────────────────────────────────────────────────────────────

function formatKES(value: number) {
  return `KSh ${value.toLocaleString("en-KE")}`;
}

export default function Page() {
  const [activeFilter, setActiveFilter] = useState("All");
  const [cartCount, setCartCount] = useState(0);
  const [added, setAdded] = useState<number | null>(null);

  function handleAdd(id: number) {
    setCartCount((c) => c + 1);
    setAdded(id);
    window.setTimeout(() => setAdded(null), 1400);
  }

  const filtered = useMemo(() => {
    if (activeFilter === "All") return PRODUCTS;
    return PRODUCTS.filter((p) => p.tags.includes(activeFilter));
  }, [activeFilter]);

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-white text-stone-900">
      {/* ══════════════════════════════════════════════ GLOBAL ATMOSPHERE */}
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
        <div className="absolute -left-48 -top-48 h-[700px] w-[700px] rounded-full bg-amber-300/18 blur-[140px]" />
        <div className="absolute -right-36 top-0 h-[520px] w-[520px] rounded-full bg-sky-200/18 blur-[120px]" />
        <div className="absolute bottom-[-12%] left-[32%] h-[620px] w-[620px] rounded-full bg-amber-200/14 blur-[160px]" />
        <div
          className="absolute inset-0 opacity-[0.018]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            backgroundSize: "200px 200px",
          }}
        />
      </div>

      <div className="fixed inset-x-0 top-0 z-50 h-[3px] bg-gradient-to-r from-amber-500 via-yellow-300 to-amber-500" />

      <style>{`
        @keyframes float {
          0%,100% { transform: translateY(0) rotate(-2deg); }
          50% { transform: translateY(-14px) rotate(2deg); }
        }
      `}</style>

      {/* ══════════════════════════════════════════════ NAVIGATION */}
      <header className="sticky top-[3px] z-40 w-full border-b border-stone-100 bg-white/80 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-screen-xl items-center justify-between px-5 py-3.5 sm:px-8 lg:px-12">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-[0_3px_12px_rgba(217,119,6,0.38)]">
              <span className="text-[16px] leading-none" aria-hidden="true">
                🐝
              </span>
            </div>
            <div className="leading-none">
              <p className="text-[9px] font-bold uppercase tracking-[0.38em] text-amber-600">
                Kenya
              </p>
              <p
                className="text-[15px] font-black tracking-tight text-stone-900"
                style={{ fontFamily: "'Georgia', serif" }}
              >
                Pollinators Beekeepers Apitherapy
              </p>
            </div>
          </div>

          <nav className="hidden items-center gap-8 text-[13px] font-medium text-stone-500 md:flex">
            {["Home", "Products", "Story", "Benefits", "Contact"].map((l) => (
              <a
                key={l}
                href={`#${l.toLowerCase()}`}
                className="relative pb-px transition-colors duration-200 hover:text-amber-600 after:absolute after:bottom-0 after:left-0 after:h-px after:w-0 after:bg-amber-400 after:transition-all after:duration-300 hover:after:w-full"
              >
                {l}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              aria-label={`Shopping interest cart, ${cartCount} items`}
              className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 transition hover:border-amber-300 hover:text-amber-600"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white">
                  {cartCount}
                </span>
              )}
            </button>

            <Link
              href="/login"
              className="hidden rounded-xl border border-stone-200 bg-white px-4 py-2 text-[13px] font-medium text-stone-600 transition hover:border-stone-300 hover:text-stone-900 md:block"
            >
              Log in
            </Link>

            <a
              href="#products"
              className="rounded-xl bg-gradient-to-b from-amber-400 to-amber-500 px-5 py-2.5 text-[13px] font-bold text-amber-950 shadow-[0_4px_14px_rgba(245,158,11,0.36)] transition duration-200 hover:-translate-y-px hover:shadow-[0_7px_20px_rgba(245,158,11,0.44)]"
            >
              View products →
            </a>
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════════ HERO */}
      <section id="home" className="relative z-10 w-full overflow-hidden py-14 sm:py-20">
        <div className="mx-auto max-w-screen-xl px-5 sm:px-8 lg:px-12">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
            <div className="relative">
              <div className="mb-7 inline-flex items-center gap-2.5 rounded-full border border-amber-200 bg-amber-50 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.3em] text-amber-700">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                </span>
                Pure Honey · Beekeeping · Apitherapy
              </div>

              <h1
                className="max-w-[15ch] text-[clamp(2.6rem,5.5vw,5rem)] font-black leading-[1.0] tracking-[-0.03em] text-stone-950"
                style={{ fontFamily: "'Georgia', serif" }}
              >
                Pure honey,
                <br />
                crafted with
                <br />
                <span className="relative inline-block">
                  <span className="relative z-10 text-amber-600">local care</span>
                  <svg
                    className="absolute -bottom-1 left-0 w-full overflow-visible"
                    height="10"
                    viewBox="0 0 300 10"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M2 7C60 2 200 2 298 7"
                      stroke="#fbbf24"
                      strokeWidth="6"
                      strokeLinecap="round"
                      opacity="0.5"
                    />
                  </svg>
                </span>
                <br />
                from Ruiru,
                <br />
                Kenya.
              </h1>

              <p className="mt-7 max-w-[46ch] text-[16px] leading-[1.82] text-stone-500">
                Pollinators Beekeepers Apitherapy offers honey and bee-derived
                products made for everyday use, gifting, and wellness. Visit our
                shop in Ruiru and discover products shaped by genuine local
                beekeeping.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-3.5">
                <a
                  href="#products"
                  className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-b from-amber-400 to-amber-500 px-8 py-4 text-[14px] font-bold text-amber-950 shadow-[0_8px_28px_rgba(245,158,11,0.36)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_14px_38px_rgba(245,158,11,0.46)]"
                >
                  Explore collection
                  <span className="transition-transform duration-300 group-hover:translate-x-1">
                    →
                  </span>
                </a>
                <a
                  href="#story"
                  className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-8 py-4 text-[14px] font-medium text-stone-600 shadow-sm transition hover:border-stone-300 hover:text-stone-900"
                >
                  Our story
                </a>
              </div>

              <div className="mt-10 flex flex-wrap gap-3">
                {[
                  { value: "Kenya", label: "Local business" },
                  { value: "Ruiru", label: "Physical shop" },
                  { value: "9+", label: "Product types" },
                  { value: "Natural", label: "Bee products" },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="flex items-baseline gap-2 rounded-2xl border border-stone-100 bg-white px-4 py-3 shadow-sm"
                  >
                    <p className="text-[15px] font-black text-stone-900">{s.value}</p>
                    <p className="text-[11.5px] font-medium text-stone-400">
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative flex min-h-[560px] items-center justify-center">
              <div
                className="absolute h-[400px] w-[400px] rounded-full bg-amber-200/45 blur-[80px]"
                aria-hidden="true"
              />
              <div
                className="absolute h-[460px] w-[460px] rounded-full border border-dashed border-amber-200/50"
                aria-hidden="true"
              />
              <div
                className="absolute h-[540px] w-[540px] rounded-full border border-stone-100"
                aria-hidden="true"
              />

              <div
                className="relative z-10 w-full max-w-[370px] rounded-[36px] border border-white/80 bg-white/90 p-4 shadow-[0_28px_80px_rgba(60,40,10,0.15)] backdrop-blur-2xl transition duration-500 hover:shadow-[0_40px_100px_rgba(60,40,10,0.22)]"
                style={{
                  transform: "perspective(1400px) rotateY(-7deg) rotateX(4deg)",
                  transformStyle: "preserve-3d",
                }}
              >
                <div className="pointer-events-none absolute inset-0 rounded-[36px] bg-[radial-gradient(circle_at_18%_14%,rgba(255,255,255,0.95),transparent_55%)]" />
                <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-b from-amber-50 to-yellow-50">
                  <div className="absolute left-4 top-4 z-10 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.28em] text-amber-950">
                    Local favourite
                  </div>
                  <div className="relative flex h-60 items-end justify-center px-6 pb-3">
                    <div className="absolute bottom-3 left-1/2 h-12 w-40 -translate-x-1/2 rounded-full bg-amber-400/14 blur-2xl" />
                    <Image
                      src="/honey-.png"
                      alt="Jar of premium Kenyan honey"
                      width={440}
                      height={440}
                      className="relative z-10 h-auto w-[230px] object-contain drop-shadow-[0_22px_28px_rgba(100,65,10,0.23)] md:w-[260px]"
                      priority
                    />
                  </div>
                  <div className="px-5 pb-5 pt-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-amber-600">
                      Kenyan Honey · Natural
                    </p>
                    <div className="mt-1.5 flex items-end justify-between gap-4">
                      <h3
                        className="text-[19px] font-black leading-tight text-stone-900"
                        style={{ fontFamily: "'Georgia', serif" }}
                      >
                        Pure Raw
                        <br />
                        Honey
                      </h3>
                      <div className="text-right">
                        <p className="text-[9px] uppercase tracking-wider text-stone-400">
                          from
                        </p>
                        <p className="text-[20px] font-black text-stone-900">
                          {formatKES(850)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAdd(0)}
                      className="mt-4 w-full rounded-xl bg-gradient-to-b from-amber-400 to-amber-500 py-3 text-[13px] font-bold text-amber-950 shadow-sm transition hover:brightness-105"
                    >
                      {added === 0 ? "✓ Added!" : "Add to interest list"}
                    </button>
                  </div>
                </div>
                <div className="absolute -bottom-3 left-8 right-8 h-10 rounded-full bg-amber-400/10 blur-2xl" />
              </div>

              <div className="absolute right-[-14px] top-10 hidden w-[158px] rotate-[7deg] rounded-[20px] border border-stone-100 bg-white p-4 shadow-[0_12px_36px_rgba(30,20,5,0.10)] backdrop-blur-xl transition duration-300 hover:rotate-[4deg] md:block">
                <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-amber-600">
                  Natural taste
                </p>
                <p className="mt-1.5 text-[12px] leading-[1.65] text-stone-500">
                  Golden, rich, and made for tea, breakfast, and daily use.
                </p>
              </div>
              <div className="absolute -left-10 bottom-24 hidden w-[164px] -rotate-[4deg] rounded-[20px] border border-stone-100 bg-white p-4 shadow-[0_12px_36px_rgba(30,20,5,0.09)] backdrop-blur-xl transition duration-300 hover:-rotate-[1deg] md:block">
                <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-amber-600">
                  Apitherapy
                </p>
                <p className="mt-1.5 text-[12px] leading-[1.65] text-stone-500">
                  Explore honey, propolis, and bee pollen in one local brand.
                </p>
              </div>
              <div className="absolute bottom-6 right-[-8px] hidden w-[148px] rotate-[3deg] rounded-[20px] border border-sky-100 bg-sky-50 p-4 shadow-[0_12px_36px_rgba(56,100,220,0.09)] backdrop-blur-xl transition duration-300 hover:rotate-[1deg] md:block">
                <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-sky-600">
                  Location
                </p>
                <p className="mt-1.5 text-[12px] leading-[1.65] text-sky-900/70">
                  Visit our shop in Ruiru for a closer look at our products.
                </p>
              </div>

              {[
                { cls: "left-4 top-16 text-3xl", delay: "0s" },
                { cls: "right-8 top-28 text-2xl", delay: "0.9s" },
                { cls: "bottom-12 left-10 text-xl", delay: "1.7s" },
              ].map((b, i) => (
                <span
                  key={i}
                  className={`absolute ${b.cls}`}
                  style={{
                    filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.10))",
                    animation: `float 4s ease-in-out ${b.delay} infinite`,
                  }}
                  aria-hidden="true"
                >
                  🐝
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════ TRUST STRIP */}
      <div className="relative z-10 border-y border-stone-100 bg-white">
        <div className="mx-auto max-w-screen-xl px-5 sm:px-8 lg:px-12">
          <div className="flex flex-wrap items-center justify-between gap-y-3 py-4">
            {[
              { icon: "🍯", text: "Pure Honey" },
              { icon: "🐝", text: "Beekeeping Focus" },
              { icon: "🌿", text: "Natural Products" },
              { icon: "📍", text: "Ruiru Shop" },
              { icon: "🧪", text: "Apitherapy Range" },
              { icon: "🤝", text: "Local Service" },
            ].map((t) => (
              <div
                key={t.text}
                className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-400"
              >
                <span aria-hidden="true">{t.icon}</span>
                <span>{t.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════ FEATURE PILLARS */}
      <section className="relative z-10 w-full py-24">
        <div className="mx-auto max-w-screen-xl px-5 sm:px-8 lg:px-12">
          <div className="mb-14 text-center">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.42em] text-amber-600">
              Why us
            </p>
            <h2
              className="text-[clamp(1.9rem,4vw,3rem)] font-black leading-tight tracking-tight text-stone-950"
              style={{ fontFamily: "'Georgia', serif" }}
            >
              Bee products with a local, grounded identity
            </h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group relative overflow-hidden rounded-3xl border border-stone-100 bg-white p-8 shadow-[0_6px_28px_rgba(20,14,5,0.06)] transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_16px_48px_rgba(20,14,5,0.10)]"
              >
                <div
                  className="pointer-events-none absolute inset-0 rounded-3xl opacity-0 transition duration-500 group-hover:opacity-100"
                  style={{
                    background: `radial-gradient(circle at 25% 25%, ${f.glow}14, transparent 65%)`,
                  }}
                  aria-hidden="true"
                />
                <div
                  className={`mb-6 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br ${f.gradient} text-xl shadow-sm`}
                  aria-hidden="true"
                >
                  {f.icon}
                </div>
                <h3 className="text-[18px] font-black text-stone-900">{f.title}</h3>
                <p className="mt-3 text-[14px] leading-[1.8] text-stone-500">
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════ PRODUCTS */}
      <section id="products" className="relative z-10 w-full bg-stone-50/80 py-24">
        <div className="mx-auto max-w-screen-xl px-5 sm:px-8 lg:px-12">
          <div className="mb-12 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.42em] text-amber-600">
                Our products
              </p>
              <h2
                className="max-w-[20ch] text-[clamp(1.9rem,4vw,3rem)] font-black leading-[1.05] tracking-tight text-stone-950"
                style={{ fontFamily: "'Georgia', serif" }}
              >
                Honey and bee products made for Kenyan homes and gifting
              </h2>
            </div>
            <a
              href="#contact"
              className="w-fit shrink-0 rounded-xl border border-stone-200 bg-white px-6 py-3 text-[13px] font-medium text-stone-600 shadow-sm transition hover:border-stone-300 hover:text-stone-900"
            >
              Visit or inquire →
            </a>
          </div>

          <div className="mb-10 flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`rounded-xl border px-5 py-2 text-[12px] font-semibold uppercase tracking-[0.22em] transition duration-200 ${
                  activeFilter === f
                    ? "border-amber-500 bg-amber-500 text-white shadow-[0_3px_12px_rgba(245,158,11,0.34)]"
                    : "border-stone-200 bg-white text-stone-500 hover:border-stone-300 hover:text-stone-800"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((product, idx) => (
              <article
                key={product.id}
                className="group relative flex flex-col overflow-hidden rounded-3xl border border-stone-100 bg-white shadow-[0_3px_20px_rgba(20,14,5,0.06)] transition duration-300 hover:-translate-y-2 hover:shadow-[0_16px_50px_rgba(20,14,5,0.13)]"
              >
                <div className="absolute left-4 top-4 z-10">
                  <span
                    className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] ${product.badgeColor}`}
                  >
                    {product.badge}
                  </span>
                </div>

                <div className="absolute right-4 top-4 z-10 text-[11px] font-bold tracking-widest text-stone-200">
                  {String(idx + 1).padStart(2, "0")}
                </div>

                <div
                  className={`relative flex h-56 items-end justify-center overflow-hidden bg-gradient-to-b ${product.imageBg} px-6 pb-4`}
                >
                  <div
                    className="absolute bottom-4 left-1/2 h-10 w-36 -translate-x-1/2 rounded-full blur-2xl"
                    style={{ background: `${product.accentHex}20` }}
                    aria-hidden="true"
                  />
                  <Image
                    src={product.img}
                    alt={product.name}
                    width={280}
                    height={280}
                    className="relative z-10 h-auto w-[138px] object-contain drop-shadow-[0_14px_20px_rgba(60,40,8,0.20)] transition duration-500 group-hover:scale-[1.07] group-hover:-translate-y-1"
                  />
                </div>

                <div className="flex flex-1 flex-col p-6">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-stone-400">
                    {product.subtitle}
                  </p>
                  <h3 className="text-[18px] font-black text-stone-900">
                    {product.name}
                  </h3>
                  <p className="mt-2 flex-1 text-[13.5px] leading-[1.75] text-stone-500">
                    {product.desc}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {product.tags
                      .filter((tag) => tag !== "All")
                      .map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-stone-100 bg-stone-50 px-2.5 py-0.5 text-[10px] font-semibold text-stone-500"
                        >
                          {tag}
                        </span>
                      ))}
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-3">
                    <div>
                      <p
                        className="text-[22px] font-black"
                        style={{ color: product.accentHex }}
                      >
                        {formatKES(product.price)}
                      </p>
                      <p className="text-[11px] text-stone-400">{product.weight}</p>
                    </div>
                    <button
                      onClick={() => handleAdd(product.id)}
                      className="rounded-xl px-5 py-2.5 text-[13px] font-bold text-white shadow-sm transition duration-200 hover:brightness-110 hover:-translate-y-px active:scale-95"
                      style={{
                        background:
                          added === product.id
                            ? "#22c55e"
                            : `linear-gradient(150deg, ${product.accentHex}ee, ${product.accentHex})`,
                      }}
                    >
                      {added === product.id ? "✓ Added!" : "Add interest"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════ BRAND STORY */}
      <section id="story" className="relative z-10 w-full py-24">
        <div className="mx-auto max-w-screen-xl px-5 sm:px-8 lg:px-12">
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="relative overflow-hidden rounded-3xl border border-stone-100 bg-white p-10 shadow-[0_6px_36px_rgba(20,14,5,0.07)] md:p-12">
              <svg
                className="pointer-events-none absolute right-6 top-6 opacity-[0.04]"
                width="140"
                height="140"
                viewBox="0 0 140 140"
                fill="none"
                aria-hidden="true"
              >
                <path d="M70 8L86 35H54L70 8Z" fill="#c98e00" />
                <path d="M100 35L116 62H84L100 35Z" fill="#c98e00" />
                <path d="M40 35L56 62H24L40 35Z" fill="#c98e00" />
                <path d="M70 62L86 89H54L70 62Z" fill="#c98e00" />
                <path d="M100 89L116 116H84L100 89Z" fill="#c98e00" />
                <path d="M40 89L56 116H24L40 89Z" fill="#c98e00" />
                <path d="M70 116L86 143H54L70 116Z" fill="#c98e00" />
              </svg>

              <p className="text-[10px] font-bold uppercase tracking-[0.38em] text-sky-600">
                Our story
              </p>
              <h2
                className="mt-4 max-w-[22ch] text-[clamp(1.8rem,3vw,2.6rem)] font-black leading-[1.08] tracking-tight text-stone-950"
                style={{ fontFamily: "'Georgia', serif" }}
              >
                A growing Kenyan brand built around bees, honey, and care
              </h2>
              <p className="mt-5 max-w-[50ch] text-[15px] leading-[1.85] text-stone-500">
                Pollinators Beekeepers Apitherapy is still growing, but the
                vision is clear: offer accessible honey and bee-based products
                rooted in local identity, practical quality, and meaningful
                customer trust. Our physical presence in Ruiru keeps the brand
                personal and grounded.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-amber-50 p-5">
                  <p className="text-[15px] font-black text-stone-900">
                    Local warmth
                  </p>
                  <p className="mt-2 text-[13px] leading-[1.7] text-stone-500">
                    A brand experience that feels welcoming, familiar, and
                    proudly Kenyan.
                  </p>
                </div>
                <div className="rounded-2xl bg-sky-50 p-5">
                  <p className="text-[15px] font-black text-stone-900">
                    Honest growth
                  </p>
                  <p className="mt-2 text-[13px] leading-[1.7] text-stone-500">
                    We keep the story real: local shop, local customers, and a
                    business still building its name.
                  </p>
                </div>
              </div>

              <blockquote className="mt-8 border-l-4 border-amber-400 pl-4 text-[14px] italic leading-[1.75] text-stone-500">
                "We want our products to feel natural, useful, and close to the
                people who buy them."
                <span className="mt-2 block not-italic font-bold text-stone-700">
                  — Pollinators Beekeepers Apitherapy
                </span>
              </blockquote>

              <div className="mt-8 flex gap-10 border-t border-stone-100 pt-7">
                {[
                  { n: "Ruiru", label: "Shop location" },
                  { n: "Kenya", label: "Local identity" },
                  { n: "Honey+", label: "Bee products" },
                ].map((s) => (
                  <div key={s.label}>
                    <p className="text-[22px] font-black text-stone-900">{s.n}</p>
                    <p className="text-[11px] font-medium text-stone-400">
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative overflow-hidden rounded-3xl border border-stone-100 bg-gradient-to-b from-white to-amber-50/60 p-10 shadow-[0_6px_36px_rgba(20,14,5,0.07)] md:p-12">
              <div className="absolute right-6 top-6 rounded-full border border-amber-100 bg-amber-50 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.28em] text-amber-700">
                Product focus
              </div>

              <div className="mt-10 overflow-hidden rounded-2xl bg-gradient-to-b from-stone-50 to-amber-50">
                <div className="relative flex h-64 w-full items-end justify-center px-6 pb-4">
                  <div
                    className="absolute bottom-4 left-1/2 h-10 w-44 -translate-x-1/2 rounded-full bg-amber-300/18 blur-2xl"
                    aria-hidden="true"
                  />
                  <Image
                    src="/honey-dipper.png"
                    alt="Honey dipper with fresh honey"
                    width={380}
                    height={200}
                    className="relative z-10 h-auto w-[260px] object-contain drop-shadow-[0_18px_26px_rgba(70,46,8,0.18)]"
                  />
                </div>
              </div>

              <p className="mt-8 text-[14.5px] leading-[1.85] text-stone-500">
                Our direction combines clean design with warmth and credibility,
                so the brand can feel premium without pretending to be bigger
                than it is. The result is a local business presentation that
                still feels polished and memorable.
              </p>

              <div className="mt-7 space-y-2.5">
                {[
                  { n: "01", label: "Browse honey and apitherapy products" },
                  { n: "02", label: "Discover prices in Kenyan shillings" },
                  { n: "03", label: "Visit the Ruiru shop or make an inquiry" },
                ].map((step) => (
                  <div
                    key={step.n}
                    className="flex items-center gap-4 rounded-xl border border-stone-100 bg-white px-4 py-3.5"
                  >
                    <span className="text-[11px] font-black text-amber-500">
                      {step.n}
                    </span>
                    <span className="text-[13px] font-medium text-stone-600">
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════ TESTIMONIALS */}
      <section id="benefits" className="relative z-10 w-full bg-stone-50/80 py-24">
        <div className="mx-auto max-w-screen-xl px-5 sm:px-8 lg:px-12">
          <div className="mb-14 text-center">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.42em] text-amber-600">
              Customer voice
            </p>
            <h2
              className="text-[clamp(1.8rem,3.5vw,2.8rem)] font-black leading-tight tracking-tight text-stone-950"
              style={{ fontFamily: "'Georgia', serif" }}
            >
              A small brand, remembered through experience
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <div
                key={t.name}
                className="group flex flex-col rounded-3xl border border-stone-100 bg-white p-8 shadow-[0_3px_20px_rgba(20,14,5,0.06)] transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_12px_40px_rgba(20,14,5,0.10)]"
              >
                <div
                  className="mb-3 select-none text-[42px] font-black leading-none text-amber-200"
                  aria-hidden="true"
                >
                  "
                </div>
                <p className="flex-1 text-[14.5px] leading-[1.85] text-stone-600">
                  {t.quote}
                </p>
                <div className="mt-6 border-t border-stone-100 pt-5">
                  <div className="mb-2.5 flex gap-0.5" aria-label={`${t.stars} out of 5 stars`}>
                    {Array.from({ length: t.stars }).map((_, i) => (
                      <span key={i} className="text-amber-400" aria-hidden="true">
                        ★
                      </span>
                    ))}
                  </div>
                  <p className="text-[14px] font-bold text-stone-800">{t.name}</p>
                  <p className="text-[12px] text-stone-400">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════ CTA */}
      <section id="contact" className="relative z-10 w-full py-24">
        <div className="mx-auto max-w-screen-xl px-5 sm:px-8 lg:px-12">
          <div className="relative overflow-hidden rounded-[40px] border border-amber-100/60 bg-gradient-to-br from-amber-50 via-white to-sky-50 px-8 py-16 shadow-[0_12px_56px_rgba(30,20,5,0.09)] md:px-16 md:py-20">
            <div
              className="pointer-events-none absolute -right-20 -top-16 h-64 w-64 rounded-full bg-amber-200/40 blur-3xl"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute -bottom-20 -left-16 h-72 w-72 rounded-full bg-sky-200/28 blur-3xl"
              aria-hidden="true"
            />

            <div className="relative flex flex-col gap-12 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-[52ch]">
                <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.42em] text-amber-600">
                  Visit or inquire
                </p>
                <h2
                  className="text-[clamp(1.9rem,4vw,3.2rem)] font-black leading-[1.06] tracking-tight text-stone-950"
                  style={{ fontFamily: "'Georgia', serif" }}
                >
                  Discover honey and apitherapy products from our Ruiru shop
                </h2>
                <p className="mt-5 text-[16px] leading-[1.82] text-stone-500">
                  We are building steadily and serving locally. Browse the range,
                  visit us in Ruiru, or reach out to learn more about availability
                  and product options.
                </p>

                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-stone-200 bg-white px-5 py-4 shadow-sm">
                    <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-stone-400">
                      Location
                    </p>
                    <p className="mt-2 text-[15px] font-semibold text-stone-800">
                      Ruiru, Kenya
                    </p>
                  </div>
                  <div className="rounded-2xl border border-stone-200 bg-white px-5 py-4 shadow-sm">
                    <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-stone-400">
                      Focus
                    </p>
                    <p className="mt-2 text-[15px] font-semibold text-stone-800">
                      Honey, bee products & apitherapy
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 lg:items-stretch">
                <a
                  href="#products"
                  className="group inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-amber-400 to-amber-500 px-10 py-4 text-[14px] font-bold text-amber-950 shadow-[0_8px_26px_rgba(245,158,11,0.36)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_14px_36px_rgba(245,158,11,0.46)]"
                >
                  View products
                  <span className="transition-transform duration-200 group-hover:translate-x-1">
                    →
                  </span>
                </a>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-xl border border-stone-200 bg-white px-10 py-4 text-[14px] font-medium text-stone-600 shadow-sm transition hover:border-stone-300 hover:text-stone-900"
                >
                  Sign in to your account
                </Link>
                <div className="mt-1 flex flex-wrap justify-center gap-4 text-[11px] font-semibold text-stone-400">
                  <span>📍 Ruiru shop</span>
                  <span>🍯 Local honey</span>
                  <span>🐝 Bee products</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════ FOOTER */}
      <footer className="relative z-10 border-t border-stone-100 bg-white">
        <div className="mx-auto max-w-screen-xl px-5 sm:px-8 lg:px-12">
          <div className="grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-sm">
                  <span className="text-[16px]" aria-hidden="true">
                    🐝
                  </span>
                </div>
                <span
                  className="text-[16px] font-black tracking-tight text-stone-900"
                  style={{ fontFamily: "'Georgia', serif" }}
                >
                  Pollinators Beekeepers Apitherapy
                </span>
              </div>
              <p className="mt-4 max-w-[36ch] text-[13px] leading-[1.8] text-stone-400">
                A growing Kenyan honey and bee-products brand serving customers
                through a local shop in Ruiru with warmth, simplicity, and care.
              </p>
              <div className="mt-5 flex gap-2.5">
                {["Instagram", "Facebook", "TikTok"].map((s) => (
                  <a
                    key={s}
                    href="#"
                    className="rounded-lg border border-stone-200 px-3 py-1.5 text-[11px] font-medium text-stone-500 transition hover:border-amber-300 hover:text-amber-700"
                  >
                    {s}
                  </a>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.32em] text-stone-400">
                Products
              </p>
              <ul className="space-y-2.5">
                {[
                  "Pure Raw Honey",
                  "Forest Honey",
                  "Bee Pollen",
                  "Propolis Tincture",
                  "Gift Packs",
                ].map((l) => (
                  <li key={l}>
                    <a
                      href="#products"
                      className="text-[13px] text-stone-500 transition hover:text-amber-700"
                    >
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.32em] text-stone-400">
                Company
              </p>
              <ul className="space-y-2.5">
                {["Our Story", "Beekeeping", "Apitherapy", "Ruiru Shop", "Contact"].map(
                  (l) => (
                    <li key={l}>
                      <a
                        href="#story"
                        className="text-[13px] text-stone-500 transition hover:text-amber-700"
                      >
                        {l}
                      </a>
                    </li>
                  )
                )}
              </ul>
            </div>
          </div>

          <div className="flex flex-col items-center justify-between gap-4 border-t border-stone-100 py-6 sm:flex-row">
            <p className="text-[12px] text-stone-400">
              © 2026 Pollinators Beekeepers Apitherapy. Ruiru, Kenya.
            </p>
            <div className="flex gap-5 text-[12px] text-stone-400">
              <a href="#" className="transition hover:text-amber-700">
                Privacy
              </a>
              <a href="#" className="transition hover:text-amber-700">
                Terms
              </a>
              <a href="#" className="transition hover:text-amber-700">
                Contact
              </a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}