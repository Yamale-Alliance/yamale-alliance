#!/usr/bin/env node
/**
 * Resumable structured chunk + re-embed backfill (one law at a time).
 *
 * Prerequisites:
 *   1. Run docs/sql/law-embeddings-hybrid-retrieval.sql in Supabase
 *   2. VOYAGE_API_KEY or OPENAI_API_KEY + AI_EMBEDDING_MODEL
 *
 * Usage:
 *   node --env-file=.env --import tsx scripts/backfill-structured-chunks.mjs
 *   node --env-file=.env --import tsx scripts/backfill-structured-chunks.mjs --dry-run
 *   node --env-file=.env --import tsx scripts/backfill-structured-chunks.mjs --law-id <uuid>
 *   node --env-file=.env --import tsx scripts/backfill-structured-chunks.mjs --limit 10
 *   node --env-file=.env --import tsx scripts/backfill-structured-chunks.mjs --resume
 */

import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { chunkLawForEmbedding } from "../lib/embeddings/vector-search.ts";
import { countryNameToIso2 } from "../lib/retrieval/jurisdiction-codes.ts";

const EMBED_BATCH = 16;
const MAX_RETRIES = 6;
const BASE_DELAY_MS = 1500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatError(err) {
  const msg = err?.message ?? String(err);
  if (msg.length > 280) return `${msg.slice(0, 280)}…`;
  return msg;
}

function isRetryableError(err) {
  const msg = (err?.message ?? String(err)).toLowerCase();
  if (["520", "502", "503", "504", "429", "408"].some((code) => msg.includes(code))) return true;
  if (err?.code === "ECONNRESET" || err?.code === "ETIMEDOUT") return true;
  if (msg.includes("fetch failed") || msg.includes("timeout")) return true;
  return false;
}

async function withRetry(label, fn) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryableError(err) || attempt === MAX_RETRIES) throw err;
      const delay = BASE_DELAY_MS * 2 ** (attempt - 1);
      console.warn(`[retry ${attempt}] ${label}: ${formatError(err)} — ${Math.round(delay / 1000)}s`);
      await sleep(delay);
    }
  }
  throw lastErr;
}

function parseArgs(argv) {
  const out = { limit: null, lawId: null, dryRun: false, resume: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--resume") out.resume = true;
    else if (a === "--limit") out.limit = Number(argv[++i]);
    else if (a === "--law-id") out.lawId = argv[++i];
  }
  return out;
}

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

