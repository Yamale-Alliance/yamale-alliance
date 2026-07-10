/**
 * Merge legacy lawyer practice areas "Finance" and "Banking" into "Banking and Finance".
 *
 * Usage (from project root):
 *   node --env-file=.env scripts/merge-lawyer-finance-into-banking-and-finance.mjs
 */

import { createClient } from "@supabase/supabase-js";

const TARGET = "Banking and Finance";
const LEGACY_KEYS = new Set(["finance", "banking", "banking and finance", "banking & finance"]);

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

function mergeSegments(expertise) {
  const seen = new Set();
  const out = [];
  for (const segment of parseSegments(expertise)) {
    const key = normalizeKey(segment);
    const label = LEGACY_KEYS.has(key) ? TARGET : segment.trim().replace(/\s+/g, " ");
    const outKey = LEGACY_KEYS.has(key) ? normalizeKey(TARGET) : normalizeKey(label);
    if (!outKey || seen.has(outKey)) continue;
    seen.add(outKey);
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

const targetRow = (areas ?? []).find((row) => normalizeKey(row.name) === normalizeKey(TARGET));
const legacyRows = (areas ?? []).filter((row) => {
  const key = normalizeKey(row.name);
  return LEGACY_KEYS.has(key) && key !== normalizeKey(TARGET);
});

let catalogDeletes = 0;
if (!targetRow) {
  const seed = legacyRows[0] ?? { sort_order: 10 };
  const { error } = await supabase.from("lawyer_practice_areas").insert({
    name: TARGET,
    sort_order: typeof seed.sort_order === "number" ? seed.sort_order : 10,
  });
  if (error) {
    console.error("Failed to create Banking and Finance catalog row:", error.message);
    process.exit(1);
  }
  console.log("Created catalog row:", TARGET);
}

for (const row of legacyRows) {
  const { error } = await supabase.from("lawyer_practice_areas").delete().eq("id", row.id);
  if (error) {
    console.error(`Failed to delete legacy practice area ${row.name}:`, error.message);
    process.exit(1);
  }
  catalogDeletes += 1;
}

console.log(`Updated ${lawyerUpdates} lawyer profile(s).`);
console.log(`Removed ${catalogDeletes} legacy catalog practice area row(s).`);
console.log(`Canonical label: ${TARGET}`);
