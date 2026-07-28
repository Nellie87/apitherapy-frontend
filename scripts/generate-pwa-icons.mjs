import sharp from "sharp";
import fs from "fs";
import path from "path";

const out = path.join("public", "icons");
fs.mkdirSync(out, { recursive: true });

async function makeIcon(size, { maskable = false, filename }) {
  const pad = maskable ? Math.round(size * 0.12) : Math.round(size * 0.08);
  const inner = size - pad * 2;
  const r = Math.round(inner * 0.5);
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${maskable ? "#f5c200" : "#fdf8ef"}"/>
  <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="#f5c200"/>
  <circle cx="${size / 2}" cy="${size / 2}" r="${Math.round(r * 0.82)}" fill="#e8a800"/>
  <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-family="Georgia, serif" font-size="${Math.round(size * 0.34)}" font-weight="700" fill="#2d2417">P</text>
</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(out, filename));
}

await makeIcon(192, { filename: "icon-192.png" });
await makeIcon(512, { filename: "icon-512.png" });
await makeIcon(512, { maskable: true, filename: "icon-512-maskable.png" });
await makeIcon(180, { filename: "apple-touch-icon.png" });
console.log("icons written", fs.readdirSync(out));
