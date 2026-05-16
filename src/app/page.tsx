"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

const PRODUCTS = [
  {
    id: 1,
    name: "Beeswax Lip Balm",
    subtitle: "Natural Protection · Long Lasting",
    desc: "Crafted with pure Kenyan beeswax and coconut oil to keep your lips hydrated and protected from the sun and wind.",
    price: 350,
    weight: "15g",
    badge: "Best Seller",
    badgeColor: "bg-amber-400 text-amber-950",
    imageBg: "from-amber-50 via-yellow-50 to-orange-50",
    accentHex: "#d4920a",
    tags: ["All", "Skincare", "Beeswax"],
    img: "/images/lipbalm.jpg",
  },
  {
    id: 2,
    name: "Pure Forest Honey",
    subtitle: "Kenyan Forest Regions · Bold",
    desc: "A deeper, fuller-bodied honey with a darker tone and stronger flavour for those who enjoy a richer taste.",
    price: 1100,
    weight: "500g",
    badge: "Bold Taste",
    badgeColor: "bg-stone-900 text-amber-200",
    imageBg: "from-orange-50 via-amber-50 to-yellow-50",
    accentHex: "#92400e",
    tags: ["All", "Dark", "Raw"],
    img: "/images/honey.jpg",
  },
  {
    id: 3,
    name: "Organic Honey Drip",
    subtitle: "Light & Floral · Delicate",
    desc: "Harvested from acacia blooms, this honey offers a clean floral taste, perfect for drizzling over breakfast.",
    price: 950,
    weight: "500g",
    badge: "Light",
    badgeColor: "bg-sky-100 text-sky-800",
    imageBg: "from-stone-50 via-amber-50 to-yellow-50",
    accentHex: "#4f73c0",
    tags: ["All", "Mild", "Floral"],
    img: "/images/honey drip.jpeg",
  },
  {
    id: 4,
    name: "Honey Infused Shampoo",
    subtitle: "Moisturizing · Scalp Care",
    desc: "A gentle, sulfate-free formula that uses the natural humectant properties of honey to strengthen and shine your hair.",
    price: 1200,
    weight: "250ml",
    badge: "New Arrival",
    badgeColor: "bg-orange-100 text-orange-700",
    imageBg: "from-orange-50 via-yellow-50 to-amber-50",
    accentHex: "#c2570b",
    tags: ["All", "Haircare", "Wellness"],
    img: "/images/shampoo.jpg",
  },
  {
    id: 5,
    name: "Turmeric & Honey Soap",
    subtitle: "Brightening · Gentle Cleansing",
    desc: "Combines the anti-inflammatory power of turmeric with the antibacterial benefits of raw honey for glowing skin.",
    price: 450,
    weight: "100g",
    badge: "Fresh Pick",
    badgeColor: "bg-yellow-100 text-yellow-800",
    imageBg: "from-yellow-50 via-amber-50 to-orange-50",
    accentHex: "#b45309",
    tags: ["All", "Skincare", "Handmade"],
    img: "/images/tumeric_soap.jpg",
  },
  {
    id: 7,
    name: "Propolis Tincture",
    subtitle: "Immune Support · Pure Resin",
    desc: "Highly concentrated propolis extract used for natural immunity and soothing sore throats.",
    price: 1500,
    weight: "30ml",
    badge: "Wellness",
    badgeColor: "bg-violet-100 text-violet-700",
    imageBg: "from-violet-50 via-amber-50 to-yellow-50",
    accentHex: "#6d28d9",
    tags: ["All", "Apitherapy", "Wellness"],
    img: "/images/propolis.jpg",
  },
  {
    id: 8,
    name: "Honey & Nut Granola",
    subtitle: "Toasted · Naturally Sweetened",
    desc: "Crunchy clusters of oats and nuts toasted in our signature honey for the perfect healthy breakfast.",
    price: 800,
    weight: "400g",
    badge: "Healthy Choice",
    badgeColor: "bg-rose-100 text-rose-700",
    imageBg: "from-rose-50 via-amber-50 to-yellow-50",
    accentHex: "#be185d",
    tags: ["All", "Food", "Breakfast"],
    img: "/images/granola.jpg",
  },
];

