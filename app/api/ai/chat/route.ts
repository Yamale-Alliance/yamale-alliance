import { NextRequest, NextResponse } from "next/server";
import {
  escapeIlikePattern,
  lawsCountryOrGlobalWithTextSearch,
  lawsOrGlobalForCountry,
} from "@/lib/law-country-scope";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { chunkLawContent } from "@/lib/embeddings/chunking";
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
  
  // Category mapping (check for full names first)
  const categoryMap: Record<string, string> = {
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
    "trade": "International Trade Laws",
    "anti-bribery": "Anti-Bribery and Corruption Law",
    "corruption": "Anti-Bribery and Corruption Law",
    "dispute resolution": "Dispute Resolution",
    "environmental": "Environmental",
  };
  
  let foundCategory: string | undefined;
  for (const [key, value] of Object.entries(categoryMap)) {
    if (lowerQuery.includes(key)) {
      foundCategory = value;
      break;
    }
  }
  
  return {
    country: foundCountry,
    category: foundCategory,
  };
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

/**
 * Search legal library for relevant content (RAG)
 */
async function searchLegalLibrary(
  query: string,
  country?: string,
  category?: string
): Promise<Array<{ title: string; country: string; category: string; content: string; year?: number }>> {
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

    let lawsQuery = supabase
      .from("laws")
      .select(
        "id, title, content, content_plain, year, status, country_id, category_id, countries(name), categories(name)"
      )
      .not("content", "is", null)
      .limit(3);

    if (categoryId) {
      lawsQuery = lawsQuery.eq("category_id", categoryId);
    }

    // Only require title/content to match the query when we have no country/category hint.
    // When user asks e.g. "what does Loi sur les sociétés commerciales Madagascar state", we
    // already filter by country + category; requiring the full sentence in content would return nothing.
    const hasHint = searchCountry || searchCategory;
    if (query.trim() && !hasHint) {
      const searchTerms = query.trim().toLowerCase();
      const escapedTerms = escapeIlikePattern(searchTerms);
      if (countryId) {
        lawsQuery = lawsQuery.or(lawsCountryOrGlobalWithTextSearch(countryId, escapedTerms));
      } else {
        lawsQuery = lawsQuery.or(
          `title.ilike.%${escapedTerms}%,content.ilike.%${escapedTerms}%`
        );
      }
    } else if (countryId) {
      lawsQuery = lawsQuery.or(lawsOrGlobalForCountry(countryId));
    }

    const { data: laws, error } = await lawsQuery;

    if (error || !laws || laws.length === 0) {
      return [];
    }

    // Use chunking strategy: paragraph/sentence-aware chunks, then take the chunks
    // that are most relevant to the user's query (not just the first N chars),
    // so that specific articles (e.g. "Chapter III, Article 8") are more likely
    // to be included in the context.
    const maxCharsPerLaw = 2500;
    const queryLower = query.toLowerCase();
    const queryTokens = queryLower
      .split(/\W+/)
      .filter((t) => t.length >= 3);

    function scoreChunk(text: string): number {
      const t = text.toLowerCase();
      let score = 0;
      for (const token of queryTokens) {
        if (t.includes(token)) score++;
      }
      return score;
    }

    return laws.map((law: any) => {
      const fullText = law.content_plain || law.content || "";
      const chunks = chunkLawContent(fullText, { maxChunkChars: 800, overlapChars: 120 });

      // Score chunks by how many query tokens they contain
      const scored = chunks.map((c: any) => ({
        text: c.text,
        score: scoreChunk(c.text),
      }));

      // Sort by score (desc), but keep original order among equally scored chunks
      scored.sort((a, b) => b.score - a.score);

      let content = "";
      for (const c of scored) {
        if (content.length + c.text.length + 2 <= maxCharsPerLaw) {
          content += (content ? "\n\n" : "") + c.text;
        } else {
          const remaining = maxCharsPerLaw - content.length - 2;
          if (remaining > 200) content += "\n\n" + c.text.slice(0, remaining);
          break;
        }
      }

      // Fallback: if, for some reason, nothing was selected, use the first part of the text
      if (!content) content = fullText.slice(0, maxCharsPerLaw);

      return {
        title: law.title,
        country: law.countries?.name || "",
        category: law.categories?.name || "",
        content,
        year: law.year,
      };
    });
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

    // If the user appears to be asking about a specific law but we don't
    // detect any country, ask them to clarify the country instead of guessing
    // from another jurisdiction or general knowledge.
    const hints = extractQueryHints(userQuery);
    if (!hints.country && isLikelyLegalQuestion(userQuery)) {
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
    const legalContext = await searchLegalLibrary(userQuery);

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
    let systemPrompt = `You are a legal research assistant specializing in African law, AfCFTA (African Continental Free Trade Area), and compliance matters. 

Your responses should:
- Be grounded in verified legal sources when possible
- Clearly indicate when information is indicative or general guidance
- Cite relevant laws, regulations, or legal frameworks when known
- Advise users to consult qualified legal professionals for specific situations
- Focus on African jurisdictions and AfCFTA-related matters

Always remind users that your responses are indicative and not a substitute for professional legal advice.`;

    // Add legal context if available
    if (legalContext.length > 0) {
      systemPrompt += `\n\nRELEVANT LEGAL DOCUMENTS FROM THE DATABASE (library):\n\n${legalContext
        .map(
          (law, i) =>
            `[Document ${i + 1}]\nTitle: ${law.title}\nCountry: ${law.country}\nCategory: ${law.category}${
              law.year ? `\nYear: ${law.year}` : ""
            }\nContent:\n${law.content}\n---\n`
        )
        .join("\n")}\n\nIMPORTANT: (1) Base your answer primarily on these legal documents from the database. When the user asks about a specific law, use the content above as the main source. (2) Do not cite them as \"Document 1\", \"Based on Document 2\", or similar—instead refer to the law by its title or country (e.g. \"Under the Loi sur les sociétés commerciales...\" or \"Malagasy law provides that...\"). (3) Use your knowledge to interpret the text, fix obvious typos or OCR errors, and clarify wording where the source is unclear—but stay grounded in what the documents say. (4) If the documents do not cover the question, say so and then give general guidance from your knowledge of African law.`;
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
        max_tokens: 2048,
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
          ...legalContext.map((law) => `${law.title} (${law.country})`),
          "Claude AI · African Legal Research",
        ]
      : ["Claude AI · African Legal Research"];

    return NextResponse.json({
      content: assistantText,
      sources,
    });
  } catch (err) {
    console.error("AI chat API error:", err);
    return NextResponse.json(
      { error: "Failed to process chat request" },
      { status: 500 }
    );
  }
}
