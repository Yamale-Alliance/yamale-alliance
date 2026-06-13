#!/usr/bin/env node
/**
 * Backfill law_embeddings for hybrid vector RAG.
 *
 * Prerequisites:
 *   1. Run docs/sql/law-embeddings-pgvector.sql in Supabase
 *   2. Set VOYAGE_API_KEY (recommended: voyage-law-2) or OPENAI_API_KEY + AI_EMBEDDING_MODEL
 *
 * Usage:
 *   node --env-file=.env scripts/backfill-law-embeddings.mjs
 *   node --env-file=.env scripts/backfill-law-embeddings.mjs --limit 50
 *   node --env-file=.env scripts/backfill-law-embeddings.mjs --law-id <uuid>
 *   node --env-file=.env scripts/backfill-law-embeddings.mjs --skip-embedded
 */

import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const PAGE = 40;
const EMBED_BATCH = 16;
const MAX_RETRIES = 6;
const BASE_DELAY_MS = 1500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatError(err) {
  const msg = err?.message ?? String(err);
  if (msg.includes("<!DOCTYPE html>") || msg.includes("cf-error-details")) {
    const code = msg.match(/Error code (\d+)/)?.[1] ?? "520";
    const host = msg.match(/truncate">([^<]+\.supabase\.co)/)?.[1];
    return `Supabase/Cloudflare HTTP ${code}${host ? ` (${host})` : ""} — transient; wait and retry`;
  }
  if (msg.length > 280) return `${msg.slice(0, 280)}…`;
  return msg;
}

function isRetryableError(err) {
  const msg = (err?.message ?? String(err)).toLowerCase();
  if (msg.includes("<!doctype html") || msg.includes("cloudflare") || msg.includes("error code 520")) {
    return true;
  }
  if (["520", "502", "503", "504", "429", "408"].some((code) => msg.includes(code))) return true;
  if (err?.code === "ECONNRESET" || err?.code === "ETIMEDOUT" || err?.code === "UND_ERR_CONNECT_TIMEOUT") {
    return true;
  }
  if (msg.includes("fetch failed") || msg.includes("network") || msg.includes("timeout")) return true;
  if (typeof err?.status === "number" && (err.status >= 500 || err.status === 429)) return true;
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
      const delay = BASE_DELAY_MS * 2 ** (attempt - 1) + Math.random() * 500;
      console.warn(
        `[retry ${attempt}/${MAX_RETRIES - 1}] ${label}: ${formatError(err)} — waiting ${Math.round(delay / 1000)}s`,
      );
      await sleep(delay);
    }
  }
  throw lastErr;
}

function parseArgs(argv) {
  const out = { limit: null, lawId: null, dryRun: false, skipEmbedded: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--skip-embedded") out.skipEmbedded = true;
    else if (a === "--limit") out.limit = Number(argv[++i]);
    else if (a === "--law-id") out.lawId = argv[++i];
  }
  return out;
}

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

