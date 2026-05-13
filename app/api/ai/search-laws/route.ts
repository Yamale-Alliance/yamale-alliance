import { NextRequest, NextResponse } from "next/server";
import {
  escapeIlikePattern,
  lawTextIlikeOr,
  lawsCountryGlobalOrScopedIds,
  lawsCountryOrGlobalWithTextSearch,
} from "@/lib/law-country-scope";
import { getSupabaseServer } from "@/lib/supabase/server";
import { fetchLawIdsForCategory } from "@/lib/law-categories-sync";
import { fetchLawIdsForCountryScope } from "@/lib/law-country-scope-ids";
import { chunkLawContent } from "@/lib/embeddings/chunking";
import { resolveUserCountryNameToDbName } from "@/lib/country-db-name-aliases";

function extractSearchTokens(query: string): string[] {
  const stopWords = new Set(["the", "and", "for", "with", "that", "this", "from", "law", "laws", "database"]);
  const unique = new Set(
    query
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 3 && !stopWords.has(t))
  );
  return Array.from(unique).slice(0, 8);
}

function isCountryCatalogLawRequest(query: string): boolean {
  const q = query.toLowerCase();
  if (!/\blaws?\b/.test(q)) return false;
  return (
    /\bwhat\s+laws?\s+do\s+you\s+have\b/.test(q) ||
    /\blist\s+(all\s+)?laws?\b/.test(q) ||
    /\bshow\s+(me\s+)?(all\s+)?laws?\b/.test(q) ||
    /\bwhich\s+laws?\s+(are|exist|do\s+you\s+have)\b/.test(q) ||
    /\blaws?\s+(in|about|for|from)\b/.test(q)
  );
}

/**
 * Semantic search in legal library for RAG
 * Searches laws by country, category, and text content
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, country, category, limit = 20 } = body as {
      query: string;
      country?: string;
      category?: string;
      limit?: number;
    };

    if (!query || typeof query !== "string" || !query.trim()) {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer() as any;

    // Resolve country/category names to IDs for reliable filtering
    let countryId: string | null = null;
    let categoryId: string | null = null;
    if (country?.trim()) {
      const dbName = resolveUserCountryNameToDbName(country.trim());
      const { data: countryRow } = await supabase
        .from("countries")
        .select("id")
        .eq("name", dbName)
        .limit(1)
        .maybeSingle();
      countryId = countryRow?.id ?? null;
    }
    if (category?.trim()) {
      const { data: categoryRow } = await supabase
        .from("categories")
        .select("id")
        .eq("name", category.trim())
        .limit(1)
        .maybeSingle();
      if (categoryRow?.id) {
        categoryId = categoryRow.id;
      } else {
        const { data: fuzzyCategoryRow } = await supabase
          .from("categories")
          .select("id")
          .ilike("name", `%${category.trim()}%`)
          .limit(1)
          .maybeSingle();
        categoryId = fuzzyCategoryRow?.id ?? null;
      }
    }

    let lawsQuery = supabase
      .from("laws")
      .select(
        "id, title, content, content_plain, year, status, country_id, category_id, countries(name), categories!laws_category_id_fkey(name)"
      )
      .not("content", "is", null)
      .neq("status", "Repealed")
      .limit(Math.min((limit || 20) * 10, 250)); // gather candidates, rank in-memory

    if (categoryId) {
      try {
        const ids = await fetchLawIdsForCategory(supabase, categoryId);
        if (ids.length === 0) {
          return NextResponse.json({ chunks: [], total: 0 });
        }
        lawsQuery = lawsQuery.in("id", ids);
      } catch {
        lawsQuery = lawsQuery.eq("category_id", categoryId);
      }
    }

    const searchTerms = query.trim().toLowerCase();
    const escapedTerms = escapeIlikePattern(searchTerms);
    const countryCatalogRequest = Boolean(countryId) && isCountryCatalogLawRequest(query);
    const scopedCountryLawIds = countryId ? await fetchLawIdsForCountryScope(supabase, countryId) : [];
    const countryScopeOr = countryId
      ? lawsCountryGlobalOrScopedIds(countryId, scopedCountryLawIds)
      : null;
    if (countryCatalogRequest && countryScopeOr) {
      lawsQuery = lawsQuery.or(countryScopeOr);
    } else if (countryId) {
      lawsQuery = lawsQuery.or(lawsCountryOrGlobalWithTextSearch(countryId, escapedTerms));
    } else {
      lawsQuery = lawsQuery.or(`or(${lawTextIlikeOr(escapedTerms)})`);
    }

    const { data: laws, error } = await lawsQuery;

    if (error) {
      console.error("Laws search error:", error);
      return NextResponse.json(
        { error: "Failed to search laws" },
        { status: 500 }
      );
    }

    // Use chunking strategy: paragraph/sentence-aware, then take first chunks per law (max 2000 chars)
    const maxCharsPerLaw = 2000;
    const tokens = extractSearchTokens(query);
    const rankedLaws = [...(laws || [])].sort((a: any, b: any) => {
      const titleA = String(a.title ?? "").toLowerCase();
      const titleB = String(b.title ?? "").toLowerCase();
      const contentA = String(a.content_plain ?? a.content ?? "").toLowerCase();
      const contentB = String(b.content_plain ?? b.content ?? "").toLowerCase();
      const score = (title: string, content: string) =>
        tokens.reduce((sum, token) => sum + (title.includes(token) ? 3 : 0) + (content.includes(token) ? 1 : 0), 0);
      return score(titleB, contentB) - score(titleA, contentA);
    });

    const perLawCap = countryCatalogRequest ? 900 : maxCharsPerLaw;
    const chunks = rankedLaws.slice(0, Math.min(limit || 20, 40)).map((law: any) => {
      const fullText = law.content_plain || law.content || "";
      const textChunks = chunkLawContent(fullText, { maxChunkChars: 800, overlapChars: 120 });
      let content = "";
      for (const c of textChunks) {
        if (content.length + c.text.length + 2 <= perLawCap) {
          content += (content ? "\n\n" : "") + c.text;
        } else {
          const remaining = perLawCap - content.length - 2;
          if (remaining > 100) content += "\n\n" + c.text.slice(0, remaining);
          break;
        }
      }
      if (!content) content = fullText.slice(0, perLawCap);
      return {
        lawId: law.id,
        title: law.title,
        country: law.countries?.name || "",
        category: law.categories?.name || "",
        year: law.year,
        status: law.status,
        content,
        fullContentLength: fullText.length,
      };
    });

    return NextResponse.json({
      chunks,
      total: chunks.length,
    });
  } catch (err) {
    console.error("Search laws API error:", err);
    return NextResponse.json(
      { error: "Failed to search laws" },
      { status: 500 }
    );
  }
}
