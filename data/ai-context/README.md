# AI Contextual Brain — source files

Drop **PDF** or **DOCX** here, **or** set your bundle path in `.env`:

```env
AI_CONTEXT_SOURCE_DIR=/Users/fahimrashid/Documents/brain
```

Then ingest from the project root:

```bash
npm run ingest:ai-context:dry-run
npm run ingest:ai-context
```

CLI override (one-off):

```bash
npm run ingest:ai-context -- "/Users/fahimrashid/Downloads/AI-Context/v2"
```

## Naming tips

| Pattern | Example | Result |
|---------|---------|--------|
| Main brain | `Yamale_AI_Contextual_Brain_v2.docx` | Global methodology |
| Practice module | `Yamale_AI_Brain_Mining_Law.docx` | Global → **Yamalé AI Brain — Mining Law** |
| Any other PDF/DOCX | `Mining Due Diligence Guide.pdf` | Global methodology |
| Country deep dive | `Senegal_Legal_System_Deep_Dive.docx` | Scoped to that country in the library |

## After adding files

```bash
npm run ingest:ai-context           # new files
npm run ingest:ai-context -- --update   # replace existing titles
```

Requires `.env` with Supabase keys and category **AI Legal Methodology** (see `docs/AI_CONTEXTUAL_BRAIN.md`).

Binary files in this repo folder are gitignored; your `Downloads/AI-Context/v2` path stays outside the repo.
