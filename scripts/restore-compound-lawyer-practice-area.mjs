/**
 * Restore the compound catalog practice area
 * "Data Protection, Cybersecurity, AI" and remove standalone split rows.
 *
 * Usage (from project root):
 *   node --env-file=.env scripts/restore-compound-lawyer-practice-area.mjs
 */

import { createClient } from "@supabase/supabase-js";

const COMPOUND = "Data Protection, Cybersecurity, AI";
const SPLIT_NAMES = ["Data Protection", "Cybersecurity", "AI"];

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

function mergeCompoundExpertise(expertise) {
  const parts = parseSegments(expertise);
  const out = [];
  let i = 0;
  while (i < parts.length) {
    if (
      i + 2 < parts.length &&
      normalizeKey(parts[i]) === "data protection" &&
      normalizeKey(parts[i + 1]) === "cybersecurity" &&
      ["ai", "a.i.", "a.i", "artificial intelligence"].includes(normalizeKey(parts[i + 2]))
    ) {
      out.push(COMPOUND);
      i += 3;
      continue;
    }
    out.push(parts[i]);
    i += 1;
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
  const next = mergeCompoundExpertise(lawyer.expertise);
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
  .select("id, name, sort_order");
if (areasError) {
  console.error("Failed to load practice areas:", areasError.message);
  process.exit(1);
}

const compoundKey = normalizeKey(COMPOUND);
const hasCompound = (areas ?? []).some((row) => normalizeKey(row.name) === compoundKey);
let maxSort = Math.max(0, ...(areas ?? []).map((row) => row.sort_order ?? 0));

if (!hasCompound) {
  maxSort += 10;
  const { error } = await supabase.from("lawyer_practice_areas").insert({
    name: COMPOUND,
    sort_order: maxSort,
  });
  if (error) {
    console.error("Failed to insert compound practice area:", error.message);
    process.exit(1);
  }
  console.log("Inserted catalog row:", COMPOUND);
}

let catalogDeletes = 0;
for (const row of areas ?? []) {
  if (!SPLIT_NAMES.some((name) => normalizeKey(name) === normalizeKey(row.name))) continue;
  const { error } = await supabase.from("lawyer_practice_areas").delete().eq("id", row.id);
  if (error) {
    console.error(`Failed to delete split practice area ${row.name}:`, error.message);
    process.exit(1);
  }
  catalogDeletes += 1;
  console.log("Removed split catalog row:", row.name);
}

console.log(`Updated ${lawyerUpdates} lawyer profile(s).`);
console.log(`Removed ${catalogDeletes} split catalog row(s).`);
console.log(`Compound label: ${COMPOUND}`);
