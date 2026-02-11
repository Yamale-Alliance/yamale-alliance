import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { chunkLawContent } from "@/lib/embeddings/chunking";
import {
  getAiUsage,
  getAiQueryLimitForTier,
  incrementAiUsage,
} from "@/lib/ai-usage";

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL_ENV = process.env.CLAUDE_MODEL;
const MODELS_URL = "https://api.anthropic.com/v1/models";

if (!CLAUDE_API_KEY) {
  console.warn("CLAUDE_API_KEY not set - AI chat will not work");
}

/** Cached model id from GET /v1/models; refreshed on 404. */
let cachedModelId: string | null = null;

/**
 * Resolve model id: use CLAUDE_MODEL if set, else fetch from API and pick best (prefer sonnet).
 */
async function resolveModelId(): Promise<string> {
  if (CLAUDE_MODEL_ENV) return CLAUDE_MODEL_ENV;
  if (cachedModelId) return cachedModelId;

  const res = await fetch(MODELS_URL, {
    headers: {
      "x-api-key": CLAUDE_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
  });
  if (!res.ok) {
    throw new Error(`Models list failed: ${res.status}`);
  }
  const json = (await res.json()) as { data?: Array<{ id: string; display_name?: string }> };
  const models = json.data || [];
  const sonnet = models.find((m) => m.id.toLowerCase().includes("sonnet"));
  const chosen = sonnet?.id ?? models[0]?.id;
  if (chosen) {
    cachedModelId = chosen;
    return chosen;
  }
  return "claude-3-5-sonnet-20241022";
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

    let lawsQuery = supabase
      .from("laws")
      .select(
        "id, title, content, content_plain, year, status, country_id, category_id, countries(name), categories(name)"
      )
      .not("content", "is", null)
      .limit(5);

    // Filter by country if specified
    if (searchCountry) {
      lawsQuery = lawsQuery.eq("countries.name", searchCountry);
    }

    // Filter by category if specified
    if (searchCategory) {
      lawsQuery = lawsQuery.eq("categories.name", searchCategory);
    }

    // Full-text search on title and content (only if query is not empty)
    if (query.trim()) {
      const searchTerms = query.trim().toLowerCase();
      // Escape special characters for ilike
      const escapedTerms = searchTerms.replace(/%/g, "\\%").replace(/_/g, "\\_");
      lawsQuery = lawsQuery.or(
        `title.ilike.%${escapedTerms}%,content.ilike.%${escapedTerms}%`
      );
    }

    const { data: laws, error } = await lawsQuery;

    if (error || !laws || laws.length === 0) {
      return [];
    }

    // Use chunking strategy: paragraph/sentence-aware chunks, then take first chunks per law (max ~2000 chars per law for context)
    const maxCharsPerLaw = 2000;
    return laws.map((law: any) => {
      const fullText = law.content_plain || law.content || "";
      const chunks = chunkLawContent(fullText, { maxChunkChars: 800, overlapChars: 120 });
      let content = "";
      for (const c of chunks) {
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
    const { getEffectiveTierForUser } = await import("@/lib/team");
    const tier = await getEffectiveTierForUser(userId);
    const limit = getAiQueryLimitForTier(tier);
    if (limit !== null) {
      const usage = await getAiUsage(userId);
      if (usage.query_count >= limit) {
        return NextResponse.json(
          {
            error: `AI query limit reached for your plan (${limit} per month). Upgrade to Pro or Team for more.`,
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
    const { messages, attachments } = body as {
      messages: Array<{ role: "user" | "assistant"; content: string }>;
      attachments?: Array<{ type: string; data: string; name?: string }>;
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
      systemPrompt += `\n\nRELEVANT LEGAL DOCUMENTS FROM THE LIBRARY:\n\n${legalContext
        .map(
          (law, i) =>
            `[Document ${i + 1}]\nTitle: ${law.title}\nCountry: ${law.country}\nCategory: ${law.category}${
              law.year ? `\nYear: ${law.year}` : ""
            }\nContent:\n${law.content}\n---\n`
        )
        .join("\n")}\n\nIMPORTANT: Base your answer primarily on the legal documents provided above. If the documents contain relevant information, cite them specifically (e.g., "According to [Document 1]..."). If the documents don't contain relevant information, say so and provide general guidance based on your knowledge of African law.`;
    }

    const modelId = await resolveModelId();

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
        max_tokens: 4096,
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
        cachedModelId = null;
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
    const usage = (data.usage as { input_tokens?: number; output_tokens?: number }) ?? {};
    const inputTokens = typeof usage.input_tokens === "number" ? usage.input_tokens : 0;
    const outputTokens = typeof usage.output_tokens === "number" ? usage.output_tokens : 0;
    await incrementAiUsage(userId, inputTokens, outputTokens);

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
