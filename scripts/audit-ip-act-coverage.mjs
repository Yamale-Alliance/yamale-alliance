/**
 * Audit domestic IP statute coverage across countries.
 * Surfaces naming/version gaps where users may ask for "Patents Act" / "Trademark Act"
 * but the library indexes "Industrial Property Act YYYY".
 *
 * Run: node --env-file=.env scripts/audit-ip-act-coverage.mjs
 * JSON: node --env-file=.env scripts/audit-ip-act-coverage.mjs --json > /tmp/ip-audit.json
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const jsonOut = process.argv.includes("--json");
const supabase = createClient(supabaseUrl, supabaseKey);

const DOMESTIC_IP_TITLE_RE =
  /\b(industrial\s+property|intellectual\s+property|patents?\s+act|trademarks?\s+act|trade\s+marks?\s+act|copyright\s+act)\b/i;

const TREATY_NOISE_RE =
  /\b(convention|protocol|treaty|wipo|berne|paris|pct|harare|aripo|madrid|oapi|bangui|regulations?\b)/i;

function extractYear(title) {
  const ofYear = title.match(/\b(?:act\s+)?(?:no\.?\s*)?\d+\s+of\s+(20\d{2}|19\d{2})\b/i);
  if (ofYear) return Number.parseInt(ofYear[1], 10);
  const dashYear = title.match(/[-–]\s*(20\d{2}|19\d{2})\b/);
  if (dashYear) return Number.parseInt(dashYear[1], 10);
  const bare = title.match(/\b(20\d{2}|19\d{2})\b/);
  return bare ? Number.parseInt(bare[1], 10) : null;
}

function classifyTitle(title) {
  const t = title.toLowerCase();
  if (TREATY_NOISE_RE.test(t)) return "treaty_or_reg";
  if (/\bindustrial\s+property\b/.test(t) && /\bact\b/.test(t)) return "industrial_property_act";
  if (/\bintellectual\s+property\b/.test(t) && /\bact\b/.test(t)) return "intellectual_property_act";
  if (/\bpatents?\s+act\b/.test(t)) return "patents_act";
  if (/\btrademarks?\s+act\b/.test(t) || /\btrade\s+marks?\s+act\b/.test(t)) return "trademarks_act";
  if (/\bcopyright\b/.test(t) && /\bact\b/.test(t)) return "copyright_act";
  return "other_ip";
}

async function fetchAllDomesticIpLaws() {
  const rows = [];
  const pageSize = 500;
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("laws")
      .select("id, title, year, status, metadata, country_id, countries(name)")
      .neq("status", "Repealed")
      .or(
        "title.ilike.%industrial property%,title.ilike.%intellectual property act%,title.ilike.%patents act%,title.ilike.%trademarks act%,title.ilike.%trade marks act%,title.ilike.%copyright act%"
      )
      .order("title")
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return rows.filter((row) => {
    const title = String(row.title ?? "");
    return DOMESTIC_IP_TITLE_RE.test(title) && !TREATY_NOISE_RE.test(title.toLowerCase());
  });
}

async function main() {
  const laws = await fetchAllDomesticIpLaws();
  const byCountry = new Map();

  for (const law of laws) {
    const country = law.countries?.name ?? "(no country)";
    if (!byCountry.has(country)) {
      byCountry.set(country, []);
    }
    byCountry.get(country).push({
      id: law.id,
      title: law.title,
      year: law.year ?? extractYear(String(law.title ?? "")),
      kind: classifyTitle(String(law.title ?? "")),
      status: law.status,
      hasSearchAliases: Array.isArray(law.metadata?.search_aliases) && law.metadata.search_aliases.length > 0,
    });
  }

  const aliasRisk = [];
  const noDomesticAct = [];
  const multiVersion = [];

  for (const [country, entries] of [...byCountry.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const domesticActs = entries.filter((e) =>
      ["industrial_property_act", "intellectual_property_act", "patents_act", "trademarks_act"].includes(e.kind)
    );
    const hasIndustrial = domesticActs.some((e) => e.kind === "industrial_property_act");
    const hasDedicatedPatent = domesticActs.some((e) => e.kind === "patents_act");
    const hasDedicatedTrademark = domesticActs.some((e) => e.kind === "trademarks_act");

    if (domesticActs.length === 0) {
      noDomesticAct.push({ country, entries });
      continue;
    }

    if (hasIndustrial && !hasDedicatedPatent && !hasDedicatedTrademark) {
      const years = domesticActs.map((e) => e.year).filter(Boolean);
      const withAliases = domesticActs.filter((e) => e.hasSearchAliases).length;
      aliasRisk.push({
        country,
        risk: "unified_industrial_property_only",
        mitigated: withAliases >= domesticActs.length,
        note: 'Users may ask for "Patents Act" or "Trademark Act" — only Industrial Property Act indexed',
        acts: domesticActs,
        years,
      });
    }

    const yearSet = new Set(domesticActs.map((e) => e.year).filter(Boolean));
    if (yearSet.size > 1 || domesticActs.length > 1) {
      multiVersion.push({
        country,
        acts: domesticActs,
        years: [...yearSet].sort(),
      });
    }
  }

  const report = {
    scannedAt: new Date().toISOString(),
    totalDomesticIpLaws: laws.length,
    countriesWithIp: byCountry.size,
    aliasRiskCount: aliasRisk.length,
    multiVersionCount: multiVersion.length,
    aliasRisk,
    multiVersion,
  };

  if (jsonOut) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`Domestic IP audit — ${laws.length} laws across ${byCountry.size} countries\n`);

  console.log("=== Alias risk (Industrial Property Act only — patent/trademark Act queries may miss) ===\n");
  for (const row of aliasRisk) {
    const tag = row.mitigated ? "[mitigated]" : "[ACTION]";
    console.log(`${tag} • ${row.country}`);
    for (const act of row.acts) {
      console.log(`    - ${act.title}${act.year ? ` (${act.year})` : ""}`);
    }
    console.log(`    → ${row.note}\n`);
  }

  console.log("=== Multiple domestic IP acts / years (version metadata review) ===\n");
  for (const row of multiVersion) {
    console.log(`• ${row.country} — years: ${row.years.join(", ") || "unknown"}`);
    for (const act of row.acts) {
      console.log(`    - [${act.kind}] ${act.title}`);
    }
    console.log();
  }

  console.log(`Summary: ${aliasRisk.length} countries with alias risk (${aliasRisk.filter((r) => r.mitigated).length} mitigated via search_aliases), ${multiVersion.length} with multiple IP acts/years.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
