"use client";

import type { CSSProperties } from "react";
import {
  PDF_COMPANY_NAME,
  PDF_HEX,
  PDF_LOGO_WORDMARK,
  pdfAssetUrl,
} from "@/lib/pdfBrand";

const brandRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  marginBottom: 12,
};

const logoStyle: CSSProperties = {
  height: 48,
  width: "auto",
  objectFit: "contain",
  display: "block",
};

const companyLabel: CSSProperties = {
  color: PDF_HEX.honeyDark,
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 2.4,
  textTransform: "uppercase",
  textAlign: "right",
};

type Props = {
  title: string;
  subtitle?: string;
  metaLeft?: string;
  metaRight?: string;
};

/** Shared branded header for html2canvas PDF report templates. */
export function PdfReportHeader({ title, subtitle, metaLeft, metaRight }: Props) {
  return (
    <header
      style={{
        borderBottom: `4px solid ${PDF_HEX.honey}`,
        paddingBottom: 18,
        marginBottom: 20,
      }}
    >
      <div style={brandRow}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={pdfAssetUrl(PDF_LOGO_WORDMARK)}
          alt={PDF_COMPANY_NAME}
          style={logoStyle}
          crossOrigin="anonymous"
        />
        <div style={companyLabel}>{PDF_COMPANY_NAME}</div>
      </div>

      <h1
        style={{
          margin: "4px 0 0",
          color: PDF_HEX.dark,
          fontSize: 28,
          lineHeight: 1.05,
          fontWeight: 900,
          letterSpacing: -1,
        }}
      >
        {title}
      </h1>

      {subtitle ? (
        <div style={{ marginTop: 8, fontSize: 12, color: PDF_HEX.muted, fontWeight: 600 }}>
          {subtitle}
        </div>
      ) : null}

      {(metaLeft || metaRight) && (
        <div
          style={{
            marginTop: 10,
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            color: PDF_HEX.muted,
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          <span>{metaLeft}</span>
          <span>{metaRight}</span>
        </div>
      )}
    </header>
  );
}
