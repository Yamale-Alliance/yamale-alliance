#!/usr/bin/env node
/**
 * Retrieval eval harness — recall@5, recall@10, MRR per mode / language / jurisdiction.
 *
 * Usage:
 *   node --env-file=.env --import tsx scripts/eval-retrieval.ts
 *   node --env-file=.env --import tsx scripts/eval-retrieval.ts --golden eval/golden_set.jsonl
 *   node --env-file=.env --import tsx scripts/eval-retrieval.ts --modes hybrid,vector
 */

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { runChunkRetrievalPipeline } from "../lib/retrieval/pipeline";
import type { RetrievalMode } from "../lib/retrieval/retrieval-mode";

type GoldenRow = {
  query: string;
  expected_law_id: string;
  expected_article_ref?: string;
  jurisdiction: string;
  language: string;
};

type EvalHit = {
  lawId: string;
  rank: number;
};

function parseArgs(argv: string[]) {
  const out = {
    goldenPath: path.join(process.cwd(), "eval/golden_set.jsonl"),
    modes: ["hybrid", "vector"] as RetrievalMode[],
    skipUnderstanding: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--golden") out.goldenPath = argv[++i];
    else if (a === "--modes") out.modes = argv[++i].split(",") as RetrievalMode[];
    else if (a === "--skip-understanding") out.skipUnderstanding = true;
  }
  return out;
}

function loadGolden(filePath: string): GoldenRow[] {
  const raw = fs.readFileSync(filePath, "utf8");
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as GoldenRow);
}

function recallAtK(hits: EvalHit[], expectedLawId: string, k: number): number {
  return hits.some((h) => h.lawId === expectedLawId && h.rank <= k) ? 1 : 0;
}

function reciprocalRank(hits: EvalHit[], expectedLawId: string): number {
  const hit = hits.find((h) => h.lawId === expectedLawId);
  return hit ? 1 / hit.rank : 0;
}

type BucketStats = {
  count: number;
  recall5: number;
  recall10: number;
  mrr: number;
};

function emptyBucket(): BucketStats {
  return { count: 0, recall5: 0, recall10: 0, mrr: 0 };
}

function addToBucket(bucket: BucketStats, r5: number, r10: number, mrr: number) {
  bucket.count += 1;
  bucket.recall5 += r5;
  bucket.recall10 += r10;
  bucket.mrr += mrr;
}

function fmtRate(n: number, d: number): string {
  if (d === 0) return "—";
  return `${((n / d) * 100).toFixed(1)}%`;
}

function fmtMrr(n: number, d: number): string {
  if (d === 0) return "—";
  return (n / d).toFixed(3);
}

function markdownTable(rows: string[][]): string {
  const header = rows[0];
  const sep = header.map(() => "---");
  const body = rows.slice(1).map((r) => `| ${r.join(" | ")} |`).join("\n");
  return `| ${header.join(" | ")} |\n| ${sep.join(" | ")} |\n${body}`;
}

async function main() {
  const args = parseArgs(process.argv);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const golden = loadGolden(args.goldenPath);
  const supabase = createClient(url, key);
  const sections: string[] = [`# Retrieval eval — ${new Date().toISOString()}\n`, `Golden set: \`${args.goldenPath}\` (${golden.length} rows)\n`];

  for (const mode of args.modes) {
    const overall = emptyBucket();
    const byLanguage = new Map<string, BucketStats>();
    const byJurisdiction = new Map<string, BucketStats>();

    for (const row of golden) {
      if (row.expected_law_id.startsWith("REPLACE_")) {
        console.warn(`Skipping placeholder law_id for: ${row.query.slice(0, 60)}`);
        continue;
      }

      const { docs } = await runChunkRetrievalPipeline({
        supabase: supabase as unknown as Parameters<typeof runChunkRetrievalPipeline>[0]["supabase"],
        userQuery: row.query,
        searchCountry: row.jurisdiction.length === 2 ? undefined : row.jurisdiction,
        forceMode: mode,
        skipQueryUnderstanding: args.skipUnderstanding,
        matchCount: 24,
      });

      const hits: EvalHit[] = docs.map((d, i) => ({ lawId: d.id, rank: i + 1 }));
      const r5 = recallAtK(hits, row.expected_law_id, 5);
      const r10 = recallAtK(hits, row.expected_law_id, 10);
      const mrr = reciprocalRank(hits, row.expected_law_id);

      addToBucket(overall, r5, r10, mrr);

      const langBucket = byLanguage.get(row.language) ?? emptyBucket();
      addToBucket(langBucket, r5, r10, mrr);
      byLanguage.set(row.language, langBucket);

      const jurBucket = byJurisdiction.get(row.jurisdiction) ?? emptyBucket();
      addToBucket(jurBucket, r5, r10, mrr);
      byJurisdiction.set(row.jurisdiction, jurBucket);
    }

    sections.push(`## Mode: \`${mode}\`\n`);
    sections.push(
      markdownTable([
        ["Scope", "N", "Recall@5", "Recall@10", "MRR"],
        [
          "Overall",
          String(overall.count),
          fmtRate(overall.recall5, overall.count),
          fmtRate(overall.recall10, overall.count),
          fmtMrr(overall.mrr, overall.count),
        ],
      ])
    );
    sections.push("");

    const langRows: string[][] = [["Language", "N", "Recall@5", "Recall@10", "MRR"]];
    for (const [lang, b] of [...byLanguage.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      langRows.push([lang, String(b.count), fmtRate(b.recall5, b.count), fmtRate(b.recall10, b.count), fmtMrr(b.mrr, b.count)]);
    }
    sections.push("### By language\n");
    sections.push(markdownTable(langRows));
    sections.push("");

    const jurRows: string[][] = [["Jurisdiction", "N", "Recall@5", "Recall@10", "MRR"]];
    for (const [jur, b] of [...byJurisdiction.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      jurRows.push([jur, String(b.count), fmtRate(b.recall5, b.count), fmtRate(b.recall10, b.count), fmtMrr(b.mrr, b.count)]);
    }
    sections.push("### By jurisdiction\n");
    sections.push(markdownTable(jurRows));
    sections.push("");
  }

  const report = sections.join("\n");
  console.log(report);

  const outDir = path.join(process.cwd(), "data/eval/runs");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `retrieval-eval-${Date.now()}.md`);
  fs.writeFileSync(outPath, report, "utf8");
  console.log(`\nWrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
