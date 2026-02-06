/**
 * Bulk-import Ghana laws from a JSON file into Supabase.
 *
 * Usage (from project root):
 *   node --env-file=.env scripts/seed-ghana-laws.mjs [path-to-json]
 *
 * Default JSON path: scripts/ghana-laws.json
 * Copy scripts/ghana-laws.example.json to scripts/ghana-laws.json and edit.
 *
 * Each JSON entry: title (required), category (required, must match DB),
 *   source_url, source_name, year, status, content, content_plain
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");
  process.exit(1);
}

const jsonPath = process.argv[2] || join(__dirname, "ghana-laws.json");
let raw;
try {
  raw = readFileSync(jsonPath, "utf8");
} catch (e) {
  console.error("Failed to read", jsonPath, e.message);
  console.error("Copy scripts/ghana-laws.example.json to scripts/ghana-laws.json and add your laws.");
  process.exit(1);
}

let list;
try {
  list = JSON.parse(raw);
} catch (e) {
  console.error("Invalid JSON in", jsonPath, e.message);
  process.exit(1);
}

if (!Array.isArray(list) || list.length === 0) {
  console.error("JSON must be a non-empty array of law objects.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: countries } = await supabase.from("countries").select("id").eq("name", "Ghana").limit(1);
  const countryId = countries?.[0]?.id;
  if (!countryId) {
    console.error("Ghana not found in countries table. Run 001_initial_laws.sql first.");
    process.exit(1);
  }

  const { data: categories } = await supabase.from("categories").select("id, name");
  const byName = Object.fromEntries((categories || []).map((c) => [c.name, c.id]));

  const rows = [];
  for (const row of list) {
    const { title, category, source_url, source_name, year, status = "In force", content, content_plain } = row;
    if (!title || !category) {
      console.warn("Skipping entry missing title or category:", row);
      continue;
    }
    const categoryId = byName[category];
    if (!categoryId) {
      console.warn("Unknown category:", category, "- use one of:", Object.keys(byName).join(", "));
      continue;
    }
    rows.push({
      country_id: countryId,
      category_id: categoryId,
      title,
      source_url: source_url || null,
      source_name: source_name || null,
      year: year ?? null,
      status: status || "In force",
      content: content || null,
      content_plain: content_plain || null,
    });
  }

  if (rows.length === 0) {
    console.error("No valid rows to insert.");
    process.exit(1);
  }

  const { data, error } = await supabase.from("laws").insert(rows).select("id");
  if (error) {
    console.error("Insert failed:", error.message);
    process.exit(1);
  }
  console.log("Inserted", data?.length ?? rows.length, "law(s).");
}

main();
