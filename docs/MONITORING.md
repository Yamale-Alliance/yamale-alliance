# Error monitoring (Sentry)

Yamalé uses [Sentry](https://sentry.io) for client + server errors, with tagged events on launch-critical flows.

## Setup

1. Create a Sentry project (platform: **Next.js**).
2. Add env vars (local `.env` + Vercel **Production** and **Preview**):

```env
NEXT_PUBLIC_SENTRY_DSN=https://…@….ingest.sentry.io/…
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=yamale-alliance
SENTRY_AUTH_TOKEN=sntrys_…
```

`SENTRY_AUTH_TOKEN` is only needed for **source map upload** on CI/Vercel builds (create under Sentry → Settings → Auth Tokens, scope: `project:releases`).

3. Redeploy. Without `NEXT_PUBLIC_SENTRY_DSN`, monitoring is disabled (no-op).

Optional: connect the **Vercel** integration in Sentry for deployment markers and serverless metrics.

## What is captured automatically

- Unhandled exceptions on API routes (`onRequestError` in `instrumentation.ts`)
- React client errors (`instrumentation-client.ts`, `app/global-error.tsx`)
- Performance traces (10% sample in production)

## Tagged operations (for alerts)

Helpers in `lib/monitoring.ts` set `area` and `operation` tags:

| Tag | Routes / cases |
|-----|----------------|
| `area:webhooks` | `/api/lomi/webhook` (Lomi + pawaPay) 500s |
| `area:payments` | `confirm-payment`, `confirm-day-pass`, cart/marketplace/library confirm |
| `area:ai` | Claude HTTP errors, `/api/ai/chat` stream/request failures |

## Recommended Sentry alerts

Create these under **Alerts → Create Alert** (Issues or Metric, depending on plan).

### 1. Webhook 500s

- **Type:** Issues  
- **When:** `area` equals `webhooks` AND event level is `error`  
- **Action:** Email/Slack immediately  
- **Threshold:** 1 event in 5 minutes (or 3 in 15 min to reduce noise)

### 2. Payment confirm failures

- **When:** `area` equals `payments` AND `operation` equals `confirm_payment`  
- **Action:** Email/Slack  
- **Threshold:** 2+ events in 10 minutes

### 3. Claude / AI chat errors

- **When:** `area` equals `ai`  
- **Filter (optional):** `operation` is `claude_api` OR `ai_chat`  
- **Action:** Email/Slack  
- **Threshold:** 5+ events in 15 minutes (rate limits can spike)

### 4. General 5xx rate (Vercel + Sentry)

**Option A — Sentry metric (if available on your plan):**

- Metric: `count()` of transactions where `http.status_code` ≥ 500  
- Threshold: &gt; 10 in 5 minutes  

**Option B — Vercel:**

- Vercel → Project → Observability → alert on **5xx rate** or **function error rate**  
- Point notifications to the same Slack channel as Sentry  

Use both: Vercel catches infra/timeouts; Sentry catches stack traces and tagged business flows.

## Verify

1. Deploy with DSN set.  
2. Trigger a test event (dev only): temporarily call `captureMonitoredException(new Error("sentry test"), { area: "api", operation: "manual_test" })` from a route, or use Sentry → Settings → Client Keys → “Send test event”.  
3. Confirm issues appear with correct `area` / `operation` tags before enabling alert rules.

## Privacy

- `sendDefaultPii` is **false** (no automatic user IP/email in Sentry).  
- Do not pass raw payment card data or full webhook bodies into `extra` fields.
