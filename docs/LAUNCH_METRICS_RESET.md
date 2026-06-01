# Reset launch metrics (revenue, analytics, AI usage)

Use this after go-live when you want **admin dashboards to start from zero** and drop pre-production test purchases and AI query history.

## Admin UI

1. Sign in as an **admin**.
2. Open **Platform Settings** (`/admin-panel/settings`), **AI Usage** (`/admin-panel/ai-usage`), or **Revenue → Analytics** (`/admin-panel/revenue?tab=analytics`).
3. Scroll to **Reset launch metrics**.
4. Choose scope:
   - **Everything** — revenue/purchase tables + AI usage
   - **Revenue & purchases only** — analytics, vault, library PDF, lawyer unlocks
   - **AI usage only** — `ai_usage`, `ai_usage_daily`, `ai_query_log`, feedback, bug reports
5. Type `RESET_LAUNCH_METRICS` and confirm.

## API

```http
POST /api/admin/reset-launch-metrics
Content-Type: application/json

{
  "confirm": "RESET_LAUNCH_METRICS",
  "scope": "all"
}
```

`scope` is optional: `"all"` (default), `"revenue"`, or `"ai"`.

## What gets cleared

| Area | Tables |
|------|--------|
| Revenue / analytics | `marketplace_purchases`, `pay_as_you_go_purchases`, `lawyer_unlocks`, `lawyer_search_*`, `subscription_ledger`, `refund_requests`, carts, payment webhook/pending logs, `afcfta_report_usage` |
| AI usage | `ai_usage`, `ai_usage_daily`, `ai_query_log`, `ai_response_feedback`, `ai_bug_reports` |

## Important warnings

- **User access:** Deleting purchase rows removes vault, library PDF, lawyer, and PAYG entitlements that depend only on those rows. Only run this if test data should no longer grant access.
- **Subscriptions:** New-subscriber and MRR figures on Analytics also use **Clerk** `publicMetadata` (`subscriberSince`, tier). This reset does **not** clear Clerk. Adjust or remove test subscribers in Clerk if subscription cards should be zero too.
- **Audit:** Each reset is logged in `admin_audit_log` as `launch_metrics.reset`.

## Manual SQL (Supabase SQL editor)

If you prefer SQL, run in dependency order (same as the API). Example for a full wipe:

```sql
-- Children first
DELETE FROM ai_response_feedback;
DELETE FROM ai_bug_reports;
DELETE FROM refund_requests;
DELETE FROM shopping_cart_items;
DELETE FROM payment_webhook_events;
DELETE FROM payment_checkout_pending;
DELETE FROM marketplace_purchases;
DELETE FROM pay_as_you_go_purchases;
DELETE FROM lawyer_search_unlock_grants;
DELETE FROM lawyer_search_unlocks;
DELETE FROM lawyer_search_purchases;
DELETE FROM lawyer_unlocks;
DELETE FROM subscription_ledger;
DELETE FROM afcfta_report_usage;
DELETE FROM ai_query_log;
DELETE FROM ai_usage;
DELETE FROM ai_usage_daily;
```

Back up production data before running in production.
