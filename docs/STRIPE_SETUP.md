# Stripe payment setup

## 1. Environment variables

Add to `.env` (from [Stripe Dashboard](https://dashboard.stripe.com)):

- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` – Publishable key (e.g. `pk_test_...`)
- `STRIPE_SECRET_KEY` – Secret key (e.g. `sk_test_...`)
- `STRIPE_WEBHOOK_SECRET` – Webhook signing secret (e.g. `whsec_...`) after creating a webhook endpoint

## 2. Products and prices in Stripe

1. In [Stripe Dashboard → Products](https://dashboard.stripe.com/products), create a product per plan (e.g. **Basic**, **Pro**, **Team**).
2. For each product, add **recurring** prices:
   - One **monthly** price
   - One **yearly** price (optional, for annual billing)
3. Copy each **Price ID** (e.g. `price_...`) into `.env`:

```env
STRIPE_PRICE_BASIC_MONTHLY=price_...
STRIPE_PRICE_BASIC_ANNUAL=price_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_ANNUAL=price_...
STRIPE_PRICE_TEAM_MONTHLY=price_...
STRIPE_PRICE_TEAM_ANNUAL=price_...
```

Use test mode keys and prices while developing.

## 3. Webhook (for granting access after payment)

1. In [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks), click **Add endpoint**.
2. **Endpoint URL**: `https://your-domain.com/api/payments/webhook`  
   For local testing use [Stripe CLI](https://stripe.com/docs/stripe-cli):  
   `stripe listen --forward-to localhost:3000/api/payments/webhook`
3. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy the **Signing secret** (`whsec_...`) into `.env` as `STRIPE_WEBHOOK_SECRET`.

## 4. Flow

- **Checkout**: User clicks a plan on `/pricing` → `POST /api/payments/checkout` (requires sign-in) → redirect to Stripe Checkout → after payment, redirect to `/dashboard?checkout=success`.
- **Webhook**: Stripe sends `checkout.session.completed` → app updates the user’s tier in Clerk `publicMetadata` (e.g. `tier: "basic"`). On `customer.subscription.deleted`, tier is set back to `"free"`.
- **Billing portal**: `POST /api/payments/portal` with `{ customerId: "cus_..." }` returns a URL to Stripe’s customer portal (manage payment method, cancel subscription). You need to store each user’s Stripe customer ID when they first complete checkout (e.g. from the webhook or from `checkout.session.completed`).

## 5. Troubleshooting: “I paid but my plan didn’t update”

1. **Webhook must be reachable**  
   - Production: ensure the webhook endpoint URL is correct and uses HTTPS.  
   - Local: run `stripe listen --forward-to localhost:3000/api/payments/webhook` and use the CLI’s `whsec_...` as `STRIPE_WEBHOOK_SECRET`.

2. **Check that the webhook ran**  
   - Stripe Dashboard → Webhooks → your endpoint → view recent events. Confirm `checkout.session.completed` was sent and returned 2xx.  
   - On Vercel (or your host), check function logs for lines like `Webhook: tier set to basic for user_...`. If you see `Webhook: checkout.session.completed had no plan_id`, the session didn’t have plan metadata; the code will also try to read the subscription and set the tier from there.

3. **Refresh after payment**  
   - The tier is updated asynchronously by the webhook. After returning to the dashboard, refresh the page (or open Profile) so the app reloads your Clerk session and shows the new plan.
