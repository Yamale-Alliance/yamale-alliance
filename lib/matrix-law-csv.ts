/**
 * Parse "research matrix" CSVs: one row per country, columns = category names,
 * each cell holds prose with multiple https links. Expands to flat { url, country, category, title? } rows.
 */

export type MatrixLawItem = {
  url: string;
  country: string;
  category: string;
  title?: string;
};

/** Default library category names (must match DB); API may supply the live list. */
export const DEFAULT_LIBRARY_CATEGORY_NAMES = [
  "Corporate Law",
  "Tax Law",
  "Labor/Employment Law",
  "Intellectual Property Law",
  "Data Protection and Privacy Law",
  "International Trade Laws",
  "Anti-Bribery and Corruption Law",
  "Dispute Resolution",
  "Environmental",
] as const;

const HEADER_TYPOS: Record<string, string> = {
  enivironmental: "Environmental",
  enviornmental: "Environmental",
  envronmental: "Environmental",
  "commercial law": "Corporate Law",
};

function normalizeHeaderLabel(raw: string): string {
  return raw.replace(/\*+/g, "").trim().replace(/\s+/g, " ");
}

/** Map a spreadsheet column header to a canonical category name, or null. */
export function matchHeaderToCategory(header: string, categories: readonly string[]): string | null {
  const label = normalizeHeaderLabel(header);
  if (!label) return null;
  const lower = label.toLowerCase();
  if (HEADER_TYPOS[lower]) return HEADER_TYPOS[lower];

  for (const c of categories) {
    if (c.toLowerCase() === lower) return c;
  }
  for (const c of categories) {
    const cl = c.toLowerCase();
    if (lower.includes(cl) || cl.includes(lower)) return c;
  }
  return null;
}

/**
 * Pull http(s) URLs from a cell and pair each with the nearest preceding text as title.
 */
export function extractUrlsWithTitles(cell: string): { url: string; title: string }[] {
  const s = cell.replace(/\r\n/g, " ").replace(/\n/g, " ");
  const re = /https?:\/\/[^\s"']+/gi;
  const out: { url: string; title: string }[] = [];
  let lastEnd = 0;
  let m: RegExpExecArray | null;
  const copy = s;
  while ((m = re.exec(copy)) !== null) {
    let url = m[0];
    url = url.replace(/[.,;)\]}>]+$/g, "");
    if (url.length < 12) continue;

    const start = m.index;
    const chunk = copy.slice(lastEnd, start).trim();
    const afterSemi = chunk.split(/[;]/).pop()?.trim() ?? chunk;
    let title = afterSemi.replace(/^[,.\s]+|[,.\s]+$/g, "").replace(/\s+/g, " ");
    if (title.length > 400) title = title.slice(0, 397).trim() + "…";
    if (title.length < 3) title = `Law link ${out.length + 1}`;

    out.push({ url, title });
    lastEnd = start + m[0].length;
  }
  return out;
}

function isProbablyRowIndex(v: string): boolean {
  return /^\d+$/.test(v.trim());
}

function isLiiPortalHeader(h: string): boolean {
  const n = normalizeHeaderLabel(h).toLowerCase();
  return /has an lii|^lii\??$|legal information/i.test(n);
}

function isCountryHeader(h: string): boolean {
  return /^country$/i.test(normalizeHeaderLabel(h));
}

export type MatrixParseResult =
  | { ok: true; items: MatrixLawItem[]; warnings: string[] }
  | { ok: false; error: string };

/**
 * Parse matrix-shaped CSV rows (header row + data). Requires a Country column and
 * columns whose headers match known category names.
 */
export function matrixRowsToItems(
  rows: string[][],
  categoryNames: readonly string[]
): MatrixParseResult {
  if (rows.length < 2) {
    return { ok: false, error: "Need a header row and at least one data row." };
  }

  const headers = rows[0]!.map((h) => h ?? "");
  type ColRole =
    | { kind: "country" }
    | { kind: "skip" }
    | { kind: "category"; name: string }
    | { kind: "ignore" };

  const roles: ColRole[] = [];
  let countryCol = -1;
  const warnings: string[] = [];

  for (let c = 0; c < headers.length; c++) {
    const h = headers[c] ?? "";
    if (!normalizeHeaderLabel(h)) {
      roles.push({ kind: "ignore" });
      continue;
    }
    if (isCountryHeader(h)) {
      if (countryCol >= 0) warnings.push("Multiple Country columns detected; using the first.");
      else countryCol = c;
      roles.push({ kind: "country" });
      continue;
    }
    if (isLiiPortalHeader(h)) {
      roles.push({ kind: "skip" });
      continue;
    }
    const cat = matchHeaderToCategory(h, categoryNames);
    if (cat) {
      roles.push({ kind: "category", name: cat });
      continue;
    }
    roles.push({ kind: "ignore" });
  }

  if (countryCol < 0) {
    return {
      ok: false,
      error:
        'Matrix format: no "Country" column found. Add a header named Country, or use the flat CSV format (url, country, category).',
    };
  }

  const categoryCols = roles.filter((r): r is ColRole & { kind: "category" } => r.kind === "category");
  if (categoryCols.length === 0) {
    return {
      ok: false,
      error:
        "Matrix format: no category columns matched your library categories. Check spelling (e.g. Environmental, International Trade Laws).",
    };
  }

  const items: MatrixLawItem[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]!;
    let countryRaw = (row[countryCol] ?? "").trim();
    if (isProbablyRowIndex(countryRaw) || !countryRaw) {
      countryRaw = (row[countryCol + 1] ?? "").trim();
    }
    if (/^https?:\/\//i.test(countryRaw)) {
      countryRaw = (row[countryCol + 2] ?? "").trim();
    }
    if (!countryRaw || /^https?:\/\//i.test(countryRaw) || isProbablyRowIndex(countryRaw)) {
      warnings.push(`Skipped data row ${r + 1}: could not read country name.`);
      continue;
    }
    const country = countryRaw;

    for (let c = 0; c < roles.length; c++) {
      const role = roles[c];
      if (role.kind !== "category") continue;
      const cell = row[c] ?? "";
      if (!cell.trim()) continue;

      const pairs = extractUrlsWithTitles(cell);
      for (const { url, title } of pairs) {
        items.push({ url, country, category: role.name, title });
      }
    }
  }

  if (items.length === 0) {
    return {
      ok: false,
      error: "Matrix format: no http(s) links were found in category cells. Check that URLs start with https://",
    };
  }

  return { ok: true, items, warnings };
}
