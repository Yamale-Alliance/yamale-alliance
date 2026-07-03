import type { AiLegalLibrarySearchResult } from "@/lib/ai-legal-context-types";
import {
  embedQueryText,
  embeddingDimensionsForModel,
  embeddingModelFromEnv,
  isAiEmbeddingsEnabled,
} from "@/lib/embeddings/embedding-client";
import { chunkLawContent } from "@/lib/embeddings/chunking";
import {
  chunkLawMarkdownStructured,
  type StructuredChunkMeta,
} from "@/lib/embeddings/structured-chunking";
import { countryNameToIso2 } from "@/lib/retrieval/jurisdiction-codes";
import { lawCountryDisplayName } from "@/lib/law-source-display";
import { lawReadableBodyText } from "@/lib/law-readable-body";
import { pickContentExcerpt } from "@/lib/ai-law-excerpt";
import { selectInstrumentContentForReview } from "@/lib/ai-law-full-content";

const LAWS_VECTOR_SELECT =
  "id, title, content, content_plain, year, status, country_id, applies_to_all_countries, countries(name), categories!laws_category_id_fkey(name)";

type VectorMatchRow = {
  law_id: string;
  chunk_index: number;
  similarity: number;
  chunk_text: string;
  law_title: string;
};

/** Chunk readable law body for embedding storage (structure-aware when Markdown headings present). */
export function chunkLawForEmbedding(law: {
  title?: string | null;
  content?: string | null;
  content_plain?: string | null;
  country?: string | null;
  category?: string | null;
  language?: string | null;
}): Array<{
  index: number;
  text: string;
  breadcrumb?: string;
  jurisdiction?: string;
  domain?: string;
  article_ref?: string;
  language?: string;
}> {
  const body = lawReadableBodyText(law);
  if (!body) return [];
  const title = String(law.title ?? "").trim();
  const country = String(law.country ?? "").trim();
  const jurisdiction = countryNameToIso2(country) ?? undefined;
  const domain = String(law.category ?? "").trim() || undefined;
  const language = String(law.language ?? "").trim() || undefined;

  const hasStructure = /^#{1,6}\s+/m.test(body) || /^(?:Article|Art\.?|Chapter|Chapitre)\s+/im.test(body);
  if (hasStructure && country && title) {
    const meta: StructuredChunkMeta = {
      country,
      lawTitle: title,
      domain,
      language,
      jurisdiction,
    };
    return chunkLawMarkdownStructured(body, meta).map((c) => ({
      index: c.index,
      text: c.text,
      breadcrumb: c.breadcrumb,
      jurisdiction,
      domain,
      article_ref: c.articleRef,
      language,
    }));
  }

  const chunks = chunkLawContent(body, { maxChunkChars: 900, overlapChars: 100 });
  return chunks.map((c) => ({
    index: c.index,
    text: title ? `${title}\n\n${c.text}` : c.text,
    jurisdiction,
    domain,
    language,
  }));
}

export async function searchLawsByVectorSimilarity(
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> },
  query: string,
  options?: {
    countryId?: string | null;
    matchCount?: number;
    excerptMaxChars?: number;
    rankTokens?: string[];
  }
): Promise<AiLegalLibrarySearchResult> {
  if (!isAiEmbeddingsEnabled()) return [];

  const embedding = await embedQueryText(query);
  if (!embedding?.length) return [];

  const model = embeddingModelFromEnv();
  const expectedDims = embeddingDimensionsForModel(model);
  if (embedding.length !== expectedDims) {
    console.warn(
      `[vector-search] dimension mismatch: got ${embedding.length}, expected ${expectedDims} for ${model}`
    );
    return [];
  }

  const { data, error } = await supabase.rpc("match_law_embedding_chunks", {
    query_embedding: embedding,
    match_count: options?.matchCount ?? 24,
    filter_country_id: options?.countryId ?? null,
    filter_model: model,
  });

  if (error) {
    console.warn("[vector-search] rpc match_law_embedding_chunks:", error);
    return [];
  }

  const rows = (data ?? []) as VectorMatchRow[];
  if (rows.length === 0) return [];

  const bestByLaw = new Map<string, VectorMatchRow>();
  for (const row of rows) {
    const id = String(row.law_id);
    const prev = bestByLaw.get(id);
    if (!prev || row.similarity > prev.similarity) bestByLaw.set(id, row);
  }

  const lawIds = [...bestByLaw.keys()];
  const { data: lawRows, error: lawErr } = await (supabase as any)
    .from("laws")
    .select(LAWS_VECTOR_SELECT)
    .in("id", lawIds)
    .neq("status", "Repealed");

  if (lawErr || !lawRows) return [];

  const lawById = new Map<string, Record<string, unknown>>();
  for (const row of lawRows as Record<string, unknown>[]) {
    lawById.set(String(row.id), row);
  }

  const excerptMax = options?.excerptMaxChars ?? 12_000;
  const rankTokens = options?.rankTokens ?? [];
  const out: AiLegalLibrarySearchResult = [];

  for (const [lawId, match] of bestByLaw.entries()) {
    const law = lawById.get(lawId);
    if (!law) continue;
    const fullText = lawReadableBodyText(law as { content?: string; content_plain?: string });
    const content =
      rankTokens.length > 0
        ? selectInstrumentContentForReview(fullText, excerptMax, rankTokens, [])
        : pickContentExcerpt(fullText, rankTokens, excerptMax) || match.chunk_text;

    out.push({
      id: lawId,
      title: String(law.title ?? match.law_title ?? ""),
      country: lawCountryDisplayName(law as Parameters<typeof lawCountryDisplayName>[0]),
      category: String((law.categories as { name?: string } | null)?.name ?? ""),
      status: String(law.status ?? "") || undefined,
      content: content || match.chunk_text,
      year: typeof law.year === "number" ? law.year : undefined,
      retrievalScore: Math.round(match.similarity * 100),
    });
  }

  return out.sort((a, b) => (b.retrievalScore ?? 0) - (a.retrievalScore ?? 0));
}

/** True when the law_embeddings table has at least one row for the active model. */
let embeddingsIndexReadyCache: { model: string; ready: boolean; checkedAt: number } | null = null;
const EMBEDDINGS_INDEX_READY_TTL_MS = 60_000;

export async function lawEmbeddingsIndexReady(
  supabase: { from: (t: string) => unknown },
  model?: string
): Promise<boolean> {
  const activeModel = model ?? embeddingModelFromEnv();
  const now = Date.now();
  if (
    embeddingsIndexReadyCache &&
    embeddingsIndexReadyCache.model === activeModel &&
    now - embeddingsIndexReadyCache.checkedAt < EMBEDDINGS_INDEX_READY_TTL_MS
  ) {
    return embeddingsIndexReadyCache.ready;
  }

  try {
    const { count, error } = await (supabase as any)
      .from("law_embeddings")
      .select("id", { count: "exact", head: true })
      .eq("embedding_model", activeModel)
      .limit(1);
    const ready = !error && typeof count === "number" && count > 0;
    embeddingsIndexReadyCache = { model: activeModel, ready, checkedAt: now };
    return ready;
  } catch {
    embeddingsIndexReadyCache = { model: activeModel, ready: false, checkedAt: now };
    return false;
  }
}
