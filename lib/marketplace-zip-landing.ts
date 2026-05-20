import JSZip from "jszip";
import { parseLandingPageHtmlInput } from "@/lib/marketplace-landing-page";

const LANDING_CANDIDATE_NAMES = [
  "index.html",
  "landing.html",
  "landing-page.html",
  "package.html",
  "sales.html",
] as const;

function normalizeZipPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}

function baseName(path: string): string {
  const parts = normalizeZipPath(path).split("/");
  return parts[parts.length - 1]?.toLowerCase() ?? "";
}

/**
 * Reads a marketplace ZIP buffer and returns landing HTML when a known root-level
 * file (e.g. index.html) is present. Used on admin upload to pre-fill landing_page_html.
 */
export async function extractLandingPageHtmlFromZip(buffer: Buffer): Promise<string | null> {
  const zip = await JSZip.loadAsync(buffer);
  const entries = Object.keys(zip.files).filter((path) => {
    const entry = zip.files[path];
    return entry && !entry.dir && /\.html?$/i.test(path);
  });
  if (entries.length === 0) return null;

  const ranked = [...entries].sort((a, b) => {
    const score = (path: string) => {
      const norm = normalizeZipPath(path);
      const depth = norm.split("/").length;
      const name = baseName(path);
      const preferred = LANDING_CANDIDATE_NAMES.indexOf(
        name as (typeof LANDING_CANDIDATE_NAMES)[number]
      );
      return (preferred >= 0 ? preferred : 99) * 1000 + depth;
    };
    return score(a) - score(b);
  });

  for (const path of ranked) {
    const entry = zip.files[path];
    if (!entry) continue;
    const raw = await entry.async("string");
    const trimmed = raw.trim();
    if (trimmed.length < 200) continue;
    try {
      return parseLandingPageHtmlInput(trimmed);
    } catch {
      continue;
    }
  }

  return null;
}
