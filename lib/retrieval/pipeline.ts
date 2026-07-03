import type { AiLegalLibrarySearchResult } from "@/lib/ai-legal-context-types";
import { lawCountryDisplayName } from "@/lib/law-source-display";
import { lawReadableBodyText } from "@/lib/law-readable-body";
import { pickContentExcerpt } from "@/lib/ai-law-excerpt";
import { isAiEmbeddingsEnabled } from "@/lib/embeddings/embedding-client";
import { lawEmbeddingsIndexReady, searchLawsByVectorSimilarity } from "@/lib/embeddings/vector-search";
import { hybridSearchChunks } from "@/lib/retrieval/hybrid-search";
import {
  type HybridChunkHit,
  hybridTopChunksFromEnv,
} from "@/lib/retrieval/hybrid-chunk-types";
import {
  understandLegalQuery,
  type QueryUnderstandingResult,
} from "@/lib/retrieval/query-understanding";
import { retrievalModeFromEnv, type RetrievalMode } from "@/lib/retrieval/retrieval-mode";
import { countryNameToIso2 } from "@/lib/retrieval/jurisdiction-codes";

const LAWS_VECTOR_SELECT =
  "id, title, content, content_plain, year, status, country_id, applies_to_all_countries, countries(name), categories!laws_category_id_fkey(name)";

export type RetrievalPipelineMetadata = {
  retrieval_mode: "vector" | "hybrid";
  query_understanding?: QueryUnderstandingResult;
  hybrid_chunk_count?: number;
  selected_chunk_count?: number;
  fallback_reason?: string;
};

function chunksToLegalContext(
  chunks: HybridChunkHit[],
  lawRows: Map<string, Record<string, unknown>>,
  rankTokens: string[]
): AiLegalLibrarySearchResult {
  const bestByLaw = new Map<string, { chunk: HybridChunkHit; score: number }>();

  for (const chunk of chunks) {
    const score = Math.round((chunk.rrf_score ?? 0) * 1000);
    const prev = bestByLaw.get(chunk.law_id);
    if (!prev || score > prev.score) {
      bestByLaw.set(chunk.law_id, { chunk, score });
    }
  }

  const out: AiLegalLibrarySearchResult = [];
  for (const [lawId, { chunk, score }] of bestByLaw.entries()) {
    const law = lawRows.get(lawId);
    if (!law) continue;
    const fullText = lawReadableBodyText(law as { content?: string; content_plain?: string });
    const excerpt =
      pickContentExcerpt(fullText, rankTokens, 12_000) ||
      chunk.chunk_text ||
      fullText.slice(0, 12_000);

    out.push({
      id: lawId,
      title: String(law.title ?? chunk.law_title ?? ""),
      country: lawCountryDisplayName(law as Parameters<typeof lawCountryDisplayName>[0]),
      category: String((law.categories as { name?: string } | null)?.name ?? chunk.domain ?? ""),
      status: String(law.status ?? "") || undefined,
      content: excerpt,
      year: typeof law.year === "number" ? law.year : undefined,
      retrievalScore: score,
    });
  }

  return out.sort((a, b) => (b.retrievalScore ?? 0) - (a.retrievalScore ?? 0));
}

/**
 * Chunk-level retrieval: query understanding → hybrid_search (RRF top-N) → law excerpts.
 * Falls back to legacy vector RPC when RETRIEVAL_MODE=vector.
 */
