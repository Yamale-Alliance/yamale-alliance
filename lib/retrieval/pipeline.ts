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
import {
  resolveLawByTitle,
  shouldScopeRetrievalToResolvedLaw,
  type LawResolverResult,
} from "@/lib/retrieval/law-resolver";
import { mergeChunkHitsRrf } from "@/lib/retrieval/merge-chunk-hits";
import {
  assessRetrievalConfidence,
  logRetrievalNotFound,
  type RetrievalConfidenceAssessment,
} from "@/lib/retrieval/absence-guard";
import { applyLawRagApprovalFilter } from "@/lib/law-rag-approval";

const LAWS_VECTOR_SELECT =
  "id, title, content, content_plain, year, status, country_id, applies_to_all_countries, countries(name), categories!laws_category_id_fkey(name)";

export type RetrievalPipelineMetadata = {
  retrieval_mode: "vector" | "hybrid";
  query_understanding?: QueryUnderstandingResult;
  law_resolver?: LawResolverResult;
  scoped_law_id?: string | null;
  confidence?: RetrievalConfidenceAssessment;
  absence_guard_fired?: boolean;
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

async function fetchLawRows(
  supabase: { from: (t: string) => unknown },
  lawIds: string[]
): Promise<Map<string, Record<string, unknown>>> {
  if (lawIds.length === 0) return new Map();
  const lawQuery = (supabase as any)
    .from("laws")
    .select(LAWS_VECTOR_SELECT)
    .in("id", lawIds)
    .neq("status", "Repealed");
  const { data: lawRows, error: lawErr } = await applyLawRagApprovalFilter(lawQuery);

  if (lawErr || !lawRows) return new Map();

  const lawById = new Map<string, Record<string, unknown>>();
  for (const row of lawRows as Record<string, unknown>[]) {
    lawById.set(String(row.id), row);
  }
  return lawById;
}

async function runHybridPasses(
  supabase: Parameters<typeof hybridSearchChunks>[0],
  queryText: string,
  options: {
    topChunks: number;
    jurisdictionFilters: string[] | null;
    domainFilter: string | null;
    queryLanguage: string | null;
    scopedLawId?: string | null;
  }
): Promise<HybridChunkHit[]> {
  const globalPromise = hybridSearchChunks(supabase, queryText, {
    matchCount: options.topChunks,
    jurisdictionFilters: options.jurisdictionFilters,
    domain: options.domainFilter,
    queryLanguage: options.queryLanguage,
  });

  if (!options.scopedLawId) {
    return globalPromise;
  }

  const scopedPromise = hybridSearchChunks(supabase, queryText, {
    matchCount: options.topChunks,
    jurisdictionFilters: options.jurisdictionFilters,
    domain: options.domainFilter,
    queryLanguage: options.queryLanguage,
    filterLawId: options.scopedLawId,
  });

  const [globalHits, scopedHits] = await Promise.all([globalPromise, scopedPromise]);
  return mergeChunkHitsRrf([scopedHits, globalHits], { maxResults: options.topChunks });
}

/**
 * Chunk-level retrieval: understanding → law resolver → scoped+global hybrid_search → absence guard.
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
  skipAbsenceGuard?: boolean;
  forceMode?: RetrievalMode;
}): Promise<{ docs: AiLegalLibrarySearchResult; metadata: RetrievalPipelineMetadata }> {
  const mode = options.forceMode ?? retrievalModeFromEnv();
  const rankTokens = options.rankTokens ?? [];
  const topChunks = hybridTopChunksFromEnv();
  const jurisdictionIso = options.searchCountry ? countryNameToIso2(options.searchCountry) : null;

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
  let queryLanguage: string | null = null;
  let understandingResult: QueryUnderstandingResult | undefined;
  let lawResolverResult: LawResolverResult | undefined;
  let scopedLawId: string | null = null;

  const understandingEnabled = process.env.AI_QUERY_UNDERSTANDING_ENABLED !== "0";
  if (understandingEnabled && !options.skipQueryUnderstanding) {
    understandingResult = await understandLegalQuery(options.userQuery, {
      countryHint: options.searchCountry ?? null,
    });
    if (understandingResult.ok) {
      queryText = understandingResult.understanding.rewritten_query || options.userQuery;
      jurisdictionFilters = understandingResult.understanding.jurisdiction_filters;
      domainFilter = understandingResult.understanding.legal_domain ?? null;
      queryLanguage = understandingResult.understanding.corpus_language ?? null;

      if (
        understandingResult.understanding.references_specific_law &&
        understandingResult.understanding.law_name_mentioned?.trim()
      ) {
        lawResolverResult = await resolveLawByTitle(
          options.supabase,
          understandingResult.understanding.law_name_mentioned,
          { countryId: options.countryId ?? null, jurisdictionIso }
        );
        if (shouldScopeRetrievalToResolvedLaw(lawResolverResult.top_hit)) {
          scopedLawId = lawResolverResult.top_hit.law_id;
        }
      }
    }
  }

  if (!jurisdictionFilters?.length && options.searchCountry) {
    const iso = countryNameToIso2(options.searchCountry);
    if (iso) jurisdictionFilters = [iso];
  }

  let hybridChunks: HybridChunkHit[] = [];
  try {
    hybridChunks = await runHybridPasses(options.supabase, queryText, {
      topChunks,
      jurisdictionFilters,
      domainFilter,
      queryLanguage,
      scopedLawId,
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
        law_resolver: lawResolverResult,
        scoped_law_id: scopedLawId,
        fallback_reason: "hybrid_search failed",
      },
    };
  }

  let confidence = assessRetrievalConfidence(hybridChunks);
  let absenceGuardFired = false;

  if (
    !options.skipAbsenceGuard &&
    confidence.low_confidence &&
    process.env.RETRIEVAL_ABSENCE_GUARD_ENABLED !== "0"
  ) {
    absenceGuardFired = true;
    const fallbackName =
      (understandingResult?.ok && understandingResult.understanding.law_name_mentioned) ||
      options.userQuery;

    const fallbackResolver = await resolveLawByTitle(options.supabase, fallbackName, {
      countryId: options.countryId ?? null,
      jurisdictionIso,
    });

    lawResolverResult = lawResolverResult ?? fallbackResolver;

    let resolvedConfidently = false;

    if (shouldScopeRetrievalToResolvedLaw(fallbackResolver.top_hit)) {
      resolvedConfidently = true;
    }

    if (resolvedConfidently && fallbackResolver.top_hit && !scopedLawId) {
      scopedLawId = fallbackResolver.top_hit.law_id;
      try {
        const retryChunks = await runHybridPasses(options.supabase, queryText, {
          topChunks,
          jurisdictionFilters,
          domainFilter,
          queryLanguage,
          scopedLawId,
        });
        if (retryChunks.length > 0) {
          hybridChunks = retryChunks;
          confidence = assessRetrievalConfidence(hybridChunks);
        }
      } catch {
        // keep original chunks
      }
    }

    if (!resolvedConfidently) {
      await logRetrievalNotFound(options.supabase, {
        query: options.userQuery,
        jurisdiction: jurisdictionIso ?? options.searchCountry ?? null,
        interpreted_law_name: fallbackName,
        resolver_results: fallbackResolver.hits,
      });
    }
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
        law_resolver: lawResolverResult,
        scoped_law_id: scopedLawId,
        confidence,
        absence_guard_fired: absenceGuardFired,
        hybrid_chunk_count: 0,
        fallback_reason: "no hybrid hits",
      },
    };
  }

  const selectedChunks = hybridChunks.slice(0, topChunks);
  const lawIds = [...new Set(selectedChunks.map((c) => c.law_id))];
  const lawById = await fetchLawRows(options.supabase, lawIds);
  const docs = chunksToLegalContext(selectedChunks, lawById, rankTokens);

  return {
    docs,
    metadata: {
      retrieval_mode: "hybrid",
      query_understanding: understandingResult,
      law_resolver: lawResolverResult,
      scoped_law_id: scopedLawId,
      confidence,
      absence_guard_fired: absenceGuardFired,
      hybrid_chunk_count: hybridChunks.length,
      selected_chunk_count: selectedChunks.length,
    },
  };
}