async function embedBatch(texts, model, provider) {
  return withRetry(`${provider} embed (${texts.length} chunks)`, async () => {
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

function chunkLaw(title, body) {
  const paragraphs = body.replace(/\r\n/g, "\n").trim().split(/\n\s*\n/).filter(Boolean);
  const chunks = [];
  let buf = "";
  const flush = () => {
    if (!buf.trim()) return;
    const text = title ? `${title}\n\n${buf.trim()}` : buf.trim();
    chunks.push(text.slice(0, 4000));
    buf = "";
  };
  for (const p of paragraphs) {
    if ((buf + "\n\n" + p).length > 900) {
      flush();
      buf = p;
    } else {
      buf = buf ? `${buf}\n\n${p}` : p;
    }
  }
  flush();
  return chunks.length ? chunks : body.trim() ? [body.slice(0, 4000)] : [];
}

async function isLawFullyEmbedded(supabase, lawId, model, chunks) {
  const { data } = await withRetry(`check embedded ${lawId}`, async () => {
    const result = await supabase
      .from("law_embeddings")
      .select("chunk_index, content_hash")
      .eq("law_id", lawId)
      .eq("embedding_model", model);
    if (result.error) throw result.error;
    return result;
  });
  if (!data?.length) return false;

  const existing = new Map(data.map((row) => [row.chunk_index, row.content_hash]));
  for (let i = 0; i < chunks.length; i++) {
    if (existing.get(i) !== sha256(chunks[i])) return false;
  }
  return true;
}

async function fetchLawPage(supabase, offset, lawId) {
  const { data } = await withRetry(`fetch laws offset ${offset}`, async () => {
    let q = supabase
      .from("laws")
      .select("id, title, content, content_plain, status")
      .neq("status", "Repealed")
      .order("updated_at", { ascending: false })
      .range(offset, offset + PAGE - 1);

    if (lawId) q = q.eq("id", lawId);

    const result = await q;
    if (result.error) throw result.error;
    return result;
  });
  return data ?? [];
}

async function upsertEmbeddings(supabase, rows) {
  await withRetry(`upsert ${rows.length} chunks for ${rows[0]?.law_id}`, async () => {
    const result = await supabase.from("law_embeddings").upsert(rows, {
      onConflict: "law_id,chunk_index,embedding_model",
    });
    if (result.error) throw result.error;
    return result;
  });
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
  if (!provider) {
    console.error("Set VOYAGE_API_KEY (recommended) or OPENAI_API_KEY");
    process.exit(1);
  }

  const model =
    process.env.AI_EMBEDDING_MODEL?.trim() ||
    (provider === "voyage" ? "voyage-law-2" : "text-embedding-3-small");

  const supabase = createClient(url, key);
  let processed = 0;
  let skipped = 0;
  let failed = 0;
  let lineNo = 0;
  let offset = 0;

  while (true) {
    if (args.limit != null && processed >= args.limit) break;

    const laws = await fetchLawPage(supabase, offset, args.lawId);
    if (!laws.length) break;

    for (const law of laws) {
      if (args.limit != null && processed >= args.limit) break;
      const body = String(law.content_plain ?? law.content ?? "").trim();
      if (body.length < 40) continue;

      try {
        const chunks = chunkLaw(String(law.title ?? ""), body);
        if (args.skipEmbedded && (await isLawFullyEmbedded(supabase, law.id, model, chunks))) {
          skipped += 1;
          lineNo += 1;
          console.log(
            `${lineNo} Skipped ${law.id} (already embedded) — ${law.title?.slice(0, 60) ?? ""}`,
          );
          continue;
        }

        const rows = [];

        for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
          const slice = chunks.slice(i, i + EMBED_BATCH);
          if (args.dryRun) {
            console.log(`[dry-run] ${law.id} chunks ${i}-${i + slice.length - 1}`);
            continue;
          }
          const vectors = await embedBatch(slice, model, provider);
          for (let j = 0; j < slice.length; j++) {
            const chunkIndex = i + j;
            const chunkText = slice[j];
            rows.push({
              law_id: law.id,
              chunk_index: chunkIndex,
              content_hash: sha256(chunkText),
              chunk_text: chunkText.slice(0, 8000),
              embedding: vectors[j],
              embedding_model: model,
              updated_at: new Date().toISOString(),
            });
          }
        }

        if (!args.dryRun && rows.length > 0) {
          await upsertEmbeddings(supabase, rows);
        }

        processed += 1;
        lineNo += 1;
        console.log(
          `${lineNo} Embedded ${law.id} (${chunks.length} chunks) — ${law.title?.slice(0, 60) ?? ""}`,
        );
      } catch (err) {
        failed += 1;
        lineNo += 1;
        console.error(
          `${lineNo} Failed ${law.id} — ${formatError(err)} — ${law.title?.slice(0, 60) ?? ""}`,
        );
      }
    }

    if (args.lawId) break;
    offset += PAGE;
  }

  const parts = [`Laws embedded: ${processed}`];
  if (args.skipEmbedded) parts.push(`skipped: ${skipped}`);
  if (failed > 0) parts.push(`failed: ${failed}`);
  console.log(`Done. ${parts.join(", ")}`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(formatError(err));
  process.exit(1);
});
