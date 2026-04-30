import { NextRequest, NextResponse } from "next/server";
import {
  escapeIlikePattern,
  lawsCountryOrGlobalWithTextSearch,
  lawsOrGlobalForCountry,
} from "@/lib/law-country-scope";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import {
  getAiUsage,
  getAiQueryLimitForTier,
  incrementAiUsage,
  getCurrentMonthKey,
} from "@/lib/ai-usage";
import { hasUnusedPayAsYouGo, consumePayAsYouGoPurchase } from "@/lib/pay-as-you-go";

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL_ENV = process.env.CLAUDE_MODEL;
const MODELS_URL = "https://api.anthropic.com/v1/models";

if (!CLAUDE_API_KEY) {
  console.warn("CLAUDE_API_KEY not set - AI chat will not work");
}

/** Cached models list; refreshed on 404. */
let cachedModels: Array<{ id: string }> | null = null;

async function fetchModels(): Promise<Array<{ id: string }>> {
  if (cachedModels?.length) return cachedModels;
  const res = await fetch(MODELS_URL, {
    headers: {
      "x-api-key": CLAUDE_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
  });
  if (!res.ok) throw new Error(`Models list failed: ${res.status}`);
  const json = (await res.json()) as { data?: Array<{ id: string }> };
  const list = json.data ?? [];
  cachedModels = list;
  return list;
}

/** Basic: Haiku and below. Pro: Sonnet and below. Team: all. */
function getAllowedModelIdsForTier(models: Array<{ id: string }>, tier: string): string[] {
  const id = (m: { id: string }) => m.id.toLowerCase();
  if (tier === "team") return models.map((m) => m.id);
  if (tier === "pro") return models.filter((m) => id(m).includes("sonnet") || id(m).includes("haiku")).map((m) => m.id);
  return models.filter((m) => id(m).includes("haiku")).map((m) => m.id);
}

/**
 * Resolve model id for the chat request.
 * Basic: Haiku 4.5 and below. Pro: Sonnet 4.5 and below. Team: all models.
 */
async function resolveModelIdForRequest(
  tier: string,
  requestedModel?: string | null
): Promise<string> {
  if (CLAUDE_MODEL_ENV) return CLAUDE_MODEL_ENV;

  const models = await fetchModels();
  const allowedIds = getAllowedModelIdsForTier(models, tier);
  const sonnet = models.find((m) => m.id.toLowerCase().includes("sonnet"));
  const haiku = models.find((m) => m.id.toLowerCase().includes("haiku"));
  const defaultId =
    tier === "team"
      ? sonnet?.id ?? haiku?.id ?? models[0]?.id
      : tier === "pro"
        ? (allowedIds.includes(sonnet?.id ?? "") ? sonnet?.id : allowedIds[0])
        : allowedIds[0];
  const fallback = defaultId ?? sonnet?.id ?? haiku?.id ?? models[0]?.id ?? "claude-3-5-sonnet-20241022";

  if (requestedModel?.trim() && allowedIds.includes(requestedModel.trim())) {
    return requestedModel.trim();
  }
  return fallback ?? "claude-3-5-sonnet-20241022";
}

function clearModelCache() {
  cachedModels = null;
}

type ClaudeMessageContent = {
  type: string;
  text?: string;
  source?: {
    type: string;
    data: string;
    media_type: string;
  };
};

type ClaudeMessage = {
  role: "user" | "assistant";
  content: ClaudeMessageContent[];
};

/**
 * Extract country and category hints from user query
 */
function extractQueryHints(query: string): { country?: string; category?: string } {
  const lowerQuery = query.toLowerCase();
  
  // Common countries (check for full names first, then partial matches)
  const countryMap: Record<string, string> = {
    "ghana": "Ghana",
    "kenya": "Kenya",
    "tunisia": "Tunisia",
    "nigeria": "Nigeria",
    "south africa": "South Africa",
    "tanzania": "Tanzania",
    "uganda": "Uganda",
    "zambia": "Zambia",
    "zimbabwe": "Zimbabwe",
    "botswana": "Botswana",
    "namibia": "Namibia",
    "mozambique": "Mozambique",
    "angola": "Angola",
    "ethiopia": "Ethiopia",
    "rwanda": "Rwanda",
    "senegal": "Senegal",
    "madagascar": "Madagascar",
    "mali": "Mali",
    "sierra leone": "Sierra Leone",
    "togo": "Togo",
    "liberia": "Liberia",
    // After "nigeria" so queries mentioning Nigeria do not match the "niger" substring first
    "niger": "Niger",
  };
  
  let foundCountry: string | undefined;
  for (const [key, value] of Object.entries(countryMap)) {
    if (lowerQuery.includes(key)) {
      foundCountry = value;
      break;
    }
  }
  
  // Category mapping (specific phrases first; avoid broad substring collisions
  // like "trademark" matching "trade").
  const categoryMap: Record<string, string> = {
    "trademark": "Intellectual Property Law",
    "trademarks": "Intellectual Property Law",
    "mark registration": "Intellectual Property Law",
    "industrial property": "Intellectual Property Law",
    "patent": "Intellectual Property Law",
    "copyright": "Intellectual Property Law",
    "corporate law": "Corporate Law",
    "corporate": "Corporate Law",
    "sociétés commerciales": "Corporate Law",
    "loi sur les sociétés": "Corporate Law",
    "tax law": "Tax Law",
    "tax": "Tax Law",
    "labor law": "Labor/Employment Law",
    "employment law": "Labor/Employment Law",
    "labor": "Labor/Employment Law",
    "employment": "Labor/Employment Law",
    "intellectual property": "Intellectual Property Law",
    "ip law": "Intellectual Property Law",
    "data protection": "Data Protection and Privacy Law",
    "privacy": "Data Protection and Privacy Law",
    "international trade": "International Trade Laws",
    "rules of origin": "International Trade Laws",
    "afcfta": "International Trade Laws",
    "anti-bribery": "Anti-Bribery and Corruption Law",
    "corruption": "Anti-Bribery and Corruption Law",
    "dispute resolution": "Dispute Resolution",
    "environmental": "Environmental",
  };
  
  let foundCategory: string | undefined;
  const orderedCategoryEntries = Object.entries(categoryMap).sort((a, b) => b[0].length - a[0].length);
  for (const [key, value] of orderedCategoryEntries) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${escaped}\\b`, "i");
    if (re.test(lowerQuery)) {
      foundCategory = value;
      break;
    }
  }
  
  return {
    country: foundCountry,
    category: foundCategory,
  };
}

function extractHintsFromConversation(
  messages: Array<{ role: "user" | "assistant"; content: string }>
): { country?: string; category?: string } {
  let country: string | undefined;
  let category: string | undefined;
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (!msg?.content?.trim()) continue;
    const hints = extractQueryHints(msg.content);
    if (!country && hints.country) country = hints.country;
    if (!category && hints.category) category = hints.category;
    if (country && category) break;
  }
  return { country, category };
}

/**
 * Heuristic: is the query likely about a specific law or legal framework?
 * Used to decide when to ask the user to specify a country if none was detected.
 */
function isLikelyLegalQuestion(query: string): boolean {
  const q = query.toLowerCase();
  return /\blaw\b|\bcode\b|\bact\b|\bregulation\b|\bstatute\b|\bordonnance\b|\bproclamation\b|\bcorporate governance\b|\bcompanies act\b/.test(
    q
  );
}

function isDetailedRequest(query: string): boolean {
  const q = query.toLowerCase();
  return (
    q.includes("detailed") ||
    q.includes("more information") ||
    q.includes("more detail") ||
    q.includes("full details") ||
    q.includes("explain in detail") ||
    q.includes("article by article") ||
    q.includes("section by section")
  );
}

function extractSpecificLawHint(query: string): string | null {
  const looksLikeNamedLawTitle = (value: string): boolean => {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return false;

    // Generic category-level prompts should not collapse retrieval to a single law.
    const genericCategoryLawPattern =
      /\b(corporate|tax|labou?r|employment|trade|customs|privacy|data protection|intellectual property|environmental|criminal|civil)\s+laws?\b/i;
    if (genericCategoryLawPattern.test(normalized)) return false;
    if (/\blaws?\s+in\s+[a-z]/i.test(normalized)) return false;
    if (/\blaws?\s+of\s+[a-z]/i.test(normalized)) return false;

    // Treat as specific only when it resembles a named instrument.
    return /\b(act|code|regulation|regulations|decree|ordinance|order|proclamation|constitution|bill)\b/i.test(value);
  };

  const q = query.trim().toLowerCase();
  if (!q) return null;
  const patterns = [
    /more info on this\s+(.+)/i,
    /more information on this\s+(.+)/i,
    /more info on\s+(.+)/i,
    /more information on\s+(.+)/i,
    /tell me more about\s+(.+)/i,
    /give me more info on\s+(.+)/i,
  ];
  for (const p of patterns) {
    const m = query.match(p);
    if (m?.[1]?.trim()) {
      let v = m[1].trim();
      v = v.replace(/\s+from\s+[a-z\s'-]+$/i, "").trim();
      if (looksLikeNamedLawTitle(v)) return v;
      return null;
    }
  }
  // fallback: if query looks like a direct named-law prompt
  if (q.includes("law no") || q.includes("decree") || q.includes("article")) return query.trim();
  return null;
}

function isTrademarkIntent(query: string): boolean {
  return /\btrademark\b|\btrademarks\b|\bmark registration\b/i.test(query);
}

async function listTrademarkLawTitlesByCountry(
  country: string
): Promise<Array<{ title: string; year?: number | null }>> {
  const supabase = getSupabaseServer() as any;
  const { data: countryRow } = await supabase
    .from("countries")
    .select("id")
    .eq("name", country.trim())
    .limit(1)
    .maybeSingle();
  const countryId = countryRow?.id as string | undefined;
  if (!countryId) return [];

  const { data } = await supabase
    .from("laws")
    .select("title, year")
    .eq("country_id", countryId)
    .or("title.ilike.%trademark%,title.ilike.%trademarks%,title.ilike.%mark%")
    .order("title")
    .limit(12);
  return (data ?? []) as Array<{ title: string; year?: number | null }>;
}

function extractRequestedArticle(query: string): number | null {
  const m = query.toLowerCase().match(/\barticle\s+(\d{1,3})\b/);
  if (!m) return null;
  const n = Number.parseInt(m[1], 10);
  return Number.isNaN(n) ? null : n;
}

function extractSearchTokens(query: string): string[] {
  const stopWords = new Set([
    "the",
    "and",
    "for",
    "with",
    "that",
    "this",
    "from",
    "your",
    "have",
    "does",
    "what",
    "where",
    "when",
    "which",
    "about",
    "into",
    "there",
    "database",
    "law",
    "laws",
  ]);
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
 * Search legal library for relevant content (RAG)
 */
async function searchLegalLibrary(
  query: string,
  country?: string,
  category?: string,
  detailedMode = false
): Promise<Array<{ id: string; title: string; country: string; category: string; status?: string; content: string; year?: number }>> {
  try {
    const supabase = getSupabaseServer() as any;
    const hints = extractQueryHints(query);
    const searchCountry = country || hints.country;
    const searchCategory = category || hints.category;

    // Resolve country/category names to IDs so we can filter reliably (Supabase nested .eq("countries.name") can be unreliable)
    let countryId: string | null = null;
    let categoryId: string | null = null;
    if (searchCountry) {
      const { data: countryRow } = await supabase
        .from("countries")
        .select("id")
        .eq("name", searchCountry)
        .limit(1)
        .maybeSingle();
      countryId = countryRow?.id ?? null;
    }
    if (searchCategory) {
      const { data: categoryRow } = await supabase
        .from("categories")
        .select("id")
        .eq("name", searchCategory)
        .limit(1)
        .maybeSingle();
      categoryId = categoryRow?.id ?? null;
    }

    const specificLawHint = extractSpecificLawHint(query);
    let lawsQuery = supabase
      .from("laws")
      .select(
        "id, title, content, content_plain, year, status, country_id, category_id, countries(name), categories(name)"
      )
      .not("content", "is", null)
      .limit(30);

    if (categoryId) {
      lawsQuery = lawsQuery.eq("category_id", categoryId);
    }

    const hasHint = Boolean(searchCountry || searchCategory);
    if (specificLawHint) {
      const specificTokens = specificLawHint
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 3)
        .slice(0, 8);
      const tokenOr = specificTokens
        .map((t) => `title.ilike.%${escapeIlikePattern(t)}%`)
        .join(",");
      if (tokenOr) lawsQuery = lawsQuery.or(tokenOr);
      if (countryId) lawsQuery = lawsQuery.or(lawsOrGlobalForCountry(countryId));
    } else if (query.trim() && !hasHint) {
      const searchTerms = query.trim().toLowerCase();
      const escapedTerms = escapeIlikePattern(searchTerms);
      const tokenOr = extractSearchTokens(query)
        .flatMap((t) => [
          `title.ilike.%${escapeIlikePattern(t)}%`,
          `content.ilike.%${escapeIlikePattern(t)}%`,
        ])
        .join(",");
      if (countryId) {
        lawsQuery = lawsQuery.or(
          tokenOr || lawsCountryOrGlobalWithTextSearch(countryId, escapedTerms)
        );
      } else {
        lawsQuery = lawsQuery.or(tokenOr || `title.ilike.%${escapedTerms}%,content.ilike.%${escapedTerms}%`);
      }
    } else if (countryId) {
      lawsQuery = lawsQuery.or(lawsOrGlobalForCountry(countryId));
    }

    const { data: laws, error } = await lawsQuery;

    if (error || !laws || laws.length === 0) {
      return [];
    }

    const queryTokens = extractSearchTokens(query);
    const rankedLaws = [...laws].sort((a: any, b: any) => {
      const titleA = String(a.title ?? "").toLowerCase();
      const titleB = String(b.title ?? "").toLowerCase();
      const contentA = String(a.content_plain ?? a.content ?? "").toLowerCase();
      const contentB = String(b.content_plain ?? b.content ?? "").toLowerCase();

      const score = (title: string, content: string) =>
        queryTokens.reduce((sum, token) => {
          const inTitle = title.includes(token) ? 3 : 0;
          const inContent = content.includes(token) ? 1 : 0;
          return sum + inTitle + inContent;
        }, 0);

      return score(titleB, contentB) - score(titleA, contentA);
    });

    const lawsForResponse =
      specificLawHint && rankedLaws.length > 0
        ? [rankedLaws[0]] // focus on the requested named law instead of mixing multiple laws
        : rankedLaws.slice(0, detailedMode ? 10 : 6);

    // Use full-text retrieval so answers are grounded in complete law text
    // rather than truncated excerpts.

    const requestedArticle = extractRequestedArticle(query);

    const shouldKeepFullTextForSpecificLaw = Boolean(specificLawHint && detailedMode);
    const maxCharsPerLaw = shouldKeepFullTextForSpecificLaw ? 60000 : detailedMode ? 9000 : 4500;
    const maxCharsTotal = shouldKeepFullTextForSpecificLaw ? 140000 : detailedMode ? 36000 : 18000;
    let remainingChars = maxCharsTotal;

    const compacted: Array<{ id: string; title: string; country: string; category: string; status?: string; content: string; year?: number }> = [];

    for (const law of lawsForResponse as any[]) {
      if (remainingChars <= 0) break;
      const fullText = law.content_plain || law.content || "";
      let selectedContent = fullText;

      if (!shouldKeepFullTextForSpecificLaw) {
        const perLawCap = Math.min(maxCharsPerLaw, remainingChars);
        selectedContent = fullText.slice(0, perLawCap);
      } else if (fullText.length > remainingChars) {
        // In specific-law detailed mode, still respect global budget to avoid hard API failures.
        selectedContent = fullText.slice(0, remainingChars);
      }

      if (requestedArticle !== null) {
        const articleRe = new RegExp(`\\barticle\\s+${requestedArticle}\\b`, "i");
        const hitIdx = selectedContent.search(articleRe);
        if (hitIdx >= 0) {
          compacted.push({
            id: law.id,
            title: law.title,
            country: law.countries?.name || "",
            category: law.categories?.name || "",
            status: law.status || undefined,
            content: selectedContent,
            year: law.year,
          });
          remainingChars -= selectedContent.length;
          continue;
        }
      }

      compacted.push({
        id: law.id,
        title: law.title,
        country: law.countries?.name || "",
        category: law.categories?.name || "",
        status: law.status || undefined,
        content: selectedContent,
        year: law.year,
      });
      remainingChars -= selectedContent.length;
    }

    return compacted;
  } catch (err) {
    console.error("Legal library search error:", err);
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Enforce plan limits: Basic 10, Pro 50, Team unlimited (incl. team members)
    // Check if user has pay-as-you-go purchases
    const hasPayAsYouGoQuery = await hasUnusedPayAsYouGo(userId, "ai_query");
    
    const { getEffectiveTierForUser } = await import("@/lib/team");
    const tier = await getEffectiveTierForUser(userId);
    const limit = getAiQueryLimitForTier(tier);
    
    let usedPayAsYouGo = false;
    if (limit !== null) {
      const usage = await getAiUsage(userId);
      // For free tier (limit = 0), always consume pay-as-you-go if available
      // For other tiers, consume pay-as-you-go only when limit is reached
      const shouldUsePayAsYouGo = limit === 0 ? hasPayAsYouGoQuery : (usage.query_count >= limit && hasPayAsYouGoQuery);
      
      if (shouldUsePayAsYouGo) {
        // Consume one pay-as-you-go purchase to allow this query
        const consumed = await consumePayAsYouGoPurchase(userId, "ai_query");
        if (!consumed) {
          return NextResponse.json(
            {
              error: `Failed to use pay-as-you-go purchase. Please try again.`,
            },
            { status: 429 }
          );
        }
        usedPayAsYouGo = true;
      } else if (usage.query_count >= limit) {
        // No pay-as-you-go purchases available and limit reached
        return NextResponse.json(
          {
            error: `AI query limit reached for your plan (${limit} per month). Upgrade to Pro or Team for more, or purchase additional queries.`,
          },
          { status: 429 }
        );
      }
    }

    if (!CLAUDE_API_KEY || CLAUDE_API_KEY === "sk-ant-api03-..." || CLAUDE_API_KEY.includes("...")) {
      return NextResponse.json(
        { 
          error: "AI service not configured. Please set CLAUDE_API_KEY in your environment variables.",
          details: { hint: "Get your API key from https://console.anthropic.com" }
        },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { messages, attachments, model: requestedModel } = body as {
      messages: Array<{ role: "user" | "assistant"; content: string }>;
      attachments?: Array<{ type: string; data: string; name?: string }>;
      model?: string | null;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Messages array required" },
        { status: 400 }
      );
    }

    // Get the last user message for RAG search
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    const userQuery = lastUserMessage?.content || "";

    // If user asks a legal follow-up, inherit country/category context from the
    // current chat before asking for clarification.
    const currentHints = extractQueryHints(userQuery);
    const conversationHints = extractHintsFromConversation(messages);
    const effectiveHints = {
      country: currentHints.country ?? conversationHints.country,
      category: currentHints.category ?? conversationHints.category,
    };
    const specificLawHint = extractSpecificLawHint(userQuery);
    const trademarkIntent = isTrademarkIntent(userQuery);

    if (trademarkIntent && !effectiveHints.country) {
      return NextResponse.json({
        content:
          "Please specify the country you want for trademark law search.\n\n" +
          "Example: \"Give me trademark laws for Tunisia.\"",
        sources: ["Yamalé AI · African Legal Research"],
      });
    }

    if (effectiveHints.country && trademarkIntent && !specificLawHint) {
      const options = await listTrademarkLawTitlesByCountry(effectiveHints.country);
      if (options.length > 1) {
        return NextResponse.json({
          content:
            `I found multiple trademark-related laws in ${effectiveHints.country}. Please specify which one you want:\n\n` +
            options.map((o, i) => `${i + 1}. ${o.title}${o.year ? ` (${o.year})` : ""}`).join("\n"),
          sources: [
            ...options.map((o) => `${o.title} (${effectiveHints.country})`),
            "Yamalé AI · African Legal Research",
          ],
        });
      }
    }

    if (!effectiveHints.country && isLikelyLegalQuestion(userQuery)) {
      return NextResponse.json({
        content:
          "I couldn't tell which country's law you mean from your question.\n\n" +
          "Please re-ask your question and include the country explicitly, for example:\n" +
          "- \"In Rwanda, what does the Capital Market Corporate Governance Code N°___, 2024 provide?\"\n" +
          "- \"Under Ghanaian corporate law, what does the Companies Act say about directors' duties?\"",
        sources: ["Yamalé AI · African Legal Research"],
      });
    }

    // Search legal library for relevant content (RAG)
    const detailedMode = isDetailedRequest(userQuery);
    const legalContext = await searchLegalLibrary(
      userQuery,
      effectiveHints.country,
      effectiveHints.category,
      detailedMode
    );

    // Build Claude messages format
    const claudeMessages: ClaudeMessage[] = [];

    const lastMessageIndex = messages.length - 1;

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const isLastMessage = i === lastMessageIndex;

      if (msg.role === "assistant") {
        if (msg.content && msg.content.trim()) {
          claudeMessages.push({
            role: "assistant",
            content: [{ type: "text", text: msg.content }],
          });
        }
      } else {
        // User message - include text and attachments (only on last message)
        const content: ClaudeMessageContent[] = [];
        
        if (msg.content && msg.content.trim()) {
          content.push({ type: "text", text: msg.content });
        }

        // Add attachments only to the last user message
        if (isLastMessage && attachments && attachments.length > 0) {
          for (const att of attachments) {
            if (att.type.startsWith("image/")) {
              content.push({
                type: "image",
                source: {
                  type: "base64",
                  media_type: att.type,
                  data: att.data,
                },
              });
            }
            // Note: Claude API v1 supports images. For documents, we'd need to extract text first
          }
        }

        // Only add user message if it has content
        if (content.length > 0) {
          claudeMessages.push({
            role: "user",
            content,
          });
        }
      }
    }

    // Ensure we have at least one user message
    if (claudeMessages.length === 0 || claudeMessages.filter((m) => m.role === "user").length === 0) {
      return NextResponse.json(
        { error: "No valid messages to process" },
        { status: 400 }
      );
    }

    // Build system prompt
    let systemPrompt = `You are a legal research assistant for the Yamalé legal library.

Core rule: when library documents are provided, answer ONLY from those documents.
Do not add outside knowledge, web references, or generic legal templates.
If something is not in the provided excerpts, say "Not stated in the provided library excerpt."`;

    // Add legal context if available
    if (legalContext.length > 0) {
      systemPrompt += `\n\nRELEVANT LEGAL DOCUMENTS FROM THE DATABASE (library):\n\n${legalContext
        .map(
          (law, i) =>
            `[Document ${i + 1}]\nTitle: ${law.title}\nCountry: ${law.country}\nCategory: ${law.category}${
              law.year ? `\nYear: ${law.year}` : ""
            }\nContent:\n${law.content}\n---\n`
        )
        .join("\n")}\n\nIMPORTANT: (1) Base your answer strictly on these legal documents from the library database. (2) Do not cite them as \"Document 1\", \"Based on Document 2\", or similar—instead refer to the law by its title or country. (3) Do NOT use outside/general knowledge when answering this request. (4) If the documents do not cover the question, explicitly say they are not found in the current library results and ask the user to refine filters/query; do not invent statutes or web references. (5) For each substantive point, include a short quote/snippet from the provided text that supports it.`;
      systemPrompt +=
        "\n\nDefault answer style (unless user asks otherwise): provide a practical summary in clear sections focused on what the law says. Use this order: (a) What this law is about, (b) Who it applies to, (c) Main obligations/prohibitions, (d) Enforcement/oversight, (e) Penalties/remedies if present, (f) Practical takeaway. Avoid long publication metadata (gazette volume, legal notice chronology, revision history) unless the user explicitly asks for citation history or amendment timeline.";
      if (detailedMode) {
        systemPrompt +=
          "\n\nThe user asked for detail. Give a detailed, structured response using headings and bullet points. Include specific procedural/legal points found in the provided text and quote short snippets for each point. Do not provide generic overviews.";
      }
      if (extractSpecificLawHint(userQuery)) {
        systemPrompt +=
          "\n\nThe user asked about a specific named law. Prioritize that law's text only. Do not summarize at high level. Instead, extract every concrete legal rule visible in the excerpt and present it as a numbered list: (a) short quote, (b) plain-language explanation, (c) practical implication. If text is partial, state that only after listing all extracted rules.";
        systemPrompt +=
          "\n\nDo not claim an article is blank or missing unless the excerpt explicitly indicates it is blank. If you cannot locate a specific article in the provided excerpt, say: 'I could not locate that article in the provided excerpt.'";
      }
      const requestedArticle = extractRequestedArticle(userQuery);
      if (requestedArticle !== null) {
        systemPrompt += `\n\nThe user asked about Article ${requestedArticle}. If Article ${requestedArticle} text is present in the provided library excerpts, quote and explain that exact article directly. Do not claim the article is missing unless it truly does not appear in the excerpts.`;
      }
    } else {
      systemPrompt +=
        "\n\nNo library documents were retrieved for this turn. Say that clearly in 2-4 short sentences and ask the user to refine country/category/law title. Do not claim you reviewed all library documents; state only that no relevant documents were retrieved for this query. Do not provide external legal guidance (agencies, filing bodies, or legal frameworks not present in retrieved docs). Do not fabricate legal content.";
    }

    const modelId = await resolveModelIdForRequest(tier, requestedModel);

    // Call Claude API
    const response = await fetch(CLAUDE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: detailedMode ? 3200 : 2048,
        messages: claudeMessages,
        system: systemPrompt,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData: any = {};
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText || "Unknown error" };
      }
      
      console.error("Claude API error:", {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
        hasApiKey: !!CLAUDE_API_KEY,
        apiKeyPrefix: CLAUDE_API_KEY?.substring(0, 10) || "none",
        messagesCount: claudeMessages.length,
        systemPromptLength: systemPrompt.length,
      });

      // Provide more helpful error messages
      let errorMessage = "AI service error";
      if (response.status === 401) {
        errorMessage = "Invalid API key. Please check CLAUDE_API_KEY configuration.";
      } else if (response.status === 404) {
        clearModelCache();
        errorMessage = `Model not found (${modelId}). Set CLAUDE_MODEL in .env to a valid model ID from your account. List models: curl -H "x-api-key: \$CLAUDE_API_KEY" -H "anthropic-version: 2023-06-01" https://api.anthropic.com/v1/models`;
      } else if (response.status === 429) {
        errorMessage = "Rate limit exceeded. Please try again later.";
      } else if (response.status === 400) {
        errorMessage = errorData.error?.message || "Invalid request format.";
      } else if (response.status >= 500) {
        errorMessage = "Claude API is temporarily unavailable. Please try again later.";
      }

      return NextResponse.json(
        { error: errorMessage, details: errorData },
        { status: 500 }
      );
    }

    const data = await response.json();
    const assistantText = data.content?.[0]?.text || "I apologize, but I couldn't generate a response.";

    // Record usage: queries and tokens (Anthropic returns usage.input_tokens, usage.output_tokens)
    // For free tier using pay-as-you-go, don't increment query count (only tokens)
    const usage = (data.usage as { input_tokens?: number; output_tokens?: number }) ?? {};
    const inputTokens = typeof usage.input_tokens === "number" ? usage.input_tokens : 0;
    const outputTokens = typeof usage.output_tokens === "number" ? usage.output_tokens : 0;
    
    if (usedPayAsYouGo && limit === 0) {
      // Free tier with pay-as-you-go: only record tokens, not query count
      // We'll manually update just the tokens
      const supabase = getSupabaseServer();
      const month = getCurrentMonthKey();
      const { data: row } = await supabase
        .from("ai_usage")
        .select("input_tokens, output_tokens")
        .eq("user_id", userId)
        .eq("month", month)
        .maybeSingle();
      
      const prev = (row as { input_tokens?: number; output_tokens?: number } | null) ?? null;
      const newInput = (prev?.input_tokens ?? 0) + inputTokens;
      const newOutput = (prev?.output_tokens ?? 0) + outputTokens;
      
      if (!prev) {
        await (supabase.from("ai_usage") as any).insert({
          user_id: userId,
          month,
          query_count: 0, // Don't increment for pay-as-you-go on free tier
          input_tokens: newInput,
          output_tokens: newOutput,
          updated_at: new Date().toISOString(),
        });
      } else {
        await (supabase.from("ai_usage") as any)
          .update({
            input_tokens: newInput,
            output_tokens: newOutput,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId)
          .eq("month", month);
      }
    } else {
      // Normal usage tracking (increment query count)
      await incrementAiUsage(userId, inputTokens, outputTokens);
    }

    // Build sources list from retrieved legal documents
    const sources = legalContext.length > 0
      ? [
          ...Array.from(new Set(legalContext.map((law) => `${law.title} (${law.country})`))),
          "Claude AI · African Legal Research",
        ]
      : ["Claude AI · African Legal Research"];

    const sourceCards = legalContext.map((law) => ({
      lawId: law.id,
      title: law.title,
      country: law.country,
      category: law.category,
      status: law.status || "In force",
      snippet: law.content.slice(0, 220).replace(/\s+/g, " ").trim(),
    }));

    let lawyerNudge: { country: string; category: string; count: number; href: string } | null = null;
    const nudgeCountry = effectiveHints.country ?? legalContext[0]?.country;
    const nudgeCategory = effectiveHints.category ?? legalContext[0]?.category;
    if (nudgeCountry && nudgeCategory) {
      try {
        const supabase = getSupabaseServer();
        const safeCategory = nudgeCategory.replace(/[%_]/g, "\\$&");
        const { count } = await (supabase.from("lawyers") as any)
          .select("id", { count: "exact", head: true })
          .eq("status", "approved")
          .eq("country", nudgeCountry)
          .ilike("expertise", `%${safeCategory}%`);
        if ((count ?? 0) > 0) {
          const q = new URLSearchParams({
            country: nudgeCountry,
            expertise: nudgeCategory,
          });
          lawyerNudge = {
            country: nudgeCountry,
            category: nudgeCategory,
            count: count ?? 0,
            href: `/lawyers?${q.toString()}`,
          };
        }
      } catch {
        // ignore nudge errors
      }
    }

    return NextResponse.json({
      content: assistantText,
      sources,
      sourceCards,
      lawyerNudge,
    });
  } catch (err) {
    console.error("AI chat API error:", err);
    return NextResponse.json(
      { error: "Failed to process chat request" },
      { status: 500 }
    );
  }
}
