/**
 * Import a single PDF as a law: extract text and insert into Supabase.
 * Handles large PDFs (extracts full text into laws.content / laws.content_plain).
 *
 * Usage (from project root):
 *   node --env-file=.env scripts/import-pdf-law.mjs "/path/to/file.pdf" [options]
 *
 * Options:
 *   --country "Ghana"           (default: Ghana) — must be one of: Ghana, Kenya, Tunisia, Ethiopia, Madagascar
 *   --title "Display title"     (default: filename without .pdf)
 *   --category "Corporate Law"  (default: "Corporate Law")
 *   --year 2019                 (optional)
 *   --status "In force"         (default: "In force")
 *   --source-url "https://..."   (optional) — original PDF URL for reference
 *   --update                    Update existing law (match by title + category + country) instead of inserting
 *
 * Example (Ghana):
 *   node --env-file=.env scripts/import-pdf-law.mjs "/path/to/file.pdf" --title "Ghana Corporate Laws" --category "Corporate Law"
 *
 * Example (Kenya):
 *   node --env-file=.env scripts/import-pdf-law.mjs "/path/to/companies-act-2015.pdf" --country Kenya --title "Companies Act, 2015" --category "Corporate Law" --year 2015
 */

import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import { basename } from "path";
import { PDFParse } from "pdf-parse";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Use: node --env-file=.env ...");
  process.exit(1);
}

const args = process.argv.slice(2);
const pdfPath = args.find((a) => !a.startsWith("--"));
if (!pdfPath) {
  console.error("Usage: node --env-file=.env scripts/import-pdf-law.mjs \"/path/to/file.pdf\" [--country Ghana|Kenya|Tunisia|Ethiopia|Madagascar] [--title \"...\"] [--category \"...\"] [--year 2019] [--source-url \"...\"] [--status \"In force\"] [--update]");
  process.exit(1);
}

function getOpt(name, defaultValue) {
  const i = args.indexOf(name);
  if (i === -1 || !args[i + 1]) return defaultValue;
  return args[i + 1];
}

const countryName = getOpt("--country", "Ghana");
const title = getOpt("--title", basename(pdfPath, ".pdf").replace(/-/g, " "));
const category = getOpt("--category", "Corporate Law");
const yearStr = getOpt("--year", null);
const status = getOpt("--status", "In force");
const sourceUrl = getOpt("--source-url", null);
const doUpdate = args.includes("--update");
const year = yearStr ? parseInt(yearStr, 10) : null;

const VALID_COUNTRIES = ["Ghana", "Kenya", "Tunisia", "Ethiopia", "Madagascar"];

const VALID_CATEGORIES = [
  "Corporate Law",
  "Tax Law",
  "Labor/Employment Law",
  "Intellectual Property Law",
  "Data Protection and Privacy Law",
  "International Trade Laws",
  "Anti-Bribery and Corruption Law",
  "Dispute Resolution",
  "Environmental",
];

if (!VALID_COUNTRIES.includes(countryName)) {
  console.error("Invalid --country. Use one of:", VALID_COUNTRIES.join(", "));
  process.exit(1);
}
if (!VALID_CATEGORIES.includes(category)) {
  console.error("Invalid --category. Use one of:", VALID_CATEGORIES.join(", "));
  process.exit(1);
}

async function main() {
  let buffer;
  try {
    buffer = await readFile(pdfPath);
  } catch (e) {
    console.error("Failed to read PDF:", e.message);
    process.exit(1);
  }

  console.log("Extracting text from PDF (may take a moment for large files)...");
  let text = "";
  let parser;
  try {
    parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    text = result.text || "";
  } catch (e) {
    console.error("PDF parse failed:", e.message);
    process.exit(1);
  }

  if (!text || !text.trim()) {
    console.warn("No text extracted from PDF. Inserting anyway with empty content.");
  } else {
    console.log("Extracted", text.length, "characters.");
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: countries } = await supabase.from("countries").select("id").eq("name", countryName).limit(1);
  const countryId = countries?.[0]?.id;
  if (!countryId) {
    console.error("Country not found:", countryName, ". Add it via migration (e.g. 014_add_kenya_country.sql) or SQL.");
    process.exit(1);
  }

  const { data: categories } = await supabase.from("categories").select("id").eq("name", category).limit(1);
  const categoryId = categories?.[0]?.id;
  if (!categoryId) {
    console.error("Category not found:", category);
    process.exit(1);
  }

  let contentTrimmed = text.trim() || null;
  if (contentTrimmed) {
    contentTrimmed = contentTrimmed
      .replace(/\0/g, "")
      .replace(/\\/g, "\\\\");
  }

  if (doUpdate) {
    const { data: existing, error: findErr } = await supabase
      .from("laws")
      .select("id")
      .eq("country_id", countryId)
      .eq("category_id", categoryId)
      .eq("title", title)
      .limit(1)
      .maybeSingle();
    if (findErr) {
      console.error("Lookup failed:", findErr.message);
      process.exit(1);
    }
    if (!existing) {
      console.error("No existing law found with that title and category. Run without --update to insert.");
      process.exit(1);
    }
    const { error: updateErr } = await supabase
      .from("laws")
      .update({ content: contentTrimmed, content_plain: contentTrimmed, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (updateErr) {
      console.error("Update failed:", updateErr.message);
      process.exit(1);
    }
    console.log("Updated law:", existing.id, "—", title);
    return;
  }

  const row = {
    country_id: countryId,
    category_id: categoryId,
    title,
    source_url: sourceUrl || null,
    source_name: null,
    year,
    status,
    content: contentTrimmed,
    content_plain: contentTrimmed,
  };

  const { data, error } = await supabase.from("laws").insert(row).select("id").single();
  if (error) {
    console.error("Insert failed:", error.message);
    process.exit(1);
  }
  console.log("Inserted law:", data.id, "—", title);
}

main();
