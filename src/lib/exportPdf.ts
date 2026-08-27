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
      el.style.color = "#000000";
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
      el.style.textDecorationColor = "#000000";
    }

    el.style.boxShadow = "none";
    el.style.textShadow = "none";
  }
}

function waitForImages(root: ParentNode) {
  const images = Array.from(root.querySelectorAll("img"));

  return Promise.all(
    images.map((img) => {
      if (img.complete) return Promise.resolve();

      return new Promise<void>((resolve) => {
        img.addEventListener("load", () => resolve(), { once: true });
        img.addEventListener("error", () => resolve(), { once: true });
      });
    }),
  );
}

function nextPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

/**
 * Snapshot a hidden report template to PDF.
 *
 * html2canvas crops to the viewport, so an off-screen node (`left: -9999px`)
 * captures whatever is actually on screen (sales history, dashboard, etc.).
 * We clone the template onto `document.body` at (0, 0) and hide every other
 * body child in the capture clone so only the report can be painted.
 */
export async function exportElementToPdf(elementId: string, filename: string) {
  if (typeof window === "undefined") return;

  const source = document.getElementById(elementId);

  if (!source) {
    throw new Error(`PDF export template "${elementId}" was not found.`);
  }

  const width = Math.max(source.scrollWidth, source.offsetWidth, 794);
  const height = Math.max(source.scrollHeight, source.offsetHeight, 1);

  const host = document.createElement("div");
  host.setAttribute("data-pdf-export-host", "true");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = [
    "position:fixed",
    "left:0",
    "top:0",
    `width:${width}px`,
    "margin:0",
    "padding:0",
    "background:#ffffff",
    "z-index:-1",
    "pointer-events:none",
    "overflow:visible",
  ].join(";");

  const clone = source.cloneNode(true) as HTMLElement;
  clone.removeAttribute("id");
  clone.style.position = "static";
  clone.style.left = "auto";
  clone.style.top = "auto";
  clone.style.right = "auto";
  clone.style.bottom = "auto";
  clone.style.transform = "none";
  clone.style.margin = "0";
  clone.style.width = `${width}px`;
  clone.style.minHeight = `${height}px`;
  clone.style.background = "#ffffff";

  host.appendChild(clone);
  document.body.appendChild(host);

  try {
    await waitForImages(host);
    await nextPaint();

    const paintHeight = Math.max(clone.scrollHeight, height);

    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      width,
      height: paintHeight,
      windowWidth: width,
      windowHeight: paintHeight,
      scrollX: 0,
      scrollY: 0,
      x: 0,
      y: 0,
      onclone: (clonedDocument) => {
        sanitizeCanvasClone(clonedDocument);

        const clonedHost = clonedDocument.querySelector(
          "[data-pdf-export-host]",
        ) as HTMLElement | null;

        Array.from(clonedDocument.body.children).forEach((child) => {
          if (child !== clonedHost) {
            (child as HTMLElement).style.setProperty(
              "display",
              "none",
              "important",
            );
          }
        });

        if (clonedHost) {
          clonedHost.style.position = "absolute";
          clonedHost.style.left = "0px";
          clonedHost.style.top = "0px";
          clonedHost.style.opacity = "1";
          clonedHost.style.zIndex = "1";
        }
      },
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
  } finally {
    host.remove();
  }
}
