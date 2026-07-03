/**
 * Backfill metadata.search_aliases + metadata.ip_act_role for domestic IP laws
 * flagged by audit-ip-act-coverage.mjs.
 *
 * Run: node --env-file=.env scripts/backfill-ip-act-search-aliases.mjs
 * Dry run: node --env-file=.env scripts/backfill-ip-act-search-aliases.mjs --dry-run
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");
const supabase = createClient(supabaseUrl, supabaseKey);

const UNIFIED_COUNTRIES = new Set(["Botswana", "Gambia", "Mauritius", "Namibia", "Seychelles"]);

const COMMON_UNIFIED_ALIASES = [
  "Patents Act",
  "Patent Act",
  "Trademarks Act",
  "Trademark Act",
  "Trade Marks Act",
  "Trade Mark Act",
  "Intellectual Property Act",
];

const COUNTRY_EXTRA_ALIASES = {
  Gambia: [
    "Industrial Property Act 2007",
    "Patents Act 2007",
    "Patents Act of Gambia",
    "Patents Act of the Gambia",
    "Trademark Act Gambia",
    "Trademarks Act Gambia",
    "Industrial Property Act 2007 as amended 2015",
  ],
};

function classifyRole(title, country) {
  const t = title.toLowerCase();
  if (/\bamendment\b/.test(t) && /\bindustrial\s+property\b/.test(t)) return "amendment";
  if (/\bpatents?\s+act\b/.test(t)) return "patents";
  if (/\btrademarks?\s+act\b/.test(t) || /\btrade\s+marks?\s+act\b/.test(t)) return "trademarks";
  if (/\bindustrial\s+property\b/.test(t) && /\bact\b/.test(t)) {
    return UNIFIED_COUNTRIES.has(country) ? "unified" : "unified";
  }
  return null;
}

function aliasesForLaw(title, country, role) {
  const aliases = new Set();
  if (role === "unified" || role === "amendment") {
    for (const a of COMMON_UNIFIED_ALIASES) aliases.add(a);
    for (const a of COUNTRY_EXTRA_ALIASES[country] ?? []) aliases.add(a);
  }
  if (role === "patents") {
    aliases.add("Patents Act");
    aliases.add("Patent Act");
    aliases.add("Patent Law");
  }
  if (role === "trademarks") {
    aliases.add("Trademarks Act");
    aliases.add("Trademark Act");
    aliases.add("Trade Marks Act");
  }
  if (role === "amendment" && /\b2015\b/.test(title)) {
    aliases.add("Industrial Property Act 2007 as amended 2015");
    aliases.add("Industrial Property Amendment Act 2015");
  }
  return [...aliases];
}

async function main() {
  const { data: laws, error } = await supabase
    .from("laws")
    .select("id, title, year, status, metadata, countries(name)")
    .neq("status", "Repealed")
    .or(
      "title.ilike.%industrial property%,title.ilike.%patents act%,title.ilike.%trademarks act%,title.ilike.%trade marks act%"
    );

  if (error) throw error;

  let updated = 0;
  for (const law of laws ?? []) {
    const country = law.countries?.name ?? "";
    const title = String(law.title ?? "");
    if (/\b(convention|protocol|treaty|regulations)\b/i.test(title)) continue;

    const role = classifyRole(title, country);
    if (!role) continue;

    const search_aliases = aliasesForLaw(title, country, role);
    const metadata = {
      ...(typeof law.metadata === "object" && law.metadata && !Array.isArray(law.metadata)
        ? law.metadata
        : {}),
      search_aliases,
      ip_act_role: role,
      search_aliases_backfill: "2026-07-03-ip-audit",
    };

    console.log(`${dryRun ? "[dry-run] " : ""}${country}: ${title}`);
    console.log(`  role=${role} aliases=${search_aliases.length}`);

    if (!dryRun) {
      const { error: upErr } = await supabase
        .from("laws")
        .update({ metadata, updated_at: new Date().toISOString() })
        .eq("id", law.id);
      if (upErr) throw upErr;
    }
    updated++;
  }

  console.log(`\nDone. ${updated} law(s) ${dryRun ? "would be " : ""}updated.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
