# Yamalé AI Contextual Brain

The **AI Contextual Brain** (`Yamale_AI_Contextual_Brain_v2.docx` and companion PDFs) is the reasoning layer for AI Legal Research. The **country-specific legal database** is the facts layer (RAG). The brain teaches the model how to read statutes, spot issues, apply IRAC, and use library excerpts—not to invent law from training data.

## Architecture

| Layer | Where it lives | Role |
|--------|----------------|------|
| **Reasoning (always on)** | `lib/ai-contextual-brain.ts` → `buildAiContextualBrainPromptBlock()` in `lib/ai-system-prompt.ts` | 8-step workflow, IRAC, African pluralism, RAG discipline |
| **Full brain + supplements (RAG)** | Supabase `laws` rows, category **AI Legal Methodology**, `applies_to_all_countries = true` | Long-form guides, country legal-system deep dives, treatises |
| **National / treaty law (RAG)** | Existing `laws` rows by country & category | Operative texts the user cites for binding rules |

On each legal research turn, the chat route prepends up to **two** methodology documents from the library (`lib/ai-methodology-retrieval.ts`) before country-specific hits.

### Hidden from the public library

Rows in **AI Legal Methodology** are **not** shown in `/library`, `/api/laws`, or law detail pages for end users (`lib/internal-library-categories.ts`). AI chat still retrieves them internally. Admins ingest and edit them via the admin panel and `npm run ingest:ai-context`.

System prompt version: `SYSTEM_PROMPT_VERSION` in `lib/ai-system-prompt.ts` (includes contextual brain v1).

## Adding more files (drop folder)

**Yes — add PDF or DOCX files to your context folder, then run one ingest command.** The AI does not watch the folder automatically; ingestion uploads text into Supabase so RAG can retrieve it.

**Recommended path (v2 bundle):** set in `.env`:

```env
AI_CONTEXT_SOURCE_DIR=/Users/fahimrashid/Downloads/AI-Context/v2
```

```bash
npm run ingest:ai-context:dry-run   # preview
npm run ingest:ai-context           # upload new files
npm run ingest:ai-context -- --update   # replace existing titles after edits
```

Or pass the folder once: `npm run ingest:ai-context -- "/Users/fahimrashid/Downloads/AI-Context/v2"`

Alternative drop folder inside the repo: `data/ai-context/` (used when `AI_CONTEXT_SOURCE_DIR` is unset).

## Source files (example bundle)

Files can live in `data/ai-context/` or any folder you pass to the script:

| File | Suggested title | Country scope |
|------|-----------------|---------------|
| `Yamale_AI_Contextual_Brain_v2.docx` | Yamalé AI Contextual Brain v2 | Global (`applies_to_all_countries`) |
| `A-Guide-to-Reading-Interpreting-and-Applying-Statutes-1.pdf` | Guide to Reading, Interpreting and Applying Statutes | Global |
| `A-Guide-to-the-Basics-of-Intl-Law.pdf` | Guide to the Basics of International Law | Global |
| `How to read legislation.pdf` | How to Read Legislation | Global |
| `Reading-Like-a-Lawyer-McKinney.pdf` | Reading Like a Lawyer | Global |
| `NYU Guide.pdf` | NYU Legal Research Guide | Global |
| `CompanyLaw_BOOK.pdf` | Company Law (Treatise) | Global |
| `Corporate Law.pdf` | Corporate Law (Treatise) | Global |
| `Contracts Law Africa.pdf` | Contracts Law Africa | Global |
| `ALSF Mining.pdf` | ALSF Mining Law Guide | Global |
| `Angola_Legal_System_Deep_Dive.docx` | Angola Legal System Deep Dive | Angola |
| `Benin_Legal_System_Deep_Dive.docx` | Benin Legal System Deep Dive | Benin |
| `Botswana_Legal_System_Deep_Dive.docx` | Botswana Legal System Deep Dive | Botswana |
| `Burkina_Faso_Legal_System_Deep_Dive.docx` | Burkina Faso Legal System Deep Dive | Burkina Faso |
| `the-rule-of-law-between-national-and-international-contexts-….pdf` | Rule of Law — National and International Contexts | Global |

Add more `*_Legal_System_Deep_Dive.docx` files the same way (filename prefix = country).

## Database setup

1. Apply migration (creates category):

   ```bash
   # Run in Supabase SQL editor if *.sql is gitignored locally:
   # supabase/migrations/20260523100000_ai_legal_methodology_category.sql
   ```

2. Confirm category exists: `SELECT id, name FROM categories WHERE name = 'AI Legal Methodology';`

## Ingestion

Drop files in `data/ai-context/`, then from project root (requires `.env` with Supabase service role):

```bash
npm run ingest:ai-context:dry-run
npm run ingest:ai-context
```

Brain document only: `node --env-file=.env scripts/ingest-ai-context.mjs --only-brain`

Large PDFs may take several minutes. Re-run with `--update` after editing an existing title in place.

### `laws_country_scope_check` failed on insert

Global methodology rows must use **`applies_to_all_countries: true`** and **`country_id: null`** (not a placeholder country). The ingest script handles this automatically; re-run:

```bash
npm run ingest:ai-context -- --update
```

Country deep dives use a specific `country_id` and `applies_to_all_countries: false`.

## Verify

1. Admin → Laws: filter by category **AI Legal Methodology**.
2. AI Research: ask *"How should I read Section 14 of a labour code?"* — response should follow IRAC and cite methodology or library excerpts.
3. Check API logs for `methodology_context` perf step and `systemPromptVersion` `2026.05.23-contextual-brain-v1`.

## Maintenance

- **Vault Strategist / Vault Researcher** own annual brain review (per source doc).
- Bump `CONTEXTUAL_BRAIN_VERSION` and `SYSTEM_PROMPT_VERSION` when Part Eight operating rules change materially.
- Re-ingest `Yamale_AI_Contextual_Brain_v2.docx` after edits (`--only-brain --update`).

## Related

- `docs/RAG_SETUP.md` — retrieval flow
- `docs/INGESTION.md` — general law ingestion
- `lib/ai-system-prompt.ts` — versioned prompt builder
