"use client";

import { useState, useEffect, useRef } from "react";
import styles from "./page.module.css";

/* ── DATA ─────────────────────────────────────────── */
const TABS = ["Honey", "Drinks", "Desserts", "Gift Sets"];

type Product = {
  id: number; name: string; weight: string;
  price: string; badge: string; emoji: string;
};

const PRODUCTS: Record<string, Product[]> = {
  Honey: [
    { id: 1,  name: "Wildflower Honey",  weight: "500 g",    price: "€12.90", badge: "Bestseller", emoji: "🍯" },
    { id: 2,  name: "Forest Dark Honey", weight: "500 g",    price: "€14.50", badge: "Raw",         emoji: "🌲" },
    { id: 3,  name: "Linden Blossom",    weight: "300 g",    price: "€10.00", badge: "Light",       emoji: "🌸" },
    { id: 4,  name: "Mountain Thyme",    weight: "300 g",    price: "€15.90", badge: "Premium",     emoji: "🏔️" },
  ],
  Drinks: [
    { id: 5,  name: "Honey Kombucha",    weight: "330 ml",   price: "€4.50",  badge: "Fermented",   emoji: "🍵" },
    { id: 6,  name: "Mead Classic",      weight: "500 ml",   price: "€18.00", badge: "Craft",       emoji: "🍺" },
    { id: 7,  name: "Propolis Tincture", weight: "30 ml",    price: "€22.00", badge: "Immunity",    emoji: "🌿" },
    { id: 8,  name: "Pollen Smoothie",   weight: "250 g",    price: "€11.50", badge: "Superfood",   emoji: "🌼" },
  ],
  Desserts: [
    { id: 9,  name: "Honey Granola",     weight: "400 g",    price: "€9.80",  badge: "New",         emoji: "🌾" },
    { id: 10, name: "Honeycomb Slab",    weight: "200 g",    price: "€13.00", badge: "Pure",        emoji: "🍯" },
    { id: 11, name: "Bee Pollen",        weight: "250 g",    price: "€11.00", badge: "Natural",     emoji: "🌼" },
    { id: 12, name: "Walnut Nougat",     weight: "150 g",    price: "€8.50",  badge: "Artisan",     emoji: "🥜" },
  ],
  "Gift Sets": [
    { id: 13, name: "The Beekeeper Box", weight: "3 items",  price: "€34.90", badge: "Gift",        emoji: "🎁" },
    { id: 14, name: "Wellness Bundle",   weight: "4 items",  price: "€48.00", badge: "Popular",     emoji: "✨" },
    { id: 15, name: "Honey Tasting Set", weight: "5 × 100g", price: "€29.50", badge: "Explorer",    emoji: "🍯" },
    { id: 16, name: "Corporate Pack",    weight: "Custom",   price: "From €60", badge: "B2B",       emoji: "📦" },
  ],
};

const TESTIMONIALS = [
  { name: "Anna K.",    role: "Regular customer", avatar: "👩",   text: "Ordered the gift box for my family — everyone was amazed. So pure and rich, nothing like the supermarket." },
  { name: "Markus L.", role: "Health coach",      avatar: "👨‍🦱", text: "I recommend the propolis tincture to every client. Real results, clean ingredients. I reorder every month." },
  { name: "Sofia R.",  role: "Food blogger",      avatar: "👩‍💻", text: "The honeycomb slab is stunning AND delicious. Featured it three times on my page already!" },
  { name: "Jan B.",    role: "Corporate buyer",   avatar: "👨‍💼", text: "40 gift sets, elegant packaging, fast delivery. Every colleague absolutely loved theirs." },
];

