/**
 * Batch-run golden AI questions from an Excel file and write a report (CSV + XLSX).
 *
 * Usage:
 *   npm run eval:golden -- --dry-run
 *   npm run eval:golden -- --limit 3
 *   npm run eval:golden -- data/eval/test-questions.xlsx
 *
 * Requires dev server: npm run dev
 * Env (.env): AI_EVAL_SECRET, AI_EVAL_CLERK_USER_ID (Team/Pro admin), optional AI_EVAL_BASE_URL
 */

import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import XLSX from "xlsx";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const DEFAULT_INPUT = join(REPO_ROOT, "data/eval/test-questions.xlsx");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const limitArg = args.find((a) => a.startsWith("--limit="));
const limitFlag = args.indexOf("--limit");
const fromArg = args.find((a) => a.startsWith("--from="));
const toArg = args.find((a) => a.startsWith("--to="));
const inputPath =
  args.find((a) => !a.startsWith("--") && (a.endsWith(".xlsx") || a.endsWith(".xls"))) ??
  DEFAULT_INPUT;

const limit =
  limitArg != null
    ? Number.parseInt(limitArg.split("=")[1], 10)
    : limitFlag >= 0 && args[limitFlag + 1]
      ? Number.parseInt(args[limitFlag + 1], 10)
      : null;
const fromNum = fromArg ? Number.parseInt(fromArg.split("=")[1], 10) : null;
const toNum = toArg ? Number.parseInt(toArg.split("=")[1], 10) : null;

