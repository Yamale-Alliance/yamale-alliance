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
2. **Endpoint URL**: `https://your-domain.com/api/stripe/webhook`  
   For local testing use [Stripe CLI](https://stripe.com/docs/stripe-cli):  
   `stripe listen --forward-to localhost:3000/api/stripe/webhook`
3. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy the **Signing secret** (`whsec_...`) into `.env` as `STRIPE_WEBHOOK_SECRET`.

## 4. Flow

- **Checkout**: User clicks a plan on `/pricing` → `POST /api/stripe/checkout` (requires sign-in) → redirect to Stripe Checkout → after payment, redirect to `/dashboard?checkout=success`.
- **Webhook**: Stripe sends `checkout.session.completed` → app updates the user’s tier in Clerk `publicMetadata` (e.g. `tier: "basic"`). On `customer.subscription.deleted`, tier is set back to `"free"`.
- **Billing portal**: `POST /api/stripe/portal` with `{ customerId: "cus_..." }` returns a URL to Stripe’s customer portal (manage payment method, cancel subscription). You need to store each user’s Stripe customer ID when they first complete checkout (e.g. from the webhook or from `checkout.session.completed`).