async function embedBatch(texts, model, provider) {
  return withRetry(`${provider} embed (${texts.length})`, async () => {
    if (provider === "openai") {
      const key = process.env.OPENAI_API_KEY?.trim();
      const res = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ input: texts, model }),
      });
      if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 400)}`);
      const json = await res.json();
      return (json.data ?? []).map((r) => r.embedding);
    }
    const key = process.env.VOYAGE_API_KEY?.trim();
    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ input: texts, model, input_type: "document" }),
    });
    if (!res.ok) throw new Error(`Voyage ${res.status}: ${(await res.text()).slice(0, 400)}`);
    const json = await res.json();
    return (json.data ?? []).map((r) => r.embedding);
  });
}

async function markProgress(supabase, lawId, patch) {
  await supabase.from("retrieval_backfill_progress").upsert(
    { law_id: lawId, updated_at: new Date().toISOString(), ...patch },
    { onConflict: "law_id" }
  );
}

async function fetchNextLaw(supabase, args) {
  if (args.lawId) {
    const { data } = await supabase
      .from("laws")
      .select("id, title, content, content_plain, status, countries(name), categories!laws_category_id_fkey(name)")
      .eq("id", args.lawId)
      .neq("status", "Repealed")
      .maybeSingle();
    return data ? [data] : [];
  }

  if (args.resume) {
    const { data: pending } = await supabase
      .from("retrieval_backfill_progress")
      .select("law_id")
      .in("status", ["pending", "failed", "in_progress"])
      .order("updated_at", { ascending: true })
      .limit(1);
    if (pending?.[0]?.law_id) {
      const { data } = await supabase
        .from("laws")
        .select("id, title, content, content_plain, status, countries(name), categories!laws_category_id_fkey(name)")
        .eq("id", pending[0].law_id)
        .maybeSingle();
      return data ? [data] : [];
    }
  }

  const { data } = await supabase
    .from("laws")
    .select("id, title, content, content_plain, status, countries(name), categories!laws_category_id_fkey(name)")
    .neq("status", "Repealed")
    .order("updated_at", { ascending: false })
    .limit(50);

  const rows = data ?? [];
  for (const law of rows) {
    const { data: prog } = await supabase
      .from("retrieval_backfill_progress")
      .select("status")
      .eq("law_id", law.id)
      .maybeSingle();
    if (!prog || prog.status !== "completed") return [law];
  }
  return [];
}

async function processLaw(supabase, law, model, provider, dryRun) {
  const body = String(law.content_plain ?? law.content ?? "").trim();
  if (body.length < 40) {
    await markProgress(supabase, law.id, {
      status: "skipped",
      error_message: "body too short",
      completed_at: new Date().toISOString(),
    });
    return { status: "skipped" };
  }

  const country = law.countries?.name ?? "";
  const category = law.categories?.name ?? "";
  const jurisdiction = countryNameToIso2(country);

  const chunks = chunkLawForEmbedding({
    title: law.title,
    content: law.content,
    content_plain: law.content_plain,
    country,
    category,
  });

  if (dryRun) {
    console.log(`[dry-run] ${law.id} — ${chunks.length} structured chunks — ${law.title?.slice(0, 60)}`);
    return { status: "dry-run", chunkCount: chunks.length };
  }

  await markProgress(supabase, law.id, {
    status: "in_progress",
    started_at: new Date().toISOString(),
    error_message: null,
  });

  await withRetry(`delete old embeddings ${law.id}`, async () => {
    const result = await supabase
      .from("law_embeddings")
      .delete()
      .eq("law_id", law.id)
      .eq("embedding_model", model);
    if (result.error) throw result.error;
  });

  const rows = [];
  for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
    const slice = chunks.slice(i, i + EMBED_BATCH);
    const texts = slice.map((c) => c.text);
    const vectors = await embedBatch(texts, model, provider);
    for (let j = 0; j < slice.length; j++) {
      const chunk = slice[j];
      rows.push({
        law_id: law.id,
        chunk_index: chunk.index,
        content_hash: sha256(chunk.text),
        chunk_text: chunk.text.slice(0, 8000),
        breadcrumb: chunk.breadcrumb ?? null,
        jurisdiction: chunk.jurisdiction ?? jurisdiction,
        domain: chunk.domain ?? (category || null),
        article_ref: chunk.article_ref ?? null,
        language: chunk.language ?? null,
        embedding: vectors[j],
        embedding_model: model,
        updated_at: new Date().toISOString(),
      });
    }
  }

  if (rows.length > 0) {
    await withRetry(`upsert ${rows.length} chunks`, async () => {
      const result = await supabase.from("law_embeddings").upsert(rows, {
        onConflict: "law_id,chunk_index,embedding_model",
      });
      if (result.error) throw result.error;
    });
  }

  await markProgress(supabase, law.id, {
    status: "completed",
    chunk_count: chunks.length,
    completed_at: new Date().toISOString(),
    error_message: null,
  });

  return { status: "completed", chunkCount: chunks.length };
}

async function main() {
  const args = parseArgs(process.argv);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const provider = process.env.VOYAGE_API_KEY?.trim()
    ? "voyage"
    : process.env.OPENAI_API_KEY?.trim()
      ? "openai"
      : null;
  if (!provider && !args.dryRun) {
    console.error("Set VOYAGE_API_KEY or OPENAI_API_KEY (or use --dry-run)");
    process.exit(1);
  }

  const model =
    process.env.AI_EMBEDDING_MODEL?.trim() ||
    (provider === "voyage" ? "voyage-law-2" : "text-embedding-3-small");

  const supabase = createClient(url, key);
  let processed = 0;
  let failed = 0;

  while (true) {
    if (args.limit != null && processed >= args.limit) break;

    const laws = await fetchNextLaw(supabase, args);
    if (!laws.length) break;

    for (const law of laws) {
      if (args.limit != null && processed >= args.limit) break;
      try {
        const result = await processLaw(supabase, law, model, provider ?? "voyage", args.dryRun);
        if (result.status === "completed" || result.status === "dry-run") {
          processed += 1;
          console.log(
            `${processed}. ${result.status} ${law.id} (${result.chunkCount ?? 0} chunks) — ${law.title?.slice(0, 60) ?? ""}`
          );
        } else {
          console.log(`Skipped ${law.id} — ${result.status}`);
        }
      } catch (err) {
        failed += 1;
        const msg = formatError(err);
        console.error(`Failed ${law.id}: ${msg}`);
        if (!args.dryRun) {
          await markProgress(supabase, law.id, {
            status: "failed",
            error_message: msg,
            completed_at: new Date().toISOString(),
          });
        }
      }
    }

    if (args.lawId) break;
  }

  console.log(`Done. processed=${processed}, failed=${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(formatError(err));
  process.exit(1);
});
