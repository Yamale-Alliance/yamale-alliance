import type { AiLegalLibrarySearchResult } from "@/lib/ai-legal-context-types";
import {
  crossLanguageRetrievalTokens,
  englishLibraryTokensFromFrenchQuery,
} from "@/lib/ai-query-language-parity";
import { mergeLegalContextDeduped } from "@/lib/ai-prompt-budget";
import { isAiEmbeddingsEnabled } from "@/lib/embeddings/embedding-client";
import { lawEmbeddingsIndexReady, searchLawsByVectorSimilarity } from "@/lib/embeddings/vector-search";
import { ohadaUniformActRetrievalAliases } from "@/lib/ohada-uniform-act-catalog";
import {
  fetchOhadaCommercialCompaniesInstrumentLaws,
  isLikelyOhadaCommercialCompaniesLaw,
  isOffTopicForOhadaCommercialCompanies,
  isOhadaCommercialCompaniesQuery,
  isOhadaInstrument,
} from "@/lib/ohada-commercial-companies-retrieval";
import { lawCountryDisplayName } from "@/lib/law-source-display";
import { selectInstrumentContentForReview } from "@/lib/ai-law-full-content";
import { normalizeSearchQueryForAi } from "@/lib/ai-library-search-intent";
import { tokenizeLibrarySearchQuery } from "@/lib/ai-multilingual-search";

export type OrchestratedRetrievalPass = "lexical_primary" | "vector_hybrid" | "expanded_lexical" | "ohada_instrument";

export type OrchestratedRetrievalResult = {
  docs: AiLegalLibrarySearchResult;
  passes: OrchestratedRetrievalPass[];
};

type OrchestrateOptions = {
  userQuery: string;
  searchCountry?: string;
  countryId?: string | null;
  detailedMode?: boolean;
  supabase: { from: (t: string) => unknown; rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> };
  lexicalSearch: (query: string, country?: string) => Promise<AiLegalLibrarySearchResult>;
  quickFallback: (query: string, country?: string) => Promise<AiLegalLibrarySearchResult>;
  maxInternalPasses?: number;
};

function topRetrievalScore(docs: AiLegalLibrarySearchResult): number {
  if (docs.length === 0) return 0;
  return Math.max(...docs.map((d) => d.retrievalScore ?? 0));
}

/** Heuristic: primary lexical pass already found strong matches — vector adds latency/noise. */
export function lexicalRetrievalStrong(docs: AiLegalLibrarySearchResult): boolean {
  if (docs.length === 0) return false;
  const top = topRetrievalScore(docs);
  if (top >= 50) return true;
  if (docs.length >= 2 && top >= 35) return true;
  return false;
}

/** Heuristic: first lexical pass did not surface strong matches — run internal follow-up searches. */
export function needsExpandedRetrievalPass(docs: AiLegalLibrarySearchResult): boolean {
  if (lexicalRetrievalStrong(docs)) return false;
  if (docs.length === 0) return true;
  const top = topRetrievalScore(docs);
  if (top < 28) return true;
  if (docs.length < 2 && top < 45) return true;
  return false;
}

function buildExpandedRetrievalQuery(userQuery: string): string | null {
  const tokens = new Set<string>([
    ...crossLanguageRetrievalTokens(userQuery),
    ...englishLibraryTokensFromFrenchQuery(userQuery),
    ...ohadaUniformActRetrievalAliases(userQuery),
  ]);
  const list = [...tokens].filter((t) => t.length >= 3).slice(0, 14);
  if (list.length < 2) return null;
  return list.join(" ");
}

function mapOhadaRowsToLegalContext(rows: unknown[], userQuery: string): AiLegalLibrarySearchResult {
  const rankTokens = tokenizeLibrarySearchQuery(normalizeSearchQueryForAi(userQuery), 12);
  const out: AiLegalLibrarySearchResult = [];
  for (const row of rows as Array<Record<string, unknown>>) {
    const id = String(row.id ?? "");
    if (!id) continue;
    const fullText = String(row.content_plain ?? row.content ?? "");
    out.push({
      id,
      title: String(row.title ?? ""),
      country: lawCountryDisplayName(row as Parameters<typeof lawCountryDisplayName>[0]),
      category: String((row.categories as { name?: string } | null)?.name ?? ""),
      status: String(row.status ?? "") || undefined,
      content: selectInstrumentContentForReview(fullText, 14_000, rankTokens, []),
      year: typeof row.year === "number" ? row.year : undefined,
      retrievalScore: 88,
    });
  }
  return out;
}

