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
  EAC: "East Africa",
  IGAD: "East Africa",
  ECOWAS: "West Africa",
  WAEMU: "West Africa",
  ECCAS: "Central Africa",
  CEMAC: "Central Africa",
  SADC: "Southern Africa",
  SACU: "Southern Africa",
  AMU: "North Africa",
  COMESA: "Eastern & Southern Africa",
  CEN_SAD: "Sahel & North Africa",
};

async function main() {
  for (const body of REGIONAL_BODY_DEFINITIONS) {
    const region = REGION_META[body.code] ?? "Regional";
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
      continue;
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

  console.log("Done. Regional bodies are available in admin + library country lists.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
