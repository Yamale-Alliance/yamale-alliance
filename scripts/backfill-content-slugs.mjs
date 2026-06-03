/**
 * Backfill SEO slugs for laws and published marketplace_items.
 * Run: node --env-file=.env scripts/backfill-content-slugs.mjs
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function slugify(raw, maxLen = 96) {
  const slug = raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) return "";
  return slug.length > maxLen ? slug.slice(0, maxLen).replace(/-+$/, "") : slug;
}

function lawSlugBase(title, countryName, year) {
  const parts = [];
  if (countryName?.trim()) parts.push(countryName.trim());
  if (title?.trim()) parts.push(title.trim());
  if (year != null && Number.isFinite(year)) parts.push(String(year));
  return slugify(parts.join(" "));
}

function itemSlugBase(title) {
  return slugify(title?.trim() ?? "");
}

async function slugTaken(table, slug, excludeId) {
  let q = supabase.from(table).select("id").eq("slug", slug).limit(1);
  if (excludeId) q = q.neq("id", excludeId);
  const { data, error } = await q;
  if (error) {
    if (/column.*slug/i.test(String(error.message ?? ""))) return false;
    throw error;
  }
  return (data?.length ?? 0) > 0;
}

async function pickUnique(table, base, id) {
  let candidate = base || `item-${id.replace(/-/g, "").slice(0, 12)}`;
  for (let n = 0; n < 25 && (await slugTaken(table, candidate, id)); n++) {
    candidate = `${base || "item"}-${n + 2}`;
  }
  if (await slugTaken(table, candidate, id)) {
    candidate = `${base || "item"}-${id.replace(/-/g, "").slice(0, 8)}`;
  }
  return candidate;
}

async function backfillLaws() {
  const pageSize = 500;
  let offset = 0;
  let updated = 0;

  while (true) {
    const { data, error } = await supabase
      .from("laws")
      .select("id, title, year, slug, countries(name)")
      .or("slug.is.null,slug.eq.")
      .range(offset, offset + pageSize - 1);

    if (error) {
      if (/column.*slug/i.test(String(error.message ?? ""))) {
        console.warn("laws.slug column missing — run migration 20260602143000_content_seo_slugs.sql first");
        return 0;
      }
      throw error;
    }
    const rows = data ?? [];
    if (rows.length === 0) break;

    for (const row of rows) {
      if (row.slug?.trim()) continue;
      const base = lawSlugBase(
        row.title,
        row.countries?.name ?? null,
        row.year
      );
      const slug = await pickUnique("laws", base, row.id);
      const { error: upErr } = await supabase.from("laws").update({ slug }).eq("id", row.id);
      if (upErr) {
        console.error("law", row.id, upErr.message);
        continue;
      }
      updated++;
    }

    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  return updated;
}

async function backfillMarketplace() {
  const pageSize = 200;
  let offset = 0;
  let updated = 0;

  while (true) {
    const { data, error } = await supabase
      .from("marketplace_items")
      .select("id, title, slug")
      .eq("published", true)
      .or("slug.is.null,slug.eq.")
      .range(offset, offset + pageSize - 1);

    if (error) {
      if (/column.*slug/i.test(String(error.message ?? ""))) {
        console.warn("marketplace_items.slug column missing — run migration first");
        return 0;
      }
      throw error;
    }
    const rows = data ?? [];
    if (rows.length === 0) break;

    for (const row of rows) {
      if (row.slug?.trim()) continue;
      const base = itemSlugBase(row.title);
      const slug = await pickUnique("marketplace_items", base, row.id);
      const { error: upErr } = await supabase
        .from("marketplace_items")
        .update({ slug })
        .eq("id", row.id);
      if (upErr) {
        console.error("marketplace", row.id, upErr.message);
        continue;
      }
      updated++;
    }

    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  return updated;
}

const laws = await backfillLaws();
const items = await backfillMarketplace();
console.log(`Backfill complete: ${laws} laws, ${items} marketplace items.`);
