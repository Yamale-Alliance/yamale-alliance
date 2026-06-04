/**
 * Generates static PNG favicon assets (≥48×48). /favicon.ico is served via app/favicon.ico/route.ts (fallback: public/favicon-default.ico).
 * Run: node scripts/generate-site-favicons.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "public");

/** Yamalé default tab icon — dark navy + gold mark (matches app/icon.tsx fallback). */
function faviconSvg(size) {
  const pad = Math.round(size * 0.208);
  const mark = size - pad * 2;
  const radius = Math.round(mark * 0.214);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#0d1b2a"/>
  <rect x="${pad}" y="${pad}" width="${mark}" height="${mark}" rx="${radius}" fill="url(#g)"/>
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#c8922a"/>
      <stop offset="100%" stop-color="#e8b84b"/>
    </linearGradient>
  </defs>
</svg>`;
}

/** Apple touch icon — “Y” on navy (matches app/apple-icon.tsx fallback). */
function appleSvg(size) {
  const fontSize = Math.round(size * 0.4);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#0d1b2a"/>
  <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle"
    font-family="Georgia, 'Times New Roman', serif" font-size="${fontSize}" font-weight="700" fill="#e8b84b">Y</text>
</svg>`;
}

async function main() {
  const sharp = (await import("sharp")).default;

  fs.mkdirSync(OUT, { recursive: true });

  const png48 = await sharp(Buffer.from(faviconSvg(48))).png().toBuffer();
  const png192 = await sharp(Buffer.from(faviconSvg(192))).png().toBuffer();
  const png180 = await sharp(Buffer.from(appleSvg(180))).png().toBuffer();

  fs.writeFileSync(path.join(OUT, "favicon.ico"), png48);
  fs.writeFileSync(path.join(OUT, "favicon-192.png"), png192);
  fs.writeFileSync(path.join(OUT, "apple-touch-icon.png"), png180);

  const meta48 = await sharp(png48).metadata();
  const meta192 = await sharp(png192).metadata();
  const meta180 = await sharp(png180).metadata();
  console.log(
    `Wrote public/favicon-default.ico (${meta48.width}×${meta48.height}), favicon-192.png (${meta192.width}×${meta192.height}), apple-touch-icon.png (${meta180.width}×${meta180.height}).`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
