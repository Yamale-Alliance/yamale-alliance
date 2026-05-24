# Golden eval improvements (May 2026)

Based on `yamalé-evaluation-report.pdf` (153 questions). **No post-fix golden re-run yet** — run `npm run eval:golden` to measure impact.

## Report vs what we did

| Report issue | Questions affected (report) | Platform fix (code) | Corpus / ingestion |
|--------------|---------------------------|---------------------|-------------------|
| Knowledge gaps / hedge phrases | 115 (75%) | Stronger anti-deflection prompt; answer from excerpts first | Many gaps need missing acts/guides in DB |
| Q148 context overflow | 1 (failed) | `lib/ai-prompt-budget.ts`, full-act caps | Chunk long telecom acts at ingest |
| Weak section citations | ~130 (only 15% had sections) | Prompt: section/article in prose + `[doc:N, art:M]` | — |
| Company formation weak (2.87 completeness) | 15 in category | `registration` → focused statute RAG; formation excerpt anchors; commercial-code slots | CAC/CIPC timelines, fees, portal guides |
| IP sourcing low (2.40) | 10 in category | Existing IP mandatory slots + focused statute budget | National IP acts per country |
| Anti-corruption sources thin (2.60) | 5 in category | `corruption` intent + mandatory slots (UNCAC, AML, national acts) | Index UNCAC, AU Convention, FATF impl. |
| Sector / telecom weak | 8 in category | New `telecommunications` intent + regulator/act slots | National comms acts + CA regs |

## Code changes (all questions benefit)

- **`lib/ai-prompt-budget.ts`** — input token ceiling (fixes Q148-class failures).
- **`lib/ai-rag-context-budget.ts`** — `registration`, `corruption`, `telecommunications` use larger statute excerpts (like tax/labour/IP).
- **`lib/ai-library-search-intent.ts`** — telecom intent; expanded corruption supplemental terms.
- **`lib/ai-intent-title-retrieval.ts`** — mandatory hydration for corruption + telecom; extra registration/commercial-code slots.
- **`app/api/ai/chat/route.ts`** — hydration IDs, formation/telecom/corruption excerpt anchors, sourcing floor.
- **`lib/ai-system-prompt.ts`** — version `2026.05.24-eval-report-rag`; banned deflection patterns; practitioner section citations.

## Per-question backlog from the PDF

```bash
npm run eval:parse-report
# → data/eval/eval-report-backlog.csv
```

Columns: Q, Category, Geography, Question, scores, Gaps, Improvements, `Needs_Ingestion`, `Needs_Prompt_Fix`.

Use the CSV to prioritise **ingestion** (rows with `Needs_Ingestion=yes`) — that is what fixes the majority of the 115 “knowledge gap” flags; prompt/RAG cannot invent missing Companies Act registration chapters or national IP codes.

## Re-run eval

```bash
npm run eval:golden
```

Compare to `data/eval/runs/golden-2026-05-24T17-53-17.*` and re-score with the same rubric as the PDF.
