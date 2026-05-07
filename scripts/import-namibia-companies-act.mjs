/**
 * One-shot ingestion: Namibia Companies Act, 2004 (Act No. 28 of 2004).
 *
 * Source: NamibLII consolidated version 16 January 2017 (post Act 8 of 2016 amendments).
 * Authoritative URL: https://namiblii.org/akn/na/act/2004/28/eng@2017-01-16
 *
 * Usage:
 *   node --env-file=.env scripts/import-namibia-companies-act.mjs
 *
 * Idempotent: upserts on (country_id, category_id, title).
 */
import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (use: node --env-file=.env ...)");
  process.exit(1);
}

const SOURCE_PATH = "data/source/namibia-companies-act-2004.namiblii.txt";
const COUNTRY_NAME = "Namibia";
const CATEGORY_NAME = "Corporate Law";
const TITLE = "Companies Act - 2004 (Act No. 28 of 2004)";
const YEAR = 2004;
const STATUS = "In force";
const SOURCE_URL = "https://namiblii.org/akn/na/act/2004/28/eng@2017-01-16";

function stripNamibliiNavigation(raw) {
  const lines = raw.split(/\r?\n/);
  const cleaned = [];

  // Locate the first real content line (Chapter 1 / "1. Definitions") and discard the page header.
  let started = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!started) {
      if (/^#\s+Companies Act, 2004\s*$/.test(trimmed)) {
        cleaned.push("# Companies Act, 2004 (Act No. 28 of 2004)");
        cleaned.push("");
        started = true;
      }
      continue;
    }

    // Skip pure social-share / report links and one-off NamibLII chrome lines.
    if (/^\[\*\*\]\(.+\)/.test(trimmed)) continue;
    if (/^\[Download PDF/i.test(trimmed)) continue;
    if (/^\(\d+(\.\d+)?\s*MB\)\]/.test(trimmed)) continue;
    if (/^ReportReport a problem$/i.test(trimmed)) continue;
    if (/^\*\s*\*\*/.test(trimmed)) continue;
    if (/^Citation\s*Act\s*\d+\s*of\s*\d+\s*Copy\s*Date$/i.test(trimmed)) continue;
    if (/^\[\d{1,2}\s+\w+\s+\d{4}\]\(#\)/.test(trimmed)) continue;
    if (/^Language\s*English\s*Type\s*Legislation$/i.test(trimmed)) continue;
    if (/^#####/.test(trimmed)) continue;
    if (/^Navigate document$/i.test(trimmed)) continue;
    if (/^!\[.*?\]\(.*?\)$/.test(trimmed)) continue;
    if (/^\* \[\d+ related documents\]/i.test(trimmed)) continue;
    if (/^This is the version of this Act/i.test(trimmed)) continue;

    cleaned.push(line);
  }

  // Convert inline markdown link syntax `[label](url)` → `label` (preserves readability).
  let out = cleaned.join("\n");
  out = out.replace(/\[([^\]]+)\]\((?:https?:\/\/|\/)[^)]+\)/g, "$1");
  // Drop any leftover bare URLs that survived as fragments.
  out = out.replace(/^\s*https?:\/\/\S+\s*$/gm, "");
  // Squash 3+ blank lines.
  out = out.replace(/\n{3,}/g, "\n\n").trim();
  return out;
}

function toPlain(markdown) {
  return markdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/`/g, "")
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/\r/g, "")
    .trim();
}

async function main() {
  const raw = await readFile(SOURCE_PATH, "utf8");
  const markdown = stripNamibliiNavigation(raw);
  const plain = toPlain(markdown);

  console.log(
    `Prepared content: markdown=${markdown.length} chars, plain=${plain.length} chars`
  );
  if (plain.length < 50000) {
    console.error(
      `Aborting: content_plain is unexpectedly short (${plain.length} chars). Source file may be truncated.`
    );
    process.exit(2);
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  const { data: country, error: countryErr } = await supabase
    .from("countries")
    .select("id")
    .eq("name", COUNTRY_NAME)
    .limit(1)
    .maybeSingle();
  if (countryErr || !country?.id) {
    console.error(`Country '${COUNTRY_NAME}' not found:`, countryErr?.message ?? "");
    process.exit(1);
  }

  const { data: category, error: categoryErr } = await supabase
    .from("categories")
    .select("id")
    .eq("name", CATEGORY_NAME)
    .limit(1)
    .maybeSingle();
  if (categoryErr || !category?.id) {
    console.error(`Category '${CATEGORY_NAME}' not found:`, categoryErr?.message ?? "");
    process.exit(1);
  }

  const { data: existing, error: lookupErr } = await supabase
    .from("laws")
    .select("id")
    .eq("country_id", country.id)
    .eq("category_id", category.id)
    .eq("title", TITLE)
    .limit(1)
    .maybeSingle();
  if (lookupErr) {
    console.error("Lookup failed:", lookupErr.message);
    process.exit(1);
  }

  if (existing?.id) {
    const { error: updateErr } = await supabase
      .from("laws")
      .update({
        content: markdown,
        content_plain: plain,
        source_url: SOURCE_URL,
        source_name: "namiblii.org",
        year: YEAR,
        status: STATUS,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (updateErr) {
      console.error("Update failed:", updateErr.message);
      process.exit(1);
    }
    console.log(`Updated law ${existing.id} — ${TITLE}`);
    return;
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("laws")
    .insert({
      country_id: country.id,
      category_id: category.id,
      title: TITLE,
      source_url: SOURCE_URL,
      source_name: "namiblii.org",
      year: YEAR,
      status: STATUS,
      content: markdown,
      content_plain: plain,
    })
    .select("id")
    .single();
  if (insertErr) {
    console.error("Insert failed:", insertErr.message);
    process.exit(1);
  }
  console.log(`Inserted law ${inserted.id} — ${TITLE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
