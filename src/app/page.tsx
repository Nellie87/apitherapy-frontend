"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

const PRODUCTS = [
  {
    id: 1,
    name: "Beeswax Lip Balm",
    subtitle: "Natural Protection",
    desc: "Crafted with pure Kenyan beeswax and coconut oil to keep lips hydrated and protected.",
    weight: "15g",
    badge: "Best Seller",
    imageBg: "from-amber-50 via-yellow-50 to-orange-50",
    tags: ["All", "Skincare", "Beeswax"],
    img: "/images/lipbalm.jpg",
  },
  {
    id: 2,
    name: "Pure Forest Honey",
    subtitle: "Kenyan Forest Honey",
    desc: "A deeper, fuller-bodied honey with a darker tone and rich natural flavour.",
    weight: "500g",
    badge: "Bold Taste",
    imageBg: "from-orange-50 via-amber-50 to-yellow-50",
    tags: ["All", "Honey", "Dark"],
    img: "/images/honey.jpg",
  },
  {
    id: 3,
    name: "Organic Honey Drip",
    subtitle: "Light & Floral",
    desc: "A clean floral honey, ideal for tea, breakfast, and everyday use.",
    weight: "500g",
    badge: "Light",
    imageBg: "from-stone-50 via-amber-50 to-yellow-50",
    tags: ["All", "Honey", "Mild"],
    img: "/images/honey drip.jpeg",
  },
  {
    id: 4,
    name: "Honey Infused Shampoo",
    subtitle: "Moisturizing Hair Care",
    desc: "A gentle honey-based shampoo made for scalp care and natural shine.",
    weight: "250ml",
    badge: "New Arrival",
    imageBg: "from-orange-50 via-yellow-50 to-amber-50",
    tags: ["All", "Haircare", "Wellness"],
    img: "/images/shampoo.jpg",
  },
  {
    id: 5,
    name: "Turmeric & Honey Soap",
    subtitle: "Gentle Cleansing",
    desc: "A handmade soap combining turmeric and honey for a simple skincare routine.",
    weight: "100g",
    badge: "Fresh Pick",
    imageBg: "from-yellow-50 via-amber-50 to-orange-50",
    tags: ["All", "Skincare", "Handmade"],
    img: "/images/tumeric_soap.jpg",
  },
  {
    id: 7,
    name: "Propolis Tincture",
    subtitle: "Apitherapy Support",
    desc: "A concentrated propolis extract prepared as part of the apitherapy product range.",
    weight: "30ml",
    badge: "Wellness",
    imageBg: "from-violet-50 via-amber-50 to-yellow-50",
    tags: ["All", "Apitherapy", "Wellness"],
    img: "/images/propolis.jpg",
  },
  {
    id: 8,
    name: "Honey & Nut Granola",
    subtitle: "Naturally Sweetened",
    desc: "Crunchy oat and nut clusters toasted with honey for a wholesome breakfast option.",
    weight: "400g",
    badge: "Healthy Choice",
    imageBg: "from-rose-50 via-amber-50 to-yellow-50",
    tags: ["All", "Food", "Breakfast"],
    img: "/images/granola.jpg",
  },
];

const FILTERS = ["All", "Honey", "Skincare", "Wellness", "Apitherapy", "Food"];

