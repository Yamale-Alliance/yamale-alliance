# Golden question batch eval

Run the top-150 (or any) test questions from Excel through live AI Research and export a review spreadsheet.

## Input

Default file: `data/eval/test-questions.xlsx` (columns: `#`, `Category`, `Question`, `Geographic Relevance`, `Notes`).

Replace or pass another path:

```bash
npm run eval:golden -- /path/to/test-questions.xlsx
```

## One-time setup

1. **Copy questions** into the repo (if not already):

   ```bash
   cp ~/Documents/test-questions.xlsx data/eval/test-questions.xlsx
   ```

2. **`.env`** — add:

   ```env
   AI_EVAL_SECRET=<random string, e.g. openssl rand -hex 32>
   AI_EVAL_CLERK_USER_ID=user_…   # Clerk user id for Team/Pro (admin ok)
   AI_EVAL_BASE_URL=http://localhost:3000
   ```

   Find `AI_EVAL_CLERK_USER_ID` in [Clerk Dashboard](https://dashboard.clerk.com) → Users → copy user ID. Use an account on **Team** tier so 150 runs are not blocked by monthly/daily caps (eval mode skips those limits).

3. **Start the app** in another terminal:

   ```bash
   npm run dev
   ```

## Run

```bash
# Preview question list
npm run eval:golden:dry-run

# First 3 questions (smoke test)
npm run eval:golden -- --limit 3

# Full sheet (~150 questions, serial, ~2–4 hours + API cost)
npm run eval:golden

# Range by row #
npm run eval:golden -- --from=50 --to=60
```

## Output report

Written to `data/eval/runs/golden-<timestamp>.xlsx` with columns:

| Column | Description |
|--------|-------------|
| **Question** | From Excel |
| **Answer** | Full AI response text |
| **Sources Used** | Law titles (and countries) from `sourceCards` |

Also: `.csv` (same data + metadata) and `.jsonl` (full row for tooling).

Progress is saved to `.jsonl` after each question so a crash does not lose completed rows.

## Options

| Flag / env | Purpose |
|------------|---------|
| `--limit N` | Run only first N questions |
| `--from=N` / `--to=N` | Filter by `#` column |
| `AI_EVAL_DELAY_MS` | Pause between calls (default 2000 ms) |
| `AI_EVAL_BASE_URL` | Staging/production URL instead of localhost |

## Review workflow

1. Open the `.xlsx` in Excel/Sheets.
2. Sort/filter **Error** column in the `.csv` (if any failures).
3. Admins can split **Category** buckets for human pass/fail notes (add columns in Sheets; not automated).

## Security

`AI_EVAL_SECRET` must match the `Authorization: Bearer …` header. Only `POST /api/ai/chat` with that secret impersonates `AI_EVAL_CLERK_USER_ID`. Do not commit the secret; do not use in production UI.
