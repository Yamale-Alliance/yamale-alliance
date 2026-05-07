# Yamalé AI Legal Library — audit remediation report

**Date:** May 7, 2026  
**Scope:** Implements actionable items from *Audit Response — Developer Answers* (`yamale_audit_response.pdf`) plus companion Pass 2 audit gaps that were committed as code (not documentation-only).

---

## Executive summary

The codebase now delivers:

1. **Structured query logging** (`ai_query_log`) — schema + insert from `POST /api/ai/chat` after each successful Claude turn (with graceful degradation if the table is missing).
2. **Versioned system prompt** — extracted to `lib/ai-system-prompt.ts` with `SYSTEM_PROMPT_VERSION`; echoed in API JSON and stored on log rows.
3. **Retrieval scores on the wire** — each `sourceCards[]` entry includes optional `retrievalScore` (same composite used for ranking).
4. **Used vs retrieved sources** — Claude is instructed to emit `[doc:N]` / `[doc:N, art:M]` markers; the API parses them, flags invalid indices, sets `usedInAnswer` per card, and sorts cited sources first.
5. **Citation verification (stage 1)** — programmatic check that `[doc:N]` indices fall within the retrieved document count (`citationVerification` in API + warning banner in UI when invalid).
6. **Formal citation sniffing in retrieval** — `extractSpecificLawHint()` recognises patterns such as French *Loi N°*, *Act No.*, *Cap.*, *decreto-lei*, *OHADA acte uniforme* and treats the query as a named-law retrieval pass.
7. **Coverage matrix API** — `GET /api/admin/coverage-matrix` returns non-repealed counts grouped by `(country_id, category_id)` with human-readable names.
8. **Admin query-log viewer API** — `GET /api/admin/ai-query-log?limit=&offset=`.
9. **User feedback** — `POST /api/ai/feedback` with thumbs UI on AI Research; persists to `ai_response_feedback`.
10. **Structural chunking hints** — `lib/embeddings/chunking.ts` attaches optional `structuralHeading` when the first line looks like Article/Section/Chapter (prep for anchors / embeddings).
11. **Ingestion runbook** — `docs/INGESTION.md`.
12. **CI** — `.github/workflows/ci-ai-detection.yml` runs `scripts/test-ai-detection.mjs` on push/PR.

**Operational prerequisite:** Run `docs/sql/006_ai_audit_tables.sql` in the Supabase SQL Editor so `ai_query_log` and `ai_response_feedback` exist. Until then, inserts fail silently (`insertAiQueryLog` logs and returns `null`).

---

## Mapping: audit PDF → implementation

| Audit area | Item | Status |
|------------|------|--------|
| 7.1 / 7.2 | Per-query logging + team access | **Done** — table SQL + `insertAiQueryLog`; admin `GET /api/admin/ai-query-log`. |
| 4.1 | Single versioned prompt artifact | **Done** — `lib/ai-system-prompt.ts` + version constant. |
| 3.7 | Scores downstream | **Done** — `retrievalScore` on `sourceCards`. |
| 5.4 | Used vs retrieved | **Done** — `usedInAnswer`, UI badges, sort order. |
| 4.8 / 5.6 | Citation verification | **Partial** — validates `[doc:N]` range; article-level grounding vs excerpt is future work (needs article-aware chunks + viewer anchors). |
| 3.5 | Citation-format retrieval | **Partial** — regex triggers full-query hint path; further tuning may add dedicated title `ilike` on extracted numbers. |
| 2.1 | Structural chunking | **Partial** — heading inference on chunks only; chat excerpts remain paragraph-based. |
| 1.1 | Coverage matrix | **Done** — admin coverage-matrix endpoint (live KPI). |
| 2.7 | Ingestion documented | **Done** — `docs/INGESTION.md`. |
| 7.3 | Eval in CI | **Done** — workflow runs detection script (logic-only; extend with E2E later). |
| 6.6 / 7.4 | Feedback | **Done** — API + UI thumbs (admin review UI for flags still optional). |
| 1.4 | Language + translation links | **Not done** — requires DB migration (`language`, `law_translations`). |
| 1.8 | Multi-country scope junction | **Not done** — requires `law_country_scopes` migration + library filter changes. |
| 1.2 | Citation metadata schema | **Not done** — JSON schema for `metadata` left to content ops (PDF plan only). |
| 2.4 | Vector embeddings | **N/A** — strategic; lexical RAG unchanged. |
| 1.6 | Summary backfill | **Not done** — table/API exist; batch script still to add. |

---

## Files touched (reference)

