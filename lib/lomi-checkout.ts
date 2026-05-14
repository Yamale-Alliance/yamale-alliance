import crypto from "crypto";
import { LomiSDK, OpenAPI } from "@lomi./sdk";

/**
 * Lomi REST + webhooks (hosts, `X-API-Key` on **your** API calls only; outbound webhooks use `X-Lomi-Signature`):
 * - https://docs.lomi.africa/reference/setup/integration
 * - https://docs.lomi.africa/reference/payments/webhooks
 *
 * The official `@lomi./sdk` sends your merchant secret as `X-API-KEY` (same as docs’ case-insensitive `X-API-Key`).
 * Live API: https://api.lomi.africa — Test: https://sandbox.api.lomi.africa
 */
const LOMI_INTEGRATION_DOC_URL = "https://docs.lomi.africa/reference/setup/integration";

export type LomiCurrencyCode = "USD" | "EUR" | "XOF";

export function isLomiConfigured(): boolean {
  return Boolean(process.env.LOMI_API_KEY?.trim());
}

function resolveLomiEnvironment(): "live" | "test" {
  const raw = (process.env.LOMI_ENVIRONMENT || "").trim().toLowerCase();
  if (raw === "test" || raw === "sandbox") return "test";
  if (raw === "live" || raw === "production" || raw === "prod") return "live";
  // Match Lomi SDK default: live base URL. Sandbox often 404s for newer accounts / live-only keys.
  return "live";
}

/** Dashboard secrets use `lomi_sk_test_…` / `lomi_sk_live_…`; hosts must match (see Lomi integration doc). */
function assertLomiApiKeyMatchesEnvironment(apiKey: string, environment: "live" | "test"): void {
  const k = apiKey.trim();
  if (k.startsWith("lomi_sk_test_") && environment === "live") {
    throw new Error(
      `LOMI_API_KEY is a test secret (lomi_sk_test_…) but LOMI_ENVIRONMENT is live. Use a live key (lomi_sk_live_…) or set LOMI_ENVIRONMENT=test. ${LOMI_INTEGRATION_DOC_URL}`
    );
  }
  if (k.startsWith("lomi_sk_live_") && environment === "test") {
    throw new Error(
      `LOMI_API_KEY is a live secret (lomi_sk_live_…) but LOMI_ENVIRONMENT is test/sandbox. Use a test key (lomi_sk_test_…) or set LOMI_ENVIRONMENT=live. ${LOMI_INTEGRATION_DOC_URL}`
    );
  }
}

/** Lomi routes live at host root (e.g. /checkout-sessions), not under /v1 — see Python SDK host defaults. */
function normalizeLomiApiBaseUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, "");
  if (trimmed.toLowerCase().endsWith("/v1")) {
    return trimmed.slice(0, -3).replace(/\/+$/, "");
  }
  return trimmed;
}

export function getLomiSdk(): LomiSDK {
  const apiKey = process.env.LOMI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("LOMI_API_KEY is not configured");
  }
  const environment = resolveLomiEnvironment();
  assertLomiApiKeyMatchesEnvironment(apiKey, environment);

  const rawOverride = (process.env.LOMI_API_BASE_URL || "").trim();
  const baseUrlOverride = rawOverride ? normalizeLomiApiBaseUrl(rawOverride) : "";

  const liveBase = baseUrlOverride || "https://api.lomi.africa";
  const testBase = baseUrlOverride || "https://sandbox.api.lomi.africa";

  // Live: pass host without /v1 (SDK default is https://api.lomi.africa/v1 — wrong for Lomi’s root routes).
  // Test: SDK hard-codes https://sandbox.api.lomi.africa/v1 and ignores config.baseUrl; patch OpenAPI.BASE after init.
  const sdk = new LomiSDK({
    apiKey,
    environment,
    ...(environment === "live" ? { baseUrl: liveBase } : {}),
  });

  if (environment === "test") {
    OpenAPI.BASE = testBase;
  }

  return sdk;
}

export function toLomiCurrency(code: string): LomiCurrencyCode | null {
  const u = code.trim().toUpperCase();
  if (u === "USD" || u === "EUR" || u === "XOF") return u;
  return null;
}

/**
 * Lomi's `amount` field is major currency units (e.g. 4.5 for $4.50 USD).
 * Callers pass the same minor units as pawaPay: cents/centimes for USD/EUR, whole francs for XOF.
 */
function lomiAmountMajorFromMinorUnits(minor: number, currency_code: LomiCurrencyCode): number {
  if (currency_code === "XOF") {
    return Math.round(minor);
  }
  return minor / 100;
}

export function flattenLomiMetadata(meta: unknown): Record<string, string> {
  if (!meta || typeof meta !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(meta as Record<string, unknown>)) {
    if (v === undefined || v === null) continue;
    out[k] =
      typeof v === "string"
        ? v
        : typeof v === "number" || typeof v === "boolean"
          ? String(v)
          : JSON.stringify(v);
  }
  return out;
}

/** `law_id` on checkout metadata may arrive with varying key casing from providers or proxies. */
export function readPaygDocumentLawIdFromMetadata(md: Record<string, string>): string | null {
  const candidates = [md.law_id, md.Law_ID, md.LawId, md.lawId, md.LAW_ID];
  for (const c of candidates) {
    const t = typeof c === "string" ? c.trim() : "";
    if (t.length > 0) return t;
  }
  return null;
}

/** Lomi checkout session `status` values that mean we can trust session metadata for paid flows. */
const LOMI_CHECKOUT_PAID_STATUSES = new Set([
  "completed",
  "complete",
  "paid",
  "succeeded",
  "success",
  "successful",
  "payment_succeeded",
  "payment-succeeded",
  "fulfilled",
]);

