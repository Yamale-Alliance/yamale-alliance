/**
 * Batch-fix OCR-noisy law text in Supabase using Claude (same CLAUDE_API_KEY as law import).
 *
 * Usage (from project root):
 *   npm run fix-law-ocr -- --country "Eritrea"
 *   (loads .env via the npm script; or: node --env-file=.env --import tsx scripts/fix-law-ocr-with-ai.ts --country "Eritrea")
 *
 * Options:
 *   --country "Eritrea"     Required — country name must match `countries.name` exactly
 *   --dry-run               Log what would be updated without writing to the database
 *   --limit N               Process at most N laws (default: all matching)
 *   --delay-ms 1500         Pause between API calls (rate limits / cost control)
 *   --chunk-chars 75000     Max characters per Claude request (large laws are split at paragraph breaks)
 *
 * Requires: CLAUDE_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import {
  cleanFullLawTextWithClaude,
  DEFAULT_CHUNK_CHARS,
  DEFAULT_INTER_CHUNK_DELAY_MS,
  sanitizeLawContentForDb,
} from "../lib/fix-law-ocr-ai";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const args = process.argv.slice(2);

function getOpt(name: string, defaultValue: string): string {
  const i = args.indexOf(name);
  if (i === -1 || !args[i + 1]) return defaultValue;
  return args[i + 1];
}

function hasFlag(name: string): boolean {
  return args.includes(name);
}

const countryName = getOpt("--country", "").trim();
const dryRun = hasFlag("--dry-run");
const limitRaw = getOpt("--limit", "");
const limit = limitRaw ? parseInt(limitRaw, 10) : Infinity;
const delayMs = parseInt(getOpt("--delay-ms", String(DEFAULT_INTER_CHUNK_DELAY_MS)), 10) || DEFAULT_INTER_CHUNK_DELAY_MS;
const chunkChars = Math.max(20_000, parseInt(getOpt("--chunk-chars", String(DEFAULT_CHUNK_CHARS)), 10) || DEFAULT_CHUNK_CHARS);

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  if (!countryName) {
    console.error(
      'Usage: npm run fix-law-ocr -- --country "Country Name" [--dry-run] [--limit N] [--delay-ms 1500]'
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: countryRows, error: cErr } = await supabase
    .from("countries")
    .select("id, name")
    .eq("name", countryName)
    .limit(1);
  if (cErr || !countryRows?.length) {
    console.error("Country not found:", countryName, cErr?.message || "");
    process.exit(1);
  }
  const countryId = countryRows[0].id;
  console.log("Country:", countryRows[0].name, "(" + countryId + ")");

  const { data: laws, error: lErr } = await supabase
    .from("laws")
    .select("id, title, content, content_plain")
    .eq("country_id", countryId)
    .order("title");

  if (lErr) {
    console.error("Failed to list laws:", lErr.message);
    process.exit(1);
  }

  let list = laws ?? [];
  if (Number.isFinite(limit) && limit > 0) {
    list = list.slice(0, limit);
  }

  console.log("Laws to process:", list.length, dryRun ? "(dry-run)" : "");

  let ok = 0;
  let failed = 0;

  for (let idx = 0; idx < list.length; idx++) {
    const law = list[idx];
    const raw =
      (law.content && law.content.trim()) || (law.content_plain && law.content_plain.trim()) || "";
    if (!raw) {
      console.log(`[${idx + 1}/${list.length}] SKIP (empty):`, law.id, law.title);
      continue;
    }

    console.log(`[${idx + 1}/${list.length}]`, law.id, "—", law.title.slice(0, 80), `(${raw.length} chars)`);

    try {
      const mergedRaw = await cleanFullLawTextWithClaude({
        raw,
        lawTitle: law.title,
        chunkChars,
        delayMs,
      });
      const merged = sanitizeLawContentForDb(mergedRaw);
      if (!merged) {
        console.warn("  Empty after clean; skipping update.");
        failed++;
        continue;
      }

      if (dryRun) {
        console.log(
          "  [dry-run] would write",
          merged.length,
          "chars (preview):",
          merged.slice(0, 200).replace(/\n/g, " ") + "…"
        );
        ok++;
        await sleep(delayMs);
        continue;
      }

      const { error: uErr } = await supabase
        .from("laws")
        .update({
          content: merged,
          content_plain: merged,
          updated_at: new Date().toISOString(),
        })
        .eq("id", law.id);

      if (uErr) {
        console.error("  DB update failed:", uErr.message);
        failed++;
      } else {
        console.log("  Updated OK.");
        ok++;
      }
    } catch (e) {
      console.error("  Error:", e instanceof Error ? e.message : e);
      failed++;
    }

    await sleep(delayMs);
  }

  console.log("\nDone. Success:", ok, "Failed:", failed, dryRun ? "(dry-run: no DB writes)" : "");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
