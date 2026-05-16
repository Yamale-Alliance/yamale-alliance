# Yamalé × Lomi — Webhook integration brief

**For:** Babacar (Lomi)  
**From:** Yamalé Legal Platform engineering  
**Last updated:** May 2026  
**Code reference:** `app/api/lomi/webhook/route.ts`, `lib/lomi-checkout.ts`, `lib/payment-webhook-fulfillment.ts`

---

## 1. Webhook endpoint

| Environment | URL |
|-------------|-----|
| **Production** | `https://yamale-alliance.vercel.app/api/lomi/webhook` |
| **Staging / preview** | Same path on the deployed preview host (e.g. `https://<preview-host>/api/lomi/webhook`) |

- **Method:** `POST` only  
- **Auth:** No Clerk session, no `X-API-Key` on inbound webhooks  
- **Content-Type:** `application/json` (raw body is used for signature verification)  
- **Public route:** Listed in app middleware as an unauthenticated payment callback (rate-limited ~30 req/min per IP)

Please register the **production** URL in the Lomi dashboard (or via `POST /webhooks`) and subscribe at minimum to **`PAYMENT_SUCCEEDED`**.

---

## 2. Signature verification (our implementation)

We follow [Lomi webhooks](https://docs.lomi.africa/reference/payments/webhooks):

| Item | Value |
|------|--------|
| Header | `X-Lomi-Signature` (case-insensitive) |
| Secret | `LOMI_WEBHOOK_SECRET` on our server (format `whsec_…` from Lomi when the webhook is created) |
| Algorithm | **HMAC-SHA256** over the **exact raw request body** (UTF-8 string, no re-serialization) |
| Digest | Hex string; we also accept `sha256=<hex>` prefix |

**Pseudo-code (matches our code):**

```text
expected = HMAC_SHA256(secret, rawBody).hexdigest()
provided = header("X-Lomi-Signature")  // strip optional "sha256=" prefix
timing_safe_equal(provided, expected)
```

- Invalid signature → **`401`** `{ "error": "Invalid Lomi webhook signature" }`  
- Invalid JSON → **`400`**  
- Valid Lomi webhook processed → **`200`** `{ "received": true }` (including events we ignore after signature check)

**Important:** Outbound webhooks must **not** rely on `X-API-Key`; that header is only for our server → Lomi API calls (`LOMI_API_KEY`).

---

## 3. Events we handle

| Event | Our behaviour |
|-------|----------------|
| `test.webhook` | Acknowledge with `200` and **no side effects** (dashboard / `POST /webhooks/{id}/test`). |
| `PAYMENT_SUCCEEDED` | Read `data.metadata`, `data.checkout_session_id`, `data.transaction_id`; fulfill purchase (see §5). |
| Other events | Acknowledge `200` `{ "received": true }` only (no fulfillment today). |

If fulfillment throws, we return **`500`** `{ "error": "Webhook handler failed" }` so Lomi can retry. Handlers are written to be **idempotent** (see §6).

---

## 4. Expected webhook payload shape

We parse a top-level JSON object roughly like:

```json
{
  "id": "evt_…",
  "event": "PAYMENT_SUCCEEDED",
  "data": {
    "metadata": { },
    "checkout_session_id": "cs_…",
    "transaction_id": "txn_…"
  }
}
```

**Fields we rely on for `PAYMENT_SUCCEEDED`:**

| Field | Required | Notes |
|-------|----------|--------|
| `event` | Yes | Must be `PAYMENT_SUCCEEDED` to trigger fulfillment. |
| `data.metadata` | Yes | Flat string key/value map (see §5). Must include `clerk_user_id` and `kind`. |
| `data.checkout_session_id` | Strongly preferred | Stored as payment reference; used in browser return URLs for some flows. |
| `data.transaction_id` | Optional but helpful | For pay-as-you-go flows we may fulfill **twice** (once per ID) when both differ — see §6. |

Please ensure **`metadata` on the checkout session is echoed unchanged** on the webhook `data` object (including nested objects flattened to strings if needed).

---

## 5. Checkout `metadata` contract

We attach metadata when creating hosted checkout sessions via `@lomi./sdk` (`checkoutSessions.create`). All values are strings.

### Common keys

| Key | Description |
|-----|-------------|
| `clerk_user_id` | Yamalé user ID (Clerk). **Required** for fulfillment. |
| `kind` | Product type discriminator (see table below). Hyphens normalized to underscores server-side. |
| `payment_provider` | Often `lomi` on subscription checkouts. |

### `kind` values and extra metadata

| `kind` | Purpose | Extra metadata keys |
|--------|---------|---------------------|
| `subscription_plan` | Basic / Pro / Team subscription | `plan_id` (`basic` \| `pro` \| `team`), `interval` (`monthly` \| `annual`), optional `change_type` |
| `payg_document` | One law PDF download unlock | `law_id` (UUID) |
| `payg_ai_query` | One-off AI research credit | — |
| `payg_afcfta_report` | AfCFTA report unlock | — |
| `payg_lawyer_search` | Lawyer directory search unlock | `country`, `expertise` |
| `lawyer_unlock` | Unlock one lawyer profile | `lawyer_id` |
| `marketplace` | Single Vault item purchase | `marketplace_item_id` |
| `marketplace_cart` | Cart checkout | `item_ids` (comma-separated UUIDs) |
| `team_extra_seats` | Team add-on seats | `seats` (number as string) |
| `day-pass` | 24h day pass | `plan_id` = `day-pass` |

**Amounts on checkout create:** We pass **major currency units** to Lomi (e.g. `4.50` USD for 450 cents). Supported currencies: **USD**, **EUR**, **XOF**.

**API hosts we use:**

| Environment | Base URL |
|-------------|----------|
| Live | `https://api.lomi.africa` |
| Test / sandbox | `https://sandbox.api.lomi.africa` |

(`LOMI_ENVIRONMENT=live` \| `test`; API key prefix must match: `lomi_sk_live_…` vs `lomi_sk_test_…`.)

---

## 6. Idempotency and duplicate references

1. **Idempotent writes:** Fulfillment checks existing rows (e.g. `pay_as_you_go_purchases.stripe_session_id` — legacy column name, stores Lomi checkout or transaction IDs) before insert.

2. **Pay-as-you-go double reference:** For `kind` in `payg_document`, `payg_ai_query`, `payg_afcfta_report`, if both `checkout_session_id` and `transaction_id` are present and **different**, we run fulfillment **once per ID** so either identifier can match the user’s return URL or a later reconciliation job.

3. **Retries:** Safe to retry `PAYMENT_SUCCEEDED`; duplicate inserts are skipped when the same `paymentRefId` already exists.

---

## 7. Response summary

| Status | Body | When |
|--------|------|------|
| `200` | `{ "received": true }` | Success, test webhook, or non-handled event after valid signature |
| `400` | `{ "error": "Invalid JSON" }` | Body not JSON |
| `401` | `{ "error": "Invalid Lomi webhook signature" }` | Bad or missing `X-Lomi-Signature` |
| `500` | `{ "error": "Webhook handler failed" }` | Fulfillment error (retry expected) |

We aim to respond within Lomi’s ~**4s** timeout; heavy work is DB writes only (no long external calls in the webhook path).

---

## 8. What we need from Lomi (checklist)

- [ ] Confirm production webhook URL: `https://yamale-alliance.vercel.app/api/lomi/webhook`  
- [ ] Subscribe **`PAYMENT_SUCCEEDED`** (and send `test.webhook` for connectivity tests)  
- [ ] Share **`whsec_…`** signing secret for our `LOMI_WEBHOOK_SECRET`  
- [ ] Confirm **`metadata`** on checkout sessions is returned on webhooks as we set it on create  
- [ ] Confirm both **`checkout_session_id`** and **`transaction_id`** when available on success events  
- [ ] Confirm retry policy if we return `500`  

---

## 9. Note on shared URL (pawaPay)

The same path `/api/lomi/webhook` also accepts **pawaPay** deposit callbacks when **`X-Lomi-Signature` is absent** (different JSON shape + optional `x-webhook-token`). Lomi deliveries should always include **`X-Lomi-Signature`** so they are routed to the Lomi branch above.

---

## 10. References

- [Lomi — Setup & integration](https://docs.lomi.africa/reference/setup/integration)  
- [Lomi — Webhooks](https://docs.lomi.africa/reference/payments/webhooks)  
- Yamalé repo: `.env.example` (`LOMI_API_KEY`, `LOMI_WEBHOOK_SECRET`, `LOMI_ENVIRONMENT`)