export default function HivePage() {
  const [activeTab,      setActiveTab]      = useState("Honey");
  const [testimonialIdx, setTestimonialIdx] = useState(0);
  const [cartCount,      setCartCount]      = useState(0);
  const [addedId,        setAddedId]        = useState<number | null>(null);
  const [openFaq,        setOpenFaq]        = useState<number | null>(null);
  const [form,           setForm]           = useState({ name: "", phone: "", email: "", note: "" });
  const [sent,           setSent]           = useState(false);
  const formRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const t = setInterval(() => setTestimonialIdx(i => (i + 1) % TESTIMONIALS.length), 5000);
    return () => clearInterval(t);
  }, []);

  const addToCart = (id: number) => {
    setCartCount(c => c + 1);
    setAddedId(id);
    setTimeout(() => setAddedId(null), 1300);
  };

  const faqs = [
    { q: "Where are your hives?",          a: "Our hives sit in certified organic forests in the Carpathian mountains — far from agriculture and pollution." },
    { q: "Is the honey raw and unheated?", a: "Always. We never heat above 37°C (hive temperature), preserving all enzymes, pollen and aroma." },
    { q: "Do you ship internationally?",   a: "Yes — across the EU with insulated packaging. Orders over €45 ship free in glass, leak-proof jars." },
    { q: "Are any products vegan?",        a: "Our granola and pollen ranges are fully plant-based. Every product is clearly labelled." },
  ];

  return (
    <div className={styles.root}>

      {/* ══ TOP HONEY DRIP ══ */}
      <div className={styles.dripTop} aria-hidden="true">
        <svg viewBox="0 0 1440 110" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
          <rect width="1440" height="18" fill="#F5C842" />
          {/* drip 1 */}
          <path d="M80,18 Q85,60 80,80 Q75,100 80,108 Q85,115 90,108 Q95,100 90,80 Q85,60 90,18 Z" fill="#F5C842"/>
          {/* drip 2 */}
          <path d="M200,18 Q208,70 200,95 Q192,115 200,110 Q208,118 216,110 Q224,102 216,95 Q208,70 216,18 Z" fill="#F5C842"/>
          {/* drip 3 — long */}
          <path d="M350,18 Q356,80 350,105 Q344,120 352,114 Q360,120 368,114 Q376,105 368,80 Q362,40 370,18 Z" fill="#F5C842"/>
          {/* drip 4 */}
          <path d="M500,18 Q506,55 500,72 Q494,85 500,82 Q506,88 512,82 Q518,72 512,55 Q507,32 516,18 Z" fill="#F5C842"/>
          {/* drip 5 */}
          <path d="M660,18 Q666,65 660,88 Q654,105 660,100 Q667,107 673,100 Q680,90 673,65 Q668,38 676,18 Z" fill="#F5C842"/>
          {/* drip 6 */}
          <path d="M820,18 Q826,50 820,66 Q814,78 820,75 Q826,80 832,75 Q838,66 832,50 Q828,28 836,18 Z" fill="#F5C842"/>
          {/* drip 7 */}
          <path d="M990,18 Q998,72 990,98 Q982,115 990,110 Q998,118 1006,110 Q1014,100 1006,72 Q1000,44 1008,18 Z" fill="#F5C842"/>
          {/* drip 8 */}
          <path d="M1160,18 Q1166,58 1160,76 Q1154,88 1160,84 Q1166,90 1172,84 Q1178,74 1172,58 Q1168,34 1176,18 Z" fill="#F5C842"/>
          {/* drip 9 */}
          <path d="M1330,18 Q1338,68 1330,92 Q1322,108 1330,103 Q1338,110 1346,103 Q1354,94 1346,68 Q1340,40 1348,18 Z" fill="#F5C842"/>
        </svg>
      </div>

      {/* ══ ABOVE-NAV HEADER ══ */}
      <header className={styles.siteHeader}>
        <p className={styles.headerEyebrow}>Online store</p>
        <h1 className={styles.headerTitle}><em>Organic honey</em></h1>
        <p className={styles.headerSub}>From the manufacturer</p>
        {/* floating bees */}
        <span className={styles.beeTL} aria-hidden="true">🐝</span>
        <span className={styles.beeTR} aria-hidden="true">🐝</span>
      </header>

      {/* ══ NAV CARD ══ */}
      <div className={styles.navWrap}>
        <nav className={styles.nav}>
          <a href="#" className={styles.logo}>⬡ Alveare</a>
          <ul className={styles.navLinks}>
            <li><a href="#hero" className={styles.navActive}>Home</a></li>
            <li><a href="#shop">Our Products</a></li>
            <li><a href="#about">About Farm</a></li>
            <li><a href="#contact">Delivery &amp; Order</a></li>
            <li><a href="#contact">Contact</a></li>
          </ul>
          <div className={styles.navRight}>
            <button className={styles.cartBtn} onClick={() => {}}>
              🛒 {cartCount > 0 && <span className={styles.badge}>{cartCount}</span>}
            </button>
            <span className={styles.phone}>+31 76 555-0147</span>
          </div>
        </nav>
      </div>

      {/* ══ HERO ══ */}
      <section className={styles.hero} id="hero">
        {/* wavy blue-grey blob background */}
        <div className={styles.heroBlob} aria-hidden="true">
          <svg viewBox="0 0 900 480" xmlns="http://www.w3.org/2000/svg">
            <path d="M0,120 C150,60 300,200 450,140 C600,80 750,220 900,160 L900,480 L0,480 Z" fill="#EAF1F8" opacity="0.7"/>
            <path d="M0,200 C120,140 280,260 440,200 C600,140 760,260 900,200 L900,480 L0,480 Z" fill="#F0F5FB" opacity="0.5"/>
          </svg>
        </div>

        <div className={styles.heroInner}>
          <div className={styles.heroText}>
            <h2 className={styles.heroHeadline}>
              Natural honey 🐝<br />
              <small>made by bees</small>
            </h2>
            <ul className={styles.heroBullets}>
              <li>Perfect for breakfast</li>
              <li>A wonderful sugar substitute</li>
              <li>Tasty &amp; good for you</li>
            </ul>
            <button
              className={styles.btnYellow}
              onClick={() => formRef.current?.scrollIntoView({ behavior: "smooth" })}
            >
              View Products
            </button>
            <p className={styles.heroHint}>*When you really want something sweet</p>
          </div>
          <div className={styles.heroImageArea}>
            <span className={styles.heroJar} aria-label="Honey jar">🍯</span>
            <span className={styles.heroDipper} aria-hidden="true">🥄</span>
            <span className={styles.heroFlower} aria-hidden="true">🌼</span>
            <span className={styles.heroBeeA} aria-hidden="true">🐝</span>
            <span className={styles.heroBeeB} aria-hidden="true">🐝</span>
            <span className={styles.heroBeeC} aria-hidden="true">🐝</span>
          </div>
        </div>
      </section>

      {/* ══ WAVY TRANSITION ══ */}
      <div className={styles.waveDivider} aria-hidden="true">
        <svg viewBox="0 0 1440 80" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
          <path d="M0,40 C360,80 720,0 1080,40 C1260,60 1380,30 1440,40 L1440,80 L0,80 Z" fill="#FAFBFF"/>
        </svg>
      </div>

      {/* ══ ABOUT / GOALS / VISION (dashed path section) ══ */}
      <section className={styles.about} id="about">
        {/* scattered honey drops */}
        <span className={styles.drop} style={{ top: "5%",  left: "6%"  }}>🫙</span>
        <span className={styles.drop} style={{ top: "22%", left: "3%"  }}>💛</span>
        <span className={styles.drop} style={{ top: "50%", left: "8%"  }}>🫙</span>
        <span className={styles.drop} style={{ top: "72%", left: "2%"  }}>💛</span>
        <span className={styles.drop} style={{ top: "14%", right: "5%" }}>💛</span>
        <span className={styles.drop} style={{ top: "38%", right: "7%" }}>🫙</span>
        <span className={styles.drop} style={{ top: "60%", right: "4%" }}>💛</span>

        {/* dashed SVG path */}
        <div className={styles.dashedPath} aria-hidden="true">
          <svg viewBox="0 0 800 900" xmlns="http://www.w3.org/2000/svg" fill="none">
            <path
              d="M100,60 C200,80 350,40 450,120 C550,200 300,300 400,400 C500,500 620,420 580,560 C540,680 300,640 320,780"
              stroke="#F5C842"
              strokeWidth="2"
              strokeDasharray="8 10"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <div className={styles.aboutGrid}>
          {/* Research */}
          <div className={styles.aboutBlock} style={{ gridColumn: "1", gridRow: "1" }}>
            <h2 className={styles.sectionScript}>Research</h2>
          </div>

          {/* About */}
          <div className={styles.aboutBlock} style={{ gridColumn: "2", gridRow: "1" }}>
            <h3 className={styles.aboutBlockTitle}>About</h3>
            <p>Alveare is the bee products online store. Our main activity is the sale of healthy, organic honey — harvested from untouched European forests.</p>
          </div>

          {/* Goals */}
          <div className={styles.aboutBlock} style={{ gridColumn: "1", gridRow: "2" }}>
            <h3 className={styles.aboutBlockTitle}>Goals &amp; Objectives</h3>
            <ul className={styles.goalsList}>
              <li>Original design, creating a feeling of comfort and warmth</li>
              <li>High usability of site</li>
              <li>Boost of sales with new design</li>
            </ul>
          </div>

          {/* Vision */}
          <div className={styles.aboutBlock} style={{ gridColumn: "2", gridRow: "2" }}>
            <h3 className={styles.aboutBlockTitle}>My Vision</h3>
            <blockquote className={styles.visionQuote}>
              Usually, a feeling of coziness is created with a warm, natural style. We decided to go one step further — adding a touch of realism to every detail. The most important thing should always be the convenience of our customers.
            </blockquote>
          </div>

          {/* Prototype */}
          <div className={styles.aboutBlock} style={{ gridColumn: "1", gridRow: "3" }}>
            <h2 className={styles.sectionScript}>Prototype</h2>
            <p style={{ fontSize: "0.85rem", color: "#8a9a78", marginTop: 8 }}>
              The process begins with designing the model of user interaction with the site.
            </p>
          </div>
        </div>
      </section>

      {/* ══ SHOP ══ */}
      <section className={styles.shop} id="shop">
        <div className={styles.shopHead}>
          <span className={styles.eyebrow}>The Collection</span>
          <h2 className={styles.shopTitle}>Our Products</h2>
        </div>

        <div className={styles.tabs}>
          {TABS.map(t => (
            <button
              key={t}
              className={`${styles.tab} ${activeTab === t ? styles.tabOn : ""}`}
              onClick={() => setActiveTab(t)}
            >{t}</button>
          ))}
        </div>

        <div className={styles.productGrid}>
          {PRODUCTS[activeTab].map(p => (
            <div key={p.id} className={styles.productCard}>
              <span className={styles.productEmoji}>{p.emoji}</span>
              <span className={styles.productBadge}>{p.badge}</span>
              <h4>{p.name}</h4>
              <p className={styles.productWeight}>{p.weight}</p>
              <div className={styles.productFoot}>
                <strong>{p.price}</strong>
                <button
                  className={`${styles.addBtn} ${addedId === p.id ? styles.addDone : ""}`}
                  onClick={() => addToCart(p.id)}
                >
                  {addedId === p.id ? "✓" : "+"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ REVIEWS ══ */}
      <section className={styles.reviews} id="reviews">
        <span className={styles.eyebrow} style={{ display: "block", textAlign: "center" }}>Happy Customers</span>
        <h2 className={styles.reviewsTitle}>What people are saying</h2>

        <div className={styles.reviewCard}>
          <p className={styles.reviewText}>"{TESTIMONIALS[testimonialIdx].text}"</p>
          <div className={styles.reviewBy}>
            <span className={styles.reviewAvatar}>{TESTIMONIALS[testimonialIdx].avatar}</span>
            <div>
              <strong>{TESTIMONIALS[testimonialIdx].name}</strong>
              <span>{TESTIMONIALS[testimonialIdx].role}</span>
            </div>
          </div>
        </div>

        <div className={styles.reviewDots}>
          {TESTIMONIALS.map((_, i) => (
            <button
              key={i}
              className={`${styles.dot} ${i === testimonialIdx ? styles.dotOn : ""}`}
              onClick={() => setTestimonialIdx(i)}
              aria-label={`Review ${i + 1}`}
            />
          ))}
        </div>
      </section>

      {/* ══ FAQ ══ */}
      <section className={styles.faq}>
        <h2 className={styles.sectionScript} style={{ textAlign: "center", marginBottom: 36 }}>Questions</h2>
        <div className={styles.faqList}>
          {faqs.map((f, i) => (
            <div key={i} className={`${styles.faqItem} ${openFaq === i ? styles.faqOpen : ""}`}>
              <button className={styles.faqQ} onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                <span>{f.q}</span>
                <span className={styles.faqArrow}>{openFaq === i ? "−" : "+"}</span>
              </button>
              {openFaq === i && <p className={styles.faqA}>{f.a}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* ══ CONTACT ══ */}
      <section className={styles.contact} id="contact" ref={formRef}>
        <div className={styles.contactInner}>
          <div className={styles.contactText}>
            <h2 className={styles.sectionScript}>Order</h2>
            <p>Leave a request and we will contact you. Free EU shipping on orders over €45.</p>
            <span aria-hidden="true" style={{ fontSize: "3rem", display: "block", marginTop: 16 }}>🐝</span>
          </div>
          <div className={styles.formWrap}>
            {sent ? (
              <div className={styles.formThanks}>
                <span>🍯</span>
                <strong>Thank you!</strong>
                <p>We'll get back to you within 24 hours.</p>
              </div>
            ) : (
              <form className={styles.form} onSubmit={e => { e.preventDefault(); setSent(true); }}>
                <input type="text"  placeholder="Your name"    required value={form.name}  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                <input type="tel"   placeholder="Phone number"          value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                <input type="email" placeholder="E-mail"                value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                <textarea rows={3}  placeholder="Your message"          value={form.note}  onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
                <button type="submit" className={styles.btnYellow}>Send Request →</button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ══ FOOTER ══ */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <a href="#" className={styles.footerLogo}>⬡ Alveare</a>
          <nav className={styles.footerNav}>
            <a href="#hero">Main</a>
            <a href="#shop">Catalog &amp; product card</a>
            <a href="#about">About the farm</a>
          </nav>
          <p>© 2025 Alveare · hello@alveare.eu</p>
        </div>
      </footer>

      {/* bottom drip decoration */}
      <div className={styles.dripBottom} aria-hidden="true">
        <svg viewBox="0 0 400 60" xmlns="http://www.w3.org/2000/svg">
          <path d="M10,0 Q14,28 10,42 Q6,52 10,50 Q14,55 18,50 Q22,42 18,28 Q14,8 18,0 Z" fill="#F5C842"/>
          <path d="M80,0 Q86,35 80,52 Q74,62 80,58 Q86,64 92,58 Q98,50 92,35 Q88,10 94,0 Z" fill="#F5C842"/>
          <path d="M200,0 Q205,22 200,34 Q195,42 200,40 Q205,44 210,40 Q215,34 210,22 Q206,6 212,0 Z" fill="#F5C842"/>
          <path d="M310,0 Q317,30 310,46 Q303,58 310,54 Q317,60 324,54 Q331,44 324,30 Q319,8 326,0 Z" fill="#F5C842"/>
          <path d="M370,0 Q374,18 370,28 Q366,35 370,33 Q374,37 378,33 Q382,28 378,18 Q375,5 380,0 Z" fill="#F5C842"/>
        </svg>
      </div>
    </div>
  );
}