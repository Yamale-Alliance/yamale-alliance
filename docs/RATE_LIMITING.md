# Distributed rate limiting (Upstash Redis)

API routes are rate-limited in `proxy.ts` via `checkRateLimit()` in `lib/distributed-rate-limit.ts`.

## Why not in-memory?

On Vercel, each serverless instance has its own memory. A `Map` in `lib/rate-limit-fallback.ts` only counts hits on **that** instance, so limits are multiplied by the number of warm instances.

## Production setup (recommended)

1. Create a Redis database at [Upstash Console](https://console.upstash.com) (free tier is enough to start).
2. Add credentials to Vercel:
   - **Option A:** Vercel Marketplace → **Upstash Redis** → link project (sets env vars automatically).
   - **Option B:** Copy **UPSTASH_REDIS_REST_URL** and **UPSTASH_REDIS_REST_TOKEN** into Vercel → Project → Settings → Environment Variables (Production + Preview).
3. Redeploy.

When both variables are set, all instances share one counter in Redis.

## Local development

- **Without** Upstash env vars: limits use in-memory fallback (fine for solo dev).
- **With** Upstash env vars in `.env`: same behavior as production.

## Limits (per minute, sliding window)

| Route | Per IP | Per signed-in user |
|-------|--------|-------------------|
| `POST /api/ai/chat` | 60 | 25 |
| Other `/api/ai/*` | 80 | 25 (shared user bucket with chat) |
| `/api/payments/*`, `/api/cart/*` | 40 | 20 |
| `/api/admin/*` | 90 | — |
| Webhooks (`/api/lomi/webhook`, etc.) | 30 | — |
| Other `/api/*` | 120 | — |

Adjust buckets in `lib/distributed-rate-limit.ts` (`BUCKETS`).

Public cached GET APIs (`/api/pricing`, `/api/laws`, `/api/marketplace`) use the **`publicReadIp`** bucket (600 req/min per IP), not the generic `apiIp` (120/min), so pricing page traffic does not starve other API calls during load tests.

## Response headers

- `X-RateLimit-Limit`, `X-RateLimit-Remaining`
- `Retry-After` (seconds) on HTTP 429

## Verify in production

After deploy, check Vercel logs: no rate-limit errors. Hit an API repeatedly; you should get `429` with `Retry-After` once the bucket is full (use a single user for per-user limits).
