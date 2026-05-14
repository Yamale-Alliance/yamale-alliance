/**
 * Optional contextual web search for AI Legal Research (POST /api/ai/chat).
 *
 * Design: runs only when heuristics say outside context plausibly helps; capped
 * snippets; library excerpts in the system prompt still govern legal conclusions.
 *
 * Env: TAVILY_API_KEY (sent as JSON `api_key` and as `Authorization: Bearer`). Set AI_WEB_SEARCH_DISABLED=1 to turn off.
 */

const TAVILY_SEARCH_URL = "https://api.tavily.com/search";

const MAX_QUERY_CHARS = 420;
const MAX_RESULTS = 4;
const MAX_SNIPPET_CHARS = 420;
const MAX_PROMPT_BLOCK_CHARS = 3200;

export type WebSearchContextForAi = {
  /** Plain-text block appended to the system prompt */
  promptBlock: string;
  /** Short transparency line for the API client / UI */
  userNote: string;
};

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/**
 * Conservative gate: avoid web on narrow statutory reads; allow when the user
 * clearly wants outside/time-sensitive context or institutional background.
 */
export function shouldAttemptContextualWebSearch(opts: {
  userQuery: string;
  platformGuideMeta: boolean;
  webSearchDisabled: boolean;
  hasApiKey: boolean;
}): boolean {
  if (opts.platformGuideMeta || opts.webSearchDisabled || !opts.hasApiKey) return false;
  const q = opts.userQuery.trim();
  if (q.length < 14) return false;

  const narrowStatuteSkim =
    q.length < 140 &&
    /\b(article|art\.?|section|§)\s*\d+/i.test(q) &&
    !/\b(latest|news|recent|update|202[4-9]|this year|press|announce|internet|web|online)\b/i.test(q);

  if (narrowStatuteSkim) return false;

  const explicitWeb =
    /\b(search the web|look (it )?up online|on the internet|from the web|web search|google this|tavily)\b/i.test(
      q
    ) ||
    /\b(latest news|breaking news|press release|official announcement|what happened (recently|this (week|month|year)))\b/i.test(
      q
    ) ||
    /\b(beyond (the )?library|outside yamale|not in yamale|not in the library)\b/i.test(q);

  const timeOrInstitution =
    /\b(202[4-9]|20[3-9]\d|today|this week|this month|currently|recently ratified|depositary|entered into force globally|ecb|imf|world bank|un security council|european commission|african union summit)\b/i.test(
      q
    );

  if (explicitWeb) return true;
  if (timeOrInstitution && q.length >= 32) return true;
  return false;
}

function formatWebSupplementBlock(
  entries: Array<{ title: string; url: string; snippet: string }>
): string {
  if (entries.length === 0) return "";
  const lines = entries.map((e, i) => {
    return `[web:${i + 1}] ${e.title}\nURL: ${e.url}\nSnippet: ${e.snippet}`;
  });
  const body = lines.join("\n\n---\n\n");
  const header = `WEB SUPPLEMENT (automated Tavily search — short secondary context, not Yamalé library law):
The backend attached this block **on purpose** for questions that need open-web or time-sensitive institutional context (e.g. IMF, World Bank, recent years). You **must** answer those parts by summarizing and attributing the SUPPLEMENT ENTRIES below (paraphrase; cite [web:N] or the site name). Do **not** refuse with blanket claims that you have no internet, no real-time access, no 2026 information, or cannot see IMF/World Bank material—**this message is the web material for this turn**; use it or say honestly that the snippets are too thin for a full answer.

For **binding legal rules** in Yamalé-archived instruments, the RETRIEVED library block still wins over any informal web line.

SUPPLEMENT ENTRIES:
`;
  return truncate(header + body, MAX_PROMPT_BLOCK_CHARS);
}

/** When Tavily was invoked but returned nothing; avoids generic "no internet" refusals. */
export function getWebSearchMissSystemBlock(): string {
  return `WEB SUPPLEMENT (automated web search — **no snippets attached for this turn**):
The backend **tried** to pull short web results (e.g. IMF/World Bank / recent developments) but received **no usable snippets** (provider error, timeout, empty results, or configuration issue).

Instructions: Tell the user plainly that **live web snippets were unavailable for this request**. Do **not** claim you are globally disconnected from the internet, forbidden from web use, or unable in principle to discuss IMF/World Bank news—say instead that the **automated web fetch failed or returned nothing here**. Then continue with the Yamalé library portion as usual.`;
}

type TavilyResultRow = {
  title?: string;
  url?: string;
  content?: string;
  raw_content?: string;
};

function tavilyTopic(userQuery: string): "general" | "news" | "finance" {
  if (
    /\b(imf|world bank|international monetary fund|sovereign debt|debt restructuring|bonds?|credit rating|financial stability|ecb|multilateral development bank)\b/i.test(
      userQuery
    )
  ) {
    return "finance";
  }
  if (/\b(news|latest|today|this week|breaking|headlines)\b/i.test(userQuery)) return "news";
  return "general";
}

function tavilySnippetFromRow(row: TavilyResultRow): string {
  const fromContent = String(row.content ?? "").trim();
  if (fromContent) return truncate(fromContent, MAX_SNIPPET_CHARS);
  const raw = typeof row.raw_content === "string" ? row.raw_content.trim() : "";
  if (raw) return truncate(raw, MAX_SNIPPET_CHARS);
  return "(No summary text was returned for this result; use the title and URL only.)";
}

/**
 * Returns null on missing key, network errors, or empty results.
 */
export async function fetchTavilyWebContextForPrompt(
  userQuery: string,
  signal?: AbortSignal
): Promise<WebSearchContextForAi | null> {
  const apiKey = process.env.TAVILY_API_KEY?.trim();
  if (!apiKey) return null;

  const topic = tavilyTopic(userQuery);

  const payload = {
    api_key: apiKey,
    query: truncate(userQuery, MAX_QUERY_CHARS),
    search_depth: "basic" as const,
    max_results: MAX_RESULTS,
    topic,
    include_answer: false,
  };

  const res = await fetch(TAVILY_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal,
    body: JSON.stringify(payload),
  });

  if (!res.ok) return null;

  const data = (await res.json()) as { results?: TavilyResultRow[] };
  const raw = Array.isArray(data.results) ? data.results : [];
  const entries: Array<{ title: string; url: string; snippet: string }> = [];
  for (const row of raw) {
    const title = truncate(String(row.title ?? "Untitled"), 200);
    const url = String(row.url ?? "").trim();
    if (!url) continue;
    const snippet = tavilySnippetFromRow(row);
    entries.push({ title, url, snippet });
    if (entries.length >= MAX_RESULTS) break;
  }
  if (entries.length === 0) return null;

  const promptBlock = formatWebSupplementBlock(entries);
  const userNote = `Optional web context (Tavily, ${entries.length} truncated snippets) was added for peripheral background only. Yamalé library excerpts remain the authority for legal text in this product.`;

  return { promptBlock, userNote };
}
