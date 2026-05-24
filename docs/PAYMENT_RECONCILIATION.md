# Payment reconciliation cron

Catches payments where the user paid at Lomi or pawaPay but Yamalé never recorded access (missed webhook / failed browser confirm).

**Subscription / tier writes** use Clerk `publicMetadata` (last-write-wins). Duplicate webhooks are generally safe at launch; see [SUBSCRIPTION_STATE.md](./SUBSCRIPTION_STATE.md).

## How it works

1. **At checkout create** — `payment_checkout_pending` stores `payment_ref`, `user_id`, `provider`, `kind`, and metadata (via `createLomiHostedCheckoutSession` / `createPaymentPageSession`).
2. **On successful fulfillment** — row gets `fulfilled_at` (`fulfillPaymentFromMetadata`).
3. **Cron every 15 minutes** — `GET /api/cron/payment-reconciliation`:
   - Pending rows aged **5 min – 7 days**, still unfulfilled → poll provider → `fulfillPaymentFromMetadata` (idempotent + webhook ledger).
   - Legacy **`lawyer_search_purchases`** without unlock grant.
   - **`refund_requests`** in `processing` **> 20 min** → poll pawaPay refund status.

## Setup

1. Run migration `20260526400000_payment_checkout_pending.sql` on Supabase.
2. In Vercel → Settings → Environment Variables, set **`CRON_SECRET`** (random string). Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
3. Deploy (uses `crons` in `vercel.json`).

## Manual test

```bash
# Add CRON_SECRET to .env (or export it). Cron routes skip site basic auth; they use this header only.
export CRON_SECRET='your-secret'
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  "http://localhost:3000/api/cron/payment-reconciliation" | jq
```

If `ENABLE_BASIC_AUTH=true` on other routes, cron is still exempt. Do not use site basic auth for cron.

## Inspect pending checkouts

```sql
SELECT payment_ref, user_id, provider, kind, created_at, fulfilled_at
FROM payment_checkout_pending
WHERE fulfilled_at IS NULL
ORDER BY created_at DESC
LIMIT 50;
```
