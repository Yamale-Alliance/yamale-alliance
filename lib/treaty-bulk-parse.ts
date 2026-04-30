/**
 * Parse treaty rows from an XLSX worksheet, including **hyperlink targets** (e.g. cells that show
 * "Full text (en)" but store the real URL in Excel metadata — `sheet_to_json` alone misses those).
 */

import * as XLSX from "xlsx";

export type TreatyBulkParsedRow = {
  /** 1-based data row index for display (first data row = 1) */
  sheetRowNumber: number;
  /** Optional value from a `Law #` column in the sheet */
  lawNumberFromSheet?: number;
  country: string;
  treatyName: string;
  year: number | null;
  link: string;
};

export type ParseTreatyWorksheetResult = {
  rows: TreatyBulkParsedRow[];
  /** Which canonical columns were matched on the header row */
  detectedFields: Record<"country" | "treatyName" | "year" | "link", boolean>;
};

function normalizeHeaderKey(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ");
}

/** Map a header cell to a canonical field, or null if unknown */
export function headerToField(
  header: string
): "lawNumber" | "country" | "treatyName" | "year" | "link" | "failureReason" | null {
  const n = normalizeHeaderKey(header);
  if (n === "law #" || n === "law no" || n === "law number" || n === "no") return "lawNumber";
  if (n === "country" || n === "nation" || n === "party" || n === "jurisdiction") return "country";
  if (
    n === "treaty name" ||
    n === "treaty" ||
    n === "name" ||
    n === "title" ||
    n === "instrument" ||
    n === "agreement name"
  ) {
    return "treatyName";
  }
  if (n === "year" || n === "signed year" || n === "date year") return "year";
  if (
    n === "link" ||
    n === "url" ||
    n === "source" ||
    n === "source url" ||
    n === "href" ||
    n === "full text link" ||
    n === "fulltext link" ||
    n === "text link"
  ) {
    return "link";
  }
  // e.g. "Document link", "PDF link"
  if (n.includes("link") && (n.includes("full") || n.includes("text") || n.includes("document"))) {
    return "link";
  }
  if (n === "failure reason" || n === "reason" || n === "error" || n === "failure") {
    return "failureReason";
  }
  return null;
}

function parseYear(raw: string | undefined): number | null {
  if (!raw?.trim()) return null;
  const n = parseInt(raw.replace(/[^\d]/g, ""), 10);
  if (Number.isNaN(n) || n < 1800 || n > 2200) return null;
  return n;
}

function parseLawNumber(raw: string | undefined): number | undefined {
  if (!raw?.trim()) return undefined;
  const n = parseInt(raw.replace(/[^\d]/g, ""), 10);
  if (Number.isNaN(n) || n <= 0) return undefined;
  return n;
}

/** Hyperlink target from a SheetJS cell (Excel "display text as link"). */
function hyperlinkTarget(cell: XLSX.CellObject | undefined): string {
  if (!cell || typeof cell !== "object") return "";
  const l = (cell as { l?: { Target?: string; target?: string } }).l;
  if (!l) return "";
  return String(l.Target ?? l.target ?? "").trim();
}

function cellText(cell: XLSX.CellObject | undefined): string {
  if (!cell) return "";
  if (cell.w != null) return String(cell.w).trim();
  if (cell.v != null && cell.t !== "z") return String(cell.v).trim();
  return "";
}

function looksLikeHttpUrl(s: string): boolean {
  return /^https?:\/\//i.test(s.trim());
}

/**
 * Parse the first sheet row as headers, then each subsequent row using cell values **and**
 * hyperlink targets for the link column.
 */
export function parseTreatyWorksheet(sheet: XLSX.WorkSheet): ParseTreatyWorksheetResult {
  const ref = sheet["!ref"];
  if (!ref) {
    return {
      rows: [],
      detectedFields: { country: false, treatyName: false, year: false, link: false },
    };
  }

  const range = XLSX.utils.decode_range(ref);
  const headerR = range.s.r;
  const colMap: Partial<Record<"lawNumber" | "country" | "treatyName" | "year" | "link", number>> = {};

  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: headerR, c });
    const cell = sheet[addr];
    const headerText = cellText(cell);
    const field = headerToField(headerText);
    if (field && field !== "failureReason") colMap[field] = c;
  }

  const detectedFields: Record<"country" | "treatyName" | "year" | "link", boolean> = {
    country: colMap.country !== undefined,
    treatyName: colMap.treatyName !== undefined,
    year: colMap.year !== undefined,
    link: colMap.link !== undefined,
  };

  const result: TreatyBulkParsedRow[] = [];
  let sheetRowNumber = 1;

  const read = (r: number, field: keyof typeof colMap): { text: string; href: string } => {
    const c = colMap[field];
    if (c === undefined) return { text: "", href: "" };
    const addr = XLSX.utils.encode_cell({ r, c });
    const cell = sheet[addr];
    return { text: cellText(cell), href: hyperlinkTarget(cell) };
  };

  for (let r = headerR + 1; r <= range.e.r; r++) {
    const lawNumber = parseLawNumber(read(r, "lawNumber").text);
    const country = read(r, "country").text;
    const treaty = read(r, "treatyName");
    const yearCell = read(r, "year");
    const linkCell = read(r, "link");

    const treatyName = treaty.text;
    const year = parseYear(yearCell.text);
    const link =
      linkCell.href || (looksLikeHttpUrl(linkCell.text) ? linkCell.text : "");

    if (!country && !treatyName && !link && !yearCell.text) continue;

    result.push({
      sheetRowNumber: sheetRowNumber++,
      lawNumberFromSheet: lawNumber,
      country,
      treatyName,
      year,
      link,
    });
  }

  return { rows: result, detectedFields };
}

/**
 * Convert XLSX `sheet_to_json` rows (objects keyed by header) into structured treaty rows.
 * **Does not include hyperlink-only URLs** — prefer {@link parseTreatyWorksheet} for real Excel files.
 */
export function parseTreatySheetRows(rows: Record<string, unknown>[]): TreatyBulkParsedRow[] {
  const result: TreatyBulkParsedRow[] = [];
  let sheetRowNumber = 1;

  for (const row of rows) {
    const fields: Partial<Record<"lawNumber" | "country" | "treatyName" | "year" | "link", string>> = {};
    for (const [header, raw] of Object.entries(row)) {
      const field = headerToField(header);
      if (!field || field === "failureReason") continue;
      const s = String(raw ?? "").trim();
      if (s) fields[field] = s;
    }

    const country = fields.country?.trim() ?? "";
    const treatyName = fields.treatyName?.trim() ?? "";
    const link = fields.link?.trim() ?? "";
    const year = parseYear(fields.year);
    const lawNumber = parseLawNumber(fields.lawNumber);

    if (!country && !treatyName && !link && !fields.year) continue;

    result.push({
      sheetRowNumber: sheetRowNumber++,
      lawNumberFromSheet: lawNumber,
      country,
      treatyName,
      year,
      link,
    });
  }

  return result;
}
