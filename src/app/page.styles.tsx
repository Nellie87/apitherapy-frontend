export const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,300;0,400;0,600;0,700;0,900;1,300;1,400;1,700&family=DM+Sans:wght@300;400;500;600&family=Caveat:wght@500;600;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --honey:        #f5c200;
    --honey-drip:   #e8a800;
    --honey-pale:   #fff8e1;
    --honey-warm:   #fef3c0;
    --amber:        #d4830a;
    --amber-dark:   #a85e00;
    --green:        #6cc04a;
    --green-pale:   #e8f7e0;
    --green-dark:   #3e8a28;
    --dark:         #2d2417;
    --charcoal:     #1e1a14;
    --body:         #4a3f2f;
    --muted:        #9a8a6a;
    --border:       #ede5d0;
    --white:        #ffffff;
    --off-white:    #fafaf5;
    --cream:        #fdf8ef;
    --light-grey:   #f5f3ee;
  }

  html { scroll-behavior: smooth; }

  body {
    font-family: 'DM Sans', sans-serif;
    background: var(--white);
    color: var(--dark);
    overflow-x: hidden;
  }

  /* ══════════════════════════════
     HONEY DRIP TOP DECORATION
  ══════════════════════════════ */
  .honey-drip-bar {
    position: relative;
    height: 60px;
    overflow: hidden;
    pointer-events: none;
    z-index: 10;
  }
  .honey-drip-bar svg {
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
  }

  /* ══════════════════════════════
     NAV
  ══════════════════════════════ */
  .nav {
    background: var(--white);
    display: flex; align-items: center; justify-content: space-between;
    padding: 1rem 4rem;
    border-bottom: 1px solid var(--border);
    position: sticky; top: 0; z-index: 100;
    transition: box-shadow 0.3s;
  }
  .nav.scrolled { box-shadow: 0 4px 24px rgba(45,36,23,0.08); }

  .nav-logo { display: flex; align-items: center; gap: 0.5rem; text-decoration: none; }
  .nav-logo-icon {
    width: 38px; height: 38px; background: var(--honey);
    border-radius: 50%; display: flex; align-items: center; justify-content: center;
    font-size: 1.2rem;
  }
  .nav-logo-text { display: flex; flex-direction: column; line-height: 1.1; }
  .nav-logo-name {
    font-family: 'Fraunces', serif; font-size: 1rem; font-weight: 700;
    color: var(--dark); letter-spacing: -0.01em;
  }
  .nav-logo-sub {
    font-family: 'Caveat', cursive; font-size: 0.72rem; font-weight: 600;
    color: var(--green-dark);
  }

  .nav-links { display: flex; align-items: center; gap: 0.2rem; list-style: none; }
  .nav-links a {
    text-decoration: none; font-size: 0.82rem; font-weight: 500;
    color: var(--body); padding: 0.4rem 0.9rem; border-radius: 100px;
    transition: background 0.2s, color 0.2s;
  }
  .nav-links a:hover { background: var(--honey-warm); color: var(--amber-dark); }
  .nav-links a.active {
    font-weight: 600; color: var(--amber-dark);
    border-bottom: 2px solid var(--honey);
  }

  .nav-cart {
    width: 40px; height: 40px; background: var(--honey-warm);
    border: 1.5px solid var(--border); border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 1rem; cursor: pointer; position: relative;
    transition: background 0.2s;
  }
  .nav-cart:hover { background: var(--honey); }
  .cart-badge {
    position: absolute; top: -4px; right: -4px;
    width: 18px; height: 18px; background: var(--amber);
    border-radius: 50%; display: flex; align-items: center; justify-content: center;
    font-size: 0.6rem; font-weight: 700; color: white;
  }

  /* ══════════════════════════════
     HERO
  ══════════════════════════════ */
  .hero {
    background: var(--light-grey);
    position: relative; overflow: hidden;
    padding: 4rem 4rem 0;
    display: grid; grid-template-columns: 1fr 1fr;
    align-items: center; gap: 2rem;
    min-height: 500px;
  }

  /* Scattered bee decorations */
  .bee-deco {
    position: absolute; font-size: 1.8rem;
    animation: beeFly 6s ease-in-out infinite;
    pointer-events: none; user-select: none; z-index: 2;
    opacity: 0.85;
  }
  .bee-deco:nth-child(2) { animation-delay: 1.5s; animation-duration: 7s; }
  .bee-deco:nth-child(3) { animation-delay: 3s; animation-duration: 5s; }
  .bee-deco:nth-child(4) { animation-delay: 0.8s; animation-duration: 8s; }

  @keyframes beeFly {
    0%, 100% { transform: translateY(0) rotate(-5deg); }
    33%       { transform: translateY(-12px) rotate(5deg); }
    66%       { transform: translateY(-6px) rotate(-3deg); }
  }

  .hero-left { position: relative; z-index: 3; }
  .hero-store-label {
    font-family: 'DM Sans', sans-serif; font-size: 0.72rem; font-weight: 500;
    letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--muted); margin-bottom: 0.4rem;
  }
  .hero-title {
    font-family: 'Fraunces', serif; font-size: clamp(2.8rem, 5vw, 4.2rem);
    font-weight: 900; line-height: 1.05; color: var(--dark);
    letter-spacing: -0.02em; margin-bottom: 0.4rem;
  }
  .hero-subtitle {
    font-family: 'Fraunces', serif; font-size: 1rem; font-weight: 300;
    font-style: italic; color: var(--muted); margin-bottom: 1.5rem;
  }
  .hero-bullets { display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 2rem; }
  .hero-bullet {
    font-size: 0.9rem; color: var(--body); display: flex; align-items: center; gap: 0.5rem;
  }
  .hero-bullet::before { content: '🍃'; font-size: 0.85rem; }

  .btn-primary {
    background: var(--honey);
    color: var(--dark);
    border: none;
    padding: 0.85rem 2.2rem;
    border-radius: 100px;
    font-family: 'DM Sans', sans-serif;
    font-size: 0.85rem; font-weight: 600;
    cursor: pointer; text-decoration: none; display: inline-block;
    transition: background 0.2s, transform 0.2s, box-shadow 0.2s;
    box-shadow: 0 4px 20px rgba(245,194,0,0.4);
  }
  .btn-primary:hover {
    background: var(--honey-drip);
    transform: translateY(-2px);
    box-shadow: 0 8px 28px rgba(245,194,0,0.5);
  }

  .btn-outline {
    background: transparent; color: var(--dark);
    border: 1.5px solid var(--border);
    padding: 0.85rem 2rem; border-radius: 100px;
    font-family: 'DM Sans', sans-serif; font-size: 0.85rem; font-weight: 600;
    cursor: pointer; text-decoration: none; display: inline-block;
    transition: border-color 0.2s, background 0.2s, transform 0.2s;
  }
  .btn-outline:hover { border-color: var(--honey); background: var(--honey-warm); transform: translateY(-2px); }

  .hero-right {
    position: relative; z-index: 3;
    display: flex; justify-content: center; align-items: flex-end;
  }
  .hero-product-img {
    width: 340px; height: 380px;
    background: radial-gradient(ellipse at 50% 80%, rgba(245,194,0,0.25) 0%, transparent 70%);
    display: flex; align-items: center; justify-content: center;
    font-size: 12rem; position: relative;
    filter: drop-shadow(0 20px 40px rgba(200,140,0,0.3));
    animation: heroFloat 5s ease-in-out infinite;
  }
  @keyframes heroFloat {
    0%, 100% { transform: translateY(0); }
    50%       { transform: translateY(-12px); }
  }

  /* Wave divider */
  .wave-divider { display: block; width: 100%; line-height: 0; }
  .wave-divider svg { display: block; width: 100%; }

  /* ══════════════════════════════
     ABOUT / FEATURES STRIP
  ══════════════════════════════ */
  .features-strip {
    background: var(--white);
    padding: 4rem 4rem;
    display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 3rem;
  }
  .feature-col {}
  .feature-col-title {
    font-family: 'Fraunces', serif; font-size: 1.3rem; font-weight: 700;
    color: var(--dark); margin-bottom: 0.8rem;
  }
  .feature-col-body { font-size: 0.88rem; color: var(--body); line-height: 1.75; }
  .feature-list { list-style: none; margin-top: 0.6rem; display: flex; flex-direction: column; gap: 0.4rem; }
  .feature-list li {
    font-size: 0.85rem; color: var(--body); display: flex; align-items: flex-start; gap: 0.5rem; line-height: 1.5;
  }
  .feature-list li::before { content: '◆'; color: var(--honey); font-size: 0.5rem; margin-top: 0.35rem; flex-shrink: 0; }

  /* Research diagram area */
  .research-diagram {
    width: 100%; height: 160px;
    display: flex; align-items: center; justify-content: center;
    position: relative; margin-bottom: 1rem;
  }

  /* ══════════════════════════════
     FARM / DARK SECTION
  ══════════════════════════════ */
  .farm-section {
    background: var(--charcoal);
    position: relative; overflow: hidden;
    padding: 5rem 4rem;
  }
  .farm-section::before {
    content: '';
    position: absolute; inset: 0;
    background: radial-gradient(ellipse 60% 60% at 80% 20%, rgba(245,194,0,0.08) 0%, transparent 60%);
    pointer-events: none;
  }
  /* Honeycomb texture pattern */
  .farm-section::after {
    content: '';
    position: absolute; top: 0; right: 0;
    width: 400px; height: 400px;
    background-image: radial-gradient(circle at center, rgba(245,194,0,0.12) 1px, transparent 1px);
    background-size: 28px 28px;
    pointer-events: none;
  }

  .farm-header { margin-bottom: 3rem; position: relative; z-index: 2; }
  .farm-title {
    font-family: 'Fraunces', serif; font-size: clamp(2rem, 3.5vw, 2.8rem);
    font-weight: 700; color: var(--white); line-height: 1.2; margin-bottom: 1rem;
  }
  .farm-title span { color: var(--honey); font-style: italic; }
  .farm-desc { font-size: 0.9rem; color: rgba(255,255,255,0.6); line-height: 1.75; max-width: 600px; }

  .farm-grid {
    display: grid; grid-template-columns: 1fr 1fr 1fr;
    gap: 1.5rem; position: relative; z-index: 2; margin-bottom: 4rem;
  }

  .farm-card {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(245,194,0,0.2);
    border-radius: 20px; padding: 2rem 1.8rem;
    transition: background 0.3s, border-color 0.3s, transform 0.3s;
  }
  .farm-card:hover {
    background: rgba(245,194,0,0.1);
    border-color: rgba(245,194,0,0.5);
    transform: translateY(-4px);
  }
  .farm-card.featured {
    background: var(--honey);
    border-color: var(--honey);
  }
  .farm-card-icon {
    font-size: 2.2rem; margin-bottom: 1.2rem; display: block;
  }
  .farm-card-title {
    font-family: 'Fraunces', serif; font-size: 1.05rem; font-weight: 700;
    color: var(--white); margin-bottom: 0.7rem;
  }
  .farm-card.featured .farm-card-title { color: var(--dark); }
  .farm-card-desc { font-size: 0.83rem; color: rgba(255,255,255,0.55); line-height: 1.65; }
  .farm-card.featured .farm-card-desc { color: var(--dark); opacity: 0.75; }

  /* Benefits list in dark section */
  .benefits-row {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 3rem; align-items: center;
    position: relative; z-index: 2;
  }
  .benefits-list { display: flex; flex-direction: column; gap: 1.2rem; }
  .benefit-item { display: flex; align-items: center; gap: 1rem; }
  .benefit-icon {
    width: 52px; height: 52px; flex-shrink: 0;
    background: rgba(245,194,0,0.15);
    border: 1px solid rgba(245,194,0,0.3);
    border-radius: 14px; display: flex; align-items: center; justify-content: center;
    font-size: 1.4rem;
  }
  .benefit-text { font-size: 0.88rem; color: rgba(255,255,255,0.75); font-weight: 500; }

  .kombucha-card {
    background: var(--honey);
    border-radius: 24px; padding: 2.5rem;
    position: relative;
  }
  .kombucha-card-title {
    font-family: 'Fraunces', serif; font-size: 1.6rem; font-weight: 700;
    color: var(--dark); margin-bottom: 1rem;
  }
  .kombucha-card-desc { font-size: 0.88rem; color: var(--dark); line-height: 1.75; margin-bottom: 1.5rem; opacity: 0.8; }
  .btn-dark {
    background: var(--dark); color: var(--honey);
    border: none; padding: 0.8rem 1.8rem; border-radius: 100px;
    font-family: 'DM Sans', sans-serif; font-size: 0.82rem; font-weight: 600;
    cursor: pointer; transition: background 0.2s, transform 0.2s;
  }
  .btn-dark:hover { background: var(--charcoal); transform: translateY(-2px); }

  /* ══════════════════════════════
     PRODUCTS SECTION
  ══════════════════════════════ */
  .products-section {
    background: var(--white);
    padding: 5rem 4rem;
  }
  .section-header { text-align: center; margin-bottom: 2.5rem; }
  .section-label {
    font-size: 0.7rem; letter-spacing: 0.2em; text-transform: uppercase;
    color: var(--green-dark); font-weight: 600; margin-bottom: 0.5rem;
    display: flex; align-items: center; justify-content: center; gap: 0.5rem;
  }
  .section-label::before, .section-label::after { content: '—'; color: var(--border); }
  .section-title {
    font-family: 'Fraunces', serif; font-size: clamp(1.8rem, 3vw, 2.6rem);
    font-weight: 700; color: var(--dark); letter-spacing: -0.02em;
  }
  .section-title span { color: var(--honey-drip); font-style: italic; }

  /* Product tabs */
  .product-tabs {
    display: flex; justify-content: center; gap: 0.5rem;
    margin-bottom: 3rem;
  }
  .tab-btn {
    background: var(--light-grey); color: var(--body);
    border: 1.5px solid var(--border); border-radius: 100px;
    padding: 0.5rem 1.4rem; font-family: 'DM Sans', sans-serif;
    font-size: 0.82rem; font-weight: 600; cursor: pointer;
    transition: background 0.2s, color 0.2s, border-color 0.2s;
  }
  .tab-btn:hover { background: var(--honey-warm); border-color: var(--honey); color: var(--amber-dark); }
  .tab-btn.active { background: var(--honey); border-color: var(--honey-drip); color: var(--dark); }

  .products-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; }

  .product-card {
    background: var(--cream); border-radius: 24px;
    border: 1.5px solid var(--border); overflow: hidden;
    transition: transform 0.3s, box-shadow 0.3s;
  }
  .product-card:hover { transform: translateY(-5px); box-shadow: 0 16px 48px rgba(45,36,23,0.12); }

  .product-img-area {
    width: 100%; aspect-ratio: 1;
    display: flex; align-items: center; justify-content: center;
    font-size: 6rem; position: relative;
    background: radial-gradient(ellipse at 50% 80%, rgba(245,194,0,0.2) 0%, transparent 70%);
    border-bottom: 1.5px solid var(--border);
  }
  .product-volume {
    position: absolute; bottom: 0.8rem; left: 1rem;
    font-size: 0.7rem; color: var(--muted); font-weight: 500;
  }

  .product-body { padding: 1.4rem; }
  .product-name {
    font-family: 'Fraunces', serif; font-size: 1.05rem; font-weight: 700;
    color: var(--dark); margin-bottom: 0.25rem;
  }
  .product-variety { font-size: 0.78rem; color: var(--muted); margin-bottom: 0.9rem; }
  .product-row { display: flex; align-items: center; justify-content: space-between; }
  .product-price {
    font-family: 'Fraunces', serif; font-size: 1.2rem; font-weight: 700; color: var(--dark);
  }
  .btn-order {
    background: var(--honey); color: var(--dark);
    border: none; padding: 0.5rem 1.2rem; border-radius: 100px;
    font-family: 'DM Sans', sans-serif; font-size: 0.75rem; font-weight: 600;
    cursor: pointer; transition: background 0.2s, transform 0.15s;
  }
  .btn-order:hover { background: var(--honey-drip); transform: translateY(-1px); }

  /* ══════════════════════════════
     TESTIMONIALS
  ══════════════════════════════ */
  .testimonials-section {
    background: var(--charcoal);
    padding: 5rem 4rem;
    position: relative; overflow: hidden;
  }
  .testimonials-section::before {
    content: '';
    position: absolute; inset: 0;
    background: radial-gradient(ellipse 50% 60% at 50% 100%, rgba(245,194,0,0.07) 0%, transparent 60%);
  }

  .testimonials-header { text-align: center; margin-bottom: 3rem; position: relative; z-index: 2; }
  .testimonials-title {
    font-family: 'Fraunces', serif; font-size: clamp(1.8rem, 3vw, 2.4rem);
    font-weight: 700; color: var(--white);
  }

  /* Avatar row */
  .avatar-row {
    display: flex; justify-content: center; align-items: center; gap: -0.5rem;
    margin-bottom: 2.5rem; position: relative; z-index: 2;
  }
  .avatar {
    width: 56px; height: 56px; border-radius: 50%;
    border: 3px solid var(--charcoal);
    background: var(--honey-warm);
    display: flex; align-items: center; justify-content: center;
    font-size: 1.5rem; cursor: pointer; margin: 0 -6px;
    transition: transform 0.2s, z-index 0.2s;
  }
  .avatar:hover, .avatar.active { transform: scale(1.15) translateY(-4px); z-index: 5; }
  .avatar.active { border-color: var(--honey); }

  .testimonial-card {
    max-width: 580px; margin: 0 auto;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(245,194,0,0.2);
    border-radius: 24px; padding: 2.5rem;
    text-align: center; position: relative; z-index: 2;
  }
  .testimonial-name {
    font-family: 'Fraunces', serif; font-size: 1.1rem; font-weight: 700;
    color: var(--honey); margin-bottom: 0.8rem;
  }
  .testimonial-stars { color: var(--honey); font-size: 1rem; margin-bottom: 1rem; letter-spacing: 0.1em; }
  .testimonial-text { font-size: 0.9rem; color: rgba(255,255,255,0.7); line-height: 1.75; font-style: italic; }

  /* Honeycomb decoration */
  .honeycomb-deco {
    position: absolute; right: 4rem; top: 50%;
    transform: translateY(-50%);
    font-size: 8rem; opacity: 0.08;
    pointer-events: none;
  }

  /* ══════════════════════════════
     CONTACT / ORDER FORM
  ══════════════════════════════ */
  .contact-section {
    background: var(--white);
    padding: 5rem 4rem;
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 5rem; align-items: start;
  }

  .contact-left {}
  .contact-title {
    font-family: 'Fraunces', serif; font-size: clamp(2rem, 3.5vw, 2.8rem);
    font-weight: 700; color: var(--dark); line-height: 1.25; margin-bottom: 1.2rem;
  }
  .contact-title span { color: var(--honey-drip); font-style: italic; }
  .contact-desc { font-size: 0.9rem; color: var(--body); line-height: 1.75; margin-bottom: 2rem; }

  .contact-img {
    width: 100%; border-radius: 20px;
    background: linear-gradient(135deg, var(--honey-warm), var(--honey));
    aspect-ratio: 4/3; display: flex; align-items: center; justify-content: center;
    font-size: 7rem; border: 1.5px solid var(--border);
  }

  .contact-form {
    background: var(--cream); border-radius: 28px;
    padding: 2.5rem; border: 1.5px solid var(--border);
  }
  .form-group { margin-bottom: 1.1rem; }
  .form-input, .form-textarea {
    width: 100%; background: var(--white);
    border: 1.5px solid var(--border); border-radius: 12px;
    padding: 0.85rem 1rem;
    font-family: 'DM Sans', sans-serif; font-size: 0.88rem; color: var(--dark);
    outline: none; resize: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .form-input:focus, .form-textarea:focus {
    border-color: var(--honey);
    box-shadow: 0 0 0 4px rgba(245,194,0,0.12);
  }
  .form-input::placeholder, .form-textarea::placeholder { color: var(--muted); }
  .form-textarea { height: 100px; }
  .form-privacy {
    font-size: 0.72rem; color: var(--muted); margin-bottom: 1.2rem;
    display: flex; align-items: flex-start; gap: 0.5rem;
  }
  .form-privacy input { margin-top: 2px; accent-color: var(--honey); }
  .btn-submit {
    width: 100%; background: var(--honey); color: var(--dark);
    border: none; padding: 1rem; border-radius: 12px;
    font-family: 'DM Sans', sans-serif; font-size: 0.9rem; font-weight: 600;
    cursor: pointer; transition: background 0.2s, transform 0.2s, box-shadow 0.2s;
    box-shadow: 0 4px 20px rgba(245,194,0,0.35);
  }
  .btn-submit:hover { background: var(--honey-drip); transform: translateY(-2px); box-shadow: 0 8px 28px rgba(245,194,0,0.45); }

  /* ══════════════════════════════
     CONTACTS INFO SECTION
  ══════════════════════════════ */
  .contacts-section {
    background: var(--cream);
    padding: 3rem 4rem;
    border-top: 1.5px solid var(--border);
  }
  .contacts-grid {
    display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 2rem;
  }
  .contact-block-title {
    font-family: 'Fraunces', serif; font-size: 0.85rem; font-weight: 700;
    color: var(--dark); margin-bottom: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em;
  }
  .contact-block-item {
    font-size: 0.83rem; color: var(--body); margin-bottom: 0.35rem;
    display: flex; align-items: center; gap: 0.4rem;
  }

  /* ══════════════════════════════
     FOOTER
  ══════════════════════════════ */
  footer {
    background: var(--charcoal);
    padding: 2.5rem 4rem;
    border-top: 3px solid var(--honey);
  }
  .footer-inner {
    display: grid; grid-template-columns: 2fr 1fr 1fr 1fr;
    gap: 3rem; margin-bottom: 2rem;
    padding-bottom: 2rem;
    border-bottom: 1px solid rgba(255,255,255,0.07);
  }
  .footer-brand { display: flex; flex-direction: column; gap: 0.9rem; }
  .footer-logo { display: flex; align-items: center; gap: 0.5rem; text-decoration: none; }
  .footer-logo-icon {
    width: 36px; height: 36px; background: var(--honey);
    border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.1rem;
  }
  .footer-logo-name { font-family: 'Fraunces', serif; font-size: 1rem; font-weight: 700; color: var(--white); }
  .footer-desc { font-size: 0.82rem; color: rgba(255,255,255,0.4); line-height: 1.7; max-width: 260px; }
  .footer-col-title {
    font-family: 'Fraunces', serif; font-size: 0.8rem; font-weight: 700;
    color: var(--honey); margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 0.1em;
  }
  .footer-links { list-style: none; display: flex; flex-direction: column; gap: 0.55rem; }
  .footer-links a { font-size: 0.82rem; color: rgba(255,255,255,0.45); text-decoration: none; transition: color 0.2s; }
  .footer-links a:hover { color: var(--honey); }
  .footer-bottom {
    display: flex; justify-content: space-between; align-items: center;
    font-size: 0.74rem; color: rgba(255,255,255,0.2);
  }
  .footer-buzzing {
    font-family: 'Fraunces', serif; font-size: 1.8rem; font-weight: 900;
    font-style: italic; color: var(--honey); letter-spacing: -0.02em;
  }

  /* ══════════════════════════════
     ANIMATIONS
  ══════════════════════════════ */
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .anim-fade-up { animation: fadeUp 0.7s ease both; }
  .delay-1 { animation-delay: 0.1s; }
  .delay-2 { animation-delay: 0.25s; }
  .delay-3 { animation-delay: 0.4s; }
  .delay-4 { animation-delay: 0.55s; }
  .delay-5 { animation-delay: 0.7s; }

  /* ══════════════════════════════
     RESPONSIVE
  ══════════════════════════════ */
  @media (max-width: 960px) {
    .nav { padding: 0.9rem 1.5rem; }
    .nav-links { display: none; }
    .hero { grid-template-columns: 1fr; padding: 4rem 1.5rem 0; }
    .hero-right { justify-content: center; }
    .hero-product-img { width: 240px; height: 260px; font-size: 8rem; }
    .features-strip { grid-template-columns: 1fr; padding: 3rem 1.5rem; }
    .farm-section { padding: 3.5rem 1.5rem; }
    .farm-grid { grid-template-columns: 1fr; }
    .benefits-row { grid-template-columns: 1fr; gap: 2rem; }
    .products-section { padding: 3.5rem 1.5rem; }
    .products-grid { grid-template-columns: 1fr; }
    .testimonials-section { padding: 3.5rem 1.5rem; }
    .contact-section { grid-template-columns: 1fr; gap: 3rem; padding: 3.5rem 1.5rem; }
    .contacts-grid { grid-template-columns: 1fr; }
    .contacts-section { padding: 2.5rem 1.5rem; }
    .footer-inner { grid-template-columns: 1fr; gap: 2rem; }
    footer { padding: 2.5rem 1.5rem; }
  }
`;