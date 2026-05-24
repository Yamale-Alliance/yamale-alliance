/**
 * Ingest Yamalé AI Contextual Brain sources (PDF + DOCX) into the legal library.
 *
 * Usage:
 *   npm run ingest:ai-context
 *   npm run ingest:ai-context -- --update
 *   node --env-file=.env scripts/ingest-ai-context.mjs [folder] [--dry-run] [--only-brain] [--update]
 *
 * Default folder: AI_CONTEXT_SOURCE_DIR in .env, else data/ai-context/.
 * Requires category "AI Legal Methodology" (migration 20260523100000_ai_legal_methodology_category.sql).
 */

import { createClient } from "@supabase/supabase-js";
import { readdir, readFile } from "fs/promises";
import { basename, dirname, join, extname } from "path";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import { promisify } from "util";
import { PDFParse } from "pdf-parse";

const execFileAsync = promisify(execFile);

const CATEGORY = "AI Legal Methodology";
const BRAIN_FILENAME = "yamale_ai_contextual_brain_v2.docx";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_DEFAULT_FOLDER = join(__dirname, "..", "data", "ai-context");

const args = process.argv.slice(2);
const folderArg = args.find((a) => !a.startsWith("--"));
const folder =
  folderArg ??
  (process.env.AI_CONTEXT_SOURCE_DIR?.trim() || REPO_DEFAULT_FOLDER);
const dryRun = args.includes("--dry-run");
const onlyBrain = args.includes("--only-brain");
const doUpdate = args.includes("--update");

/** Filename stem → exact `countries.name` in Postgres */
const DEEP_DIVE_COUNTRY_DB = {
  "cote d ivoire": "Côte d'Ivoire",
  "democratic republic of the congo": "DR Congo",
  "congo republic": "Congo Republic",
  "cape verde": "Cabo Verde",
  "guinea bissau": "Guinea-Bissau",
  "sao tome and principe": "São Tomé and Príncipe",
  "eswatini": "Eswatini",
  "swaziland": "Eswatini",
};

function normalizeCountrySlug(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "");
}

function countryFromDeepDiveFilename(name) {
  const m = name.match(/^(.+)_Legal_System_Deep_Dive\.docx$/i);
  if (!m) return null;
  return m[1].replace(/_/g, " ").trim();
}

function resolveDeepDiveDbCountry(label, countries) {
  const slug = normalizeCountrySlug(label);
  const mapped = DEEP_DIVE_COUNTRY_DB[slug];
  if (mapped) {
    return countries.find((c) => c.name === mapped) ?? null;
  }
  const exact = countries.find((c) => normalizeCountrySlug(c.name) === slug);
  if (exact) return exact;
  return (
    countries.find((c) => {
      const cs = normalizeCountrySlug(c.name);
      return cs.includes(slug) || slug.includes(cs);
    }) ?? null
  );
}

function titleCaseWords(s) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function titleFromFilename(file) {
  const base = basename(file, extname(file));
  const country = countryFromDeepDiveFilename(basename(file));
  if (country) return `${country} Legal System Deep Dive`;
  if (/contextual_brain/i.test(base)) return "Yamalé AI Contextual Brain v2";
  const brainModule = base.match(/^yamale_ai_brain_(.+)$/i);
  if (brainModule) {
    const topic = brainModule[1].replace(/[-_]+/g, " ").trim();
    return `Yamalé AI Brain — ${titleCaseWords(topic)}`;
  }
  return base.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
}

function collapseWhitespace(s) {
  return s.replace(/\s+/g, " ").trim();
}

async function extractDocxText(path) {
  const { stdout } = await execFileAsync("unzip", ["-p", path, "word/document.xml"], {
    maxBuffer: 50 * 1024 * 1024,
  });
  return collapseWhitespace(stdout.replace(/<[^>]+>/g, " "));
}

async function extractPdfText(path) {
  const buffer = await readFile(path);
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  await parser.destroy();
  return (result.text || "").trim();
}

async function main() {
  const entries = await readdir(folder);
  const files = entries
    .filter((f) => /\.(pdf|docx)$/i.test(f))
    .map((f) => join(folder, f))
    .filter((p) => {
      if (!onlyBrain) return true;
      return basename(p).toLowerCase().includes("contextual_brain");
    });

  if (files.length === 0) {
    console.error("No PDF/DOCX files found in", folder);
    process.exit(1);
  }

  console.log(`Found ${files.length} file(s) in ${folder}`);
  if (dryRun) {
    for (const f of files) {
      const country = countryFromDeepDiveFilename(basename(f));
      console.log("-", basename(f), "→", titleFromFilename(f), country ? `(${country})` : "(global)");
    }
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: categoryRow, error: catErr } = await supabase
    .from("categories")
    .select("id")
    .eq("name", CATEGORY)
    .limit(1)
    .maybeSingle();

  if (catErr || !categoryRow?.id) {
    console.error(`Category "${CATEGORY}" not found. Run migration 20260523100000_ai_legal_methodology_category.sql`);
    process.exit(1);
  }
  const categoryId = categoryRow.id;

  const { data: allCountries } = await supabase.from("countries").select("id, name");
  const countries = Array.isArray(allCountries) ? allCountries : [];

  for (const filePath of files) {
    const fileName = basename(filePath);
    const title = titleFromFilename(filePath);
    const deepDiveCountry = countryFromDeepDiveFilename(fileName);
    let countryId = null;
    let appliesGlobal = true;

    if (deepDiveCountry) {
      const cRow = resolveDeepDiveDbCountry(deepDiveCountry, countries);
      if (cRow?.id) {
        countryId = cRow.id;
        appliesGlobal = false;
      } else {
        console.warn(`  Country not matched for deep dive (${deepDiveCountry}); storing as global.`);
      }
    }

    console.log(`\nProcessing: ${fileName} → "${title}"${appliesGlobal ? " (global)" : ""}`);
    let text = "";
    try {
      if (filePath.toLowerCase().endsWith(".docx")) {
        text = await extractDocxText(filePath);
      } else {
        text = await extractPdfText(filePath);
      }
    } catch (e) {
      console.error("  Extract failed:", e.message);
      continue;
    }

    if (text.length < 200) {
      console.warn("  Skipping — extracted text too short:", text.length);
      continue;
    }
    console.log(`  Extracted ${text.length} characters`);
    if (!appliesGlobal && countryId) {
      const cName = countries.find((c) => c.id === countryId)?.name;
      if (cName) console.log(`  Country: ${cName}`);
    }

    const row = {
      country_id: appliesGlobal ? null : countryId,
      category_id: categoryId,
      title,
      status: "In force",
      year: 2026,
      content: null,
      content_plain: text,
      applies_to_all_countries: appliesGlobal,
      source_name: "Yamalé AI Contextual Brain bundle",
    };

    if (doUpdate) {
      let q = supabase.from("laws").select("id").eq("category_id", categoryId).eq("title", title);
      if (appliesGlobal) {
        q = q.eq("applies_to_all_countries", true).is("country_id", null);
      } else if (countryId) {
        q = q.eq("country_id", countryId);
      }
      const { data: existing } = await q.limit(1).maybeSingle();
      if (!existing?.id) {
        console.warn("  No existing row for update; inserting.");
      } else {
        const { error: upErr } = await supabase
          .from("laws")
          .update({ content_plain: text, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (upErr) console.error("  Update failed:", upErr.message);
        else console.log("  Updated:", existing.id);
        continue;
      }
    }

    const { data, error } = await supabase.from("laws").insert(row).select("id").single();
    if (error) console.error("  Insert failed:", error.message);
    else console.log("  Inserted:", data.id);
  }

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
