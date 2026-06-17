import html2canvas from "html2canvas";
import jsPDF from "jspdf";

function hasUnsupportedColor(value: string) {
  return value.includes("lab(") || value.includes("oklch(") || value.includes("color(");
}

function sanitizeCanvasClone(clonedDocument: Document) {
  const all = Array.from(clonedDocument.querySelectorAll<HTMLElement>("*"));

  for (const el of all) {
    const style = clonedDocument.defaultView?.getComputedStyle(el);
    if (!style) continue;

    if (hasUnsupportedColor(style.color)) el.style.color = "#1f1b14";
    if (hasUnsupportedColor(style.backgroundColor)) el.style.backgroundColor = "#ffffff";
    if (hasUnsupportedColor(style.borderColor)) el.style.borderColor = "#eadfc2";
    if (hasUnsupportedColor(style.outlineColor)) el.style.outlineColor = "#eadfc2";
    if (hasUnsupportedColor(style.textDecorationColor)) el.style.textDecorationColor = "#1f1b14";

    el.style.boxShadow = "none";
    el.style.textShadow = "none";
  }
}

export async function exportElementToPdf(elementId: string, filename: string) {
  const element = document.getElementById(elementId);

  if (!element) {
    throw new Error("PDF export template was not found.");
  }

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
    onclone: sanitizeCanvasClone,
  });

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF("p", "mm", "a4");

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgHeight = (canvas.height * pageWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, "PNG", 0, position, pageWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position -= pageHeight;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, position, pageWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(filename);
}
