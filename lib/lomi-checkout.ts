import crypto from "crypto";
import { LomiSDK, OpenAPI } from "@lomi./sdk";

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
  const rawOverride = (process.env.LOMI_API_BASE_URL || "").trim();
  const baseUrlOverride = rawOverride ? normalizeLomiApiBaseUrl(rawOverride) : "";

  const liveBase = baseUrlOverride || "https://api.lomi.africa";
  const testBase = baseUrlOverride || "https://sandbox.api.lomi.africa";

  const sdk = new LomiSDK({
    apiKey,
    environment,
    ...(environment === "live" ? { baseUrl: liveBase } : {}),
  });

  // @lomi./sdk sets test mode to …/v1, which 404s; real sandbox matches live (no /v1 prefix).
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
  const sessionId = rec.id ?? rec.checkout_session_id ?? "";
  if (!checkoutUrl || !sessionId) {
    throw new Error("Lomi checkout session missing checkout_url or id");
  }
  return { checkoutUrl, sessionId };
}

export async function getCompletedLomiCheckoutMetadata(
  sessionId: string
): Promise<Record<string, string> | null> {
  if (!isLomiConfigured()) return null;
  try {
    const lomi = getLomiSdk();
    const session = await lomi.checkoutSessions.get(sessionId);
    const status = String((session as { status?: string }).status || "").toLowerCase();
    if (status !== "completed") return null;
    return flattenLomiMetadata((session as { metadata?: unknown }).metadata);
  } catch {
    return null;
  }
}

export function verifyLomiWebhookSignature(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!rawBody || !signatureHeader || !secret) return false;
  try {
    const hmac = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
    const a = Buffer.from(signatureHeader.trim(), "utf8");
    const b = Buffer.from(hmac, "utf8");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