function filterVectorHitsForQuery(
  userQuery: string,
  hits: AiLegalLibrarySearchResult
): AiLegalLibrarySearchResult {
  if (!isOhadaCommercialCompaniesQuery(userQuery)) return hits;
  return hits.filter((doc) => {
    const law = { title: doc.title, categories: { name: doc.category } };
    if (isLikelyOhadaCommercialCompaniesLaw(law)) return true;
    if (!isOhadaInstrument({ title: doc.title })) return false;
    return !isOffTopicForOhadaCommercialCompanies(law);
  });
}

function shouldAwaitVectorMerge(
  userQuery: string,
  lexicalDocs: AiLegalLibrarySearchResult
): boolean {
  if (lexicalRetrievalStrong(lexicalDocs)) return false;
  if (
    isOhadaCommercialCompaniesQuery(userQuery) &&
    lexicalDocs.some((doc) =>
      isLikelyOhadaCommercialCompaniesLaw({ title: doc.title, categories: { name: doc.category } })
    )
  ) {
    return false;
  }
  return true;
}

/**
 * One billed user query → up to 3 internal retrieval passes (lexical, vector, expanded/OHADA).
 * All passes share the same user turn; query_count increments once in the chat route.
 */
export async function orchestrateLegalLibrarySearch(
  options: OrchestrateOptions
): Promise<OrchestratedRetrievalResult> {
  const maxPasses = Math.min(3, Math.max(1, options.maxInternalPasses ?? 3));
  const passes: OrchestratedRetrievalPass[] = [];
  const rankTokens = tokenizeLibrarySearchQuery(normalizeSearchQueryForAi(options.userQuery), 12);

  const vectorEligible =
    maxPasses >= 2 && isAiEmbeddingsEnabled() && (await lawEmbeddingsIndexReady(options.supabase));

  // Pass 1 (+ optional 2) — start vector alongside lexical; skip awaiting vector when lexical is already strong.
  const lexicalPromise = options.lexicalSearch(options.userQuery, options.searchCountry);
  const vectorPromise = vectorEligible
    ? searchLawsByVectorSimilarity(options.supabase, options.userQuery, {
        countryId: options.countryId ?? null,
        matchCount: 12,
        rankTokens,
      })
    : null;

  const lexicalDocs = await lexicalPromise;
  let docs = lexicalDocs;
  passes.push("lexical_primary");

  let rawVectorHits: AiLegalLibrarySearchResult = [];
  if (vectorPromise) {
    if (shouldAwaitVectorMerge(options.userQuery, lexicalDocs)) {
      rawVectorHits = await vectorPromise;
    } else {
      void vectorPromise.catch(() => {});
    }
  }

  if (rawVectorHits.length > 0) {
    const vectorHits = filterVectorHitsForQuery(options.userQuery, rawVectorHits);
    if (vectorHits.length > 0) {
      passes.push("vector_hybrid");
      docs = mergeLegalContextDeduped(docs, vectorHits) as AiLegalLibrarySearchResult;
    }
  }

  // Pass 3 — expanded lexical + OHADA instrument fetch when recall still looks weak.
  if (maxPasses >= 3 && needsExpandedRetrievalPass(docs)) {
    const expandedQuery = buildExpandedRetrievalQuery(options.userQuery);
    if (expandedQuery) {
      const expandedHits = await options.lexicalSearch(expandedQuery, options.searchCountry);
      if (expandedHits.length > 0) {
        passes.push("expanded_lexical");
        docs = mergeLegalContextDeduped(docs, expandedHits) as AiLegalLibrarySearchResult;
      }
    }

    if (isOhadaCommercialCompaniesQuery(options.userQuery)) {
      const ohadaRows = await fetchOhadaCommercialCompaniesInstrumentLaws(options.supabase, {
        excludeIds: new Set(docs.map((d) => d.id)),
        maxLaws: 4,
      });
      const ohadaDocs = mapOhadaRowsToLegalContext(ohadaRows, options.userQuery);
      if (ohadaDocs.length > 0) {
        passes.push("ohada_instrument");
        docs = mergeLegalContextDeduped(docs, ohadaDocs) as AiLegalLibrarySearchResult;
      }
    }

    if (docs.length === 0) {
      const fallback = await options.quickFallback(options.userQuery, options.searchCountry);
      if (fallback.length > 0) {
        docs = mergeLegalContextDeduped(docs, fallback) as AiLegalLibrarySearchResult;
      }
    }
  }

  return { docs, passes };
}
