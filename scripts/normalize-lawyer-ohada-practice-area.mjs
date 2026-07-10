/**
 * Normalize legacy lawyer practice area labels "Ohada" to "OHADA".
 *
 * Usage (from project root):
 *   node --env-file=.env scripts/normalize-lawyer-ohada-practice-area.mjs
 */

import { createClient } from "@supabase/supabase-js";

const TARGET = "OHADA";
const LEGACY_KEYS = new Set(["ohada"]);

function normalizeKey(raw) {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function parseSegments(expertise) {
  return String(expertise ?? "")
    .split(/[,;|\n]|(?:\s*\/\s*)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function canonicalSegment(segment) {
  const trimmed = segment.trim().replace(/\s+/g, " ");
  const key = normalizeKey(trimmed);
  if (LEGACY_KEYS.has(key)) return TARGET;
  if (key === "ohada law") return "OHADA Law";
  return trimmed;
}

function mergeSegments(expertise) {
  const seen = new Set();
  const out = [];
  for (const segment of parseSegments(expertise)) {
    const label = canonicalSegment(segment);
    const key = normalizeKey(label);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out.join(", ");
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const { data: lawyers, error: lawyersError } = await supabase.from("lawyers").select("id, expertise");
if (lawyersError) {
  console.error("Failed to load lawyers:", lawyersError.message);
  process.exit(1);
}

let lawyerUpdates = 0;
for (const lawyer of lawyers ?? []) {
  const next = mergeSegments(lawyer.expertise);
  if (next === (lawyer.expertise ?? "")) continue;
  const { error } = await supabase.from("lawyers").update({ expertise: next }).eq("id", lawyer.id);
  if (error) {
    console.error(`Failed to update lawyer ${lawyer.id}:`, error.message);
    process.exit(1);
  }
  lawyerUpdates += 1;
}

const { data: areas, error: areasError } = await supabase
  .from("lawyer_practice_areas")
  .select("id, name");
if (areasError) {
  console.error("Failed to load practice areas:", areasError.message);
  process.exit(1);
}

let catalogUpdates = 0;
for (const row of areas ?? []) {
  const key = normalizeKey(row.name);
  let nextName = null;
  if (key === "ohada" && row.name !== TARGET) {
    nextName = TARGET;
  } else if (key === "ohada law" && row.name !== "OHADA Law") {
    nextName = "OHADA Law";
  }
  if (!nextName) continue;
  const { error } = await supabase.from("lawyer_practice_areas").update({ name: nextName }).eq("id", row.id);
  if (error) {
    console.error(`Failed to update practice area ${row.name}:`, error.message);
    process.exit(1);
  }
  catalogUpdates += 1;
}

console.log(`Updated ${lawyerUpdates} lawyer profile(s).`);
console.log(`Updated ${catalogUpdates} catalog practice area row(s).`);
console.log(`Canonical label: ${TARGET}`);
