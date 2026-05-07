# Yamalé legal library — ingestion runbook

Canonical path from raw source to a searchable, AI-retrievable law row.

## 1. Choose an ingestion channel

| Channel | When to use | Entry point |
|--------|----------------|-------------|
| **Admin URL import** | PDF/HTML URL known; Claude can infer metadata | Admin → Laws → Add from URL (`lib/admin-law-url-import-core.ts`) |
| **Admin bulk URL import** | Many URLs | Admin → Bulk from URL |
| **Treaty bulk row** | Repeat treaty rows per country | Admin → Treaty bulk |
| **CLI PDF script** | Local PDF, scripted ops | `node --env-file=.env scripts/import-pdf-law.mjs "/path/to/file.pdf"` — see `scripts/README.md` |
| **JSON seed** | Scripted fixtures | `scripts/seed-ghana-laws.mjs` |
| **Supabase SQL** | One-off inserts | SQL Editor (example patterns in `scripts/README.md`) |

## 2. Processing pipeline (conceptual)

1. **Fetch / upload** — PDF bytes or URL.
2. **Extract text** — `extractTextFromPdf` or URL fetch + strip TOC (`stripTableOfContents`).
3. **Normalize** — Markdown/plain (`plainTextToMarkdown`, `sanitizeLawContent` in admin utils).
4. **Metadata** — Heuristic inference (`inferMetadataHeuristic`); optional Claude extraction (`extractLawMetadataWithClaude` when API configured).
5. **Persist** — Insert/update `laws` row with `country_id`, `category_id`, `title`, `year`, `status`, `content`, `content_plain`, optional `metadata` JSON.
6. **Categories** — Sync junction `law_categories` when multi-category (`syncLawCategories`).
7. **Audit** — `recordAuditLog` for admin actions.

## 3. Edge cases

- **Scanned PDFs** — Force OCR where supported; prefer manual cleanup via Admin Fix OCR (`app/(admin)/admin-panel/laws/fix-ocr/`).
- **French / Arabic / Portuguese** — No separate language column yet (planned in audit response); store authoritative text in `content`/`content_plain`; retrieval uses lexical ILIKE + intent boosts.
- **Supranational instruments** — Often duplicated per signatory country in DB; AI retrieval dedupes by title and applies framework quotas; long-term fix is `law_country_scopes` junction (see audit report).

## 4. After ingestion

- Verify row in Library filters (country, category, status).
- Smoke-test AI Research with a query that names the instrument or topic.
- Optional: Team-plan law summary via `/api/laws/[id]/summary` (manual POST until backfill script ships).

## 5. Related docs

- High-level RAG flow: `docs/RAG_SETUP.md`
- Chunking for future embeddings: `lib/embeddings/chunking.ts`
- Versioned AI system prompt: `lib/ai-system-prompt.ts` (`SYSTEM_PROMPT_VERSION`)
