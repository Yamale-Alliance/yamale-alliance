/**
 * Seed official_sources from Africa_Legal_Sources_Reference.xlsx
 *
 * Usage (from project root):
 *   npm run seed:official-sources -- /path/to/Africa_Legal_Sources_Reference.xlsx
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import * as XLSX from "@e965/xlsx";
import {
  isOfficialSourceCategory,
  normalizeOfficialSourceCountryName,
  sanitizeOfficialSourceUrl,
  type OfficialSourceCategory,
} from "../lib/official-sources";

const SHEET_NAME = "Detailed Sources";

type ParsedRow = {
  country: string;
  region: string | null;
  category: OfficialSourceCategory;
  agency_name: string;
  url: string | null;
  notes: string | null;
};

function parseDetailedSourcesSheet(buffer: Buffer): ParsedRow[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets[SHEET_NAME];
  if (!sheet) {
    throw new Error(`Sheet "${SHEET_NAME}" not found. Available: ${wb.SheetNames.join(", ")}`);
  }

  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as string[][];
  const headerIdx = aoa.findIndex((row) => String(row[0] ?? "").trim() === "Country");
  if (headerIdx < 0) {
    throw new Error('Could not find header row with "Country" in Detailed Sources sheet');
  }

  const out: ParsedRow[] = [];

  for (let i = headerIdx + 1; i < aoa.length; i++) {
    const row = aoa[i];
    const country = String(row[0] ?? "").trim();
    const region = String(row[1] ?? "").trim() || null;
    const categoryRaw = String(row[2] ?? "").trim();
    const agency_name = String(row[3] ?? "").trim();
    const urlRaw = String(row[4] ?? "").trim();
    const notes = String(row[5] ?? "").trim() || null;

    if (!country || country === "Country") continue;
    if (!isOfficialSourceCategory(categoryRaw)) {
      console.warn(`Skipping row ${i + 1}: unknown category "${categoryRaw}" (${country})`);
      continue;
    }
    if (!agency_name) {
      console.warn(`Skipping row ${i + 1}: missing agency (${country} / ${categoryRaw})`);
      continue;
    }

    out.push({
      country: normalizeOfficialSourceCountryName(country),
      region,
      category: categoryRaw,
      agency_name,
      url: sanitizeOfficialSourceUrl(urlRaw),
      notes,
    });
  }

  return out;
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npm run seed:official-sources -- <path-to-xlsx>");
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const buffer = readFileSync(filePath);
  const rows = parseDetailedSourcesSheet(buffer);
  if (!rows.length) {
    console.error("No rows parsed from spreadsheet.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  let upserted = 0;
  let failed = 0;

  for (const row of rows) {
    const { error } = await supabase.from("official_sources").upsert(
      {
        country: row.country,
        region: row.region,
        category: row.category,
        agency_name: row.agency_name,
        url: row.url,
        notes: row.notes,
      },
      { onConflict: "country,category" }
    );

    if (error) {
      failed++;
      console.error(`Failed ${row.country} / ${row.category}:`, error.message);
    } else {
      upserted++;
    }
  }

  console.log(`Parsed ${rows.length} rows. Upserted ${upserted}, failed ${failed}.`);
  const nullUrls = rows.filter((r) => !r.url).length;
  console.log(`Rows with null URL (offline / unavailable): ${nullUrls}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
