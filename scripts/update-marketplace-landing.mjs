#!/usr/bin/env node
/**
 * Push landing_page_html (and optional description) to a marketplace vault item.
 *
 * Usage:
 *   node scripts/update-marketplace-landing.mjs \
 *     --title "Zambia Extractive Industry Subcontractor Pack" \
 *     --html data/marketplace/zambia-extractive-industry-subcontractor-pack/landing.html
 *
 *   node scripts/update-marketplace-landing.mjs --id <uuid> --html path/to/landing.html
 *
 *   node scripts/update-marketplace-landing.mjs --title "..." --html ... --verify-zip
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env (loaded via dotenv if present).
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import JSZip from "jszip";

const MAX_LANDING_CHARS = 500_000;

function loadEnv() {
  try {
    const envPath = resolve(process.cwd(), ".env");
    if (!existsSync(envPath)) return;
    const dotenv = readFileSync(envPath, "utf8");
    for (const line of dotenv.split("\n")) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!m) continue;
      const key = m[1];
      if (process.env[key]) continue;
      let val = m[2].trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  } catch {
    // optional
  }
}

function arg(name) {
  const i = process.argv.indexOf(name);
  if (i === -1) return null;
  return process.argv[i + 1] ?? null;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

async function main() {
  loadEnv();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const id = arg("--id");
  const titleQuery = arg("--title");
  const htmlPath = arg("--html");
  const descriptionPath = arg("--description");
  const verifyZip = hasFlag("--verify-zip");
  const dryRun = hasFlag("--dry-run");

  if (!htmlPath) {
    console.error("Provide --html path/to/landing.html");
    process.exit(1);
  }

  const htmlFile = resolve(process.cwd(), htmlPath);
  if (!existsSync(htmlFile)) {
    console.error("HTML file not found:", htmlFile);
    process.exit(1);
  }

  const landingHtml = readFileSync(htmlFile, "utf8").trim();
  if (!landingHtml) {
    console.error("Landing HTML file is empty");
    process.exit(1);
  }
  if (landingHtml.length > MAX_LANDING_CHARS) {
    console.error(`Landing HTML exceeds ${MAX_LANDING_CHARS} characters`);
    process.exit(1);
  }

  let description = null;
  if (descriptionPath) {
    const descFile = resolve(process.cwd(), descriptionPath);
    if (existsSync(descFile)) {
      description = readFileSync(descFile, "utf8").trim() || null;
    }
  }

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  let item;
  if (id) {
    const { data, error } = await supabase
      .from("marketplace_items")
      .select("id, title, file_path, file_name, file_format, landing_page_html")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    item = data;
  } else if (titleQuery) {
    const { data, error } = await supabase
      .from("marketplace_items")
      .select("id, title, file_path, file_name, file_format, landing_page_html")
      .ilike("title", `%${titleQuery}%`)
      .limit(5);
    if (error) throw error;
    if (!data?.length) {
      console.error("No marketplace item matched title:", titleQuery);
      process.exit(1);
    }
    if (data.length > 1) {
      console.error("Multiple items matched — use --id:");
      for (const row of data) console.error(" ", row.id, row.title);
      process.exit(1);
    }
    item = data[0];
  } else {
    console.error("Provide --id or --title");
    process.exit(1);
  }

  console.log("Target:", item.id, item.title);

  if (verifyZip && item.file_path) {
    const { data: blob, error: dlErr } = await supabase.storage
      .from("marketplace-files")
      .download(item.file_path);
    if (dlErr) {
      console.warn("Could not download ZIP for verification:", dlErr.message);
    } else {
      const buf = Buffer.from(await blob.arrayBuffer());
      const zip = await JSZip.loadAsync(buf);
      const files = Object.values(zip.files).filter(
        (f) => !f.dir && !f.name.startsWith("__MACOSX") && !f.name.endsWith("/")
      );
      const docx = files.filter((f) => /\.docx$/i.test(f.name));
      console.log(`ZIP: ${files.length} file(s), ${docx.length} .docx`);
      if (docx.length !== 9) {
        console.warn("Expected 9 .docx documents in the ZIP — upload a corrected archive in Admin → Marketplace.");
        for (const f of docx.sort((a, b) => a.name.localeCompare(b.name))) {
          console.warn(" ", f.name);
        }
      } else {
        console.log("ZIP document count OK (9 .docx).");
      }
    }
  }

  const patch = {
    landing_page_html: landingHtml,
    updated_at: new Date().toISOString(),
  };
  if (description) patch.description = description;

  if (dryRun) {
    console.log("Dry run — would update landing_page_html length:", landingHtml.length);
    process.exit(0);
  }

  const { error: upErr } = await supabase.from("marketplace_items").update(patch).eq("id", item.id);
  if (upErr) {
    console.error("Update failed:", upErr.message);
    process.exit(1);
  }

  console.log("Updated landing_page_html for", item.title);
  console.log("Package URL:", `/marketplace/${item.id}/package`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
