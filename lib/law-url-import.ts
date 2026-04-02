/**
 * Fetch a PDF from a URL, strip table-of-contents blocks, and convert plain text to Markdown.
 * Used by POST /api/admin/laws/from-url.
 */

const MAX_PDF_BYTES = 45 * 1024 * 1024;

/** Fetch URL and return buffer if response is a PDF (by Content-Type or %PDF magic). */
export async function fetchPdfFromUrl(urlStr: string): Promise<{ buffer: Buffer; finalUrl: string }> {
  let u: URL;
  try {
    u = new URL(urlStr);
  } catch {
    throw new Error("Invalid URL");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("Only http and https URLs are allowed");
  }

  const res = await fetch(urlStr, {
    redirect: "follow",
    headers: {
      Accept: "application/pdf,*/*",
      "User-Agent": "YamaleLawImport/1.0 (+https://yamalealliance.org)",
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch URL: HTTP ${res.status}`);
  }

  const len = res.headers.get("content-length");
  if (len && Number(len) > MAX_PDF_BYTES) {
    throw new Error("PDF exceeds maximum size (45 MB)");
  }

  const ab = await res.arrayBuffer();
  if (ab.byteLength > MAX_PDF_BYTES) {
    throw new Error("PDF exceeds maximum size (45 MB)");
  }
  const buffer = Buffer.from(ab);
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  const magic = buffer.slice(0, 5).toString("ascii");
  const looksPdf = ct.includes("pdf") || magic.startsWith("%PDF");
  if (!looksPdf) {
    throw new Error("The URL did not return a PDF (expected application/pdf or %PDF header)");
  }

  return { buffer, finalUrl: res.url };
}

/**
 * Remove common table-of-contents sections from extracted PDF text.
 * Does not use AI — pattern-based only; Claude can refine metadata separately.
 */
export function stripTableOfContents(text: string): string {
  if (!text?.trim()) return text;

  let t = text.replace(/\r\n/g, "\n");

  // 1) Explicit block: from a "Table of contents" / "Contents" heading until a structural body marker
  const bodyStart = /^(CHAPTER|PART|SECTION|ARTICLE|SCHEDULE|PREAMBLE|LONG TITLE|AN ACT|ARRANGEMENT OF SECTIONS)\b/im;
  const tocHeading = /^\s*(TABLE OF CONTENTS|CONTENTS)\s*$/gim;
  let m: RegExpExecArray | null;
  const candidates: { start: number; end: number }[] = [];
  tocHeading.lastIndex = 0;
  while ((m = tocHeading.exec(t)) !== null) {
    const start = m.index;
    const after = t.slice(start + m[0].length);
    const rel = after.search(bodyStart);
    if (rel !== -1) {
      candidates.push({ start, end: start + m[0].length + rel });
    } else {
      // No clear body marker: remove at most next ~120 lines of short/TOC-style lines
      const lines = after.split("\n");
      let cut = 0;
      let i = 0;
      for (; i < lines.length && i < 150; i++) {
        const L = lines[i].trim();
        if (!L) {
          cut += lines[i].length + 1;
          continue;
        }
        if (L.length > 180) break;
        if (bodyStart.test(L)) break;
        const tocLine =
          /^.{1,100}\.{3,}\s*\d+\s*$/.test(L) ||
          /^.{1,80}\s+\d{1,4}\s*$/.test(L) ||
          /^\d+\.\s+.{1,70}\s+\d{1,4}\s*$/.test(L);
        if (!tocLine && L.length > 60 && !/^\d+\./.test(L)) break;
        cut += lines[i].length + 1;
      }
      candidates.push({ start, end: start + m[0].length + cut });
    }
  }

  // Apply removals from end to start so indices stay valid
  candidates.sort((a, b) => b.start - a.start);
  for (const { start, end } of candidates) {
    t = t.slice(0, start) + "\n\n" + t.slice(end);
  }

  // 2) Dot-leader lines scattered in first pages (orphan TOC lines)
  const lines = t.split("\n");
  const kept: string[] = [];
  let inEarly = true;
  let lineNo = 0;
  for (const line of lines) {
    lineNo++;
    if (lineNo > 80) inEarly = false;
    const L = line.trim();
    if (inEarly && L && /^.{1,100}\.{3,}\s*\d+\s*$/.test(L)) {
      continue;
    }
    kept.push(line);
  }

  t = kept.join("\n");
  return t.replace(/\n{4,}/g, "\n\n\n").trim();
}

/** Light plain-text → Markdown: paragraphs, common law headings. */
export function plainTextToMarkdown(text: string): string {
  if (!text?.trim()) return "";
  const lines = text.split(/\n/);
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const L = raw.trim();
    if (!L) {
      out.push("");
      continue;
    }
    if (/^(ARTICLE|Article)\s+\d+/i.test(L)) {
      out.push(`## ${L}`);
      continue;
    }
    if (/^(CHAPTER|Chapter)\s+[IVXLCDM0-9]+/i.test(L) && L.length < 120) {
      out.push(`## ${L}`);
      continue;
    }
    if (/^(PART|Part)\s+[IVXLCDM0-9]+/i.test(L) && L.length < 120) {
      out.push(`### ${L}`);
      continue;
    }
    if (/^(SECTION|Section)\s+\d+/i.test(L) && L.length < 160) {
      out.push(`#### ${L}`);
      continue;
    }
    if (/^SCHEDULE\s+[A-Z0-9]/i.test(L) && L.length < 120) {
      out.push(`## ${L}`);
      continue;
    }
    out.push(L);
  }
  let md = out.join("\n");
  md = md.replace(/\n{3,}/g, "\n\n");
  return md.trim();
}

export type CountryOpt = { id: string; name: string };
export type CategoryOpt = { id: string; name: string };

/** Guess title from first substantive lines; match country/category names in excerpt + URL. */
export function inferMetadataHeuristic(
  plainText: string,
  urlStr: string,
  countries: CountryOpt[],
  categories: CategoryOpt[]
): { title: string; countryId: string | null; categoryId: string | null; year: number | null } {
  const lines = plainText.split(/\n/).map((l) => l.trim()).filter(Boolean);
  let title = "";
  for (const L of lines.slice(0, 25)) {
    if (/^(table of contents|contents)$/i.test(L)) continue;
    if (L.length < 8) continue;
    if (/^page\s+\d+/i.test(L)) continue;
    title = L.slice(0, 500);
    break;
  }
  if (!title) title = "Imported law";

  const hay = `${plainText.slice(0, 12000)}\n${urlStr}`.toLowerCase();
  let countryId: string | null = null;
  for (const c of countries) {
    if (hay.includes(c.name.toLowerCase())) {
      countryId = c.id;
      break;
    }
  }

  let categoryId: string | null = null;
  for (const cat of categories) {
    const n = cat.name.toLowerCase();
    if (n.length > 3 && hay.includes(n)) {
      categoryId = cat.id;
      break;
    }
  }

  let year: number | null = null;
  const y = plainText.match(/\b(19|20)\d{2}\b/);
  if (y) {
    const n = parseInt(y[0], 10);
    if (n >= 1900 && n <= 2100) year = n;
  }

  return { title, countryId, categoryId, year };
}
