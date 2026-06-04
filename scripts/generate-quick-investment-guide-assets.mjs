/**
 * Placeholder covers for Quick Investment Guide until marketing assets are dropped in place.
 * Run: node scripts/generate-quick-investment-guide-assets.mjs
 *
 * Replace after run:
 *   public/vault/quick-investment-guide/cover.jpg          — series card (all countries)
 *   public/vault/quick-investment-guide/countries/bj.jpg   — Benin (and {iso}.jpg per country)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "public", "vault", "quick-investment-guide");
const COUNTRIES_DIR = path.join(ROOT, "countries");

function coverSvg(width, height, label) {
  const fontSize = Math.round(height * 0.11);
  const subSize = Math.round(height * 0.06);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0d1b2a"/>
      <stop offset="100%" stop-color="#1e3148"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#c8922a"/>
      <stop offset="100%" stop-color="#e8b84b"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <rect x="0" y="${height - 8}" width="${width}" height="8" fill="url(#accent)"/>
  <text x="50%" y="42%" dominant-baseline="middle" text-anchor="middle"
    font-family="Georgia, serif" font-size="${fontSize}" font-weight="700" fill="#e8b84b">${label}</text>
  <text x="50%" y="58%" dominant-baseline="middle" text-anchor="middle"
    font-family="system-ui, sans-serif" font-size="${subSize}" fill="rgba(244,241,235,0.85)">Quick Investment Guide</text>
</svg>`;
}

async function writeJpeg(outPath, svg, w, h) {
  const sharp = (await import("sharp")).default;
  const buf = await sharp(Buffer.from(svg)).resize(w, h).jpeg({ quality: 88 }).toBuffer();
  fs.writeFileSync(outPath, buf);
}

async function main() {
  fs.mkdirSync(COUNTRIES_DIR, { recursive: true });

  await writeJpeg(path.join(ROOT, "cover.jpg"), coverSvg(800, 1000, "Africa"), 800, 1000);
  await writeJpeg(path.join(COUNTRIES_DIR, "bj.jpg"), coverSvg(600, 750, "Benin"), 600, 750);

  console.log("Wrote placeholder JPEGs under public/vault/quick-investment-guide/");
  console.log("Swap cover.jpg and countries/*.jpg with your final artwork (same filenames).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