export async function runChunkRetrievalPipeline(options: {
  supabase: {
    from: (t: string) => unknown;
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  };
  userQuery: string;
  searchCountry?: string;
  countryId?: string | null;
  rankTokens?: string[];
  matchCount?: number;
  skipQueryUnderstanding?: boolean;
  forceMode?: RetrievalMode;
}): Promise<{ docs: AiLegalLibrarySearchResult; metadata: RetrievalPipelineMetadata }> {
  const mode = options.forceMode ?? retrievalModeFromEnv();
  const rankTokens = options.rankTokens ?? [];
  const topChunks = hybridTopChunksFromEnv();

  if (mode === "vector" || !isAiEmbeddingsEnabled()) {
    const docs = await searchLawsByVectorSimilarity(options.supabase, options.userQuery, {
      countryId: options.countryId ?? null,
      matchCount: options.matchCount ?? 24,
      rankTokens,
    });
    return { docs, metadata: { retrieval_mode: "vector" } };
  }

  const indexReady = await lawEmbeddingsIndexReady(options.supabase);
  if (!indexReady) {
    const docs = await searchLawsByVectorSimilarity(options.supabase, options.userQuery, {
      countryId: options.countryId ?? null,
      matchCount: options.matchCount ?? 24,
      rankTokens,
    });
    return {
      docs,
      metadata: { retrieval_mode: "vector", fallback_reason: "empty index" },
    };
  }

  let queryText = options.userQuery;
  let jurisdictionFilters: string[] | null = null;
  let domainFilter: string | null = null;
  let understandingResult: QueryUnderstandingResult | undefined;

  const understandingEnabled = process.env.AI_QUERY_UNDERSTANDING_ENABLED !== "0";
  if (understandingEnabled && !options.skipQueryUnderstanding) {
    understandingResult = await understandLegalQuery(options.userQuery, {
      countryHint: options.searchCountry ?? null,
    });
    if (understandingResult.ok) {
      queryText = understandingResult.understanding.rewritten_query || options.userQuery;
      jurisdictionFilters = understandingResult.understanding.jurisdiction_filters;
      domainFilter = understandingResult.understanding.legal_domain ?? null;
    }
  }

  if (!jurisdictionFilters?.length && options.searchCountry) {
    const iso = countryNameToIso2(options.searchCountry);
    if (iso) jurisdictionFilters = [iso];
  }

  let hybridChunks: HybridChunkHit[] = [];
  try {
    hybridChunks = await hybridSearchChunks(options.supabase, queryText, {
      matchCount: topChunks,
      jurisdictionFilters,
      domain: domainFilter,
    });
  } catch (err) {
    console.warn("[retrieval-pipeline] hybrid_search failed:", err);
    const docs = await searchLawsByVectorSimilarity(options.supabase, options.userQuery, {
      countryId: options.countryId ?? null,
      matchCount: options.matchCount ?? 24,
      rankTokens,
    });
    return {
      docs,
      metadata: {
        retrieval_mode: "vector",
        query_understanding: understandingResult,
        fallback_reason: "hybrid_search failed",
      },
    };
  }

  if (hybridChunks.length === 0) {
    const docs = await searchLawsByVectorSimilarity(options.supabase, options.userQuery, {
      countryId: options.countryId ?? null,
      matchCount: options.matchCount ?? 24,
      rankTokens,
    });
    return {
      docs,
      metadata: {
        retrieval_mode: "hybrid",
        query_understanding: understandingResult,
        hybrid_chunk_count: 0,
        fallback_reason: "no hybrid hits",
      },
    };
  }

  const selectedChunks = hybridChunks.slice(0, topChunks);

  const lawIds = [...new Set(selectedChunks.map((c) => c.law_id))];
  const { data: lawRows, error: lawErr } = await (options.supabase as any)
    .from("laws")
    .select(LAWS_VECTOR_SELECT)
    .in("id", lawIds)
    .neq("status", "Repealed");

  if (lawErr || !lawRows) {
    return { docs: [], metadata: { retrieval_mode: "hybrid", query_understanding: understandingResult } };
  }

  const lawById = new Map<string, Record<string, unknown>>();
  for (const row of lawRows as Record<string, unknown>[]) {
    lawById.set(String(row.id), row);
  }

  const docs = chunksToLegalContext(selectedChunks, lawById, rankTokens);

  return {
    docs,
    metadata: {
      retrieval_mode: "hybrid",
      query_understanding: understandingResult,
      hybrid_chunk_count: hybridChunks.length,
      selected_chunk_count: selectedChunks.length,
    },
  };
}
