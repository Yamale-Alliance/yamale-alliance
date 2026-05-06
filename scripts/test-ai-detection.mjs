#!/usr/bin/env node
/**
 * Logic-only test for AI retrieval detection. Mirrors the regexes in
 * `app/api/ai/chat/route.ts` so we can verify country, supranational
 * framework, and bilateral pair detection without touching Supabase or
 * Claude. Run: `node scripts/test-ai-detection.mjs`.
 */

// ── Mirror of helpers under test ──────────────────────────────────────────────

const COUNTRY_DEMONYM_SUFFIX = "(?:n|ns|s|ese|lese|ian|ians|ans?|aise|enne|ois|i)?";

function buildCountryMatchRegex(countryNameLower) {
  const escaped = countryNameLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}${COUNTRY_DEMONYM_SUFFIX}\\b`, "i");
}

function findCountriesInQuery(query, countryNames) {
  const ordered = [...countryNames].sort((a, b) => b.length - a.length);
  const found = [];
  const seen = new Set();
  for (const name of ordered) {
    if (seen.has(name)) continue;
    if (buildCountryMatchRegex(name.toLowerCase()).test(query)) {
      seen.add(name);
      found.push(name);
    }
  }
  return found;
}

const SUPRANATIONAL_FRAMEWORKS = [
  { id: "ohada",          detect: /\b(ohada|acte\s+uniforme|uniform\s+act\s+(?:on|relating|organising|organizing))\b/i },
  { id: "afcfta",         detect: /\b(afcfta|afcta|african\s+continental\s+free\s+trade)\b/i },
  { id: "ecowas",         detect: /\b(ecowas|cedeao|economic\s+community\s+of\s+west\s+african|etls|trade\s+liberalisation\s+scheme)\b/i },
  { id: "eac",            detect: /\b(\beac\b|east\s+african\s+community)\b/i },
  { id: "comesa",         detect: /\b(comesa|common\s+market\s+for\s+eastern\s+and\s+southern\s+africa)\b/i },
  { id: "sadc",           detect: /\b(sadc|southern\s+african\s+development\s+community)\b/i },
  { id: "cemac",          detect: /\b(cemac|communaut[eé]\s+[eé]conomique\s+et\s+mon[eé]taire\s+de\s+l[' ]afrique\s+centrale)\b/i },
  { id: "uemoa_waemu",    detect: /\b(uemoa|waemu|union\s+[eé]conomique\s+et\s+mon[eé]taire\s+ouest\s+africaine)\b/i },
  { id: "au",             detect: /\b(african\s+union\b|au\s+treaty|au\s+convention|au\s+protocol|maputo\s+protocol|charter\s+of\s+the\s+african\s+union|african\s+charter\s+on)\b/i },
  { id: "berne",          detect: /\b(berne\s+convention)\b/i },
  { id: "trips",          detect: /\btrips\b/i },
  { id: "madrid",         detect: /\b(madrid\s+(?:protocol|agreement|system))\b/i },
  { id: "paris_convention", detect: /\bparis\s+convention\b/i },
  { id: "pct",            detect: /\b(patent\s+cooperation\s+treaty|\bpct\b)\b/i },
];

function detectSupranationalFrameworks(query) {
  return SUPRANATIONAL_FRAMEWORKS.filter((f) => f.detect.test(query)).map((f) => f.id);
}

function extractHyphenatedProperNounPairs(query) {
  if (!query?.trim()) return [];
  const out = [];
  const properNoun = "[A-ZÀ-ÖØ-Ý][\\p{L}'’]+(?:\\s+[A-ZÀ-ÖØ-Ý][\\p{L}'’]+)?";
  const re = new RegExp(`\\b(${properNoun})\\s*[-–—]\\s*(${properNoun})\\b`, "gu");
  let m;
  while ((m = re.exec(query)) !== null) {
    if (m[1]) out.push(m[1].trim());
    if (m[2]) out.push(m[2].trim());
  }
  return Array.from(new Set(out.map((s) => s.replace(/\s+/g, " ").trim()))).filter((s) => s.length >= 3);
}

// ── Stand-in for the live `countries` table (African states + a few partners) ─

const COUNTRY_NAMES = [
  "Algeria", "Angola", "Benin", "Botswana", "Burkina Faso", "Burundi", "Cameroon",
  "Cape Verde", "Central African Republic", "Chad", "Comoros", "Congo", "Côte d'Ivoire",
  "Democratic Republic of Congo", "Djibouti", "Egypt", "Equatorial Guinea", "Eritrea",
  "Eswatini", "Ethiopia", "Gabon", "Gambia", "Ghana", "Guinea", "Guinea-Bissau",
  "Kenya", "Lesotho", "Liberia", "Libya", "Madagascar", "Malawi", "Mali", "Mauritania",
  "Mauritius", "Morocco", "Mozambique", "Namibia", "Niger", "Nigeria", "Rwanda",
  "Sao Tome and Principe", "Senegal", "Seychelles", "Sierra Leone", "Somalia",
  "South Africa", "South Sudan", "Sudan", "Tanzania", "Togo", "Tunisia", "Uganda",
  "Zambia", "Zimbabwe",
];

// ── Test suite ────────────────────────────────────────────────────────────────

const cases = [
  // Hawa — supranational
  { id: "Hawa-1", q: "Under the OHADA Uniform Act on Commercial Companies, what are the minimum capital requirements for a Société à Responsabilité Limitée (SARL)?",
    expectFrameworks: ["ohada"], expectCountries: [], expectBilateralPair: false },
  { id: "Hawa-2", q: "What dispute resolution mechanisms does the ECOWAS Revised Treaty provide for member states?",
    expectFrameworks: ["ecowas"], expectCountries: [], expectBilateralPair: false },
  { id: "Hawa-3", q: "Under the AfCFTA Protocol on Trade in Goods, what non-tariff barriers are prohibited between member states?",
    expectFrameworks: ["afcfta"], expectCountries: [], expectBilateralPair: false },
  { id: "Hawa-4", q: "What are the obligations of COMESA member states regarding the free movement of capital?",
    expectFrameworks: ["comesa"], expectCountries: [], expectBilateralPair: false },
  { id: "Hawa-5", q: "Under the CEMAC treaty, what are the rules governing cross-border business establishment?",
    expectFrameworks: ["cemac"], expectCountries: [], expectBilateralPair: false },

  // Andrea — bilateral & country-specific
  { id: "Andrea-1", q: "What does the Senegal–France bilateral investment treaty say about expropriation and compensation?",
    expectFrameworks: [], expectCountries: ["Senegal"], expectBilateralPair: true,
    expectBilateralTokensAtLeast: ["senegal", "france"] },
  { id: "Andrea-2", q: "What are the corporate registration requirements for a foreign company operating in Morocco under Moroccan commercial law?",
    expectFrameworks: [], expectCountries: ["Morocco"], expectBilateralPair: false },
  { id: "Andrea-3", q: "Under Tunisian investment law, what tax incentives are available to foreign investors in the manufacturing sector?",
    expectFrameworks: [], expectCountries: ["Tunisia"], expectBilateralPair: false },
  { id: "Andrea-4", q: "What does the Senegal–India bilateral investment treaty say about most-favoured-nation treatment?",
    expectFrameworks: [], expectCountries: ["Senegal"], expectBilateralPair: true,
    expectBilateralTokensAtLeast: ["senegal", "india"] },
  { id: "Andrea-5", q: "What are the labour rights and employer obligations under the Liberian Decent Work Act?",
    expectFrameworks: [], expectCountries: ["Liberia"], expectBilateralPair: false },

  // Patrick — stress tests
  { id: "Patrick-1", q: "What does the Senegal–Canada bilateral investment treaty say about fair and equitable treatment?",
    expectFrameworks: [], expectCountries: ["Senegal"], expectBilateralPair: true,
    expectBilateralTokensAtLeast: ["senegal", "canada"] },
  { id: "Patrick-2", q: "Under the Namibia Companies Act, what are the duties of company directors?",
    expectFrameworks: [], expectCountries: ["Namibia"], expectBilateralPair: false },
  { id: "Patrick-3", q: "What environmental obligations does South Africa's National Water Act impose on industrial operators?",
    expectFrameworks: [], expectCountries: ["South Africa"], expectBilateralPair: false },
  { id: "Patrick-4", q: "What are the anti-corruption obligations for public officials under Beninese law?",
    expectFrameworks: [], expectCountries: ["Benin"], expectBilateralPair: false },
  { id: "Patrick-5", q: "Under the SADC Protocol on Finance and Investment, what protections exist for foreign investors against arbitrary state action?",
    expectFrameworks: ["sadc"], expectCountries: [], expectBilateralPair: false },
];

let pass = 0;
let fail = 0;
const failures = [];

for (const c of cases) {
  const frameworks = detectSupranationalFrameworks(c.q);
  const countries = findCountriesInQuery(c.q, COUNTRY_NAMES);
  const hyphenPairs = extractHyphenatedProperNounPairs(c.q);
  const bilateralTokens = Array.from(new Set([
    ...countries.map((s) => s.toLowerCase()),
    ...hyphenPairs.map((s) => s.toLowerCase()),
  ].filter((s) => s.length >= 3)));
  const isBilateral = bilateralTokens.length >= 2;

  const errs = [];

  for (const f of c.expectFrameworks) {
    if (!frameworks.includes(f)) errs.push(`expected framework "${f}" not detected (got: ${frameworks.join(", ") || "none"})`);
  }
  for (const co of c.expectCountries) {
    if (!countries.includes(co)) errs.push(`expected country "${co}" not detected (got: ${countries.join(", ") || "none"})`);
  }
  if (c.expectBilateralPair && !isBilateral) {
    errs.push(`expected bilateral pair, but only got ${bilateralTokens.length} title token(s): ${bilateralTokens.join(", ")}`);
  }
  if (Array.isArray(c.expectBilateralTokensAtLeast)) {
    for (const t of c.expectBilateralTokensAtLeast) {
      if (!bilateralTokens.includes(t)) errs.push(`expected bilateral token "${t}" missing (got: ${bilateralTokens.join(", ") || "none"})`);
    }
  }
  if (!c.expectBilateralPair && isBilateral) {
    errs.push(`unexpected bilateral pair detected: ${bilateralTokens.join(", ")}`);
  }

  if (errs.length === 0) {
    console.log(`PASS  ${c.id}`);
    pass++;
  } else {
    console.log(`FAIL  ${c.id}`);
    for (const e of errs) console.log(`        - ${e}`);
    failures.push({ id: c.id, errs });
    fail++;
  }
}

// ── Sanity: ensure short country names don't false-positive ──────────────────

const sanityCases = [
  { q: "This contract clause is malicious and overreaching.",  mustNotMatch: ["Mali"] },
  { q: "The Niger River basin authority issued guidance.",     mustNotMatch: ["Nigeria"] },
  { q: "Public officials must follow procurement rules.",      mustNotMatch: ["Benin", "Mali", "Togo", "Chad", "Niger"] },
];

console.log("\nSanity (false-positive) checks:");
for (const sc of sanityCases) {
  const cs = findCountriesInQuery(sc.q, COUNTRY_NAMES);
  const hits = sc.mustNotMatch.filter((m) => cs.includes(m));
  if (hits.length === 0) {
    console.log(`PASS  sanity: "${sc.q.slice(0, 60)}..."`);
    pass++;
  } else {
    console.log(`FAIL  sanity: "${sc.q.slice(0, 60)}..." matched ${hits.join(", ")}`);
    fail++;
  }
}

console.log(`\nResult: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