const FEATURES = [
  {
    title: "Natural beekeeping focus",
    body: "Products shaped by care, simplicity, and respect for bees.",
  },
  {
    title: "Local Kenyan identity",
    body: "A warm product range built around honey, wellness, and everyday use.",
  },
  {
    title: "Available in Ruiru",
    body: "Customers can visit the shop and explore the product range directly.",
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
      "I like that the products feel local and genuine. The honey is one of my favourites.",
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

function TitleStroke({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative inline-block">
      <span className="relative z-10">{children}</span>
      <span className="absolute left-0 top-[74%] z-0 h-3 w-full rounded-full bg-amber-300/60" />
    </span>
  );
}

export default function Page() {
  const [activeFilter, setActiveFilter] = useState("All");

  const filteredProducts = useMemo(() => {
    if (activeFilter === "All") return PRODUCTS;
    return PRODUCTS.filter((product) => product.tags.includes(activeFilter));
  }, [activeFilter]);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#fcfbf7] text-stone-900">
      <header className="sticky top-0 z-40 border-b border-black/10 bg-[#fcfbf7]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-screen-xl items-center justify-between px-5 py-4 sm:px-8 lg:px-12">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.35em] text-amber-600">
              Kenya
            </p>
            <p
              className="text-sm font-black text-stone-900 sm:text-base"
              style={{ fontFamily: "'Georgia', serif" }}
            >
              Pollinator Beekeeping & Apitherapy
            </p>
          </div>

          <nav className="hidden items-center gap-7 text-sm font-medium text-stone-600 md:flex">
            {["Home", "Products", "Story", "Benefits", "Contact"].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase()}`}
                className="hover:text-amber-700"
              >
                {item}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-xl border border-black bg-white px-4 py-2 text-sm font-medium text-stone-700"
            >
              Log in
            </Link>

            <a
              href="#products"
              className="hidden rounded-xl border border-black bg-amber-500 px-5 py-2 text-sm font-bold text-black hover:bg-amber-400 sm:inline-flex"
            >
              View products
            </a>
          </div>
        </div>
      </header>

      <section id="home" className="py-14 sm:py-20 lg:py-24">
        <div className="mx-auto grid max-w-screen-xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-2 lg:px-12">
          <div>
            <div className="mb-6 inline-flex rounded-full border border-black bg-amber-100 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.25em] text-amber-800">
              Pure Honey · Beekeeping · Apitherapy
            </div>

            <h1
              className="max-w-[13ch] text-[clamp(2.5rem,7vw,5rem)] font-black leading-[1] tracking-[-0.04em]"
              style={{ fontFamily: "'Georgia', serif" }}
            >
              Pure honey,
              <br />
              crafted with{" "}
              <span className="text-amber-600">
                <TitleStroke>local care</TitleStroke>
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-8 text-stone-600 sm:text-lg">
              Pollinators Beekeepers Apitherapy offers honey and bee-derived
              products made for everyday use, gifting, skincare, and wellness.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#products"
                className="rounded-xl border border-black bg-amber-500 px-7 py-4 text-sm font-bold text-black hover:bg-amber-400"
              >
                Explore products
              </a>

              <a
                href="#story"
                className="rounded-xl border border-black bg-white px-7 py-4 text-sm font-medium text-stone-700"
              >
                Our story
              </a>
            </div>

            <div className="mt-10 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
              {[
                ["Kenya", "Local business"],
                ["Ruiru", "Physical shop"],
                ["7+", "Products sold"],
                ["Natural", "Bee products"],
              ].map(([value, label]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-black bg-white px-4 py-3"
                >
                  <p className="font-black text-stone-900">{value}</p>
                  <p className="text-xs font-medium text-stone-500">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mx-auto w-full max-w-md">
            <div className="rounded-[32px] border border-black bg-[#fffdf8] p-4 shadow-[0_24px_70px_rgba(60,40,10,0.12)]">
              <div className="overflow-hidden rounded-[26px] bg-[#f6f0d8]">
                <div className="relative h-[320px] sm:h-[420px]">
                  <Image
                    src="/images/honey.jpg"
                    alt="Jar of Kenyan honey"
                    fill
                    priority
                    className="object-contain p-8"
                  />
                </div>

                <div className="px-5 pb-6">
                  <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-amber-700">
                    Featured product
                  </p>
                  <h3
                    className="mt-2 text-3xl font-black leading-none"
                    style={{ fontFamily: "'Georgia', serif" }}
                  >
                    Pure Raw Honey
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-stone-600">
                    A local favourite for tea, breakfast, gifting, and everyday
                    home use.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-black/10 bg-white/70">
        <div className="mx-auto grid max-w-screen-xl gap-3 px-5 py-5 text-center sm:grid-cols-3 sm:px-8 lg:grid-cols-6 lg:px-12">
          {[
            "Pure Honey",
            "Bee Products",
            "Natural Care",
            "Ruiru Shop",
            "Apitherapy",
            "Local Service",
          ].map((item) => (
            <p
              key={item}
              className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500"
            >
              {item}
            </p>
          ))}
        </div>
      </section>

      <section className="py-20 lg:py-24">
        <div className="mx-auto max-w-screen-xl px-5 sm:px-8 lg:px-12">
          <div className="mb-12 text-center">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.38em] text-amber-600">
              Why us
            </p>
            <h2
              className="text-[clamp(1.9rem,4vw,3rem)] font-black leading-tight"
              style={{ fontFamily: "'Georgia', serif" }}
            >
              Bee products with a warm local identity
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-3xl border border-black bg-white p-7"
              >
                <h3 className="text-lg font-black text-stone-900">
                  {feature.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-stone-600">
                  {feature.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="products" className="py-20 lg:py-24">
        <div className="mx-auto max-w-screen-xl px-5 sm:px-8 lg:px-12">
          <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.38em] text-amber-600">
                Products sold
              </p>
              <h2
                className="max-w-2xl text-[clamp(1.9rem,4vw,3rem)] font-black leading-tight"
                style={{ fontFamily: "'Georgia', serif" }}
              >
                Honey and bee products for daily use, gifting, skincare, and
                wellness
              </h2>
            </div>

            <a
              href="#contact"
              className="w-fit rounded-xl border border-black bg-white px-6 py-3 text-sm font-medium text-stone-700"
            >
              Visit or inquire
            </a>
          </div>

          <div className="mb-8 flex gap-2 overflow-x-auto pb-2 sm:flex-wrap sm:overflow-visible">
            {FILTERS.map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`shrink-0 rounded-full border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] transition ${
                  activeFilter === filter
                    ? "border-black bg-amber-500 text-black"
                    : "border-black/20 bg-white text-stone-600 hover:bg-amber-50"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((product) => (
              <article
                key={product.id}
                className="overflow-hidden rounded-[28px] border border-black bg-[#fffdf8] shadow-[0_10px_28px_rgba(30,20,5,0.07)]"
              >
                <div className="flex items-center justify-between gap-3 px-4 pt-4">
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-800">
                    {product.badge}
                  </span>

                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400">
                    {product.weight}
                  </span>
                </div>

                <div
                  className={`relative mt-3 h-64 overflow-hidden bg-gradient-to-b sm:h-72 ${product.imageBg}`}
                >
                  <Image
                    src={product.img}
                    alt={product.name}
                    fill
                    className="object-cover transition duration-500 hover:scale-[1.03]"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                </div>

                <div className="p-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-amber-700">
                    {product.subtitle}
                  </p>

                  <h3
                    className="mt-2 text-2xl font-black leading-tight text-stone-900"
                    style={{ fontFamily: "'Georgia', serif" }}
                  >
                    {product.name}
                  </h3>

                  <p className="mt-3 text-sm leading-7 text-stone-600">
                    {product.desc}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {product.tags
                      .filter((tag) => tag !== "All")
                      .map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold text-stone-600"
                        >
                          {tag}
                        </span>
                      ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="story" className="py-20 lg:py-24">
        <div className="mx-auto grid max-w-screen-xl gap-8 px-5 sm:px-8 lg:grid-cols-2 lg:px-12">
          <div className="rounded-3xl border border-black bg-white p-8 md:p-12">
            <p className="text-[10px] font-bold uppercase tracking-[0.38em] text-amber-600">
              Our story
            </p>

            <h2
              className="mt-4 text-[clamp(1.8rem,3vw,2.6rem)] font-black leading-tight"
              style={{ fontFamily: "'Georgia', serif" }}
            >
              A growing Kenyan brand built around bees, honey, and care
            </h2>

            <p className="mt-5 text-sm leading-8 text-stone-600 sm:text-base">
              Pollinators Beekeepers Apitherapy is focused on accessible honey
              and bee-based products rooted in local identity, practical quality,
              and customer trust.
            </p>
          </div>

          <div className="overflow-hidden rounded-3xl border border-black bg-[#fffdf8]">
            <div className="relative h-72 sm:h-full sm:min-h-[380px]">
              <Image
                src="/images/dripper.jpg"
                alt="Honey dipper with fresh honey"
                fill
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      <section id="benefits" className="py-20 lg:py-24">
        <div className="mx-auto max-w-screen-xl px-5 sm:px-8 lg:px-12">
          <div className="mb-12 text-center">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.38em] text-amber-600">
              Customer voice
            </p>

            <h2
              className="text-[clamp(1.8rem,3.5vw,2.8rem)] font-black leading-tight"
              style={{ fontFamily: "'Georgia', serif" }}
            >
              A small brand remembered through experience
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {TESTIMONIALS.map((testimonial) => (
              <div
                key={testimonial.name}
                className="rounded-3xl border border-black bg-white p-7"
              >
                <p className="text-sm leading-8 text-stone-600">
                  “{testimonial.quote}”
                </p>

                <div className="mt-6 border-t border-black/10 pt-5">
                  <p className="text-sm font-bold text-stone-800">
                    {testimonial.name}
                  </p>
                  <p className="text-xs text-stone-500">{testimonial.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="py-20 lg:py-24">
        <div className="mx-auto max-w-screen-xl px-5 sm:px-8 lg:px-12">
          <div className="rounded-[32px] border border-black bg-gradient-to-br from-amber-50 via-[#fffdf8] to-sky-50 px-7 py-14 md:px-14 md:py-16">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.38em] text-amber-600">
                  Visit or inquire
                </p>

                <h2
                  className="text-[clamp(1.9rem,4vw,3.2rem)] font-black leading-tight"
                  style={{ fontFamily: "'Georgia', serif" }}
                >
                  Discover honey and apitherapy products from our Ruiru shop
                </h2>

                <p className="mt-5 text-base leading-8 text-stone-600">
                  Browse the range, visit the shop, or reach out to learn more
                  about availability and product options.
                </p>
              </div>

              <a
                href="#products"
                className="w-fit rounded-xl border border-black bg-amber-500 px-8 py-4 text-sm font-bold text-black hover:bg-amber-400"
              >
                View products
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-black/10 bg-[#fcfbf7]">
        <div className="mx-auto max-w-screen-xl px-5 sm:px-8 lg:px-12">
          <div className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <p
                className="text-base font-black text-stone-900"
                style={{ fontFamily: "'Georgia', serif" }}
              >
                Pollinator Beekeeping & Apitherapy
              </p>

              <p className="mt-4 max-w-md text-sm leading-7 text-stone-500">
                A growing Kenyan honey and bee-products brand serving customers
                through a local shop in Ruiru with warmth, simplicity, and care.
              </p>
            </div>

            <div>
              <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.3em] text-stone-400">
                Products
              </p>

              <ul className="space-y-2.5">
                {[
                  "Pure Raw Honey",
                  "Forest Honey",
                  "Lip Balm",
                  "Propolis Tincture",
                  "Honey Soap",
                ].map((item) => (
                  <li key={item}>
                    <a
                      href="#products"
                      className="text-sm text-stone-600 hover:text-amber-700"
                    >
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.3em] text-stone-400">
                Company
              </p>

              <ul className="space-y-2.5">
                {["Our Story", "Beekeeping", "Apitherapy", "Ruiru Shop"].map(
                  (item) => (
                    <li key={item}>
                      <a
                        href="#story"
                        className="text-sm text-stone-600 hover:text-amber-700"
                      >
                        {item}
                      </a>
                    </li>
                  ),
                )}
              </ul>
            </div>
          </div>

          <div className="flex flex-col items-center justify-between gap-4 border-t border-black/10 py-6 sm:flex-row">
            <p className="text-xs text-stone-500">
              © 2026 Pollinators Beekeepers Apitherapy. Ruiru, Kenya.
            </p>

            <div className="flex gap-5 text-xs text-stone-500">
              <a href="#">Privacy</a>
              <a href="#">Terms</a>
              <a href="#contact">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}