| Path | Purpose |
|------|---------|
| `lib/ai-system-prompt.ts` | Versioned `buildAiResearchSystemPrompt`. |
| `lib/ai-citation-verify.ts` | Parse / validate `[doc:N]`. |
| `lib/ai-query-log.ts` | Insert helper for `ai_query_log`. |
| `lib/embeddings/chunking.ts` | Optional `structuralHeading` per chunk. |
| `app/api/ai/chat/route.ts` | Wiring: prompt builder, scores, citations, logging, API fields; lawyer nudge fix (`approved` boolean). |
| `app/(user)/ai-research/page.tsx` | `sourceCards` UX, feedback buttons, citation warning. |
| `app/api/ai/feedback/route.ts` | Thumbs persistence. |
| `app/api/admin/coverage-matrix/route.ts` | Coverage KPI JSON. |
| `app/api/admin/ai-query-log/route.ts` | Paginated logs. |
| `lib/database.types.ts` | Types for new tables. |
| `docs/sql/006_ai_audit_tables.sql` | DDL for Supabase. |
| `docs/INGESTION.md` | Ingestion runbook. |
| `docs/RAG_SETUP.md` | Cross-links to prompt + ingestion + logging. |
| `.github/workflows/ci-ai-detection.yml` | CI regression for detection script. |

---

## API additions

### `POST /api/ai/chat` (success body extensions)

- `systemPromptVersion` — string (matches `SYSTEM_PROMPT_VERSION` in code).
- `citationVerification` — `{ invalidDocRefs, citedDocIndices, allDocRefsValid }`.
- `queryLogId` — UUID string when logging insert succeeds; `null` if logging failed or table missing.

### `sourceCards[]` extensions

- `docSlot` — 1-based index matching `[Document N]` in the prompt (stable for `[doc:N]`).
- `retrievalScore` — composite retrieval rank score.
- `usedInAnswer` — whether any `[doc:N]` cited this slot.

### `POST /api/ai/feedback`

Body: `{ "queryLogId"?: string, "rating": 1 | -1, "comment"?: string }`  
Requires signed-in user.

### Admin (`requireAdmin`)

- `GET /api/admin/coverage-matrix`
- `GET /api/admin/ai-query-log?limit=40&offset=0`

---

## Recommended next steps (not in this PR scope)

1. Run SQL migration in production Supabase.
2. Add admin UI page listing `ai_query_log` / flagged feedback (tables are API-ready).
3. Implement `law_country_scopes` + library filter join for OHADA/AfCFTA UX (audit 1.8).
4. Article-level deep links in library viewer + `[doc:N, art:M]` validation against excerpt (audit 5.5 / stage-2 verification).
5. Optional: strip or soft-hide `[doc:N]` markers in markdown render while keeping verification server-side.

---

## Follow-up fixes from `yamale_test_results.pdf` (May 7 QA)

The post-fix QA reported 2 PASS / 2 PARTIAL / 1 FAIL and asked to fix code-side PARTIAL/FAIL items.
The content-gap item (Namibia Companies Act not indexed) cannot be solved in code alone, but retrieval and excerpt behavior were tightened:

### 1) Q3 source noise (PARTIAL) — fixed in retrieval

- Added intent-aware off-topic pruning for labor queries in `searchLegalLibrary()`:
  - Laws whose title/category look like IP instruments are dropped for labor intent unless labor signals are present in title/body.
- Enabled title-deduping for labor intent to avoid near-duplicate rows in source cards.
- Net effect: reduces irrelevant cards like **Liberia Intellectual Property Act** in labor-rights prompts while preserving Decent Work / Labor-law instruments.

### 2) Q5 OHADA excerpt depth (PARTIAL) — improved excerpt targeting

- Extended `pickContentExcerpt()` to support **anchor phrases** (`anchorPhrases`) with higher priority scoring than generic token matches.
- Added query-aware anchor generation in `chat/route.ts` for OHADA SA/capital prompts:
  - `société anonyme`, `capital social`, `capital minimum`, `constitution de la société`, `articles 385`, `part iv`, etc.
- Net effect: for large OHADA acts, excerpt windows are now biased toward SA formation/capital chapters rather than liquidation-only tails when the query asks for SA capital.

### 3) Q4 structural-chunking fail in report

- The QA fail is confirmed as a **content indexing gap** (Namibia Companies Act absent), not a generation/retrieval hallucination.
- Existing code already avoids fabrication and now has stronger specific-law token filtering (drops generic words like `article`, `under`, `what`, `does`) to reduce accidental broad matches.

These follow-up patches are fully type-checked and lint-clean.

---

## Verification performed locally

- `npx tsc --noEmit` — clean.
- `node scripts/test-ai-detection.mjs` — 18 passed.

---

*End of report.*
