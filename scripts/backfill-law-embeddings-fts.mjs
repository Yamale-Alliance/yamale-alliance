#!/usr/bin/env node
/**
 * Backfill law_embeddings.fts in small batches (avoids Supabase SQL editor timeout).
 *
 * Uses direct Postgres (DATABASE_URL) — does not require the RPC function.
 *
 * Setup:
 *   1. Supabase → Project Settings → Database → Connection string → URI
 *   2. Add to .env: DATABASE_URL=postgresql://postgres.[ref]:[password]@...
 *   3. Run block 2 from docs/sql/law-embeddings-hybrid-retrieval-safe.sql (fts column + trigger)
 *
 * Usage:
 *   npm run embeddings:backfill-fts
 *   npm run embeddings:backfill-fts -- --batch 500
 */

import pg from "pg";

const { Pool } = pg;

const ENSURE_FTS_SQL = `
ALTER TABLE public.law_embeddings
  ADD COLUMN IF NOT EXISTS fts tsvector;

CREATE OR REPLACE FUNCTION public.law_embeddings_sync_fts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.fts := to_tsvector(
    'simple',
    coalesce(NEW.breadcrumb, '') || ' ' || coalesce(NEW.chunk_text, '')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS law_embeddings_fts_sync ON public.law_embeddings;

CREATE TRIGGER law_embeddings_fts_sync
  BEFORE INSERT OR UPDATE OF breadcrumb, chunk_text ON public.law_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION public.law_embeddings_sync_fts();
`;

const SELECT_BATCH_SQL = `
  SELECT id
  FROM public.law_embeddings
  WHERE fts IS NULL
    AND ($2::uuid IS NULL OR id > $2::uuid)
  ORDER BY id
  LIMIT $1
`;

const BACKFILL_BATCH_SQL = `
UPDATE public.law_embeddings le
SET fts = to_tsvector(
  'simple',
  coalesce(le.breadcrumb, '') || ' ' || coalesce(le.chunk_text, '')
)
WHERE le.id = ANY($1::uuid[]);
`;

function parseArgs(argv) {
  const out = { batch: 500 };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--batch") out.batch = Number(argv[++i]);
  }
  return out;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const PARTIAL_NULL_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS law_embeddings_fts_null_id_idx
  ON public.law_embeddings (id)
  WHERE fts IS NULL;
`;

function isTimeoutError(err) {
  const msg = (err?.message ?? String(err)).toLowerCase();
  return msg.includes("timeout") || msg.includes("57014");
}

async function queryWithRetry(pool, text, params, label) {
  let lastErr;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      return await pool.query(text, params);
    } catch (err) {
      lastErr = err;
      if (!isTimeoutError(err) || attempt === 5) throw err;
      const delay = 1500 * attempt;
      console.warn(`[retry ${attempt}/5] ${label}: ${err.message} — waiting ${delay}ms`);
      await sleep(delay);
    }
  }
  throw lastErr;
}

async function configureSession(pool) {
  const client = await pool.connect();
  try {
    await client.query("SET statement_timeout = '600s'");
    await client.query("SET lock_timeout = '30s'");
  } finally {
    client.release();
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.error(
      "Missing DATABASE_URL in .env\n\n" +
        "Get it from Supabase → Project Settings → Database → Connection string → URI\n" +
        "Example: DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"
    );
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false },
  });

  try {
    await configureSession(pool);
    console.log("Ensuring fts column + trigger…");
    await queryWithRetry(pool, ENSURE_FTS_SQL, undefined, "ensure fts");
    console.log("Ensuring partial index on rows missing fts…");
    await queryWithRetry(pool, PARTIAL_NULL_INDEX_SQL, undefined, "partial null index");

    let total = 0;
    let rounds = 0;
    let cursor = null;
    let wrapped = false;

    while (true) {
      let batch = await queryWithRetry(pool, SELECT_BATCH_SQL, [args.batch, cursor], "select batch");
      if (batch.rows.length === 0 && !wrapped && cursor !== null) {
        cursor = null;
        wrapped = true;
        batch = await queryWithRetry(pool, SELECT_BATCH_SQL, [args.batch, cursor], "select batch wrap");
      }

      const ids = batch.rows.map((row) => row.id);
      if (ids.length === 0) {
        console.log(`Round ${rounds + 1}: updated 0 rows (total ${total})`);
        break;
      }

      const res = await queryWithRetry(pool, BACKFILL_BATCH_SQL, [ids], "update batch");
      const n = res.rowCount ?? 0;
      rounds += 1;
      total += n;
      cursor = ids[ids.length - 1];
      console.log(`Round ${rounds}: updated ${n} rows (total ${total})`);
      await sleep(500);
    }

    try {
      const remaining = await queryWithRetry(
        pool,
        "SELECT EXISTS (SELECT 1 FROM public.law_embeddings WHERE fts IS NULL LIMIT 1) AS has_null",
        undefined,
        "verify remaining"
      );
      const hasNull = Boolean(remaining.rows[0]?.has_null);
      console.log(hasNull ? "Some rows still have fts IS NULL — re-run to finish." : "All rows have fts populated.");
    } catch (err) {
      console.warn("Skipped remaining check (timeout). Re-run script; it will resume if needed.");
    }

    console.log("Next: create GIN index (block 4 in law-embeddings-hybrid-retrieval-safe.sql).");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
