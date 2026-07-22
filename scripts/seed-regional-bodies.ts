/**
 * Seed regional body rows into `countries` (requires docs/sql/009_regional_bodies.sql).
 *
 * Usage:
 *   node --env-file=.env --import tsx scripts/seed-regional-bodies.ts
 *   # or: npx tsx --env-file=.env scripts/seed-regional-bodies.ts
 */

import { createClient } from "@supabase/supabase-js";
import { REGIONAL_BODY_DEFINITIONS } from "../lib/regional-bodies";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const REGION_META: Record<string, string> = {
  AU: "Continental",
  AFCFTA: "Continental",
  OHADA: "West & Central Africa",
  ECOWAS: "West Africa",
  EAC: "East Africa",
  SADC: "Southern Africa",
  COMESA: "Eastern & Southern Africa",
  ECCAS: "Central Africa",
  UEMOA: "West Africa",
  CEMAC: "Central Africa",
  SACU: "Southern Africa",
};

/** Bodies that were seeded previously but are no longer in the product catalog. */
const OBSOLETE_CODES = ["IGAD", "AMU", "CEN_SAD", "WAEMU"] as const;

async function upsertBody(body: (typeof REGIONAL_BODY_DEFINITIONS)[number], region: string) {
  const { data: existing } = await supabase
    .from("countries")
    .select("id, name, kind, code")
    .or(`code.eq.${body.code},name.eq.${body.name}`)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from("countries")
      .update({ kind: "regional_body", code: body.code, region, name: body.name })
      .eq("id", existing.id);
    if (error) {
      console.error(`Update failed for ${body.name}:`, error.message);
      process.exit(1);
    }
    console.log(`Updated regional body: ${body.name}`);
    return;
  }

  const { error } = await supabase.from("countries").insert({
    name: body.name,
    kind: "regional_body",
    code: body.code,
    region,
  });

  if (error) {
    console.error(`Insert failed for ${body.name}:`, error.message);
    process.exit(1);
  }
  console.log(`Inserted regional body: ${body.name}`);
}

/** Rename legacy WAEMU row to UEMOA if present. */
async function migrateWaemuToUemoa() {
  const { data: waemu } = await supabase
    .from("countries")
    .select("id, name, code")
    .eq("code", "WAEMU")
    .maybeSingle();
  if (!waemu?.id) return;

  const { data: uemoa } = await supabase
    .from("countries")
    .select("id")
    .eq("code", "UEMOA")
    .maybeSingle();

  if (uemoa?.id) {
    console.log(
      `Note: both WAEMU (${waemu.id}) and UEMOA (${uemoa.id}) exist — keep UEMOA; re-point laws from WAEMU manually if needed.`
    );
    return;
  }

  const { error } = await supabase
    .from("countries")
    .update({ code: "UEMOA", name: "UEMOA", region: "West Africa", kind: "regional_body" })
    .eq("id", waemu.id);
  if (error) {
    console.error("Failed to rename WAEMU → UEMOA:", error.message);
    process.exit(1);
  }
  console.log("Renamed regional body WAEMU → UEMOA");
}

async function reportObsolete() {
  const catalogCodes = new Set(REGIONAL_BODY_DEFINITIONS.map((b) => b.code));
  const { data: rows } = await supabase
    .from("countries")
    .select("id, name, code")
    .eq("kind", "regional_body");

  const obsolete = (rows ?? []).filter((r) => {
    const code = (r.code ?? "").toUpperCase();
    return (
      OBSOLETE_CODES.includes(code as (typeof OBSOLETE_CODES)[number]) ||
      (code && !catalogCodes.has(code) && code !== "WAEMU")
    );
  });

  if (obsolete.length === 0) return;

  for (const row of obsolete) {
    const { count: laws } = await supabase
      .from("laws")
      .select("id", { count: "exact", head: true })
      .eq("country_id", row.id);
    const { count: scopes } = await supabase
      .from("law_country_scopes")
      .select("id", { count: "exact", head: true })
      .eq("country_id", row.id);

    if ((laws ?? 0) > 0 || (scopes ?? 0) > 0) {
      console.log(
        `Keeping obsolete ${row.name} (code=${row.code}) — laws=${laws ?? 0}, scopes=${scopes ?? 0}`
      );
      continue;
    }

    const { error } = await supabase.from("countries").delete().eq("id", row.id);
    if (error) {
      console.warn(`Could not delete unused obsolete body ${row.name}:`, error.message);
    } else {
      console.log(`Deleted unused obsolete regional body: ${row.name} (${row.code})`);
    }
  }
}

async function main() {
  await migrateWaemuToUemoa();

  for (const body of REGIONAL_BODY_DEFINITIONS) {
    const region = REGION_META[body.code] ?? "Regional";
    await upsertBody(body, region);
  }

  await reportObsolete();
  console.log("Done. Regional bodies are available in admin + library country lists.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
