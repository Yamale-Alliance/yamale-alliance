/**
 * AI cost and abuse caps: daily DB limits, message size, duplicate prompts.
 * Enforced in POST /api/ai/chat before Claude is called.
 */

import { createHash } from "crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { PlanTier } from "@/lib/plan-limits";
import { getTeamBillingAdminUserId, getTeamMemberUserIds } from "@/lib/team";
import { checkInMemoryRateLimit } from "@/lib/rate-limit-fallback";

export type AiChatRequestLimits = {
  maxUserMessageChars: number;
  maxMessages: number;
  maxTotalConversationChars: number;
  maxAttachments: number;
  maxAttachmentBase64Chars: number;
};

export type AiDailyCapResult =
  | { allowed: true }
  | { allowed: false; reason: string; status: 429 };

function isProductionEnv(): boolean {
  return (
    process.env.VERCEL_ENV === "production" ||
    (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview")
  );
}

function envInt(name: string, devDefault: number, prodDefault: number, min: number, max: number): number {
  const raw = process.env[name]?.trim();
  const fallback = isProductionEnv() ? prodDefault : devDefault;
  if (!raw) {
    return Math.min(max, Math.max(min, fallback));
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) {
    return Math.min(max, Math.max(min, fallback));
  }
  return Math.min(max, Math.max(min, n));
}

/** null = unlimited for that dimension. */
function envCap(name: string, devDefault: number | null, prodDefault: number | null): number | null {
  const raw = process.env[name]?.trim();
  if (raw === "0" || raw?.toLowerCase() === "unlimited") return null;
  const fallback = isProductionEnv() ? prodDefault : devDefault;
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  if (n === 0) return null;
  return n;
}

export function getAiChatRequestLimits(): AiChatRequestLimits {
  return {
    maxUserMessageChars: envInt("AI_CHAT_MAX_USER_MESSAGE_CHARS", 16_000, 8_000, 500, 32_000),
    maxMessages: envInt("AI_CHAT_MAX_MESSAGES", 40, 28, 2, 80),
    maxTotalConversationChars: envInt(
      "AI_CHAT_MAX_TOTAL_CONVERSATION_CHARS",
      120_000,
      64_000,
      2_000,
      400_000
    ),
    maxAttachments: envInt("AI_CHAT_MAX_ATTACHMENTS", 4, 2, 0, 8),
    maxAttachmentBase64Chars: envInt(
      "AI_CHAT_MAX_ATTACHMENT_BASE64_CHARS",
      1_200_000,
      600_000,
      0,
      4_000_000
    ),
  };
}

export function getDailyQueryCapForTier(tier: string): number | null {
  const t = (tier || "free").toLowerCase() as PlanTier;
  const map: Record<PlanTier, { dev: number | null; prod: number | null }> = {
    free: { dev: 5, prod: 3 },
    basic: { dev: 25, prod: 15 },
    pro: { dev: 80, prod: 50 },
    team: { dev: 60, prod: 40 },
  };
  const row = map[t] ?? map.free;
  return envCap(`AI_DAILY_QUERY_CAP_${t.toUpperCase()}`, row.dev, row.prod);
}

/** Shared pool for team admin + invited members (UTC day). */
export function getTeamDailyQueryCap(): number | null {
  return envCap("AI_TEAM_DAILY_QUERY_CAP", 250, 150);
}

export function getUtcUsageDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function normalizePromptForDedup(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

export function hashPromptForDedup(text: string): string {
  return createHash("sha256").update(normalizePromptForDedup(text)).digest("hex").slice(0, 32);
}

export function validateAiChatRequest(
  messages: Array<{ role: string; content?: string }>,
  attachments?: Array<{ type?: string; data?: string }> | null
): { ok: true } | { ok: false; error: string; status: number } {
  const limits = getAiChatRequestLimits();

  if (!Array.isArray(messages) || messages.length === 0) {
    return { ok: false, error: "Messages array required", status: 400 };
  }

  if (messages.length > limits.maxMessages) {
    return {
      ok: false,
      error: `Too many messages in this conversation (max ${limits.maxMessages}). Start a new research query.`,
      status: 400,
    };
  }

  let totalChars = 0;
  for (const msg of messages) {
    const len = String(msg.content ?? "").length;
    totalChars += len;
    if (msg.role === "user" && len > limits.maxUserMessageChars) {
      return {
        ok: false,
        error: `Your message is too long (max ${limits.maxUserMessageChars} characters). Shorten it or start a new query.`,
        status: 400,
      };
    }
  }

  if (totalChars > limits.maxTotalConversationChars) {
    return {
      ok: false,
      error: `This conversation is too long (max ${limits.maxTotalConversationChars} characters total). Start a new research query.`,
      status: 400,
    };
  }

  const att = attachments ?? [];
  if (att.length > limits.maxAttachments) {
    return {
      ok: false,
      error: `Too many attachments (max ${limits.maxAttachments}).`,
      status: 400,
    };
  }

  for (const a of att) {
    const dataLen = String(a.data ?? "").length;
    if (dataLen > limits.maxAttachmentBase64Chars) {
      return {
        ok: false,
        error: "Attachment is too large. Use a smaller file or extract text first.",
        status: 400,
      };
    }
  }

  return { ok: true };
}

let dupRedis: Redis | null | undefined;
let dupLimiter: Ratelimit | null | undefined;

function getDupRedis(): Redis | null {
  if (dupRedis !== undefined) return dupRedis;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  dupRedis = url && token ? new Redis({ url, token }) : null;
  return dupRedis;
}

function getDupLimiter(): Ratelimit | null {
  const r = getDupRedis();
  if (!r) return null;
  if (dupLimiter) return dupLimiter;
  const windowSec = envInt("AI_DUPLICATE_PROMPT_WINDOW_SEC", 45, 60, 10, 600);
  dupLimiter = new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(1, `${windowSec} s`),
    prefix: "yamale:ai:dup",
  });
  return dupLimiter;
}

