import html2canvas from "html2canvas";
import jsPDF from "jspdf";

function hasUnsupportedColor(value?: string | null) {
  if (!value) return false;

  return (
    value.includes("lab(") ||
    value.includes("oklch(") ||
    value.includes("color(")
  );
}

function sanitizeCanvasClone(clonedDocument: Document) {
  const win = clonedDocument.defaultView;
  if (!win) return;

  const all = Array.from(clonedDocument.querySelectorAll<HTMLElement>("*"));

  for (const el of all) {
    const style = win.getComputedStyle(el);

    if (hasUnsupportedColor(style.color)) {
      el.style.color = "#1f1b14";
    }

    if (hasUnsupportedColor(style.backgroundColor)) {
      el.style.backgroundColor = "#ffffff";
    }

    if (hasUnsupportedColor(style.borderTopColor)) {
      el.style.borderTopColor = "#eadfc2";
    }

    if (hasUnsupportedColor(style.borderRightColor)) {
      el.style.borderRightColor = "#eadfc2";
    }

    if (hasUnsupportedColor(style.borderBottomColor)) {
      el.style.borderBottomColor = "#eadfc2";
    }

    if (hasUnsupportedColor(style.borderLeftColor)) {
      el.style.borderLeftColor = "#eadfc2";
    }

    if (hasUnsupportedColor(style.outlineColor)) {
      el.style.outlineColor = "#eadfc2";
    }

    if (hasUnsupportedColor(style.textDecorationColor)) {
      el.style.textDecorationColor = "#1f1b14";
    }

    el.style.boxShadow = "none";
    el.style.textShadow = "none";
  }
}

export async function exportElementToPdf(elementId: string, filename: string) {
  if (typeof window === "undefined") return;

  const element = document.getElementById(elementId);

  if (!element) {
    throw new Error(`PDF export template "${elementId}" was not found.`);
  }

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    logging: false,
    onclone: sanitizeCanvasClone,
  });

  const imgData = canvas.toDataURL("image/png");

  const pdf = new jsPDF({
    orientation: "p",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let y = 0;
  let remainingHeight = imgHeight;

  pdf.addImage(imgData, "PNG", 0, y, imgWidth, imgHeight);
  remainingHeight -= pageHeight;

  while (remainingHeight > 0) {
    y -= pageHeight;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, y, imgWidth, imgHeight);
    remainingHeight -= pageHeight;
  }

  pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}