function isLomiCheckoutSessionPaidStatus(statusRaw: string | undefined): boolean {
  const s = String(statusRaw || "")
    .toLowerCase()
    .trim()
    .replace(/-/g, "_");
  return s.length > 0 && LOMI_CHECKOUT_PAID_STATUSES.has(s);
}

/** Collect status-like strings from a checkout session payload (shape varies by API version). */
function extractLomiCheckoutSessionStatusStrings(session: unknown): string[] {
  if (!session || typeof session !== "object") return [];
  const s = session as Record<string, unknown>;
  const keys = [
    "status",
    "checkout_session_status",
    "payment_status",
    "provider_payment_status",
    "state",
    "lifecycle_status",
  ];
  const out: string[] = [];
  for (const k of keys) {
    const v = s[k];
    if (typeof v === "string" && v.trim()) out.push(v);
  }
  const pay = s.payment;
  if (pay && typeof pay === "object") {
    const p = pay as Record<string, unknown>;
    for (const k of ["status", "state", "payment_status"]) {
      const v = p[k];
      if (typeof v === "string" && v.trim()) out.push(v);
    }
  }
  const data = s.data;
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    for (const k of ["status", "checkout_session_status", "payment_status", "state"]) {
      const v = d[k];
      if (typeof v === "string" && v.trim()) out.push(v);
    }
  }
  return out;
}

function isLomiCheckoutSessionPaid(session: unknown): boolean {
  const strings = extractLomiCheckoutSessionStatusStrings(session);
  if (strings.some((x) => isLomiCheckoutSessionPaidStatus(x))) return true;
  const paidFlag =
    (session as { paid?: unknown }).paid === true ||
    (session as { is_paid?: unknown }).is_paid === true ||
    (session as { payment_completed?: unknown }).payment_completed === true;
  return Boolean(paidFlag);
}

export type HostedLomiCheckoutInput = {
  /** Minor units (USD/EUR cents; XOF whole francs) — converted to Lomi major units before API call. */
  amount: number;
  currency_code: LomiCurrencyCode;
  success_url: string;
  cancel_url: string;
  metadata?: Record<string, string>;
  title?: string;
  description?: string;
};

export async function createLomiHostedCheckoutSession(
  input: HostedLomiCheckoutInput
): Promise<{ checkoutUrl: string; sessionId: string }> {
  const lomi = getLomiSdk();
  const amountMajor = lomiAmountMajorFromMinorUnits(input.amount, input.currency_code);
  const session = await lomi.checkoutSessions.create({
    amount: amountMajor,
    currency_code: input.currency_code,
    success_url: input.success_url,
    cancel_url: input.cancel_url,
    metadata: input.metadata ?? {},
    title: input.title ?? undefined,
    description: input.description ?? undefined,
  } as never);

  const rec = session as {
    checkout_url?: string;
    id?: string;
    checkout_session_id?: string;
  };
  const checkoutUrl = rec.checkout_url;
  // Lomi APIs identify checkout sessions by `checkout_session_id`; prefer it over generic `id`.
  const sessionId = rec.checkout_session_id ?? rec.id ?? "";
  if (!checkoutUrl || !sessionId) {
    throw new Error("Lomi checkout session missing checkout_url or id");
  }
  return { checkoutUrl, sessionId };
}

/** Max time to wait for Lomi session to flip to paid after success redirect (race with API + webhook). */
const LOMI_CONFIRM_POLL_MS = 12_000;
const LOMI_CONFIRM_POLL_INTERVAL_MS = 700;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function getCompletedLomiCheckoutMetadata(
  sessionId: string
): Promise<Record<string, string> | null> {
  if (!isLomiConfigured()) return null;
  try {
    const lomi = getLomiSdk();
    const session = await lomi.checkoutSessions.get(sessionId);
    if (!isLomiCheckoutSessionPaid(session)) return null;
    return flattenLomiMetadata((session as { metadata?: unknown }).metadata);
  } catch {
    return null;
  }
}

/**
 * Poll Lomi until checkout session is paid or timeout. Use after hosted-checkout success redirect
 * when GET may briefly still return non-paid status.
 */
export async function pollCompletedLomiCheckoutMetadata(
  sessionId: string,
  options?: { maxWaitMs?: number; intervalMs?: number }
): Promise<Record<string, string> | null> {
  if (!isLomiConfigured()) return null;
  const maxWait = options?.maxWaitMs ?? LOMI_CONFIRM_POLL_MS;
  const interval = options?.intervalMs ?? LOMI_CONFIRM_POLL_INTERVAL_MS;
  const deadline = Date.now() + maxWait;
  while (Date.now() < deadline) {
    const md = await getCompletedLomiCheckoutMetadata(sessionId);
    if (md) return md;
    await sleep(interval);
  }
  return null;
}

/**
 * Verify Lomi outbound webhook HMAC on the exact raw request body (do not re-serialize JSON).
 * @see https://docs.lomi.africa/reference/payments/webhooks (header `X-Lomi-Signature`, secret `whsec_…`)
 * @see https://docs.lomi.africa/reference/setup/integration
 */
export function verifyLomiWebhookSignature(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!rawBody || !signatureHeader || !secret) return false;
  try {
    let sig = signatureHeader.trim();
    const prefixed = /^sha256=(.+)$/i.exec(sig);
    if (prefixed) sig = prefixed[1].trim();

    const hmac = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(hmac, "utf8");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
