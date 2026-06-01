/** Paths that must not be indexed or used for AI training snapshots (auth, APIs, admin). */
export const SEO_DISALLOW_PATHS = [
  "/api/",
  "/account/",
  "/admin-panel/",
  "/dashboard",
] as const;

/**
 * AI assistants and search-augmented crawlers — allowed on the same public surface as Google.
 * Previously these were fully blocked; we now permit public legal library and marketing pages.
 */
export const AI_CRAWLER_USER_AGENTS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "Google-Extended",
  "CCBot",
  "anthropic-ai",
  "ClaudeBot",
  "Claude-Web",
  "Bytespider",
  "PerplexityBot",
  "Perplexity-User",
  "cohere-ai",
  "Diffbot",
  "Omgilibot",
  "omgili",
  "ImagesiftBot",
  "Applebot-Extended",
  "Meta-ExternalAgent",
  "FacebookBot",
  "Amazonbot",
] as const;
