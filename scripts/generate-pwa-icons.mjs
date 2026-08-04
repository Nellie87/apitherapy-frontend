import sharp from "sharp";
import fs from "fs";
import path from "path";

const out = path.join("public", "icons");
fs.mkdirSync(out, { recursive: true });

/** Light cream splash / icon surface (matches a warm brand UI). */
const BG = "#fffaf0";
/**
 * Maskable icons get a solid warm plate so Android safe-zone cropping
 * still leaves a readable tile. Amber plate + dark bee = high contrast.
 */
const BG_MASKABLE = "#f5c200";

/** Deep honey-brown bee — readable on cream and on amber. */
const BEE = { r: 45, g: 36, b: 23 };

const markPath = path.join(out, "icon-mark-transparent.png");

/** Recolor yellow bee pixels to dark honey-brown; drop white speckles. */
async function recolorMark(buffer) {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a === 0) continue;

    const isYellow = r > 160 && g > 100 && b < 100 && r > b + 60;
    const isSpeck = r > 160 && g > 160 && b > 160;

    if (isSpeck) {
      data[i + 3] = 0;
      continue;
    }

    if (isYellow) {
      // Preserve anti-alias edges via existing alpha
      data[i] = BEE.r;
      data[i + 1] = BEE.g;
      data[i + 2] = BEE.b;
    }
  }

  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

async function makeIcon(size, { maskable = false, filename, bg }) {
  const background = bg ?? (maskable ? BG_MASKABLE : BG);
  const pad = maskable ? Math.round(size * 0.18) : Math.round(size * 0.14);
  const inner = size - pad * 2;

  const resized = await sharp(markPath)
    .resize(inner, inner, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  const bee = await recolorMark(resized);

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background,
    },
  })
    .composite([{ input: bee, gravity: "centre" }])
    .png()
    .toFile(path.join(out, filename));
}

await makeIcon(192, { filename: "icon-192.png" });
await makeIcon(512, { filename: "icon-512.png" });
await makeIcon(512, { maskable: true, filename: "icon-512-maskable.png" });
await makeIcon(180, { filename: "apple-touch-icon.png" });

console.log("icons written", fs.readdirSync(out));
