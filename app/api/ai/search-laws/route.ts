import { NextRequest, NextResponse } from "next/server";
import {
  escapeIlikePattern,
  lawTextIlikeOr,
  lawsCountryOrGlobalWithTextSearch,
} from "@/lib/law-country-scope";
import { getSupabaseServer } from "@/lib/supabase/server";
import { chunkLawContent } from "@/lib/embeddings/chunking";

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

/**
 * Semantic search in legal library for RAG
 * Searches laws by country, category, and text content
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, country, category, limit = 5 } = body as {
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
      const { data: countryRow } = await supabase
        .from("countries")
        .select("id")
        .eq("name", country.trim())
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
      categoryId = categoryRow?.id ?? null;
    }

    let lawsQuery = supabase
      .from("laws")
      .select(
        "id, title, content, content_plain, year, status, country_id, category_id, countries(name), categories(name)"
      )
      .not("content", "is", null)
      .neq("status", "Repealed")
      .limit(Math.min((limit || 5) * 8, 80)); // gather candidates, rank in-memory

    if (categoryId) lawsQuery = lawsQuery.eq("category_id", categoryId);

    const searchTerms = query.trim().toLowerCase();
    const escapedTerms = escapeIlikePattern(searchTerms);
    if (countryId) {
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

    const chunks = rankedLaws.slice(0, Math.min(limit || 5, 20)).map((law: any) => {
      const fullText = law.content_plain || law.content || "";
      const textChunks = chunkLawContent(fullText, { maxChunkChars: 800, overlapChars: 120 });
      let content = "";
      for (const c of textChunks) {
        if (content.length + c.text.length + 2 <= maxCharsPerLaw) {
          content += (content ? "\n\n" : "") + c.text;
        } else {
          const remaining = maxCharsPerLaw - content.length - 2;
          if (remaining > 100) content += "\n\n" + c.text.slice(0, remaining);
          break;
        }
      }
      if (!content) content = fullText.slice(0, maxCharsPerLaw);
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
