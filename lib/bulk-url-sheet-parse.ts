/**
 * Parse flat/matrix spreadsheets for bulk URL law import (CSV rows or XLSX first sheet).
 */

import * as XLSX from "xlsx";

export type BulkUrlSheetItem = {
  url: string;
  country?: string;
  category?: string;
  countryId?: string;
  categoryId?: string;
  title?: string;
  year?: number | string | null;
  status?: string;
  forceOcr?: boolean;
};

const HEADER_ALIASES: Record<string, string> = {
  pdf_url: "url",
  pdf_link: "url",
  link: "url",
  pdf: "url",
  law_url: "url",
  law_link: "url",
  country_name: "country",
  category_name: "category",
  db_category: "category",
  law_name: "title",
  law_title: "title",
  country_id: "countryid",
  category_id: "categoryid",
  force_ocr: "forceocr",
  region_name: "region",
};

export function normalizeBulkUrlHeader(h: string): string {
  const t = h.trim().toLowerCase().replace(/\s+/g, "_");
  return HEADER_ALIASES[t] ?? t;
}

/** Row index whose cells (after normalization) include flat-import columns. */
export function findFlatHeaderRowIndex(rows: string[][]): number {
  const maxScan = Math.min(rows.length, 20);
  for (let i = 0; i < maxScan; i++) {
    const rawHeaders = rows[i]!.map(normalizeBulkUrlHeader);
    const hasUrl = rawHeaders.includes("url");
    const hasCountry = rawHeaders.includes("country") || rawHeaders.includes("countryid");
    const hasCategory = rawHeaders.includes("category") || rawHeaders.includes("categoryid");
    if (hasUrl && hasCountry && hasCategory) return i;
  }
  return -1;
}

export function hasFlatUrlColumn(rows: string[][]): boolean {
  return findFlatHeaderRowIndex(rows) >= 0;
}

/** If row 0 is a title row, skip to the real header row (e.g. missing-laws workbook). */
export function rowsForFlatSheet(rows: string[][]): string[][] {
  const headerIdx = findFlatHeaderRowIndex(rows);
  if (headerIdx < 0) return rows;
  const header = rows[headerIdx]!;
  const data = rows.slice(headerIdx + 1);
  return [header, ...data];
}

export function parseWorkbookToRows(buffer: ArrayBuffer): string[][] {
  const wb = XLSX.read(buffer, { type: "array" });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) return [];
  const firstSheet = wb.Sheets[firstSheetName];
  if (!firstSheet) return [];
  const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" }) as unknown[][];
  return rows.map((row) => row.map((cell) => String(cell ?? "").trim()));
}

export function sheetRowsToBulkUrlItems(rows: string[][]): { items: BulkUrlSheetItem[]; error: string | null } {
  if (rows.length < 2) {
    return { items: [], error: "Need a header row and at least one data row." };
  }
  const rawHeaders = rows[0]!.map(normalizeBulkUrlHeader);
  const idx = (name: string) => rawHeaders.indexOf(name);

  const urlCol = idx("url");
  const countryCol = idx("country");
  const categoryCol = idx("category");
  const countryIdCol = idx("countryid");
  const categoryIdCol = idx("categoryid");
  const titleCol = idx("title");
  const yearCol = idx("year");
  const statusCol = idx("status");
  const forceOcrCol = idx("forceocr");

  if (urlCol < 0) {
    return { items: [], error: 'Missing required column "url" (or pdf_url / link).' };
  }
  if (countryIdCol < 0 && countryCol < 0) {
    return { items: [], error: 'Need "country" or "country_id" column.' };
  }
  if (categoryIdCol < 0 && categoryCol < 0) {
    return { items: [], error: 'Need "category" or "category_id" column.' };
  }

  const items: BulkUrlSheetItem[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]!;
    const url = (row[urlCol] ?? "").trim();
    if (!url) continue;

    const country = countryCol >= 0 ? (row[countryCol] ?? "").trim() : undefined;
    const category = categoryCol >= 0 ? (row[categoryCol] ?? "").trim() : undefined;
    const countryId = countryIdCol >= 0 ? (row[countryIdCol] ?? "").trim() : undefined;
    const categoryId = categoryIdCol >= 0 ? (row[categoryIdCol] ?? "").trim() : undefined;

    if (!country && !countryId) {
      return { items: [], error: `Row ${r + 1}: country or country_id is required.` };
    }
    if (!category && !categoryId) {
      return { items: [], error: `Row ${r + 1}: category or category_id is required.` };
    }

    const title = titleCol >= 0 ? (row[titleCol] ?? "").trim() : "";
    const yearStr = yearCol >= 0 ? (row[yearCol] ?? "").trim() : "";
    const status = statusCol >= 0 ? (row[statusCol] ?? "").trim() : "";
    const forceRaw = forceOcrCol >= 0 ? (row[forceOcrCol] ?? "").trim().toLowerCase() : "";
    const forceOcr = forceRaw === "true" || forceRaw === "1" || forceRaw === "yes";

    const item: BulkUrlSheetItem = { url };
    if (country) item.country = country;
    if (category) item.category = category;
    if (countryId) item.countryId = countryId;
    if (categoryId) item.categoryId = categoryId;
    if (title) item.title = title;
    if (yearStr) item.year = yearStr;
    if (status) item.status = status;
    if (forceOcr) item.forceOcr = true;

    items.push(item);
  }

  if (items.length === 0) {
    return { items: [], error: "No data rows with a URL were found." };
  }

  return { items, error: null };
}

/** Parse a flat sheet: detect header row, then map columns to bulk URL items. */
export function parseFlatSheetFromMatrix(rows: string[][]): { items: BulkUrlSheetItem[]; error: string | null } {
  const sliced = rowsForFlatSheet(rows);
  if (!hasFlatUrlColumn(rows)) {
    return {
      items: [],
      error:
        'Could not find a header row with Country, URL, and Category columns. First row should be headers (e.g. COUNTRY, CATEGORY, LAW NAME, URL).',
    };
  }
  return sheetRowsToBulkUrlItems(sliced);
}
