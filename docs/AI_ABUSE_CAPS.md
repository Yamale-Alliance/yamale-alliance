# AI cost and abuse caps

Hard limits applied in `POST /api/ai/chat` **before** RAG retrieval and Claude calls, so runaway usage cannot burn API budget even when monthly plan limits or pay-as-you-go still allow turns.

## Enforcement order

1. Clerk auth
2. Monthly plan / pay-as-you-go (`getAiUsage`, `consumePayAsYouGoPurchase`)
3. Request size validation (`validateAiChatRequest`)
4. Duplicate prompt throttle (`checkDuplicatePrompt`) — skipped for platform-guide / assistant-workflow meta turns
5. Daily DB reserve (`reserveDailyAiQuery`) — same skip as duplicate for meta turns
6. RAG + Claude

## Daily cap (database)

Migration: `supabase/migrations/20260526600000_ai_abuse_caps.sql`

- Table `ai_usage_daily` — `(user_id, usage_date UTC, query_count)`
- RPC `try_reserve_ai_daily_query(user_id, date, max)` — atomic increment only if under cap

Per-tier defaults when env unset (production is stricter):

| Tier  | Dev | Prod |
|-------|-----|------|
| free  | 5   | 3    |
| basic | 25  | 15   |
| pro   | 80  | 50   |
| team  | 60  | 40   |

Override with `AI_DAILY_QUERY_CAP_FREE`, `AI_DAILY_QUERY_CAP_BASIC`, etc. Set `0` or `unlimited` to disable per tier.

**Team org pool:** When the effective tier is `team` and the user belongs to a billing admin’s org, `AI_TEAM_DAILY_QUERY_CAP` (default 150 prod / 250 dev) applies to the **sum** of all member daily counts before the per-user reserve.

Apply the migration in Supabase before deploy; without it, a legacy read/update fallback is used (less safe under concurrency).

## Message and RAG size

Controlled in `lib/ai-abuse-caps.ts` and `lib/ai-rag-context-budget.ts`. Explicit env vars always win; when unset, **production** uses lower defaults than local dev.

Do not copy large dev `.env` RAG values into production unless you accept higher token cost per turn.

## Duplicate prompts

Same normalized user text (trim, lowercase, collapse whitespace) within `AI_DUPLICATE_PROMPT_WINDOW_SEC` (default 60s prod) is rejected with HTTP 429. Minimum prompt length 24 characters. Uses Upstash when configured; otherwise in-memory (per server instance only).

## Operations

- Tune caps via env; redeploy Vercel — no code change required.
- Monitor `ai_usage_daily` for users hitting caps during launch.
- Daily caps are independent of monthly `ai_usage` / plan limits — both apply.