const baseUrl = (process.env.AI_EVAL_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const evalSecret = process.env.AI_EVAL_SECRET?.trim();
const evalUserId = process.env.AI_EVAL_CLERK_USER_ID?.trim();

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function csvEscape(value) {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function formatSources(payload) {
  const cards = Array.isArray(payload?.sourceCards) ? payload.sourceCards : [];
  if (cards.length > 0) {
    return cards
      .map((c) => {
        const title = (c && c.title) || "Untitled";
        const country = (c && c.country) || "";
        return country ? `${title} (${country})` : title;
      })
      .join("; ");
  }
  if (Array.isArray(payload?.sources) && payload.sources.length > 0) {
    return payload.sources.join("; ");
  }
  return "";
}

function parseSseDone(text) {
  const blocks = text.split(/\n\n+/);
  for (const block of blocks) {
    if (!block.trim()) continue;
    let event = "message";
    let data = "";
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      if (line.startsWith("data:")) data += line.slice(5).trim();
    }
    if (!data) continue;
    if (event === "done") {
      return JSON.parse(data);
    }
    if (event === "error") {
      const p = JSON.parse(data);
      throw new Error(p.error || "AI error");
    }
  }
  return null;
}

async function askQuestion(question) {
  const headers = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  };
  if (!evalSecret) {
    throw new Error("AI_EVAL_SECRET is required");
  }
  headers.Authorization = `Bearer ${evalSecret}`;

  const started = Date.now();
  const res = await fetch(`${baseUrl}/api/ai/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      messages: [{ role: "user", content: question }],
    }),
  });

  const text = await res.text();
  const latencyMs = Date.now() - started;

  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const j = JSON.parse(text);
      if (j.error) errMsg = String(j.error);
    } catch {
      if (text) errMsg = text.slice(0, 500);
    }
    return { ok: false, error: errMsg, latencyMs };
  }

  if (text.trimStart().startsWith("event:")) {
    try {
      const payload = parseSseDone(text);
      if (!payload?.content) {
        return { ok: false, error: "Empty SSE response", latencyMs };
      }
      return {
        ok: true,
        answer: String(payload.content),
        sources: formatSources(payload),
        queryLogId: payload.queryLogId ?? null,
        systemPromptVersion: payload.systemPromptVersion ?? null,
        latencyMs,
      };
    } catch (e) {
      return { ok: false, error: e.message || String(e), latencyMs };
    }
  }

  try {
    const json = JSON.parse(text);
    if (json.error) {
      return { ok: false, error: String(json.error), latencyMs };
    }
    return {
      ok: true,
      answer: String(json.content ?? ""),
      sources: formatSources(json),
      queryLogId: json.queryLogId ?? null,
      systemPromptVersion: json.systemPromptVersion ?? null,
      latencyMs,
    };
  } catch {
    return { ok: false, error: "Unexpected response format", latencyMs };
  }
}

function loadQuestions(path) {
  const wb = XLSX.readFile(path);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  return rows
    .map((row) => ({
      num: row["#"] ?? row.Number ?? "",
      category: row.Category ?? "",
      question: String(row.Question ?? row.question ?? "").trim(),
      geography: row["Geographic Relevance"] ?? row.Geography ?? "",
      notes: row.Notes ?? "",
    }))
    .filter((r) => r.question.length > 0);
}

async function main() {
  if (!dryRun && (!evalSecret || !evalUserId)) {
    console.error(
      "Set AI_EVAL_SECRET and AI_EVAL_CLERK_USER_ID in .env (Clerk user id for a Team/Pro account).\n" +
        "Generate a random secret: openssl rand -hex 32"
    );
    process.exit(1);
  }

  console.log(`Input: ${inputPath}`);
  const all = loadQuestions(inputPath);
  let subset = all;
  if (fromNum != null) subset = subset.filter((r) => Number(r.num) >= fromNum);
  if (toNum != null) subset = subset.filter((r) => Number(r.num) <= toNum);
  if (limit != null && Number.isFinite(limit)) subset = subset.slice(0, limit);

  console.log(`Questions to run: ${subset.length} / ${all.length}`);

  if (dryRun) {
    for (const r of subset.slice(0, 10)) {
      console.log(`  #${r.num} ${r.question.slice(0, 72)}…`);
    }
    if (subset.length > 10) console.log(`  … and ${subset.length - 10} more`);
    return;
  }

  const runId = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outDir = join(REPO_ROOT, "data/eval/runs");
  mkdirSync(outDir, { recursive: true });
  const baseName = `golden-${runId}`;
  const jsonlPath = join(outDir, `${baseName}.jsonl`);
  const csvPath = join(outDir, `${baseName}.csv`);
  const xlsxPath = join(outDir, `${baseName}.xlsx`);

  const reportRows = [];

  for (let i = 0; i < subset.length; i++) {
    const row = subset[i];
    const label = `#${row.num} (${i + 1}/${subset.length})`;
    console.log(`\n${label} ${row.question.slice(0, 60)}…`);

    const result = await askQuestion(row.question);
    const record = {
      "#": row.num,
      Category: row.category,
      "Geographic Relevance": row.geography,
      Question: row.question,
      Answer: result.ok ? result.answer : "",
      "Sources Used": result.ok ? result.sources : "",
      Error: result.ok ? "" : result.error,
      "Latency (ms)": result.latencyMs ?? "",
      query_log_id: result.queryLogId ?? "",
      system_prompt_version: result.systemPromptVersion ?? "",
    };

    reportRows.push(record);
    writeFileSync(jsonlPath, reportRows.map((r) => JSON.stringify(r)).join("\n") + "\n");

    if (result.ok) {
      console.log(`  OK ${result.latencyMs}ms · sources: ${(result.sources || "").slice(0, 80)}…`);
    } else {
      console.log(`  FAIL: ${result.error}`);
    }

    if (i < subset.length - 1) {
      await sleep(Number.parseInt(process.env.AI_EVAL_DELAY_MS ?? "2000", 10) || 2000);
    }
  }

  const csvHeader = [
    "Question",
    "Answer",
    "Sources Used",
    "#",
    "Category",
    "Geographic Relevance",
    "Error",
    "Latency (ms)",
  ];
  const csvLines = [
    csvHeader.join(","),
    ...reportRows.map((r) =>
      [
        r.Question,
        r.Answer,
        r["Sources Used"],
        r["#"],
        r.Category,
        r["Geographic Relevance"],
        r.Error,
        r["Latency (ms)"],
      ]
        .map(csvEscape)
        .join(",")
    ),
  ];
  writeFileSync(csvPath, csvLines.join("\n"));

  const slimRows = reportRows.map((r) => ({
    Question: r.Question,
    Answer: r.Answer,
    "Sources Used": r["Sources Used"],
  }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(slimRows);
  XLSX.utils.book_append_sheet(wb, ws, "Results");
  XLSX.writeFile(wb, xlsxPath);

  const ok = reportRows.filter((r) => !r.Error).length;
  console.log(`\nDone. ${ok}/${reportRows.length} succeeded.`);
  console.log(`  ${xlsxPath}`);
  console.log(`  ${csvPath}`);
  console.log(`  ${jsonlPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
