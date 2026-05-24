# Subscription state and Clerk metadata

Yamalé stores **plan tier**, **billing period**, **day pass**, and **team extra seats** in Clerk `publicMetadata`. That is the runtime source of truth today. It is **not** transactionally safe: each fulfillment does read → merge → `updateUserMetadata` (last-write-wins).

## Launch posture (acceptable for ~100 users)

**Duplicate payment webhooks are generally fine** when our existing guards apply:

| Layer | What it does |
|-------|----------------|
| `payment_webhook_events` | One successful processing per `(provider, event_id)`. Lomi retries with the same `id` are no-ops. Failed handlers release the claim so retries can run. |
| Reconciliation cron | Uses a **different** event id (`reconcile:pending:{payment_ref}`) and only rows with `payment_checkout_pending.fulfilled_at IS NULL`. |
| PAYG / marketplace | Upserts on stable keys (`stripe_session_id`, `user_id + marketplace_item_id`). |
| Subscription re-apply | Same `plan_id` + `payment_ref` usually rewrites the same tier/period fields (mostly idempotent in practice). |

**Why this is OK at launch:** Providers retry the **same** delivery; we dedupe that. Most users get one success path (webhook **or** browser confirm **or** reconciliation), not three conflicting writes.

**Residual risks (document, do not panic):**

1. **Concurrent different payments** for one user (rare) — two webhooks interleave; the later Clerk write wins. No merge conflict detection.
2. **`team_extra_seats`** — fulfillment does `current + seats`. A duplicate fulfillment **without** webhook dedupe would double-add seats. Webhook idempotency prevents this for the same event; reconciliation uses a separate event id — mitigated because pending is marked fulfilled after the first success.
3. **Day pass** — each fulfillment sets `day_pass_expires_at` to now + 24h. A stray duplicate could shorten/reset the window depending on timing.
4. **Subscription period** — `fulfillSubscriptionPlanPayment` sets `subscription_period_start` to **now** on new/renewal. A duplicate apply (e.g. webhook + confirm route both without shared event id) could reset the period. Monitor `payment_checkout_pending` and webhook logs.
5. **Admin PATCH** vs payment webhook — manual tier edits can be overwritten by a late webhook or vice versa.

None of these are PostgreSQL transactions; they are **Clerk document updates**.

## What is stored in Clerk (reference)

| Field | Purpose |
|-------|---------|
| `tier` | `free`, `basic`, `pro`, `team` |
| `subscription_period_start` / `subscription_period_end` | Paid period (ISO strings) |
| `subscription_interval` | `monthly` \| `annual` |
| `subscription_cancel_at_period_end` | Cancel at end flag |
| `subscription_scheduled_tier` | Downgrade scheduled for period end |
| `subscription_payment_provider` | `lomi` \| `pawapay` |
| `subscription_grant` | Admin complimentary grant |
| `subscriber_since` | First paid date |
| `team_admin` / `team_extra_seats` | Team billing |
| `day_pass_expires_at` / `day_pass_last_purchase_at` | 24h pass |

Code: `lib/subscription-state.ts`, `lib/payment-webhook-fulfillment.ts`, `app/api/subscription/route.ts`.

## Webhook and confirm flows

- **Lomi / pawaPay:** `app/api/lomi/webhook/route.ts` → `runIdempotentPaymentWebhook` → `fulfillPaymentFromMetadata`.
- **Browser return:** `confirm-payment`, `confirm-day-pass`, etc. may call fulfillment directly — see each route; prefer webhook as source of truth when both fire.
- **Stuck checkouts:** `docs/PAYMENT_RECONCILIATION.md` — cron polls provider then fulfills with idempotency key `reconcile:pending:{payment_ref}`.

See also `docs/LOMI_WEBHOOK_INTEGRATION.md` §6 (idempotency).

## Longer term: `subscription_ledger`

Migration: `supabase/migrations/20260526700000_subscription_ledger.sql`

**Goal:** Append-only **one row per payment event** that affects subscription-like state (plan, day pass, team seats). Clerk metadata becomes a **projection** derived from the ledger, not the authoritative log.

| Today | Target |
|-------|--------|
| Clerk `publicMetadata` = source of truth | Ledger = source of truth; Clerk = cache for JWT/session |
| Last-write-wins | Replay events in order; detect duplicate `payment_ref` |
| Debug via Clerk dashboard | SQL audit: who paid, when, what changed |

**Not wired as source of truth yet.** Optional append via `recordSubscriptionLedgerEntry` in `lib/subscription-ledger.ts` logs rows when the table exists; reads still use Clerk.

### Planned rollout

1. Apply migration on Supabase.
2. Append on every subscription-related fulfillment (already callable from fulfillment).
3. Admin/support tools read ledger for disputes.
4. `applySubscriptionFromLedger(userId)` replays events → updates Clerk (or replace Clerk tier with DB + short-lived claims).
5. Deprecate blind `publicMetadata` patches except from the projector.

## Operations checklist

- [ ] `payment_webhook_events` and `payment_checkout_pending` migrations applied.
- [ ] `subscription_ledger` migration applied when you want audit rows.
- [ ] `LOMI_WEBHOOK_SECRET` set; webhook returns 200 on duplicates.
- [ ] On tier disputes: check Clerk user, `payment_checkout_pending`, `payment_webhook_events`, then `subscription_ledger` (newest first).
