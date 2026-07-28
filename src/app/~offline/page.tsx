import Link from "next/link";
import Image from "next/image";

export default function OfflinePage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: "2rem",
        background: "linear-gradient(165deg, #fdf8ef 0%, #fff8e1 45%, #f5f3ee 100%)",
        color: "#2d2417",
        fontFamily: "system-ui, sans-serif",
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: "22rem" }}>
        <Image
          src="/brand-wordmark.png"
          alt="Pollinator Beekeeping & Apitherapy"
          width={280}
          height={138}
          style={{
            width: "min(100%, 16rem)",
            height: "auto",
            margin: "0 auto 1.25rem",
            mixBlendMode: "multiply",
          }}
          priority
          unoptimized
        />
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>
          You&apos;re offline
        </h1>
        <p style={{ color: "#4a3f2f", lineHeight: 1.5, marginBottom: "1.5rem" }}>
          Pollinator Beekeeping needs a connection for live data. Reconnect and try again.
        </p>
        <Link
          href="/"
          style={{
            display: "inline-block",
            background: "#f5c200",
            color: "#2d2417",
            fontWeight: 600,
            textDecoration: "none",
            padding: "0.75rem 1.25rem",
            borderRadius: "0.5rem",
          }}
        >
          Try again
        </Link>
      </div>
    </main>
  );
}
