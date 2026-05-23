/**
 * Vercel serverless limits for POST /api/ai/chat.
 * `maxDuration` must cover pre-stream retrieval + full SSE generation.
 * Claude abort timeout is capped below `maxDuration` (connection / TTFB guard).
 */

import { isFullLibraryContextEnabled } from "@/lib/ai-full-library-context";

/** Pro plan ceiling for `export const maxDuration` (seconds). */
export const VERCEL_AI_CHAT_MAX_DURATION_CEILING_SEC = 300;

const DEFAULT_BUFFER_MS = 8_000;

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Vercel `maxDuration` for /api/ai/chat (seconds).
 * Default: 60 (Pro default platform limit) or 300 when full-library mode is on.
 * On Pro, set AI_CHAT_MAX_DURATION_SEC=300 for long streamed answers.
 */
export function getAiChatMaxDurationSec(): number {
  const fromEnv = parsePositiveInt(process.env.AI_CHAT_MAX_DURATION_SEC, 0);
  const fallback = isFullLibraryContextEnabled() ? 300 : 60;
  const chosen = fromEnv > 0 ? fromEnv : fallback;
  return Math.min(VERCEL_AI_CHAT_MAX_DURATION_CEILING_SEC, Math.max(10, chosen));
}

function durationBufferMs(): number {
  return parsePositiveInt(process.env.AI_CHAT_DURATION_BUFFER_MS, DEFAULT_BUFFER_MS);
}

/**
 * Claude fetch abort timeout (ms). Capped below `maxDuration` minus buffer.
 * Default: 52s (normal) / 280s (full library). Override with AI_CLAUDE_TIMEOUT_MS.
 */
export function getClaudeTimeoutMs(): number {
  const maxMs = getAiChatMaxDurationSec() * 1000 - durationBufferMs();
  const safeCap = Math.max(5_000, maxMs);

  const fromEnv = process.env.AI_CLAUDE_TIMEOUT_MS?.trim();
  if (fromEnv) {
    const n = Number.parseInt(fromEnv, 10);
    if (Number.isFinite(n) && n > 0) return Math.min(n, safeCap);
  }

  const defaultMs = isFullLibraryContextEnabled() ? 280_000 : 52_000;
  return Math.min(defaultMs, safeCap);
}
