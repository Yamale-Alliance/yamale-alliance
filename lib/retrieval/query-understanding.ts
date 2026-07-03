import { z } from "zod";
import { jurisdictionFiltersForHybridSearch } from "@/lib/retrieval/jurisdiction-codes";

const QueryUnderstandingSchema = z.object({
  jurisdictions: z.array(z.string()).default([]),
  legal_domain: z.string().nullable().optional(),
  corpus_language: z.string().nullable().optional(),
  rewritten_query: z.string().min(1),
  references_specific_law: z.boolean().default(false),
  law_name_mentioned: z.string().nullable().optional(),
});

export type QueryUnderstanding = z.infer<typeof QueryUnderstandingSchema> & {
  jurisdiction_filters: string[] | null;
};

export type QueryUnderstandingResult = {
  ok: true;
  understanding: QueryUnderstanding;
  raw: Record<string, unknown>;
  model: string;
  latency_ms: number;
} | {
  ok: false;
  fallback_query: string;
  error?: string;
};

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

function buildJurisdictionFilters(jurisdictions: string[]): string[] | null {
  const codes = jurisdictions
    .map((j) => j?.trim().toUpperCase())
    .filter((j) => j && j !== "UNKNOWN");
  if (codes.length === 0) return null;

  const expanded = new Set<string>();
  for (const code of codes) {
    if (code === "OHADA") {
      expanded.add("OHADA");
      continue;
    }
    const filters = jurisdictionFiltersForHybridSearch(code);
    if (filters) filters.forEach((f) => expanded.add(f));
  }
  return expanded.size > 0 ? [...expanded] : null;
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1].trim() : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object in model response");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

/**
 * Haiku JSON query understanding — falls back to raw query on any failure.
 */
export async function understandLegalQuery(
  userQuery: string,
  options?: { countryHint?: string | null }
): Promise<QueryUnderstandingResult> {
  const started = Date.now();
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, fallback_query: userQuery, error: "ANTHROPIC_API_KEY missing" };
  }

  const model = process.env.AI_QUERY_UNDERSTANDING_MODEL?.trim() || DEFAULT_MODEL;
  const hint = options?.countryHint?.trim();

  const system = `You extract structured retrieval filters for an African legal library RAG system.
Respond with ONLY valid JSON (no markdown prose) matching this schema:
{
  "jurisdictions": ["ISO2 uppercase codes or OHADA or unknown"],
  "legal_domain": "short domain label or null",
  "corpus_language": "en|fr|pt|ar|unknown",
  "rewritten_query": "formal legal register query in corpus_language",
  "references_specific_law": true|false,
  "law_name_mentioned": "normalized statute name or null"
}
Rules:
- jurisdictions: ISO 3166-1 alpha-2 UPPERCASE for African countries; use ["unknown"] if unclear.
- If the user names an OHADA member state, include that ISO code (OHADA instruments are added separately).
- rewritten_query must stay in the corpus language of the primary jurisdiction.
- references_specific_law: true when the user names or clearly points at one statute/instrument (e.g. "Trade Marks Act", "Companies Act 2019", "Code du travail").
- law_name_mentioned: the canonical statute title phrase only (e.g. "Trade Marks Act", "Companies Act") — null if generic topic question.`;

  const user = hint
    ? `Country hint: ${hint}\n\nUser question:\n${userQuery}`
    : `User question:\n${userQuery}`;

  try {
    const res = await fetch(CLAUDE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 300,
        temperature: 0,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        ok: false,
        fallback_query: userQuery,
        error: `Anthropic ${res.status}: ${errText.slice(0, 200)}`,
      };
    }

    const json = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = json.content?.find((c) => c.type === "text")?.text ?? "";
    const parsed = QueryUnderstandingSchema.parse(extractJsonObject(text));

    const jurisdiction_filters = buildJurisdictionFilters(parsed.jurisdictions);

    const understanding: QueryUnderstanding = {
      ...parsed,
      jurisdiction_filters,
    };

    return {
      ok: true,
      understanding,
      raw: parsed as unknown as Record<string, unknown>,
      model,
      latency_ms: Date.now() - started,
    };
  } catch (err) {
    return {
      ok: false,
      fallback_query: userQuery,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
