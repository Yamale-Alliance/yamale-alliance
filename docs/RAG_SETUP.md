# RAG (Retrieval Augmented Generation) Setup

This guide explains the RAG integration that powers AI Legal Research with real legal documents from your library.

**System prompt (audit / versioning):** The Legal Research assistant instructions live in `lib/ai-system-prompt.ts` as `buildAiResearchSystemPrompt()`. The string constant `SYSTEM_PROMPT_VERSION` is returned on successful `POST /api/ai/chat` responses (`systemPromptVersion`) and persisted on each row in `ai_query_log` when that table exists (see `docs/sql/006_ai_audit_tables.sql`).

**Ingestion runbook:** See `docs/INGESTION.md` for URL/PDF → indexed law steps.

## How RAG Works

When a user asks a question in AI Legal Research:

1. **Query Analysis**: The system extracts country and category hints from the question
   - Example: "Corporate law in Ghana" → country: "Ghana", category: "Corporate Law"

2. **Legal Library Search**: Searches the `laws` table for relevant documents
   - Filters by country and category if detected
   - Full-text search on title and content
   - Returns top 5 most relevant laws

3. **Context Retrieval**: Extracts relevant chunks (first 2000 chars) from each law

4. **AI Response**: Passes retrieved legal content to Claude AI as context
   - Claude answers based on the actual legal documents
   - Cites specific laws when relevant
   - Provides accurate, source-grounded responses

## Database Setup

### Migration: pgvector Extension (Optional - for future vector embeddings)

Run migration `005_rag_embeddings.sql` to enable vector search:

```sql
-- This enables pgvector extension for future vector embeddings
CREATE EXTENSION IF NOT EXISTS vector;
```

**Note**: Currently using full-text search. Vector embeddings can be added later for semantic similarity.

### Current Implementation

- Uses PostgreSQL full-text search (`GIN` index on `laws` table)
- Filters by country and category when detected in query
- **Chunking strategy**: Law content is split into semantic chunks before being sent to the AI (see below)
- Passes context to Claude AI

### Chunking Strategy

Law text is chunked with **paragraph- and sentence-aware splitting** so context stays coherent:

- **Library**: `lib/embeddings/chunking.ts` — `chunkLawContent(text, options)`
- **Defaults**: max 800 chars per chunk, 120 char overlap between chunks
- **Logic**: Split by paragraphs (`\n\n`); if a paragraph exceeds the max, split by sentences and rejoin with overlap so boundaries don’t cut mid-thought
- **Usage**: RAG uses the first N chunks per law (up to ~2000 chars per law) so the prompt stays within limits while favoring the start of each document (often the most relevant)

This same chunking is used when you add vector embeddings later: each chunk can be embedded and stored in `law_embeddings` for similarity search.

## API Endpoints

### 1. AI Chat with RAG (`POST /api/ai/chat`)

Automatically searches legal library and includes context.

**Request:**
```json
{
  "messages": [
    { "role": "user", "content": "What are the requirements for company registration in Ghana?" }
  ]
}
```

**Response:**
```json
{
  "content": "According to the Companies Act 2019 (Act 992) of Ghana...",
  "sources": [
    "Companies Act 2019 (Ghana)",
    "Claude AI · African Legal Research"
  ]
}
```

### 2. Legal Library Search (`POST /api/ai/search-laws`)

Direct search endpoint (used internally by chat).

**Request:**
```json
{
  "query": "company registration",
  "country": "Ghana",
  "category": "Corporate Law",
  "limit": 5
}
```

**Response:**
```json
{
  "chunks": [
    {
      "lawId": "uuid",
      "title": "Companies Act 2019",
      "country": "Ghana",
      "category": "Corporate Law",
      "year": 2019,
      "content": "First 2000 chars of law content...",
      "fullContentLength": 50000
    }
  ],
  "total": 1
}
```

## Query Extraction Examples

The system automatically detects:

- **Countries**: Ghana, Kenya, Nigeria, South Africa, Tanzania, Uganda, Zambia, Zimbabwe, etc.
- **Categories**: Corporate Law, Tax Law, Labor/Employment Law, Intellectual Property, Data Protection, etc.

**Examples:**
- "Corporate law in Ghana" → searches Ghana + Corporate Law
- "What is the minimum wage in Kenya?" → searches Kenya + Labor/Employment Law
- "Tax requirements" → searches all countries, Tax Law category
- "Company registration" → searches all countries/categories, full-text search

## How to Improve RAG Results

### 1. Add More Laws to Database

More laws = better context for AI:
- Use admin panel: `/admin-panel/laws/add`
- Or import scripts: `scripts/import-pdf-law.mjs`

### 2. Improve Law Content Quality

- Use high-quality OCR for PDFs
- Clean up OCR errors
- Ensure `content` and `content_plain` fields are populated

### 3. Add Vector Embeddings (Future Enhancement)

For semantic similarity search:

1. Generate embeddings for law content using Claude's embedding API
2. Store in `law_embeddings` table
3. Use cosine similarity search instead of full-text search

## Testing RAG

1. **Add a law** via admin panel:
   - Country: Ghana
   - Category: Corporate Law
   - Upload a PDF with company registration requirements

2. **Ask AI**:
   - "What are the requirements for company registration in Ghana?"
   - Should reference the actual law you added

3. **Check sources**:
   - Response should list the law title in sources
   - Answer should be based on the law content

## Troubleshooting

### "No relevant laws found"

- Check that laws exist in database with `content` field populated
- Verify country/category names match exactly
- Try broader search (remove country/category filters)

### "AI doesn't cite the law"

- Ensure law content is in the database
- Check that search is returning results (see API logs)
- Law content might be too short or not relevant

### "Wrong country/category detected"

- Query extraction is heuristic-based
- Can be improved by adding more country/category mappings
- User can be more specific: "Corporate law in Ghana" vs "corporate"

## Future Enhancements

1. **Vector Embeddings**: Use pgvector for semantic similarity
2. **Chunking Strategy**: Split long laws into smaller chunks
3. **Re-ranking**: Use ML to re-rank search results
4. **Hybrid Search**: Combine full-text + vector search
5. **Query Expansion**: Expand user queries with synonyms
6. **Citation Links**: Link sources to actual law pages

## Performance

- Search is fast (<100ms) with GIN index
- Context size: ~10KB per query (5 laws × 2000 chars)
- Claude API handles context well up to 200K tokens
