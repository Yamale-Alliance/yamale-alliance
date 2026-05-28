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

## 1. Smoke test (recommended first)

| Command | Profile | Max VUs | Duration | Use when |
|---------|---------|---------|----------|----------|
| `npm run loadtest:smoke` | **local** (auto if `BASE_URL` is localhost) | 5 | ~3 min | Sanity check (passed ✓) |
| `npm run loadtest:smoke:medium` | medium | 15 | ~7 min | Step up from local |
| `npm run loadtest:smoke:staging` | staging | 30 | ~9 min | Pre-launch on Vercel |
| `npm run loadtest:smoke:stress` | stress | 50 | ~21 min | Find timeouts / 429s (run completes even if thresholds fail) |
| `npm run loadtest:smoke:full` | full (+ `/library`) | 50 | ~21 min | Vercel only — heaviest pages |

**Important:** Do **not** use `npm run dev` while load testing. The dev server is single-threaded and will time out (e.g. 91% failures on `/api/pricing` with 30 VUs).

```bash
# Local — build production server first
npm run build && npm run start
# new terminal:
npm run loadtest:smoke

# Vercel
BASE_URL=https://your-deployment.vercel.app npm run loadtest:smoke:staging
```

`/library` is **excluded** from the default smoke test (it loads the full catalog). Use `npm run loadtest:library` against staging only.

**Watch for:** `http_req_failed`, `p(95)` latency, Vercel **504** / **429**, Supabase connection errors in logs.

### If smoke fails with ~90% timeouts on localhost

1. Stop `npm run dev` — use `npm run start` only.  
2. Use `npm run loadtest:smoke` (5 VUs), not `loadtest:smoke:staging` (30 VUs).  
3. Confirm the app responds: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/`

### If smoke fails with ~75% errors but fast latency (p95 &lt; 500ms)

Usually **`ENABLE_BASIC_AUTH=true`**: HTML pages return **401**, while `GET /api/pricing` is exempt (~25% of requests pass).

```bash
BASIC_AUTH_USERNAME=yamale BASIC_AUTH_PASSWORD=your-password npm run loadtest:smoke
```

Or disable basic auth locally while load testing.

### Reading stress results

After `loadtest:smoke:stress` or `:staging`, open **`loadtest-summary.json`** in the repo root (written by k6). Look for:

- `metrics.path_failure` — tagged by `path` and `kind` (`timeout`, `rate_limit_429`, `server_504`, …)
- `metrics.http_req_duration` groups tagged `name:/api/pricing` etc. — which route is slowest at p95

The run **does not abort early** on threshold failures so you see the full ramp. Exit code may still be non-zero if error rate is high — that is expected while stress testing.

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
npm run loadtest:smoke          # 5 VUs — localhost sanity
npm run loadtest:smoke:medium   # 15 VUs
npm run loadtest:smoke:staging  # 30 VUs — prefer Vercel
npm run loadtest:smoke:stress   # 50 VUs — find breaking points
npm run loadtest:smoke:full     # 50 VUs + /library — Vercel only
npm run loadtest:library        # /library only — Vercel only
npm run loadtest:rag
npm run loadtest:ai             # requires AI_EVAL_SECRET in env
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
| 429 | Plan limits or rate limiter (`apiIp` 120/min; public GETs use `publicReadIp` 600/min) |
| ~44% fail, p95 &lt; 1s | Often **304 Not Modified** counted as fail (fixed in script) + **429** on `/api/pricing` before public-read bucket |
| 401 on AI chat | Missing/wrong `AI_EVAL_SECRET` on server or k6 |
| Slow `p(95)` on `/library` | Large server render / catalog fetch — use `loadtest:library` on Vercel only |
| ~90% timeout on `localhost` with 30 VUs | Ran staging profile against `npm run dev` — use `loadtest:smoke` + `npm run start` |
| High failure only on preview | Cold starts; rerun or use production |

## Dev vs production

- **`npm run dev`** — HMR and single-threaded Node distort timings; do not use for go-live numbers.
- Use **`npm run build && npm run start`** locally, or test the **Vercel preview/production** URL.

## Security

- Never commit `AI_EVAL_SECRET`.
- Rotate `AI_EVAL_SECRET` after load tests on shared staging.
- Restrict who can call `POST /api/ai/chat` with the eval bearer in production (treat like an admin key).
