import sharp from "sharp";
import fs from "fs";
import path from "path";

const out = path.join("public", "icons");
fs.mkdirSync(out, { recursive: true });

/** Cream brand surface — matches manifest background_color */
const BG = "#fdf8ef";
/** Amber fill for maskable safe-zone icons */
const BG_MASKABLE = "#f5c200";

const markPath = path.join(out, "icon-mark-transparent.png");

async function makeIcon(size, { maskable = false, filename, bg }) {
  const background = bg ?? (maskable ? BG_MASKABLE : BG);
  const pad = maskable ? Math.round(size * 0.18) : Math.round(size * 0.16);
  const inner = size - pad * 2;

  const bee = await sharp(markPath)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

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
