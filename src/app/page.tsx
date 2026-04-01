import Image from "next/image";
import Link from "next/link";

export default function Page() {
  return (
    <main className="relative overflow-hidden bg-[#f7f7f4] text-[#2f2a26]">
      {/* Top honey drip */}
      <div className="absolute inset-x-0 top-0 z-10 h-24 bg-gradient-to-b from-[#f4c23d] to-[#f0b61d] shadow-[0_8px_30px_rgba(240,182,29,0.25)]">
        <div className="relative h-full w-full">
          <span className="absolute left-[4%] top-full h-10 w-5 rounded-b-full bg-[#f0b61d]" />
          <span className="absolute left-[12%] top-full h-16 w-6 rounded-b-full bg-[#f0b61d]" />
          <span className="absolute left-[26%] top-full h-8 w-4 rounded-b-full bg-[#f0b61d]" />
          <span className="absolute left-[47%] top-full h-12 w-5 rounded-b-full bg-[#f0b61d]" />
          <span className="absolute left-[64%] top-full h-7 w-4 rounded-b-full bg-[#f0b61d]" />
          <span className="absolute left-[78%] top-full h-14 w-6 rounded-b-full bg-[#f0b61d]" />
          <span className="absolute left-[90%] top-full h-9 w-4 rounded-b-full bg-[#f0b61d]" />
        </div>
      </div>

      {/* Floating decorative dots */}
      <div className="pointer-events-none absolute inset-0">
        <span className="absolute left-8 top-[26rem] h-8 w-8 rounded-full bg-[#f2bb2b]/70 blur-[1px]" />
        <span className="absolute left-16 top-[30rem] h-4 w-4 rounded-full bg-[#ffd564]/70" />
        <span className="absolute right-20 top-[52rem] h-20 w-20 rounded-full bg-[#f2bb2b]/35 blur-[1px]" />
        <span className="absolute right-10 top-[58rem] h-6 w-6 rounded-full bg-[#ffd564]/80" />
        <span className="absolute left-[22%] bottom-40 h-5 w-5 rounded-full bg-[#f2bb2b]/50" />
        <span className="absolute right-[18%] bottom-24 h-12 w-12 rounded-full bg-[#f2bb2b]/25" />
      </div>

      {/* Simple SVG dotted path */}
      <svg
        className="pointer-events-none absolute left-0 top-28 h-[1400px] w-full opacity-50"
        viewBox="0 0 1440 1400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M40 180C140 260 260 230 340 300C430 380 350 510 500 570C620 620 760 520 830 610C900 700 780 810 860 910C940 1010 1120 980 1210 1090C1270 1160 1270 1240 1360 1290"
          stroke="#7f95c8"
          strokeWidth="2.5"
          strokeDasharray="8 9"
          strokeLinecap="round"
        />
        <circle cx="340" cy="300" r="8" fill="#f5cd54" />
        <circle cx="500" cy="570" r="8" fill="#9db7ff" />
        <circle cx="830" cy="610" r="8" fill="#9db7ff" />
        <circle cx="860" cy="910" r="8" fill="#9db7ff" />
        <circle cx="1210" cy="1090" r="8" fill="#f5cd54" />
      </svg>

      {/* Header */}
      <section className="relative z-20 mx-auto flex max-w-7xl flex-col items-center px-6 pb-8 pt-36 text-center">
        <p className="mb-2 text-lg text-[#6e655d]">Online store</p>
        <h1 className="font-serif text-5xl font-bold tracking-tight text-[#2f2a26] md:text-6xl">
          Organic honey
        </h1>
        <p className="mt-3 text-base text-[#7a7169] md:text-lg">
          Pure, golden, natural sweetness from the manufacturer
        </p>
      </section>

      {/* Hero card */}
      <section className="relative z-20 mx-auto max-w-6xl px-4 pb-24">
        <div className="relative overflow-hidden rounded-[32px] border border-white/60 bg-white/80 shadow-[0_15px_60px_rgba(45,36,22,0.08)] backdrop-blur">
          {/* top nav */}
          <div className="flex items-center justify-between border-b border-[#efe9de] px-6 py-5 md:px-10">
            <div>
              <p className="text-lg font-black uppercase tracking-wide text-[#db9f00]">
                Honey Grove
              </p>
            </div>

            <nav className="hidden gap-8 text-sm text-[#5f5852] md:flex">
              <a href="#home" className="transition hover:text-[#db9f00]">
                Home
              </a>
              <a href="#products" className="transition hover:text-[#db9f00]">
                Our Products
              </a>
              <a href="#about" className="transition hover:text-[#db9f00]">
                About
              </a>
              <a href="#delivery" className="transition hover:text-[#db9f00]">
                Delivery
              </a>
              <a href="#contact" className="transition hover:text-[#db9f00]">
                Contact
              </a>
            </nav>

            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="rounded-full border border-[#ddd4c7] px-4 py-2 text-sm font-medium text-[#524a44] transition hover:bg-[#faf7f2]"
              >
                Login
              </Link>

              <a
                href="#products"
                className="rounded-full bg-[#f2bb2b] px-4 py-2 text-sm font-semibold text-[#3c2d0b] shadow-sm transition hover:scale-[1.02] hover:bg-[#eab51b]"
              >
                Shop now
              </a>
            </div>
          </div>

          <div className="grid items-center gap-10 px-6 py-10 md:grid-cols-2 md:px-10 md:py-14">
            <div>
              <p className="mb-3 text-sm uppercase tracking-[0.3em] text-[#c9a651]">
                Natural product
              </p>
              <h2 className="max-w-lg font-serif text-4xl font-bold leading-tight md:text-5xl">
                Pure honey for a healthy and cozy lifestyle
              </h2>

              <ul className="mt-6 space-y-3 text-lg text-[#625952]">
                <li>Ideal for breakfast</li>
                <li>Perfect natural sugar alternative</li>
                <li>Delicious, healthy, and organic</li>
              </ul>

              <div className="mt-8 flex flex-wrap gap-4">
                <a
                  href="#products"
                  className="rounded-full bg-[#f2bb2b] px-6 py-3 text-sm font-semibold text-[#3c2d0b] transition hover:scale-[1.02] hover:bg-[#eab51b]"
                >
                  View products
                </a>
                <a
                  href="#about"
                  className="rounded-full border border-[#ddd4c7] px-6 py-3 text-sm font-medium text-[#524a44] transition hover:bg-[#faf7f2]"
                >
                  Learn more
                </a>
              </div>
            </div>

            <div className="relative flex items-center justify-center">
              <div className="absolute h-[360px] w-[360px] rounded-full bg-[#fff4cf]" />
              <div className="absolute h-[280px] w-[280px] rounded-full border border-dashed border-[#d7d2c7]" />

              <div className="relative z-10 rounded-[28px] bg-white p-6 shadow-[0_15px_40px_rgba(50,40,20,0.12)]">
                <Image
                  src="/honey-.png"
                  alt="Jar of organic honey"
                  width={340}
                  height={340}
                  className="h-auto w-[240px] object-contain md:w-[300px]"
                />
              </div>

              <span className="absolute left-4 top-10 text-2xl">🐝</span>
              <span className="absolute right-8 top-4 text-xl">🐝</span>
              <span className="absolute bottom-8 right-14 text-2xl">🐝</span>
            </div>
          </div>

          <div className="h-20 bg-[#eef2ff] [clip-path:ellipse(72%_100%_at_50%_100%)]" />
        </div>
      </section>

      {/* Research / story section */}
      <section className="relative z-20 mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-14 md:grid-cols-2">
          <div>
            <h3 className="font-serif text-4xl font-bold">Research</h3>

            <div className="mt-14 space-y-12">
              <div>
                <h4 className="mb-3 text-2xl font-bold">Goals and objectives</h4>
                <ul className="space-y-2 text-[#5d5751]">
                  <li>• Create an organic, warm, and inviting design</li>
                  <li>• Improve usability and product discovery</li>
                  <li>• Increase conversions with a cleaner layout</li>
                </ul>
              </div>

              <div>
                <h4 className="mb-3 text-2xl font-bold">Prototype</h4>
                <p className="max-w-md leading-7 text-[#5d5751]">
                  The design focuses on an easy customer journey, from landing
                  page exploration to browsing products and learning more about
                  the farm and production process.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-12 pt-2">
            <div>
              <h4 className="mb-3 text-2xl font-bold">About</h4>
              <p className="max-w-md leading-7 text-[#5d5751]">
                Honey Grove is an organic honey brand focused on providing pure,
                healthy, and naturally harvested honey. The site design reflects
                softness, trust, warmth, and simplicity.
              </p>
            </div>

            <div>
              <h4 className="mb-3 text-2xl font-bold">My vision</h4>
              <p className="max-w-md leading-7 text-[#5d5751]">
                I wanted the website to feel comforting and natural, while still
                looking modern. The key idea was to combine coziness with clear
                usability, so customers can browse and shop effortlessly.
              </p>
            </div>

            <div className="relative mt-6 flex h-44 items-center justify-center rounded-[28px] bg-[#fff8df] shadow-[0_10px_30px_rgba(60,45,10,0.08)]">
              <Image
                src="/honey-dipper.png"
                alt="Honey dipper"
                width={340}
                height={160}
                className="h-auto w-[260px] object-contain"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Soft divider section */}
      <section className="relative z-20 bg-[#eef2ff] py-24">
        <div className="absolute inset-x-0 top-0 h-20 bg-[#f7f7f4] [clip-path:ellipse(70%_100%_at_50%_0%)]" />
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-10 md:grid-cols-3">
            <div className="rounded-[28px] bg-white p-8 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
              <h5 className="mb-3 text-xl font-bold">Main page</h5>
              <p className="leading-7 text-[#5d5751]">
                A warm hero section with clear product value, beautiful
                visuals, and a strong call to action.
              </p>
            </div>

            <div className="rounded-[28px] bg-white p-8 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
              <h5 className="mb-3 text-xl font-bold">Catalog & product cards</h5>
              <p className="leading-7 text-[#5d5751]">
                Clean product browsing, simple filters, and product cards that
                highlight quality and purity.
              </p>
            </div>

            <div className="rounded-[28px] bg-white p-8 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
              <h5 className="mb-3 text-xl font-bold">About the farm</h5>
              <p className="leading-7 text-[#5d5751]">
                A storytelling section about the brand, harvesting process, and
                natural ingredients.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-20 px-6 py-10 text-center text-sm text-[#7a7169]">
        <p>© 2026 Honey Grove. Crafted with warmth and simplicity.</p>
      </footer>
    </main>
  );
}