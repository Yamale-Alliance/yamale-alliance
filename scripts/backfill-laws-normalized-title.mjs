#!/usr/bin/env node
/**
 * Backfill laws.normalized_title after applying docs/sql/law-title-resolution-retrieval.sql.
 *
 * Uses direct Postgres (DATABASE_URL).
 *
 * Usage:
 *   npm run laws:backfill-normalized-title
 *   npm run laws:backfill-normalized-title -- --batch 500
 */

import pg from "pg";

const { Pool } = pg;

const BATCH_DEFAULT = 500;

const SELECT_BATCH_SQL = `
  SELECT id
  FROM public.laws
  WHERE normalized_title IS NULL
    AND ($2::uuid IS NULL OR id > $2::uuid)
  ORDER BY id
  LIMIT $1
`;

const BACKFILL_BATCH_SQL = `
UPDATE public.laws l
SET normalized_title = public.normalize_legal_text(l.title)
WHERE l.id = ANY($1::uuid[])
  AND l.normalized_title IS NULL
`;

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.error("Missing DATABASE_URL in environment");
    process.exit(1);
  }

  let batchSize = BATCH_DEFAULT;
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === "--batch") batchSize = Number.parseInt(process.argv[++i], 10) || BATCH_DEFAULT;
  }

  const pool = new Pool({ connectionString: databaseUrl, max: 2 });
  let cursor = null;
  let total = 0;

  try {
    const fnCheck = await pool.query(`
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'normalize_legal_text'
      LIMIT 1
    `);
    if (fnCheck.rowCount === 0) {
      console.error("normalize_legal_text() not found — apply docs/sql/law-title-resolution-retrieval.sql first");
      process.exit(1);
    }

    const colCheck = await pool.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'laws' AND column_name = 'normalized_title'
      LIMIT 1
    `);
    if (colCheck.rowCount === 0) {
      console.error("laws.normalized_title column not found — apply docs/sql/law-title-resolution-retrieval.sql first");
      process.exit(1);
    }

    console.log(`Backfilling laws.normalized_title (batch ${batchSize})…`);

    for (;;) {
      const { rows } = await pool.query(SELECT_BATCH_SQL, [batchSize, cursor]);
      if (rows.length === 0) break;

      const ids = rows.map((r) => r.id);
      await pool.query(BACKFILL_BATCH_SQL, [ids]);
      total += ids.length;
      cursor = ids[ids.length - 1];
      console.log(`  updated ${total} rows (last id ${cursor})`);
      await new Promise((r) => setTimeout(r, 200));
    }

    console.log(`Done. Backfilled ${total} laws.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
