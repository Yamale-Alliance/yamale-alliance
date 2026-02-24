import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import type { Database } from "@/lib/database.types";
import * as XLSX from "xlsx";

type TariffInsert = Database["public"]["Tables"]["afcfta_tariff_schedule"]["Insert"];

const COLUMN_ALIASES: Record<string, string[]> = {
  hsCode: ["hs code", "hs_code", "hscode", "code"],
  productDescription: ["product description", "product_description", "product", "description"],
  productCategory: ["product category", "product_category", "category"],
  sensitivity: ["sensitivity"],
  mfnRatePercent: ["mfn rate", "mfn rate (%)", "mfn_rate", "mfn"],
  afcfta2026Percent: ["afcfta 2026", "afcfta 2026 (%)", "afcfta_2026", "2026"],
  afcfta2030Percent: ["afcfta 2030", "afcfta 2030 (%)", "afcfta_2030", "2030"],
  afcfta2035Percent: ["afcfta 2035", "afcfta 2035 (%)", "afcfta_2035", "2035"],
  phaseCategory: ["phase category", "phase_category", "phase"],
  phaseYears: ["phase years", "phase_years", "years"],
  annualSavings10k: ["annual savings on $10k", "annual savings", "annual_savings_10k", "savings 10k"],
};

function normalizeHeader(h: string): string {
  return String(h ?? "").toLowerCase().replace(/%/g, "").trim();
}

function findKeyForHeader(header: string): string | null {
  const n = normalizeHeader(header);
  for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
    if (aliases.some((a) => n.includes(a) || a.includes(n))) return key;
  }
  return null;
}

function parseNum(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "number" && Number.isFinite(val)) return val;
  const s = String(val).replace(/%/g, "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export type NormalizedRow = {
  hsCode: string;
  productDescription: string;
  productCategory?: string | null;
  sensitivity?: string | null;
  mfnRatePercent?: number | null;
  afcfta2026Percent?: number | null;
  afcfta2030Percent?: number | null;
  afcfta2035Percent?: number | null;
  phaseCategory?: string | null;
  phaseYears?: string | null;
  annualSavings10k?: number | null;
};

function getByKey(values: (string | number)[], headerToKey: Record<number, string>, key: string): unknown {
  const idx = Number(Object.entries(headerToKey).find(([, k]) => k === key)?.[0]);
  if (Number.isFinite(idx) && values[idx] !== undefined) return values[idx];
  return undefined;
}

function mapRowToNormalized(
  values: (string | number)[],
  headerToKey: Record<number, string>
): NormalizedRow | null {
  const get = (key: string) => getByKey(values, headerToKey, key);
  const hsCode = String(get("hsCode") ?? values[0] ?? "").trim();
  const productDescription = String(get("productDescription") ?? values[1] ?? "").trim();
  if (!hsCode || !productDescription) return null;
  return {
    hsCode,
    productDescription,
    productCategory: (get("productCategory") as string) || null,
    sensitivity: (get("sensitivity") as string) || null,
    mfnRatePercent: parseNum(get("mfnRatePercent") ?? values[4]),
    afcfta2026Percent: parseNum(get("afcfta2026Percent") ?? values[5]),
    afcfta2030Percent: parseNum(get("afcfta2030Percent") ?? values[6]),
    afcfta2035Percent: parseNum(get("afcfta2035Percent") ?? values[7]),
    phaseCategory: (get("phaseCategory") as string) || null,
    phaseYears: (get("phaseYears") as string) || null,
    annualSavings10k: parseNum(get("annualSavings10k") ?? values[10]),
  };
}

function parseCsv(buffer: Buffer): NormalizedRow[] {
  const text = buffer.toString("utf-8");
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const headerLine = lines[0];
  const headerToKey: Record<number, string> = {};
  const headers = headerLine.split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  headers.forEach((h, i) => {
    const key = findKeyForHeader(h);
    if (key) headerToKey[i] = key;
  });
  const defaultOrder = ["hsCode", "productDescription", "productCategory", "sensitivity", "mfnRatePercent", "afcfta2026Percent", "afcfta2030Percent", "afcfta2035Percent", "phaseCategory", "phaseYears", "annualSavings10k"];
  let dataStart = 1;
  if (Object.keys(headerToKey).length === 0) {
    defaultOrder.forEach((k, i) => { headerToKey[i] = k; });
    dataStart = 0;
  }
  const rows: NormalizedRow[] = [];
  for (let i = dataStart; i < lines.length; i++) {
    const parts: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let j = 0; j < lines[i].length; j++) {
      const c = lines[i][j];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if ((c === "," && !inQuotes) || (c === "\t" && !inQuotes)) {
        parts.push(current.trim());
        current = "";
      } else {
        current += c;
      }
    }
    parts.push(current.trim());
    const norm = mapRowToNormalized(parts, headerToKey);
    if (norm) rows.push(norm);
  }
  return rows;
}

