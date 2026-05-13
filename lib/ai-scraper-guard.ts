import type { NextRequest } from "next/server";

/**
 * Substrings matched case-insensitively against User-Agent for known AI / bulk-training crawlers.
 * Keep conservative: avoid broad tokens like "bot" alone (would false-positive many legitimate bots).
 */
const AI_TRAINING_CRAWLER_SUBSTRINGS = [
  "gptbot",
  "chatgpt-user",
  "oai-searchbot",
  "google-extended",
  "ccbot",
  "anthropic-ai",
  "claudebot",
  "claude-web",
  "bytespider",
  "perplexitybot",
  "perplexity-user",
  "cohere-ai",
  "diffbot",
  "omgilibot",
  "omgili",
  "imagesiftbot",
] as const;

/** Paths where automated harvesting of legal / product content is blocked for AI crawlers (GET/HEAD). */
const PROTECTED_PATH_PREFIXES = [
  "/library",
  "/api/laws",
  "/api/ai",
  "/ai-research",
  "/afcfta",
  "/marketplace",
  "/lawyers",
] as const;

function pathnameMatchesProtectedPrefix(pathname: string): boolean {
  const p = pathname.split("?")[0] || pathname;
  for (const prefix of PROTECTED_PATH_PREFIXES) {
    if (p === prefix || p.startsWith(`${prefix}/`)) return true;
  }
  return false;
}

function userAgentLooksLikeAiTrainingCrawler(userAgent: string | null): boolean {
  if (!userAgent) return false;
  const lower = userAgent.toLowerCase();
  return AI_TRAINING_CRAWLER_SUBSTRINGS.some((sig) => lower.includes(sig));
}

/**
 * Returns true when the request should receive 403 (AI / training crawler on protected content).
 * Opt out with env `BLOCK_AI_SCRAPER_UA=false` (e.g. local debugging with a spoofed UA).
 */
export function isBlockedAiScraperRequest(request: NextRequest): boolean {
  if (process.env.BLOCK_AI_SCRAPER_UA === "false") return false;
  const method = request.method?.toUpperCase() || "GET";
  if (method !== "GET" && method !== "HEAD") return false;
  if (!pathnameMatchesProtectedPrefix(request.nextUrl.pathname)) return false;
  return userAgentLooksLikeAiTrainingCrawler(request.headers.get("user-agent"));
}
