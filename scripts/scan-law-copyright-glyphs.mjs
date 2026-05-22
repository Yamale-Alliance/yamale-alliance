/**
 * Scan all laws for copyright symbols / publisher boilerplate (©, "Copyright", etc.)
 * in body text — not an audit of "Copyright Act" titles as subject matter.
 *
 * Writes a markdown report for manual cleanup in admin or SQL.
 *
 * Usage (project root):
 *   node --env-file=.env scripts/scan-law-copyright-glyphs.mjs
 *   node --env-file=.env scripts/scan-law-copyright-glyphs.mjs --out docs/law-copyright-glyphs-report.md
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";
import { resolve } from "path";

const META_PAGE = 500;
const CONTENT_BATCH = 40;

/**
 * Publisher / OCR boilerplate in law bodies — not substantive mentions inside
 * national Copyright Acts (those laws are excluded via isCopyrightSubjectMatterLaw).
 */
const PATTERNS = [
  { id: "copyright_symbol", label: "© / copyright sign", re: /©|\u00a9|\u24b8/g },
  { id: "copyrighted", label: '"copyrighted"', re: /\bcopyrighted\b/gi },
  { id: "copyright_word", label: '"copyright" (word)', re: /\bcopyright\b/gi },
  { id: "all_rights_reserved", label: '"All rights reserved"', re: /\ball\s+rights\s+reserved\b/gi },
  {
    id: "droits_reserves",
    label: '"droits réservés" / droits reservee',
    re: /\bdroits\s+r[eéè]serv[eé]{1,2}s?\b/gi,
  },
  {
    id: "tous_droits",
    label: '"Tous droits réservés"',
    re: /\btous\s+droits\s+r[eéè]serv[eé]{1,2}s?\b/gi,
  },
  {
    id: "copyright_footer",
    label: "Copyright © / (c) footer",
    re: /\bcopyright\s*(?:©|\u00a9|\(c\))/gi,
  },
  {
    id: "copyright_line_year",
    label: "Copyright line with year",
    re: /(?:^|\n)\s*copyright\s+(?:©|\u00a9)?\s*\d{4}/gim,
  },
];

/** Skip national Copyright Acts / IP statutes where "copyright" is the legal subject. */
function isCopyrightSubjectMatterLaw(law) {
  const title = String(law.title ?? "").toLowerCase();
  const category = String(law.categories?.name ?? "").toLowerCase();
  if (/\bcopyright\b/.test(title) && /\b(act|law|code|decree|ordonnance|loi|cap\.?)\b/i.test(title)) {
    return true;
  }
  if (/\bintellectual\s+property\b/.test(category) && /\bcopyright\b/.test(title)) {
    return true;
  }
  if (/\bprotection\s+of\s+copyright\b/.test(title)) return true;
  return false;
}

function getArg(name, fallback) {
  const i = process.argv.indexOf(name);
  if (i === -1 || !process.argv[i + 1]) return fallback;
  return process.argv[i + 1];
}

function countMatches(text, re) {
  const flags = re.flags.includes("g") ? re.flags : `${re.flags}g`;
  const global = new RegExp(re.source, flags);
  return [...text.matchAll(global)].length;
}

function snippetAround(text, index, radius = 80) {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

function analyzeLawBody(text) {
  const body = (text ?? "").trim();
  if (!body) return null;

  const findings = [];
  for (const p of PATTERNS) {
    const n = countMatches(body, p.re);
    if (n > 0) findings.push({ ...p, count: n });
  }
  if (findings.length === 0) return null;

  let firstSnippet = "";
  const sym = body.search(/©|\u00a9/);
  if (sym >= 0) {
    firstSnippet = snippetAround(body, sym);
  } else {
    const m = body.match(/\bcopyright\b/i);
    if (m?.index != null) firstSnippet = snippetAround(body, m.index);
  }

  return { findings, firstSnippet };
}

async function fetchLawMetadata(supabase) {
  const rows = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("laws")
      .select("id, title, year, status, countries(name), categories!laws_category_id_fkey(name)")
      .order("title")
      .range(from, from + META_PAGE - 1);
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < META_PAGE) break;
    from += META_PAGE;
  }
  return rows;
}

