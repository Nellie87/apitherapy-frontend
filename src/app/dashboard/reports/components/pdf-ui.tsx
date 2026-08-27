"use client";

import type { CSSProperties, ReactNode } from "react";
import { PDF_COMPANY_NAME, PDF_HEX } from "@/lib/pdfBrand";

export const PDF_FONT = '"DM Sans", Arial, Helvetica, sans-serif';
export const PDF_DISPLAY = '"DM Serif Display", Georgia, "Times New Roman", serif';

export const pdfPage: CSSProperties = {
  width: 794,
  minHeight: 1123,
  background: PDF_HEX.white,
  color: PDF_HEX.dark,
  padding: "40px 42px 36px",
  fontFamily: PDF_FONT,
  boxSizing: "border-box",
};

export const pdfGrid4: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: 10,
};

export const pdfGrid2: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: 10,
};

const metricCard: CSSProperties = {
  border: `1px solid ${PDF_HEX.line}`,
  borderTop: `3px solid ${PDF_HEX.honey}`,
  background: PDF_HEX.white,
  borderRadius: 12,
  padding: "14px 14px 13px",
  boxSizing: "border-box",
};

export function PdfMetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div style={metricCard}>
      <div
        style={{
          color: PDF_HEX.muted,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 8,
          color: PDF_HEX.dark,
          fontSize: 22,
          fontWeight: 700,
          lineHeight: 1.15,
          letterSpacing: "-0.03em",
        }}
      >
        {value}
      </div>
      {hint ? (
        <div
          style={{
            marginTop: 6,
            color: PDF_HEX.muted,
            fontSize: 11,
            fontWeight: 500,
            lineHeight: 1.4,
          }}
        >
          {hint}
        </div>
      ) : null}
    </div>
  );
}

export function PdfSection({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: string;
  children: ReactNode;
}) {
  return (
    <section style={{ marginTop: 28 }}>
      <h2
        style={{
          margin: 0,
          color: PDF_HEX.dark,
          fontSize: 16,
          fontWeight: 700,
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </h2>
      {caption ? (
        <p
          style={{
            margin: "5px 0 0",
            color: PDF_HEX.muted,
            fontSize: 12,
            fontWeight: 500,
            lineHeight: 1.45,
          }}
        >
          {caption}
        </p>
      ) : null}
      <div style={{ marginTop: 12 }}>{children}</div>
    </section>
  );
}

export function PdfStory({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        margin: "20px 0 0",
        padding: "12px 0 12px 14px",
        borderLeft: `3px solid ${PDF_HEX.honey}`,
        color: PDF_HEX.body,
        fontSize: 13,
        lineHeight: 1.6,
        fontWeight: 500,
      }}
    >
      {children}
    </p>
  );
}

export function PdfBar({ pct, color }: { pct: number; color: string }) {
  const width = Math.max(0, Math.min(100, pct));

  return (
    <div
      style={{
        height: 8,
        overflow: "hidden",
        borderRadius: 999,
        background: "#F3EEE4",
      }}
    >
      <div
        style={{
          width: `${width}%`,
          height: "100%",
          background: color,
          borderRadius: 999,
        }}
      />
    </div>
  );
}

export function PdfChartFrame({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        border: `1px solid ${PDF_HEX.line}`,
        background: PDF_HEX.white,
        borderRadius: 14,
        padding: 16,
      }}
    >
      {children}
    </div>
  );
}

export function PdfEmpty({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        border: `1px solid ${PDF_HEX.line}`,
        background: PDF_HEX.white,
        borderRadius: 14,
        padding: "28px 16px",
        color: PDF_HEX.muted,
        fontSize: 13,
        fontWeight: 600,
        textAlign: "center",
      }}
    >
      {children}
    </div>
  );
}

export function PdfFooter({ extra }: { extra?: string }) {
  return (
    <footer
      style={{
        marginTop: 32,
        borderTop: `1px solid ${PDF_HEX.line}`,
        paddingTop: 12,
        color: PDF_HEX.lightMuted,
        fontSize: 11,
        fontWeight: 500,
      }}
    >
      {PDF_COMPANY_NAME}
      {extra ? ` · ${extra}` : ""}
    </footer>
  );
}
