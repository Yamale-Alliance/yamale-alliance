/**
 * Optional Claude call to infer title, jurisdiction, and legal category from law text excerpt.
 * Requires CLAUDE_API_KEY. Returns null if unavailable or parsing fails.
 */

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const DEFAULT_IMPORT_MODEL = "claude-haiku-4-5";
const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";

export type CountryOpt = { id: string; name: string };
export type CategoryOpt = { id: string; name: string };

export type ClaudeLawMetadataResult = {
  title: string;
  countryId: string | null;
  categoryId: string | null;
  year: number | null;
};

export function isClaudeConfiguredForImport(): boolean {
  return Boolean(CLAUDE_API_KEY && !CLAUDE_API_KEY.includes("...") && CLAUDE_API_KEY.length > 20);
}

/**
 * Ask Claude to pick country/category IDs from allowed lists and suggest a short title.
 * Excerpt should already have TOC removed.
 */
export async function extractLawMetadataWithClaude(
  excerpt: string,
  sourceUrl: string,
  countries: CountryOpt[],
  categories: CategoryOpt[]
): Promise<ClaudeLawMetadataResult | null> {
  if (!isClaudeConfiguredForImport()) return null;

  const excerptTrim = excerpt.slice(0, 14_000);
  const countryLines = countries.map((c) => `- "${c.name}" → id: ${c.id}`).join("\n");
  const categoryLines = categories.map((c) => `- "${c.name}" → id: ${c.id}`).join("\n");

  const prompt = `You are helping import a legal statute into a library. The text below is an excerpt from a PDF (table of contents already removed). The source URL is: ${sourceUrl}

Return a SINGLE JSON object only, no markdown, with these keys:
- "title": string, a concise official-style title for the law (max 200 chars)
- "countryId": string or null — MUST be exactly one of the country ids listed below, or null if unclear
- "categoryId": string or null — MUST be exactly one of the category ids listed below, or null if unclear  
- "year": number or null — enactment or revision year if clearly stated near the start, else null

Countries (use id values exactly):
${countryLines}

Categories (use id values exactly):
${categoryLines}

Excerpt:
---
${excerptTrim}
---

JSON only:`;

  try {
    const res = await fetch(CLAUDE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CLAUDE_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.CLAUDE_MODEL || DEFAULT_IMPORT_MODEL,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) {
      console.error("Claude law metadata:", res.status, await res.text());
      return null;
    }
    const json = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = json.content?.find((c) => c.type === "text")?.text?.trim() ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as {
      title?: string;
      countryId?: string | null;
      categoryId?: string | null;
      year?: number | null;
    };
    const title = typeof parsed.title === "string" ? parsed.title.trim().slice(0, 500) : "";
    if (!title) return null;

    const countryIds = new Set(countries.map((c) => c.id));
    const categoryIds = new Set(categories.map((c) => c.id));
    const countryId =
      countryIds.has(parsed.countryId as string) ? (parsed.countryId as string) : null;
    const categoryId =
      categoryIds.has(parsed.categoryId as string) ? (parsed.categoryId as string) : null;
    let year: number | null =
      typeof parsed.year === "number" && parsed.year >= 1900 && parsed.year <= 2100
        ? parsed.year
        : null;

    return { title, countryId, categoryId, year };
  } catch (e) {
    console.error("extractLawMetadataWithClaude:", e);
    return null;
  }
}
