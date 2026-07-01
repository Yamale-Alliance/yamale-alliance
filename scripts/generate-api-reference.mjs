#!/usr/bin/env node
/**
 * Generates API_REFERENCE.local.md — local-only API documentation (gitignored).
 * Run: node scripts/generate-api-reference.mjs
 */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "API_REFERENCE.local.md");

const routeFiles = execSync('find app/api -name route.ts | sort', { cwd: ROOT })
  .toString()
  .trim()
  .split("\n")
  .filter(Boolean);

function extractRoutes(file) {
  const content = fs.readFileSync(path.join(ROOT, file), "utf8");
  const methods = [...content.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)/g)].map(
    (m) => m[1]
  );
  const apiPath = "/" + path.dirname(file).replace(/^app\//, "");
  const guards = [];
  if (content.includes("requireAdmin(")) guards.push("requireAdmin");
  if (content.includes("requireAdminPanel(")) guards.push("requireAdminPanel");
  if (content.includes("requireLawsAccess(")) guards.push("requireLawsAccess");
  if (content.includes("requireLibraryApiSession")) guards.push("requireLibraryApiSession");
  if (content.includes("verifyCronRequest")) guards.push("CRON_SECRET");
  if (content.includes("AI_EVAL_SECRET")) guards.push("AI_EVAL_SECRET");
  if (/await auth\(\)|auth\(\)/.test(content)) guards.push("Clerk session");
  const comment = content.match(/\/\*\*([^*]|\*(?!\/))*\*\//)?.[0]?.replace(/\s*\*\s?/g, " ").trim() ?? "";
  return { apiPath, methods, guards: [...new Set(guards)], comment, file };
}

const routes = routeFiles.map(extractRoutes);

function groupKey(apiPath) {
  const parts = apiPath.split("/").filter(Boolean);
  if (parts[0] !== "api") return "other";
  if (parts[1] === "admin") return "admin";
  return parts[1] ?? "other";
}

const groups = {};
for (const r of routes) {
  const g = groupKey(r.apiPath);
  if (!groups[g]) groups[g] = [];
  groups[g].push(r);
}

const groupOrder = [
  "admin",
  "ai",
  "laws",
  "marketplace",
  "payments",
  "lawyers",
  "lawyer",
  "cart",
  "subscription",
  "support",
  "refunds",
  "afcfta",
  "advisory",
  "team",
  "library",
  "auth",
  "cron",
  "lomi",
  "bookmarks",
  "pricing",
  "search",
  "user",
  "other",
];

const header = `# Yamalé Legal Platform — API Reference (Local)

> **CONFIDENTIAL — LOCAL ONLY**  
> This file is listed in \`.gitignore\` and must not be committed or pushed.  
> Generated: ${new Date().toISOString()}  
> Regenerate: \`node scripts/generate-api-reference.mjs\`

---

## Table of contents

1. [Overview](#1-overview)
2. [Base URL & conventions](#2-base-url--conventions)
3. [Authentication](#3-authentication)
4. [Admin MFA step-up flow](#4-admin-mfa-step-up-flow)
5. [Middleware & security layers](#5-middleware--security-layers)
6. [Standard error responses](#6-standard-error-responses)
7. [Rate limiting](#7-rate-limiting)
8. [Roles & permissions](#8-roles--permissions)
9. [Endpoint reference](#9-endpoint-reference)
10. [Detailed endpoint schemas](#10-detailed-endpoint-schemas)
11. [Webhooks & cron](#11-webhooks--cron)
12. [Environment variables](#12-environment-variables)

---

## 1. Overview

Yamalé is a Next.js App Router application. All HTTP APIs live under \`/api/*\` as Route Handlers in \`app/api/**/route.ts\`.

| Stat | Value |
|------|-------|
| Total route files | ${routeFiles.length} |
| Framework | Next.js 16 (App Router) |
| Primary auth | [Clerk](https://clerk.com) session cookies |
| Admin MFA | App-level TOTP (not Clerk MFA) |
| Payments | Lomi + pawaPay (webhook at \`/api/lomi/webhook\`) |
| Database | Supabase Postgres (service role server-side) |

---

## 2. Base URL & conventions

| Environment | Base URL |
|-------------|----------|
| Production | \`https://yamalelegal.com\` |
| Local dev | \`http://localhost:3000\` |

### Request format

- **JSON bodies**: \`Content-Type: application/json\` unless noted (multipart for uploads).
- **Auth**: Clerk session cookie (\`__session\` / \`__client\`) sent automatically by the browser with \`credentials: "include"\`.
- **Dynamic segments**: \`[id]\`, \`[userId]\`, \`[courseKey]\`, etc. in paths are URL parameters.

### Response format

- Success: JSON object or binary stream (exports, ZIP, XLSX).
- Errors: \`{ "error": string, "code"?: string, ... }\` with appropriate HTTP status.
- Streaming: \`POST /api/ai/chat\` returns \`text/event-stream\` (SSE).

### Common query parameters

| Param | Used by | Description |
|-------|---------|-------------|
| \`page\` | \`/api/laws\`, admin lists | 1-based page index |
| \`pageSize\` | \`/api/laws\` | Page size (max 100) |
| \`q\` | \`/api/laws\` | Search query |
| \`countryId\`, \`categoryId\`, \`status\` | Library/admin laws | Filters |
| \`ids\` | \`/api/laws/summaries\` | Comma-separated law UUIDs |

---

## 3. Authentication

### 3.1 Clerk user session (standard)

Most authenticated routes call \`auth()\` from \`@clerk/nextjs/server\`.

\`\`\`
Client → Request with Clerk cookies
       → proxy.ts: auth.protect() (unless public route)
       → Route handler: const { userId } = await auth()
       → 401 if !userId
\`\`\`

**401 response:**
\`\`\`json
{ "error": "Sign in required" }
\`\`\`
or
\`\`\`json
{ "error": "Sign in to access the legal library." }
\`\`\`

### 3.2 Library session (\`requireLibraryApiSession\`)

Used by \`GET /api/laws/[id]\` and \`GET /api/laws/summaries\`. Requires signed-in Clerk user; public library browse (\`GET /api/laws\`) does not.

### 3.3 Admin panel roles

Stored in Clerk \`publicMetadata.role\`:

| Role | Value | Panel access |
|------|-------|--------------|
| User | \`user\` (default) | None |
| Full admin | \`admin\` | Full \`/admin-panel\` + all \`/api/admin/*\` |
| Legal admin | \`legal_admin\` | Laws section only + MFA + session |

**403 response (no panel role):**
\`\`\`json
{ "error": "Forbidden" }
\`\`\`

### 3.4 Admin route guards

| Guard | Who passes | Used for |
|-------|------------|----------|
| \`requireAdminPanel()\` | \`admin\` or \`legal_admin\` + MFA step-up | MFA routes, panel-wide |
| \`requireAdmin()\` | \`admin\` only + MFA | Most admin APIs |
| \`requireLawsAccess()\` | \`admin\` or \`legal_admin\` + MFA | Law CRUD (with extra ownership checks) |

### 3.5 AI eval bypass

\`POST /api/ai/chat\` accepts \`Authorization: Bearer <AI_EVAL_SECRET>\` for batch evaluation (no Clerk). Requires \`AI_EVAL_CLERK_USER_ID\` in env for the eval user context.

### 3.6 Cron

\`GET /api/cron/*\` requires \`Authorization: Bearer <CRON_SECRET>\` (verified in handler).

### 3.7 Payment webhooks

\`POST /api/lomi/webhook\` — no Clerk. Verified via Lomi \`X-Lomi-Signature\` HMAC or pawaPay callback token.

---

## 4. Admin MFA step-up flow

Admin and legal_admin users must complete **app-level TOTP** before accessing protected admin routes.

\`\`\`
1. User signs in via Clerk
2. User navigates to /admin-panel/*
3. proxy.ts checks admin_mfa_step_up cookie
4. If missing/expired → redirect to /admin-panel/mfa?returnTo=...&reason=expired
5. User enrolls (first time) or enters 6-digit code
6. POST /api/admin/mfa { action: "verify" | "confirm-enroll", code: "123456" }
7. Server sets httpOnly cookie admin_mfa_step_up (signed, sliding idle window)
8. User redirected to returnTo
\`\`\`

### MFA cookie

| Property | Value |
|----------|-------|
| Name | \`admin_mfa_step_up\` |
| Type | httpOnly, SameSite=Lax, Secure (prod) |
| Idle timeout | Configurable in \`admin_security_settings\` (default 30 min) |
| Absolute max | \`ADMIN_MFA_SESSION_TTL_SEC\` (default 12h) |
| Cleared on | Sign-out (avatar menu), MFA logout action, idle expiry redirect |

### MFA API codes

| code | HTTP | Meaning |
|------|------|---------|
| \`MFA_ENROLLMENT_REQUIRED\` | 403 | TOTP not enrolled |
| \`MFA_REQUIRED\` | 403 | Step-up cookie missing |
| \`MFA_SESSION_EXPIRED\` | 403 | Idle timeout exceeded |

### Disable MFA (local dev only)

Set \`ADMIN_MFA_DISABLED=true\` in \`.env\`.

---

## 5. Middleware & security layers

Executed in \`proxy.ts\` (Clerk middleware) in order:

1. **Canonical redirect** — \`*.vercel.app\` → \`yamalelegal.com\`
2. **AI scraper block** — blocks known training crawlers (403 plain text)
3. **Rate limiting** — per IP/user (\`lib/runtime-security\`)
4. **Basic auth** (optional) — \`ENABLE_BASIC_AUTH=true\` staging gate
5. **Clerk auth.protect()** — except public routes and webhooks
6. **Admin panel role check** — redirect or 403
7. **Legal admin path allow-list** — restrict to laws APIs
8. **Admin MFA step-up** — cookie check + slide refresh
9. **Security headers** — applied to all responses

### Public API routes (no Clerk in middleware)

- \`GET /api/pricing\`
- \`GET /api/marketplace\`, \`GET /api/marketplace/*\` (catalog)
- \`GET /api/laws\` (list only)
- \`POST /api/lomi/webhook\`, \`/api/payments/webhook\`, \`/api/stripe/webhook\`
- \`GET /api/cron/*\` (CRON_SECRET in handler)

---

## 6. Standard error responses

| HTTP | When | Typical body |
|------|------|--------------|
| **400** | Invalid JSON, validation failure | \`{ "error": "..." }\` |
| **401** | Not signed in | \`{ "error": "Sign in required" }\` |
| **403** | Forbidden, MFA, role, permission | \`{ "error": "...", "code"?: "..." }\` |
| **404** | Resource not found | \`{ "error": "..." }\` |
| **409** | Conflict (e.g. already enrolled) | \`{ "error": "..." }\` |
| **429** | Rate limit or MFA lockout | \`{ "error": "...", "lockoutSec"?: number }\` |
| **500** | Server error | \`{ "error": "..." }\` |
| **503** | Service disabled / missing migration | \`{ "error": "..." }\` |

### Application error codes

| code | Routes | Description |
|------|--------|-------------|
| \`MFA_REQUIRED\` | Admin APIs | Step-up not complete |
| \`MFA_ENROLLMENT_REQUIRED\` | Admin APIs | Must enroll TOTP first |
| \`MFA_SESSION_EXPIRED\` | Admin APIs | Idle timeout |
| \`Forbidden\` | Admin | Wrong role or legal_admin blocked path |

---

## 7. Rate limiting

Applied in middleware via \`checkRateLimit()\`. On exceed:

\`\`\`json
{ "error": "Too many requests. Please slow down and retry." }
\`\`\`
**HTTP 429** with rate-limit headers attached.

Additional per-feature limits exist in route handlers (AI abuse caps, document generation, etc.).

---

## 8. Roles & permissions

### Legal admin API allow-list

Legal admins may only call:

- \`GET /api/admin/session\`
- \`GET|POST /api/admin/mfa\`
- \`GET /api/admin/categories\`
- \`GET|POST /api/admin/laws\`
- \`GET|PUT /api/admin/laws/{uuid}\` (edit only laws they added)
- Sub-paths for create: \`bulk\`, \`bulk-from-url\`, \`from-url\`, \`pdf-upload-url\`

**Blocked for legal_admin:** batch-delete, export, rag-approval, duplicates, fix-ocr, security-settings, users, etc.

### Law permissions

| Action | admin | legal_admin |
|--------|-------|-------------|
| Create law | ✓ | ✓ |
| Edit any law | ✓ | Own laws only (\`ingested_by\`) |
| Delete law | ✓ | ✗ |
| Approve RAG | ✓ | ✗ |

---

## 9. Endpoint reference

`;

let body = header;

for (const g of groupOrder) {
  if (!groups[g]?.length) continue;
  const title = g === "admin" ? "Admin (`/api/admin/*`)" : g.charAt(0).toUpperCase() + g.slice(1);
  body += `### ${title}\n\n`;
  body += `| Method | Path | Auth | Description |\n`;
  body += `|--------|------|------|-------------|\n`;
  for (const r of groups[g]) {
    const methods = r.methods.join(", ") || "—";
    const auth = r.guards.length ? r.guards.join(", ") : "Public / handler-specific";
    const desc = r.comment.replace(/\|/g, "\\|").slice(0, 120) || "—";
    body += `| ${methods} | \`${r.apiPath}\` | ${auth} | ${desc} |\n`;
  }
  body += "\n";
}

body += `---

## 10. Detailed endpoint schemas

### GET /api/laws

**Auth:** Public (no Clerk required in middleware)

**Query:**
\`\`\`
?countryId=&categoryId=&status=&q=&page=1&pageSize=12&sort=title-asc
&skipEnrichment=1&metaOnly=1
\`\`\`

**Response 200:**
\`\`\`json
{
  "countries": [{ "id": "uuid", "name": "string" }],
  "categories": [{ "id": "uuid", "name": "string" }],
  "laws": [{ "id", "title", "year", "status", "country_id", "category_id", "countries", "categories" }],
  "lawCount": 4173,
  "page": 1,
  "pageSize": 25
}
\`\`\`

---

### GET /api/laws/[id]

**Auth:** \`requireLibraryApiSession\` (signed-in user)

**Path:** \`id\` = law UUID or SEO slug

**Response 200:** Full law object with content, metadata, bookmarks state.

**Errors:** 401 unsigned, 404 not found

---

### GET /api/ai/usage

**Auth:** Clerk session

**Response 200:**
\`\`\`json
{
  "used": 3,
  "limit": 10,
  "remaining": 7,
  "tier": "basic",
  "payAsYouGoCount": 0,
  "canQuery": true,
  "inputTokens": 1200,
  "outputTokens": 800,
  "estimatedUsageUsd": 0.02
}
\`\`\`

---

### POST /api/ai/chat

**Auth:** Clerk session **or** \`Bearer AI_EVAL_SECRET\`

**Request:**
\`\`\`json
{
  "messages": [{ "role": "user|assistant", "content": "string" }],
  "modelId": "optional",
  "sessionId": "optional",
  "countryId": "optional",
  "categoryId": "optional"
}
\`\`\`

**Response:** \`text/event-stream\` (SSE chunks) or JSON error

**Errors:** 401, 403 (quota), 429 (abuse), 503 (disabled)

---

### GET /api/admin/session

**Auth:** Clerk + admin panel role

**Response 200:**
\`\`\`json
{
  "userId": "user_...",
  "role": "admin" | "legal_admin",
  "permissions": {
    "canDeleteLaws": false,
    "canApproveRag": false,
    "isFullAdmin": false
  }
}
\`\`\`

---

### GET /api/admin/mfa

**Auth:** \`requireAdminPanel({ skipMfa: true })\`

**Response 200:**
\`\`\`json
{
  "enforced": true,
  "enrolled": true,
  "stepUpComplete": false,
  "role": "legal_admin",
  "defaultReturnTo": "/admin-panel/laws"
}
\`\`\`

---

### POST /api/admin/mfa

**Auth:** \`requireAdminPanel({ skipMfa: true })\`

**Request:**
\`\`\`json
{ "action": "enroll" | "confirm-enroll" | "verify" | "disable" | "logout", "code": "123456" }
\`\`\`

| action | code required | Response |
|--------|---------------|----------|
| enroll | No | \`{ secret, otpauthUrl, qrDataUrl }\` |
| confirm-enroll | Yes (6 digits) | \`{ ok: true, stepUpComplete: true }\` + sets cookie |
| verify | Yes | \`{ ok: true, stepUpComplete: true }\` + sets cookie |
| disable | Yes | \`{ ok: true }\` + clears cookie |
| logout | No | \`{ ok: true }\` + clears cookie |

**Errors:** 400 invalid code, 403 not enrolled, 429 lockout (\`lockoutSec\`)

---

### GET /api/admin/security-settings

**Auth:** \`requireAdmin\` (full admin only)

**Response 200:**
\`\`\`json
{
  "mfaIdleTimeoutSec": 1800,
  "updatedAt": "ISO8601",
  "defaultIdleTimeoutSec": 1800,
  "presets": [300, 900, 1800, 3600, 7200, 28800, null]
}
\`\`\`

---

### PUT /api/admin/security-settings

**Auth:** \`requireAdmin\`

**Request:**
\`\`\`json
{ "mfaIdleTimeoutSec": 1800 }
\`\`\`
Use \`null\` for "never expire on inactivity" (not recommended).

**Response 200:** \`{ "ok": true, "mfaIdleTimeoutSec": 1800 }\`

---

### GET /api/subscription

**Auth:** Clerk session

**Response 200:**
\`\`\`json
{
  "tier": "pro",
  "periodStart": "ISO8601",
  "periodEnd": "ISO8601",
  "interval": "monthly" | "annual",
  "cancelAtPeriodEnd": false,
  "scheduledTier": null,
  "isPaid": true,
  "paymentProvider": "lomi" | "pawapay",
  "isSubscriptionGrant": false,
  "subscriberSince": "ISO8601"
}
\`\`\`

---

### POST /api/subscription

**Auth:** Clerk session

**Request (one of):**
\`\`\`json
{ "action": "cancel" }
{ "action": "resume" }
{ "action": "schedule_downgrade", "scheduledTier": "basic" }
\`\`\`

**Response 200:** \`{ "ok": true }\`

---

### POST /api/payments/checkout

**Auth:** Clerk session

**Request:**
\`\`\`json
{
  "planId": "basic" | "pro" | "team",
  "interval": "monthly" | "annual",
  "provider": "pawapay" | "lomi"
}
\`\`\`

**Response 200:**
\`\`\`json
{ "url": "https://...", "provider": "pawapay" }
\`\`\`

---

### POST /api/payments/payg/ai-query

**Auth:** Clerk session

**Response 200:** Checkout redirect URL for one-off AI query purchase.

---

### GET /api/pricing

**Auth:** Public

**Response 200:** Subscription tiers with prices, features, CTA copy (cached).

---

### GET /api/marketplace

**Auth:** Optional Clerk (enriches \`purchased\` flags when signed in)

**Response 200:** Published vault items list.

---

### POST /api/cart/checkout

**Auth:** Clerk session

**Response 200:** Payment provider checkout URL for cart contents.

---

### GET /api/refunds/eligible

**Auth:** Clerk session

**Response 200:** List of purchases eligible for refund request.

---

### POST /api/refunds

**Auth:** Clerk session

**Request:**
\`\`\`json
{ "purchaseId": "...", "reason": "string" }
\`\`\`

---

### POST /api/admin/laws

**Auth:** \`requireLawsAccess\`

**Request:** \`multipart/form-data\` — PDF upload or pasted content fields (see route handler).

**Response 201/200:** Created law object.

---

### PUT /api/admin/laws/[id]

**Auth:** \`requireLawsAccess\` + \`assertCanEditLaw\`

**Request:** Law fields JSON (title, status, content, categories, etc.)

---

### DELETE /api/admin/laws/[id]

**Auth:** \`requireAdmin\` + \`assertCanDeleteLaw\`

---

### POST /api/lawyers/join

**Auth:** Public

**Request:** \`multipart/form-data\` — lawyer directory application + documents.

---

### GET /api/lawyers/unlocked

**Auth:** Clerk session

**Response 200:** Unlocked lawyer IDs, day-pass status, contact details for unlocked lawyers.

---

## 11. Webhooks & cron

### POST /api/lomi/webhook

**Auth:** Lomi \`X-Lomi-Signature\` HMAC-SHA256 **or** pawaPay deposit callback validation.

**Handles:** Subscription fulfillment, marketplace purchases, PAYG, day pass, lawyer unlocks, refunds.

**Idempotency:** \`payment_webhook_events\` table dedupes by \`(provider, event_id)\`.

**Legacy aliases:** \`/api/payments/webhook\`, \`/api/stripe/webhook\` re-export same handler.

---

### GET /api/cron/payment-reconciliation

**Auth:** \`Authorization: Bearer <CRON_SECRET>\`

**Purpose:** Reconcile stuck \`payment_checkout_pending\` rows; fulfill missed webhooks.

**Schedule:** Vercel Cron (see \`vercel.json\`).

---

## 12. Environment variables

| Variable | Purpose |
|----------|---------|
| \`CLERK_SECRET_KEY\` | Clerk server API |
| \`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY\` | Clerk client |
| \`ADMIN_MFA_SECRET\` | Sign \`admin_mfa_step_up\` cookie (32+ chars) |
| \`ADMIN_MFA_ENCRYPTION_KEY\` | Encrypt TOTP secrets at rest |
| \`ADMIN_MFA_SESSION_TTL_SEC\` | Absolute max step-up TTL (default 43200) |
| \`ADMIN_MFA_DISABLED\` | Skip MFA enforcement (local dev) |
| \`ADMIN_MFA_COOKIE_INSECURE\` | Allow non-secure cookie on HTTP |
| \`CRON_SECRET\` | Authorize cron endpoints |
| \`AI_EVAL_SECRET\` | Bearer token for batch AI eval |
| \`LOMI_WEBHOOK_SECRET\` | Verify Lomi webhook signatures |
| \`ENABLE_BASIC_AUTH\` | Staging HTTP basic auth gate |
| \`UPSTASH_REDIS_REST_URL\` | Distributed rate limits |

---

## Appendix: All routes by file

`;

for (const r of routes) {
  body += `- \`${r.methods.join(",") || "—"}\` **${r.apiPath}** — \`${r.file}\`\n`;
}

body += `
---

*End of API reference. For implementation details, inspect the route handler at the file path listed above.*
`;

fs.writeFileSync(OUT, body, "utf8");
console.log(`Wrote ${OUT} (${routes.length} routes, ${(body.length / 1024).toFixed(1)} KB)`);
