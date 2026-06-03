/**
 * Backfill laws.last_verified_at in batches (if the migration timed out mid-run).
 * Run: node --env-file=.env scripts/backfill-law-last-verified.mjs
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const BATCH = 500;

async function main() {
  let total = 0;
  for (;;) {
    const { data: rows, error: selErr } = await supabase
      .from("laws")
      .select("id, created_at, updated_at")
      .is("last_verified_at", null)
      .limit(BATCH);

    if (selErr) {
      if (/column.*last_verified_at/i.test(String(selErr.message ?? ""))) {
        console.error("Column last_verified_at missing — run migration 20260602150000 first.");
        process.exit(1);
      }
      throw selErr;
    }

    if (!rows?.length) break;

    for (const row of rows) {
      const at = row.updated_at ?? row.created_at ?? new Date().toISOString();
      const { error: upErr } = await supabase
        .from("laws")
        .update({ last_verified_at: at })
        .eq("id", row.id);
      if (upErr) {
        console.error(row.id, upErr.message);
      } else {
        total++;
      }
    }
    console.log(`Updated ${total} rows so far…`);
    if (rows.length < BATCH) break;
  }

  console.log(`Done. Backfilled ${total} law(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