/** Block identical user prompts re-fired in a short window (optional; needs Redis or uses memory). */
export async function checkDuplicatePrompt(
  userId: string,
  userQuery: string
): Promise<AiDailyCapResult> {
  const normalized = normalizePromptForDedup(userQuery);
  if (normalized.length < 24) {
    return { allowed: true };
  }

  const hash = hashPromptForDedup(userQuery);
  const identifier = `${userId}:${hash}`;
  const limiter = getDupLimiter();

  if (limiter) {
    const res = await limiter.limit(identifier);
    if (!res.success) {
      return {
        allowed: false,
        reason:
          "You sent the same question again too soon. Wait a minute or rephrase slightly before retrying.",
        status: 429,
      };
    }
    return { allowed: true };
  }

  const windowSec = envInt("AI_DUPLICATE_PROMPT_WINDOW_SEC", 45, 60, 10, 600);
  const mem = checkInMemoryRateLimit(`ai_dup:${identifier}`, {
    windowMs: windowSec * 1000,
    limit: 1,
  });
  if (!mem.allowed) {
    return {
      allowed: false,
      reason:
        "You sent the same question again too soon. Wait a minute or rephrase slightly before retrying.",
      status: 429,
    };
  }
  return { allowed: true };
}

export async function sumDailyAiQueriesForUsers(
  userIds: string[],
  usageDate: string
): Promise<number> {
  if (userIds.length === 0) return 0;
  const supabase = getSupabaseServer();
  const { data, error } = await (supabase.from("ai_usage_daily") as any)
    .select("query_count")
    .in("user_id", userIds)
    .eq("usage_date", usageDate);
  if (error || !data) return 0;
  return (data as Array<{ query_count: number }>).reduce(
    (sum, row) => sum + (row.query_count ?? 0),
    0
  );
}

async function tryReserveDailySlotRpc(
  userId: string,
  usageDate: string,
  max: number | null
): Promise<boolean> {
  if (max === null) return true;
  const supabase = getSupabaseServer();
  const { data, error } = await (supabase as any).rpc("try_reserve_ai_daily_query", {
    p_user_id: userId,
    p_usage_date: usageDate,
    p_max: max,
  });
  if (error) {
    console.error("try_reserve_ai_daily_query:", error.message ?? error);
    return false;
  }
  return data === true;
}

async function tryReserveDailySlotLegacy(
  userId: string,
  usageDate: string,
  max: number
): Promise<boolean> {
  const supabase = getSupabaseServer();
  const { data: row } = await (supabase.from("ai_usage_daily") as any)
    .select("query_count")
    .eq("user_id", userId)
    .eq("usage_date", usageDate)
    .maybeSingle();
  const count = (row as { query_count?: number } | null)?.query_count ?? 0;
  if (count >= max) return false;
  if (!row) {
    const { error } = await (supabase.from("ai_usage_daily") as any).insert({
      user_id: userId,
      usage_date: usageDate,
      query_count: 1,
    });
    return !error;
  }
  const { data: updated, error } = await (supabase.from("ai_usage_daily") as any)
    .update({ query_count: count + 1, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("usage_date", usageDate)
    .lt("query_count", max)
    .select("query_count")
    .maybeSingle();
  return !error && Boolean(updated);
}

async function tryReserveDailySlot(
  userId: string,
  usageDate: string,
  max: number | null
): Promise<boolean> {
  if (max === null) return true;
  const ok = await tryReserveDailySlotRpc(userId, usageDate, max);
  if (ok) return true;
  return tryReserveDailySlotLegacy(userId, usageDate, max);
}

/**
 * Reserve one daily AI turn in the DB before calling Claude.
 * Team members share the billing admin's org pool when configured.
 */
export async function reserveDailyAiQuery(
  userId: string,
  tier: string
): Promise<AiDailyCapResult> {
  const usageDate = getUtcUsageDateString();
  const userCap = getDailyQueryCapForTier(tier);
  const teamCap = getTeamDailyQueryCap();
  const effectiveTier = (tier || "free").toLowerCase();

  if (teamCap !== null && effectiveTier === "team") {
    const adminId = await getTeamBillingAdminUserId(userId);
    if (adminId) {
      const scopeIds = await getTeamMemberUserIds(adminId);
      const teamTotal = await sumDailyAiQueriesForUsers(scopeIds, usageDate);
      if (teamTotal >= teamCap) {
        return {
          allowed: false,
          reason: `Your organization's daily AI research limit (${teamCap} queries per day) has been reached. Try again tomorrow or contact your team admin.`,
          status: 429,
        };
      }
    }
  }

  const reserved = await tryReserveDailySlot(userId, usageDate, userCap);
  if (!reserved) {
    const cap = userCap ?? 0;
    return {
      allowed: false,
      reason: `Daily AI research limit reached (${cap} queries per day on your plan). Try again tomorrow, upgrade, or purchase pay-as-you-go queries if available.`,
      status: 429,
    };
  }

  return { allowed: true };
}