async function fetchLawBodies(supabase, ids) {
  const map = new Map();
  for (let i = 0; i < ids.length; i += CONTENT_BATCH) {
    const slice = ids.slice(i, i + CONTENT_BATCH);
    const { data, error } = await supabase
      .from("laws")
      .select("id, content, content_plain")
      .in("id", slice);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      map.set(row.id, row);
    }
  }
  return map;
}

function mdEscape(s) {
  return String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const outPath = resolve(
    process.cwd(),
    getArg("--out", "docs/law-copyright-glyphs-report.md")
  );

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  console.error("Fetching law metadata…");
  const meta = await fetchLawMetadata(supabase);
  console.error(`Loaded ${meta.length} laws. Fetching body text in batches…`);
  const bodies = await fetchLawBodies(
    supabase,
    meta.map((m) => m.id)
  );

  const hits = [];
  for (const law of meta) {
    if (isCopyrightSubjectMatterLaw(law)) continue;

    const body = bodies.get(law.id);
    const text =
      (body?.content_plain && String(body.content_plain).trim()) ||
      String(body?.content ?? "");
    const analysis = analyzeLawBody(text);
    if (!analysis) continue;
    const country = law.countries?.name ?? "—";
    const category = law.categories?.name ?? "—";
    hits.push({
      id: law.id,
      title: law.title ?? "(untitled)",
      country,
      category,
      year: law.year,
      status: law.status,
      ...analysis,
    });
  }

  hits.sort((a, b) => {
    const c = a.country.localeCompare(b.country);
    if (c !== 0) return c;
    return a.title.localeCompare(b.title);
  });

  const generated = new Date().toISOString().slice(0, 19).replace("T", " ") + " UTC";
  const lines = [
    "# Laws containing copyright symbols or publisher notices",
    "",
    "Generated for manual review — **not** a list of countries’ Copyright Acts as legal subject matter.",
    "Scanned for: **©**, **copyright**, **copyrighted**, **All rights reserved**, **droits réservés** / **droits reservee**, and similar publisher lines in body text (not in excluded Copyright Acts).",
    "",
    `**Generated:** ${generated}  `,
    `**Laws scanned (metadata):** ${meta.length}  `,
    `**Copyright Acts excluded (subject-matter):** ${meta.filter(isCopyrightSubjectMatterLaw).length}  `,
    `**Laws with a publisher-notice hit:** ${hits.length}  `,
    "",
    "| # | Law | Country | Category | Year | Status | What matched | Count | Admin link |",
    "|---|-----|---------|----------|------|--------|--------------|-------|------------|",
  ];

  hits.forEach((h, i) => {
    const what = h.findings.map((f) => f.label).join("; ");
    const count = h.findings.reduce((s, f) => s + f.count, 0);
    const admin = `/admin-panel/laws/${h.id}`;
    lines.push(
      `| ${i + 1} | ${mdEscape(h.title)} | ${mdEscape(h.country)} | ${mdEscape(h.category)} | ${h.year ?? "—"} | ${mdEscape(h.status)} | ${what} | ${count} | [Edit](${admin}) |`
    );
  });

  lines.push("");
  lines.push("## Snippets (first match per law)");
  lines.push("");

  for (const h of hits) {
    lines.push(`### ${h.title}`);
    lines.push("");
    lines.push(`- **Country:** ${h.country}`);
    lines.push(`- **Category:** ${h.category}`);
    lines.push(`- **ID:** \`${h.id}\``);
    lines.push(`- **Matched:** ${h.findings.map((f) => `${f.label} (${f.count})`).join(", ")}`);
    if (h.firstSnippet) {
      lines.push(`- **Sample:** \`…${mdEscape(h.firstSnippet)}…\``);
    }
    lines.push("");
  }

  if (hits.length === 0) {
    lines.push("_No laws in the database contained © or the scanned publisher notice phrases in body text._");
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push("Re-run: `node --env-file=.env scripts/scan-law-copyright-glyphs.mjs`");

  writeFileSync(outPath, lines.join("\n"), "utf8");
  console.error(`Wrote ${hits.length} hits to ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
