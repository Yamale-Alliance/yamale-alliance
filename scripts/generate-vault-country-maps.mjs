/**
 * Generates monochrome country silhouettes for vault cards:
 *   public/vault-maps/countries/{iso2}.svg
 *   public/vault-maps/africa.svg
 *
 * Run: node scripts/generate-vault-country-maps.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { geoMercator, geoPath } from "d3-geo";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "vault-maps", "countries");
const AFRICA_OUT = path.join(ROOT, "public", "vault-maps", "africa.svg");

/** ISO 3166-1 alpha-2 — all AU-aligned states in Yamalé. */
const AFRICA_ISO2 = [
  "dz", "ao", "bj", "bw", "bf", "bi", "cv", "cm", "cf", "td", "km", "cg", "cd", "ci", "dj", "eg",
  "gq", "er", "sz", "et", "ga", "gm", "gh", "gn", "gw", "ke", "ls", "lr", "ly", "mg", "mw", "ml",
  "mr", "mu", "ma", "mz", "na", "ne", "ng", "rw", "st", "sn", "sc", "sl", "so", "za", "ss", "sd", "tz",
  "tg", "tn", "ug", "zm", "zw",
];

const GEOJSON_URL =
  "https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson";

function writeSvg(filePath, viewBox, pathD, label) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" aria-label="${label}">
  <path fill="currentColor" d="${pathD}"/>
</svg>
`;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, svg, "utf8");
}

async function main() {
  const res = await fetch(GEOJSON_URL);
  if (!res.ok) throw new Error(`Failed to fetch GeoJSON: ${res.status}`);
  const collection = await res.json();

  const byIso = new Map();
  for (const feature of collection.features) {
    const iso = feature.properties?.["ISO3166-1-Alpha-2"]?.toLowerCase();
    if (!iso || iso === "-99") continue;
    byIso.set(iso, feature);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  let written = 0;

  for (const iso of AFRICA_ISO2) {
    const feature = byIso.get(iso);
    if (!feature) {
      console.warn(`Missing GeoJSON for ${iso}`);
      continue;
    }
    const width = 420;
    const height = 520;
    const projection = geoMercator().fitExtent(
      [
        [12, 12],
        [width - 12, height - 12],
      ],
      feature
    );
    const pathGen = geoPath(projection);
    const d = pathGen(feature);
    if (!d) {
      console.warn(`Empty path for ${iso}`);
      continue;
    }
    writeSvg(
      path.join(OUT_DIR, `${iso}.svg`),
      `0 0 ${width} ${height}`,
      d,
      `Map of ${feature.properties?.name ?? iso}`
    );
    written += 1;
  }

  const africaFeatures = AFRICA_ISO2.map((iso) => byIso.get(iso)).filter(Boolean);
  const africaCollection = { type: "FeatureCollection", features: africaFeatures };
  const aw = 300;
  const ah = 360;
  const africaProjection = geoMercator().fitExtent(
    [
      [8, 8],
      [aw - 8, ah - 8],
    ],
    africaCollection
  );
  const africaPath = geoPath(africaProjection);
  const africaD = africaFeatures.map((f) => africaPath(f)).filter(Boolean).join(" ");
  writeSvg(AFRICA_OUT, `0 0 ${aw} ${ah}`, africaD, "Map of Africa");

  console.log(`Wrote ${written} country maps and ${AFRICA_OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
