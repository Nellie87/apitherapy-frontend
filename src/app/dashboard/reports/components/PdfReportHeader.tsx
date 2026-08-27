"use client";

import type { CSSProperties } from "react";
import {
  PDF_COMPANY_NAME,
  PDF_HEX,
  PDF_LOGO_WORDMARK,
  pdfAssetUrl,
} from "@/lib/pdfBrand";
import { PDF_DISPLAY, PDF_FONT } from "./pdf-ui";

const brandRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
};

const logoStyle: CSSProperties = {
  height: 40,
  width: "auto",
  objectFit: "contain",
  display: "block",
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
        borderBottom: `1px solid ${PDF_HEX.line}`,
        paddingBottom: 18,
        marginBottom: 22,
        fontFamily: PDF_FONT,
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
        <div
          style={{
            color: PDF_HEX.muted,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            textAlign: "right",
            maxWidth: 220,
            lineHeight: 1.45,
          }}
        >
          {PDF_COMPANY_NAME}
        </div>
      </div>

      <div
        style={{
          marginTop: 18,
          width: 36,
          height: 3,
          background: PDF_HEX.honey,
          borderRadius: 2,
        }}
      />

      <h1
        style={{
          margin: "12px 0 0",
          color: PDF_HEX.dark,
          fontSize: 32,
          lineHeight: 1.12,
          fontWeight: 400,
          fontFamily: PDF_DISPLAY,
          letterSpacing: "-0.02em",
        }}
      >
        {title}
      </h1>

      {subtitle ? (
        <div
          style={{
            marginTop: 8,
            fontSize: 13,
            color: PDF_HEX.muted,
            fontWeight: 500,
            lineHeight: 1.45,
          }}
        >
          {subtitle}
        </div>
      ) : null}

      {(metaLeft || metaRight) && (
        <div
          style={{
            marginTop: 14,
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            color: PDF_HEX.muted,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.02em",
          }}
        >
          <span>{metaLeft}</span>
          <span>{metaRight}</span>
        </div>
      )}
    </header>
  );
}