function parseXlsx(buffer: Buffer): NormalizedRow[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const first = wb.Sheets[wb.SheetNames[0]];
  if (!first) return [];
  const data = XLSX.utils.sheet_to_json(first, { header: 1, defval: "" }) as unknown[][];
  if (!Array.isArray(data) || data.length < 2) return [];
  const headerRow = data[0];
  const headerToKey: Record<number, string> = {};
  headerRow.forEach((h, i) => {
    const key = findKeyForHeader(String(h ?? ""));
    if (key) headerToKey[i] = key;
  });
  const defaultOrder = ["hsCode", "productDescription", "productCategory", "sensitivity", "mfnRatePercent", "afcfta2026Percent", "afcfta2030Percent", "afcfta2035Percent", "phaseCategory", "phaseYears", "annualSavings10k"];
  let dataStart = 1;
  if (Object.keys(headerToKey).length === 0) {
    defaultOrder.forEach((k, i) => { headerToKey[i] = k; });
    dataStart = 0;
  }
  const rows: NormalizedRow[] = [];
  for (let i = dataStart; i < data.length; i++) {
    const row = data[i];
    if (!Array.isArray(row)) continue;
    const values = row.map((v) => (typeof v === "number" ? v : String(v ?? "")));
    const norm = mapRowToNormalized(values, headerToKey);
    if (norm) rows.push(norm);
  }
  return rows;
}

async function parsePdf(buffer: Buffer): Promise<NormalizedRow[]> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  await parser.destroy();
  const text = result?.text ?? "";
  if (!text.trim()) return [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const rows: NormalizedRow[] = [];
  const headerLine = lines[0];
  const sep = headerLine.includes("\t") ? "\t" : /\s{2,}/;
  const headers = headerLine.split(sep).map((h) => h.trim());
  const headerToKey: Record<number, string> = {};
  headers.forEach((h, i) => {
    const key = findKeyForHeader(h);
    if (key) headerToKey[i] = key;
  });
  const defaultOrder = ["hsCode", "productDescription", "productCategory", "sensitivity", "mfnRatePercent", "afcfta2026Percent", "afcfta2030Percent", "afcfta2035Percent", "phaseCategory", "phaseYears", "annualSavings10k"];
  let dataStart = 1;
  if (Object.keys(headerToKey).length === 0) {
    defaultOrder.forEach((k, i) => { headerToKey[i] = k; });
    dataStart = 0;
  }
  for (let i = dataStart; i < lines.length; i++) {
    const parts = lines[i].split(sep).map((p) => p.trim());
    const norm = mapRowToNormalized(parts, headerToKey);
    if (norm) rows.push(norm);
  }
  return rows;
}

function toInsert(country: string, r: NormalizedRow): TariffInsert {
  return {
    country,
    hs_code: r.hsCode,
    product_description: r.productDescription,
    product_category: r.productCategory ?? null,
    sensitivity: r.sensitivity ?? null,
    mfn_rate_percent: r.mfnRatePercent ?? null,
    afcfta_2026_percent: r.afcfta2026Percent ?? null,
    afcfta_2030_percent: r.afcfta2030Percent ?? null,
    afcfta_2035_percent: r.afcfta2035Percent ?? null,
    phase_category: r.phaseCategory ?? null,
    phase_years: r.phaseYears ?? null,
    annual_savings_10k: r.annualSavings10k ?? null,
  };
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const country = formData.get("country") as string | null;

    if (!file || !country?.trim()) {
      return NextResponse.json(
        { error: "file and country are required" },
        { status: 400 }
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const name = (file.name ?? "").toLowerCase();
    let parsed: NormalizedRow[];

    if (name.endsWith(".csv")) {
      parsed = parseCsv(buf);
    } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      parsed = parseXlsx(buf);
    } else if (name.endsWith(".pdf")) {
      parsed = await parsePdf(buf);
    } else {
      return NextResponse.json(
        { error: "Unsupported format. Use PDF, XLSX, or CSV." },
        { status: 400 }
      );
    }

    if (parsed.length === 0) {
      return NextResponse.json(
        { error: "No rows detected. Check file has headers and data (HS Code, Product Description, etc.)." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();
    const payload: TariffInsert[] = parsed.map((r) => toInsert(country.trim(), r));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase typings for this table
    const { error } = await (supabase as any).from("afcfta_tariff_schedule").insert(payload);

    if (error) {
      console.error("Import insert error:", error);
      return NextResponse.json(
        { error: "Failed to insert rows", details: error.message },
        { status: 500 }
      );
    }

    // Save to import history so admin can view this import later
    const batchPayload = {
      country: country.trim(),
      file_name: file.name || null,
      row_count: parsed.length,
      rows: parsed as unknown as Record<string, unknown>[],
    };
    await (supabase as any).from("afcfta_import_batches").insert(batchPayload);

    return NextResponse.json({
      ok: true,
      inserted: payload.length,
      /** Full list of normalized rows that were inserted (for admin to view). */
      rows: parsed,
    });
  } catch (err) {
    console.error("AfCFTA import error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Import failed", details: message },
      { status: 500 }
    );
  }
}