const FEATURES = [
  {
    icon: "🐝",
    title: "Natural beekeeping focus",
    body: "Our products are shaped by care, simplicity, and respect for the bees.",
  },
  {
    icon: "🍯",
    title: "Pure honey, local warmth",
    body: "Prepared for everyday homes, gifting, tea, breakfast, and wellness.",
  },
  {
    icon: "📍",
    title: "Visit us in Ruiru",
    body: "Serving customers locally through our physical shop in Ruiru, Kenya.",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "The honey tastes natural and clean. You can tell it has not been overprocessed.",
    name: "Wanjiru M.",
    role: "Customer, Ruiru",
  },
  {
    quote:
      "I like that the products feel local and genuine. The ginger honey is one of my favourites.",
    name: "Brian K.",
    role: "Customer, Nairobi",
  },
  {
    quote:
      "Their shop experience feels personal, and the products make great gifts for family too.",
    name: "Mercy N.",
    role: "Customer, Kiambu",
  },
];

const FILTERS = ["All", "Mild", "Dark", "Wellness", "Gift", "Apitherapy"];

function formatKES(value: number) {
  return `KSh ${value.toLocaleString("en-KE")}`;
}

function TitleStroke({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative inline-block">
      <span className="relative z-10">{children}</span>
      <svg
        className="absolute left-0 top-[76%] z-0 w-full"
        viewBox="0 0 420 34"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M10 18C70 10 155 10 228 14C292 17 345 17 408 14"
          stroke="#f2c75c"
          strokeWidth="8"
          strokeLinecap="round"
          opacity="0.72"
        />
      </svg>
    </div>
  );
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
    <main className="relative min-h-screen overflow-x-hidden bg-[#fcfbf7] text-stone-900">
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
        <div className="absolute -left-48 -top-48 h-[700px] w-[700px] rounded-full bg-amber-300/18 blur-[140px]" />
        <div className="absolute -right-36 top-0 h-[520px] w-[520px] rounded-full bg-yellow-100/25 blur-[120px]" />
        <div className="absolute bottom-[-12%] left-[32%] h-[620px] w-[620px] rounded-full bg-orange-100/16 blur-[160px]" />
      </div>

      <header className="sticky top-0 z-40 w-full border-b border-black/10 bg-[#fcfbf7]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-screen-xl items-center justify-between px-5 py-4 sm:px-8 lg:px-12">
          <div className="leading-none">
            <p className="text-[9px] font-bold uppercase tracking-[0.38em] text-amber-600">
              Kenya
            </p>
            <p
              className="text-[15px] font-black tracking-tight text-stone-900"
              style={{ fontFamily: "'Georgia', serif" }}
            >
              Pollinator Beekeeping & Apitherapy
            </p>
          </div>

          <nav className="hidden items-center gap-8 text-[13px] font-medium text-stone-600 md:flex">
            {["Home", "Products", "Story", "Benefits", "Contact"].map((l) => (
              <a key={l} href={`#${l.toLowerCase()}`} className="transition hover:text-amber-700">
                {l}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              aria-label={`Shopping cart, ${cartCount} items`}
              className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-black bg-white text-stone-600"
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
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-black">
                  {cartCount}
                </span>
              )}
            </button>

            <Link
              href="/login"
              className="hidden rounded-xl border border-black bg-white px-4 py-2 text-[13px] font-medium text-stone-700 md:block"
            >
              Log in
            </Link>

            <a
              href="#products"
              className="rounded-xl border border-black bg-amber-500 px-5 py-2.5 text-[13px] font-bold text-black transition hover:bg-amber-400"
            >
              View products
            </a>
          </div>
        </div>
      </header>

      <section id="home" className="relative z-10 w-full overflow-hidden py-14 sm:py-20">
        <div className="mx-auto max-w-screen-xl px-5 sm:px-8 lg:px-12">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
            <div className="relative">
              <div className="mb-7 inline-flex items-center gap-2.5 rounded-full border border-black bg-amber-100 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.3em] text-amber-800">
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
                <span className="text-amber-600">
                  <TitleStroke>local care</TitleStroke>
                </span>
                <br />
                from Ruiru,
                <br />
                Kenya.
              </h1>

              <p className="mt-7 max-w-[46ch] text-[16px] leading-[1.82] text-stone-600">
                Pollinators Beekeepers Apitherapy offers honey and bee-derived
                products made for everyday use, gifting, and wellness. Visit our
                shop in Ruiru and discover products shaped by genuine local
                beekeeping.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-3.5">
                <a
                  href="#products"
                  className="inline-flex items-center gap-2 rounded-xl border border-black bg-amber-500 px-8 py-4 text-[14px] font-bold text-black transition hover:bg-amber-400"
                >
                  Explore collection →
                </a>
                <a
                  href="#story"
                  className="inline-flex items-center gap-2 rounded-xl border border-black bg-white px-8 py-4 text-[14px] font-medium text-stone-700"
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
                    className="rounded-2xl border border-black bg-white px-4 py-3"
                  >
                    <p className="text-[15px] font-black text-stone-900">{s.value}</p>
                    <p className="text-[11.5px] font-medium text-stone-500">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative flex min-h-[560px] items-center justify-center">
              <div className="absolute h-[460px] w-[460px] rounded-full border border-dashed border-amber-300/70" />
              <div className="absolute h-[540px] w-[540px] rounded-full border border-amber-100" />
              <div className="absolute h-[400px] w-[400px] rounded-full bg-amber-100/70 blur-[80px]" />

              <div className="relative z-10 w-full max-w-[380px] rounded-[34px] border-[1.5px] border-black bg-[#fffdf8] p-4 shadow-[0_24px_80px_rgba(60,40,10,0.12)]">
                <div className="relative overflow-hidden rounded-[28px] bg-[#f6f0d8]">
                  <div className="absolute left-4 top-4 z-10 rounded-full bg-amber-500 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.28em] text-black">
                    Local favourite
                  </div>

                  <div className="relative h-[360px] overflow-hidden">
                    <Image
                      src="/honey-.png"
                      alt="Jar of premium Kenyan honey"
                      fill
                      className="object-contain p-6"
                      priority
                    />
                  </div>

                  <div className="px-5 pb-5 pt-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-amber-700">
                      Kenyan honey · Natural
                    </p>
                    <div className="mt-2 flex items-end justify-between gap-4">
                      <h3
                        className="text-[22px] font-black leading-tight text-stone-900"
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
                      className="mt-4 w-full rounded-xl border border-black bg-amber-500 py-3 text-[13px] font-bold text-black transition hover:bg-amber-400"
                    >
                      {added === 0 ? "✓ Added!" : "Add to interest list"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="absolute right-[-14px] top-10 hidden w-[158px] rotate-[7deg] rounded-[20px] border border-black bg-white p-4 shadow-sm md:block">
                <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-amber-700">
                  Natural taste
                </p>
                <p className="mt-1.5 text-[12px] leading-[1.65] text-stone-600">
                  Rich, smooth, and made for tea, breakfast, and gifting.
                </p>
              </div>

              <div className="absolute -left-10 bottom-24 hidden w-[164px] -rotate-[4deg] rounded-[20px] border border-black bg-white p-4 shadow-sm md:block">
                <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-amber-700">
                  Apitherapy
                </p>
                <p className="mt-1.5 text-[12px] leading-[1.65] text-stone-600">
                  Explore honey, propolis, and other bee-based products.
                </p>
              </div>

              <div className="absolute bottom-6 right-[-8px] hidden w-[148px] rotate-[3deg] rounded-[20px] border border-black bg-sky-50 p-4 shadow-sm md:block">
                <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-sky-700">
                  Location
                </p>
                <p className="mt-1.5 text-[12px] leading-[1.65] text-sky-900/70">
                  Visit our shop in Ruiru for a closer look at our range.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="relative z-10 border-y border-black/10 bg-white/80">
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
                className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500"
              >
                <span>{t.icon}</span>
                <span>{t.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

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
              Bee products with a warm local identity
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-3xl border border-black bg-white p-8 shadow-sm"
              >
                <div className="mb-6 grid h-12 w-12 place-items-center rounded-2xl border border-black bg-amber-50 text-xl">
                  {f.icon}
                </div>
                <h3 className="text-[18px] font-black text-stone-900">{f.title}</h3>
                <p className="mt-3 text-[14px] leading-[1.8] text-stone-600">
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="products" className="relative z-10 w-full py-24">
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
                Honey and bee products for daily use, gifting, and wellness
              </h2>
            </div>
            <a
              href="#contact"
              className="w-fit shrink-0 rounded-xl border border-black bg-white px-6 py-3 text-[13px] font-medium text-stone-700"
            >
              Visit or inquire →
            </a>
          </div>

          <div className="mb-8 flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`rounded-full border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
                  activeFilter === f
                    ? "border-black bg-amber-500 text-black"
                    : "border-black/20 bg-white text-stone-600 hover:bg-amber-50"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((product) => (
              <article
                key={product.id}
                className="group overflow-hidden rounded-[28px] border-[1.5px] border-black bg-[#fffdf8] shadow-[0_10px_30px_rgba(30,20,5,0.08)] transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_18px_42px_rgba(30,20,5,0.12)]"
              >
                <div className="flex items-center justify-between px-4 pt-4">
                  <span
                    className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${product.badgeColor}`}
                  >
                    {product.badge}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-stone-300">
                    {product.weight}
                  </span>
                </div>

                <div
                  className={`relative mt-3 h-[320px] overflow-hidden bg-gradient-to-b ${product.imageBg}`}
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(255,255,255,0.55),transparent_52%)]" />
                  <div
                    className="absolute inset-x-[8%] bottom-4 h-10 rounded-full blur-2xl"
                    style={{ background: `${product.accentHex}22` }}
                  />
                  <Image
                    src={product.img}
                    alt={product.name}
                    fill
                    className="object-cover transition duration-500 group-hover:scale-[1.04]"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                </div>

                <div className="bg-[#fffdf8] p-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-amber-700">
                    {product.subtitle}
                  </p>

                  <h3
                    className="mt-2 text-[28px] font-black leading-[0.95] tracking-[-0.03em] text-stone-900"
                    style={{ fontFamily: "'Georgia', serif" }}
                  >
                    {product.name}
                  </h3>

                  <p className="mt-3 text-[13px] leading-[1.7] text-stone-600">
                    {product.desc}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {product.tags
                      .filter((tag) => tag !== "All")
                      .map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-black/10 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-stone-600"
                        >
                          {tag}
                        </span>
                      ))}
                  </div>

                  <div className="mt-5 flex items-end justify-between gap-3">
                    <div>
                      <p
                        className="text-[22px] font-black"
                        style={{ color: product.accentHex }}
                      >
                        {formatKES(product.price)}
                      </p>
                    </div>

                    <button
                      onClick={() => handleAdd(product.id)}
                      className="rounded-xl border border-black px-4 py-2 text-[12px] font-bold text-black transition hover:-translate-y-px"
                      style={{
                        background:
                          added === product.id
                            ? "#86efac"
                            : "linear-gradient(180deg,#fbbf24 0%, #f59e0b 100%)",
                      }}
                    >
                      {added === product.id ? "✓ Added" : "Add"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="story" className="relative z-10 w-full py-24">
        <div className="mx-auto max-w-screen-xl px-5 sm:px-8 lg:px-12">
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="rounded-3xl border border-black bg-white p-10 md:p-12">
              <p className="text-[10px] font-bold uppercase tracking-[0.38em] text-amber-600">
                Our story
              </p>
              <h2
                className="mt-4 max-w-[22ch] text-[clamp(1.8rem,3vw,2.6rem)] font-black leading-[1.08] tracking-tight text-stone-950"
                style={{ fontFamily: "'Georgia', serif" }}
              >
                A growing Kenyan brand built around bees, honey, and care
              </h2>
              <p className="mt-5 max-w-[50ch] text-[15px] leading-[1.85] text-stone-600">
                Pollinators Beekeepers Apitherapy is still growing, but the
                vision is clear: offer accessible honey and bee-based products
                rooted in local identity, practical quality, and meaningful
                customer trust.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-black bg-amber-50 p-5">
                  <p className="text-[15px] font-black text-stone-900">Local warmth</p>
                  <p className="mt-2 text-[13px] leading-[1.7] text-stone-600">
                    A brand experience that feels welcoming, familiar, and proudly Kenyan.
                  </p>
                </div>
                <div className="rounded-2xl border border-black bg-sky-50 p-5">
                  <p className="text-[15px] font-black text-stone-900">Honest growth</p>
                  <p className="mt-2 text-[13px] leading-[1.7] text-stone-600">
                    A real local shop, local customers, and steady growth.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-black bg-[#fffdf8] p-10 md:p-12">
              <div className="overflow-hidden rounded-2xl bg-gradient-to-b from-amber-50 to-yellow-50">
                <div className="relative h-64 w-full">
                  <Image
                    src="/images/dripper.jpg"
                    alt="Honey dipper with fresh honey"
                    fill
                    className="object-cover"
                  />
                </div>
              </div>

              <p className="mt-8 text-[14.5px] leading-[1.85] text-stone-600">
                The direction blends warm editorial styling with clean modern cards,
                so the business feels premium, local, and believable at the same time.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="benefits" className="relative z-10 w-full py-24">
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
                className="rounded-3xl border border-black bg-white p-8"
              >
                <div className="mb-3 text-[42px] font-black leading-none text-amber-300">
                  "
                </div>
                <p className="flex-1 text-[14.5px] leading-[1.85] text-stone-600">
                  {t.quote}
                </p>
                <div className="mt-6 border-t border-black/10 pt-5">
                  <p className="text-[14px] font-bold text-stone-800">{t.name}</p>
                  <p className="text-[12px] text-stone-500">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="relative z-10 w-full py-24">
        <div className="mx-auto max-w-screen-xl px-5 sm:px-8 lg:px-12">
          <div className="rounded-[40px] border border-black bg-gradient-to-br from-amber-50 via-[#fffdf8] to-sky-50 px-8 py-16 md:px-16 md:py-20">
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
                <p className="mt-5 text-[16px] leading-[1.82] text-stone-600">
                  Browse the range, visit us in Ruiru, or reach out to learn more
                  about availability and product options.
                </p>
              </div>

              <div className="flex flex-col gap-3 lg:items-stretch">
                <a
                  href="#products"
                  className="inline-flex items-center justify-center rounded-xl border border-black bg-amber-500 px-10 py-4 text-[14px] font-bold text-black"
                >
                  View products
                </a>
                
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-black/10 bg-[#fcfbf7]">
        <div className="mx-auto max-w-screen-xl px-5 sm:px-8 lg:px-12">
          <div className="grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <span
                className="text-[16px] font-black tracking-tight text-stone-900"
                style={{ fontFamily: "'Georgia', serif" }}
              >
                Pollinator Beekeeping & Apitherapy
              </span>
              <p className="mt-4 max-w-[36ch] text-[13px] leading-[1.8] text-stone-500">
                A growing Kenyan honey and bee-products brand serving customers
                through a local shop in Ruiru with warmth, simplicity, and care.
              </p>
            </div>

            <div>
              <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.32em] text-stone-400">
                Products
              </p>
              <ul className="space-y-2.5">
                {["Pure Raw Honey", "Forest Honey", "Bee Pollen", "Propolis Tincture", "Gift Packs"].map((l) => (
                  <li key={l}>
                    <a href="#products" className="text-[13px] text-stone-600 hover:text-amber-700">
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
                {["Our Story", "Beekeeping", "Apitherapy", "Ruiru Shop", "Contact"].map((l) => (
                  <li key={l}>
                    <a href="#story" className="text-[13px] text-stone-600 hover:text-amber-700">
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex flex-col items-center justify-between gap-4 border-t border-black/10 py-6 sm:flex-row">
            <p className="text-[12px] text-stone-500">
              © 2026 Pollinators Beekeepers Apitherapy. Ruiru, Kenya.
            </p>
            <div className="flex gap-5 text-[12px] text-stone-500">
              <a href="#">Privacy</a>
              <a href="#">Terms</a>
              <a href="#">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}