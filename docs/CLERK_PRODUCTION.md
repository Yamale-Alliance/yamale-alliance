# Clerk production setup (yamalelegal.com)

## `failed_to_load_clerk_js` / `clerk.yamalelegal.com`

If the console shows:

```text
Failed to load script: https://clerk.yamalelegal.com/npm/@clerk/clerk-js@5/dist/clerk.browser.js
(code="failed_to_load_clerk_js")
```

your **production** Clerk instance uses a **custom Frontend API** at `clerk.yamalelegal.com`, but the browser cannot load that script (DNS, CSP, or ad-blocker).

**If DNS is already set in Clerk** and `curl -I https://clerk.yamalelegal.com/npm/@clerk/clerk-js@5/dist/clerk.browser.js` returns **200**, the usual remaining cause is **Content-Security-Policy** blocking `clerk.yamalelegal.com` on `localhost` (fixed in code by reading your publishable key). Restart `npm run dev` after pulling the latest code.

**If DNS is not ready** (NXDOMAIN):

**Fix (choose one):**

### A — Finish Clerk custom domain (recommended for production)

1. Clerk Dashboard → your **production** instance → **Domains** (or **Configure** → custom domains).
2. Add the DNS records Clerk shows (typically CNAMEs for `clerk.yamalelegal.com` and `accounts.yamalelegal.com` at your DNS host).
3. Wait until Clerk shows the domain as **Verified** / **Active** (can take up to 48h).
4. Confirm in a terminal: `curl -I https://clerk.yamalelegal.com/npm/@clerk/clerk-js@5/dist/clerk.browser.js` returns **200**, not “could not resolve host”.

Then redeploy with `NEXT_PUBLIC_APP_URL=https://www.yamalelegal.com` (and optional `NEXT_PUBLIC_CLERK_FRONTEND_API=clerk.yamalelegal.com`).

### B — Disable custom domain until DNS is ready

In Clerk, turn off or remove the custom `clerk.yamalelegal.com` domain so the instance uses the default `*.clerk.accounts.dev` Frontend API again. Redeploy with the **new** `pk_live_` / `sk_live_` keys if Clerk regenerates them.

### C — Local development (`localhost`)

**Production keys (`pk_live_` / `sk_live_`) do not work on `localhost`.** Clerk returns:

```text
Production Keys are only allowed for domain "yamalelegal.com".
The Request HTTP Origin header must be equal to or a subdomain of the requesting URL.
```

`localhost` is not a subdomain of `yamalelegal.com`, so this is expected.

**Fix:** use a separate `.env.local` (gitignored) with keys from your Clerk **Development** instance:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_…
CLERK_SECRET_KEY=sk_test_…
```

Remove or override any `pk_live_` values from `.env` when running locally (Next.js loads `.env.local` after `.env` and wins for the same variable).

Restart `npm run dev`. Scripts load from `https://<slug>.clerk.accounts.dev/...`.

To test **production** Clerk, use `https://www.yamalelegal.com` (deployed site), not localhost.

---

If the header shows a **spinner** instead of **Log in / Sign up**, Clerk’s client SDK never finished loading (`useUser().isLoaded` stays `false`).

## 1. Production keys on your host (Vercel, etc.)

Set these for the **production** environment and **redeploy** after changing them:

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_…` from your **production** Clerk instance |
| `CLERK_SECRET_KEY` | `sk_live_…` from the same instance |
| `NEXT_PUBLIC_APP_URL` | `https://www.yamalelegal.com` |

Do **not** use `pk_test_` / `sk_test_` on the live site.

`NEXT_PUBLIC_*` variables are baked in at **build** time — trigger a new deployment after updating them.

## 2. Clerk Dashboard → Domains

Under your **production** instance, add:

- `https://www.yamalelegal.com`
- `https://yamalelegal.com`

Use the exact URLs users visit (including `www` if that is canonical).

## 3. Custom Clerk domain (if enabled)

If Clerk shows a Frontend API like `clerk.yamalelegal.com`:

1. Complete DNS in Clerk’s domain setup.
2. Set on your host:
   ```bash
   NEXT_PUBLIC_CLERK_FRONTEND_API=clerk.yamalelegal.com
   ```
3. Redeploy (CSP allows `clerk.yamalelegal.com` when `NEXT_PUBLIC_APP_URL` or this variable is set).

## 4. Verify in the browser

1. Open `https://www.yamalelegal.com`
2. DevTools → **Console** — look for Clerk or CSP errors (`blocked by Content-Security-Policy`, invalid publishable key, etc.).
3. DevTools → **Network** — filter `clerk`; confirm requests return 200, not 403/blocked.

## 5. App behaviour after fixes

- When Clerk loads: header shows **Log in** / **Sign up** (or account menu if signed in).
- If Clerk still fails after ~6s: header falls back to **Log in** / **Sign up** anyway (no infinite spinner).
- If `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is missing at build: guest header shows immediately.

## 6. Sign-in / sign-up URL env vars

This app’s routes:

| Route | Page |
|-------|------|
| `/sign-in` | Sign in |
| `/signup` | Sign up (client accounts) |
| `/sign-up` | Redirects to `/signup` (alias for Clerk / legacy links) |

**Use:**

```env
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/signup
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/api/auth/complete-signup?role=user
```

**Avoid:**

- `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up` without the redirect page (was missing; now `/sign-up` → `/signup`).
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` / `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` — deprecated in Clerk v6; use `*_FALLBACK_REDIRECT_URL` or `*_FORCE_REDIRECT_URL` instead.
- `NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL=/dashboard` — skips `complete-signup`, so new users may not get the `user` role in metadata.

Wrong sign-up URLs usually break **modals and redirects**, not the header spinner by themselves. The spinner is still most often missing `pk_live_` keys or Clerk domain/CSP issues (sections 1–4 above).

## 7. Disable staging basic auth in production

If `ENABLE_BASIC_AUTH=true` on production, browsers must send basic auth before Clerk can load. Keep it `false` on `www.yamalelegal.com` unless you intend password-gated staging.
