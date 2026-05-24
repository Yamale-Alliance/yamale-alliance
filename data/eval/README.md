# AI eval data

| Path | Purpose |
|------|---------|
| `test-questions.xlsx` | Golden question list (source for batch runs) |
| `runs/` | Generated reports (gitignored) |

```bash
npm run eval:golden:dry-run
npm run eval:golden -- --limit 5
```

See [docs/AI_GOLDEN_EVAL.md](../../docs/AI_GOLDEN_EVAL.md).
