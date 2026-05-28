# Load testing before go-live (k6)

Generic “50 users on `/api/query`” scripts do **not** apply to Yamalé. This repo uses:

| Endpoint | Auth | Cost | Use in load test |
|----------|------|------|------------------|
| `GET /`, `/library`, `/pricing` | No | Low | **Yes** — start here |
| `GET /api/pricing` | No | Low | **Yes** |
| `POST /api/ai/search-laws` | No | DB only | **Yes** — RAG retrieval |
| `POST /api/ai/chat` | Clerk or `AI_EVAL_SECRET` | **High (Claude)** | **Sparingly** — max ~3 VUs |

There is **no** `/api/query` route.

## Install k6

```bash
brew install k6
# or: https://grafana.com/docs/k6/latest/set-up/install-k6/
```

## 1. Smoke test (recommended first) — ~9 minutes

Tests marketing pages + pricing API. Safe for staging/production.

```bash
# Production / preview
BASE_URL=https://your-deployment.vercel.app k6 run scripts/loadtest/public-pages.js

# Local (production server, not `npm run dev`)
npm run build && npm run start
BASE_URL=http://localhost:3000 k6 run scripts/loadtest/public-pages.js
```

**Watch for:** `http_req_failed`, `p(95)` latency, Vercel **504** / **429**, Supabase connection errors in logs.

## 2. RAG search load — ~9 minutes

Hits `POST /api/ai/search-laws` (no Claude). Good proxy for DB + app under read load.

```bash
BASE_URL=https://your-deployment.vercel.app k6 run scripts/loadtest/rag-search.js
```

## 3. AI chat load (optional, expensive)

Each request can take **30–120+ seconds** and bills **Anthropic**.

1. Set on the **target** environment (Vercel → Settings → Environment Variables):
   - `AI_EVAL_SECRET` — `openssl rand -hex 32`
   - `AI_EVAL_CLERK_USER_ID` — Team/Pro Clerk user id (see [AI_GOLDEN_EVAL.md](./AI_GOLDEN_EVAL.md))

2. Run with **low** concurrency (script caps at 3 VUs, ~45s between calls per user):

```bash
BASE_URL=https://your-deployment.vercel.app \
AI_EVAL_SECRET=your-secret \
k6 run scripts/loadtest/ai-chat.js
```

**Do not** ramp AI chat to 50 VUs unless you intend a large Anthropic bill and may hit Vercel timeouts.

## npm shortcuts

```bash
npm run loadtest:smoke
npm run loadtest:rag
npm run loadtest:ai   # requires AI_EVAL_SECRET in env
```

Override base URL:

```bash
BASE_URL=https://staging.example.com npm run loadtest:smoke
```

## What to watch while k6 runs

1. **k6 summary** — `http_req_failed`, `p(95)`, custom `errors` rate.
2. **Vercel** — Functions duration, error rate, concurrency limits.
3. **Supabase** — CPU, connections, statement timeouts.
4. **Anthropic** — usage dashboard (only if running `ai-chat.js`).
5. **Upstash** (if rate limits enabled) — throttling on hot routes.

## Interpreting results

| Symptom | Likely cause |
|---------|----------------|
| 504 / function timeout | AI route duration; reduce VUs or optimize RAG |
| 429 | Plan limits or rate limiter |
| 401 on AI chat | Missing/wrong `AI_EVAL_SECRET` on server or k6 |
| Slow `p(95)` on `/library` | Large server render / catalog fetch — expected under load |
| High failure only on preview | Cold starts; rerun or use production |

## Dev vs production

- **`npm run dev`** — HMR and single-threaded Node distort timings; do not use for go-live numbers.
- Use **`npm run build && npm run start`** locally, or test the **Vercel preview/production** URL.

## Security

- Never commit `AI_EVAL_SECRET`.
- Rotate `AI_EVAL_SECRET` after load tests on shared staging.
- Restrict who can call `POST /api/ai/chat` with the eval bearer in production (treat like an admin key).
