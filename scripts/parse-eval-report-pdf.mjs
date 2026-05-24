#!/usr/bin/env node
/**
 * Parse yamalé-evaluation-report.pdf into a structured ingestion / QA backlog CSV.
 *
 * Usage:
 *   node scripts/parse-eval-report-pdf.mjs [path-to.pdf]
 *   npm run eval:parse-report
 *
 * Output: data/eval/eval-report-backlog.csv
 */

import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const defaultPdf = join(process.env.HOME ?? "", "Documents", "yamalé-evaluation-report.pdf");
const pdfPath = process.argv[2]?.trim() || defaultPdf;
const outPath = join(repoRoot, "data/eval/eval-report-backlog.csv");

function csvEscape(s) {
  const t = String(s ?? "").replace(/\r?\n/g, " ").trim();
  if (/[",]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

let text = "";
try {
  text = execSync(`pdftotext "${pdfPath}" -`, { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
} catch (e) {
  console.error("pdftotext failed — install poppler (brew install poppler) or pass a .txt export.");
  console.error(e.message ?? e);
  process.exit(1);
}

const rows = [];
const sectionStart = text.indexOf("3. Per-Question Evaluation");
const perQuestion = sectionStart >= 0 ? text.slice(sectionStart) : text;
const qBlocks = perQuestion.split(/\n(?=Q\d+\n)/);

for (const block of qBlocks) {
  const head = block.match(/^Q(\d+)\n+([^\n]+)\n+([^\n]+)\n+([\s\S]+)/);
  if (!head) continue;
  const num = head[1];
  const categoryLine = head[2].trim();
  const question = head[3].trim();
  const rest = head[4];

  const catMatch = categoryLine.match(/^(.+?)\s*·\s*(.+)$/);
  const category = catMatch?.[1]?.trim() ?? categoryLine;
  const geography = catMatch?.[2]?.trim() ?? "";

  const gaps = [];
  const gapSection = rest.match(/Gaps & Issues\n([\s\S]*?)(?:\nImprovements Needed|\nSources:)/);
  if (gapSection?.[1]) {
    for (const line of gapSection[1].split("\n")) {
      const m = line.match(/^•\s*(.+)/);
      if (m) gaps.push(m[1].trim());
    }
  }

  const improvements = [];
  const impSection = rest.match(/Improvements Needed\n([\s\S]*?)(?:\nSources:)/);
  if (impSection?.[1]) {
    for (const line of impSection[1].split("\n")) {
      const m = line.match(/^•\s*(.+)/);
      if (m) improvements.push(m[1].trim());
    }
  }

  const scoreLines = [...rest.matchAll(/(\d)\/5/g)].map((m) => m[1]);
  const overall = scoreLines.length >= 5 ? scoreLines[4] : scoreLines[scoreLines.length - 1] ?? "";

  const needsIngestion = improvements.some((i) =>
    /index additional|prioritise ingestion|missing.*laws|corpus/i.test(i)
  );
  const needsHedgeFix = improvements.some((i) => /consult a professional|deflection|hedge/i.test(i));
  const needsCitations = improvements.some((i) => /citation|section|article/i.test(i));

  rows.push({
    num,
    category,
    geography,
    question,
    overall,
    gaps: gaps.join(" | "),
    improvements: improvements.join(" | "),
    needs_ingestion: needsIngestion ? "yes" : "no",
    needs_prompt: needsHedgeFix || needsCitations ? "yes" : "no",
  });
}

mkdirSync(dirname(outPath), { recursive: true });
const header =
  "Q,Category,Geography,Question,Overall_5,Gaps,Improvements,Needs_Ingestion,Needs_Prompt_Fix";
const body = rows
  .map((r) =>
    [
      r.num,
      csvEscape(r.category),
      csvEscape(r.geography),
      csvEscape(r.question),
      r.overall,
      csvEscape(r.gaps),
      csvEscape(r.improvements),
      r.needs_ingestion,
      r.needs_prompt,
    ].join(",")
  )
  .join("\n");
writeFileSync(outPath, `${header}\n${body}\n`, "utf8");

const ingestCount = rows.filter((r) => r.needs_ingestion === "yes").length;
const promptCount = rows.filter((r) => r.needs_prompt === "yes").length;
console.log(`Wrote ${rows.length} questions → ${outPath}`);
console.log(`  Needs ingestion (corpus): ${ingestCount}`);
console.log(`  Needs prompt/RAG fix: ${promptCount}`);
