import {
  embedQueryText,
  embeddingDimensionsForModel,
  embeddingModelFromEnv,
  isAiEmbeddingsEnabled,
} from "@/lib/embeddings/embedding-client";
import type { HybridChunkHit } from "@/lib/retrieval/hybrid-chunk-types";

type HybridSearchRow = {
  law_id: string;
  chunk_index: number;
  chunk_text: string;
  breadcrumb: string | null;
  jurisdiction: string | null;
  domain: string | null;
  article_ref: string | null;
  language: string | null;
  law_title: string | null;
  vector_score: number | null;
  fts_score: number | null;
  rrf_score: number | null;
  embedding_model: string | null;
};

export async function hybridSearchChunks(
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> },
  queryText: string,
  options?: {
    matchCount?: number;
    jurisdictionFilters?: string[] | null;
    domain?: string | null;
    filterLawId?: string | null;
    queryLanguage?: string | null;
  }
): Promise<HybridChunkHit[]> {
  if (!isAiEmbeddingsEnabled()) return [];

  const embedding = await embedQueryText(queryText);
  if (!embedding?.length) return [];

  const model = embeddingModelFromEnv();
  const expectedDims = embeddingDimensionsForModel(model);
  if (embedding.length !== expectedDims) {
    console.warn(
      `[hybrid-search] dimension mismatch: got ${embedding.length}, expected ${expectedDims}`
    );
    return [];
  }

  const { data, error } = await supabase.rpc("hybrid_search", {
    query_text: queryText,
    query_embedding: embedding,
    match_count: options?.matchCount ?? 40,
    filter_jurisdictions: options?.jurisdictionFilters ?? null,
    filter_domain: options?.domain ?? null,
    filter_model: model,
    filter_law_id: options?.filterLawId ?? null,
    query_language: options?.queryLanguage ?? null,
  });

  if (error) {
    console.warn("[hybrid-search] rpc hybrid_search:", error);
    return [];
  }

  return ((data ?? []) as HybridSearchRow[]).map((row) => ({
    law_id: String(row.law_id),
    chunk_index: Number(row.chunk_index),
    chunk_text: String(row.chunk_text ?? ""),
    breadcrumb: row.breadcrumb ?? null,
    jurisdiction: row.jurisdiction ?? null,
    domain: row.domain ?? null,
    article_ref: row.article_ref ?? null,
    language: row.language ?? null,
    law_title: row.law_title ?? null,
    vector_score: row.vector_score ?? null,
    fts_score: row.fts_score ?? null,
    rrf_score: Number(row.rrf_score ?? 0),
    embedding_model: row.embedding_model ?? null,
  }));
}
