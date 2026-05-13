type PawaPayMetadata = Record<string, string>;
type PawaPayMetadataWire = Array<Record<string, string | number | boolean>>;

type PaymentPageSessionInput = {
  depositId: string;
  amountCents: number;
  currency: string;
  returnUrl: string;
  reason?: string;
  customerMessage?: string;
  country?: string;
  metadata?: PawaPayMetadata;
};

type PawaPayDepositData = {
  depositId: string;
  status: string;
  amount?: string;
  currency?: string;
  country?: string;
  metadata?: Record<string, string>;
  failureReason?: { failureCode?: string; failureMessage?: string };
};

type ActiveConfCurrency = { currency?: string };
type ActiveConfProvider = { currencies?: ActiveConfCurrency[] };
type ActiveConfCountry = { country?: string; providers?: ActiveConfProvider[] };
type ActiveConfResponse = { countries?: ActiveConfCountry[] };

const apiToken = process.env.PAWAPAY_API_TOKEN ?? "";
const baseUrl = (process.env.PAWAPAY_BASE_URL || "https://api.sandbox.pawapay.io").replace(/\/+$/, "");
let activeConfCache: { at: number; data: ActiveConfResponse } | null = null;
const ACTIVE_CONF_TTL_MS = 5 * 60 * 1000;

/** True when `PAWAPAY_API_TOKEN` is set — required for all pawaPay Payment Page flows. */
export function isPawapayConfigured(): boolean {
  return !!apiToken.trim();
}

/** True when the configured API host is production (stricter `returnUrl` rules). */
export function isPawapayLiveApi(): boolean {
  return (process.env.PAWAPAY_BASE_URL || "").includes("api.pawapay.io");
}

/**
 * Thrown when checkout cannot proceed because the Payment Page `returnUrl` does not
 * meet pawaPay live requirements (typically HTTPS). Caught by API routes as HTTP 400.
 */
export class PawapayReturnUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PawapayReturnUrlError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

function assertLivePawapayReturnUrlIsHttps(returnUrl: string): void {
  if (!isPawapayLiveApi()) return;
  let parsed: URL;
  try {
    parsed = new URL(returnUrl);
  } catch {
    throw new PawapayReturnUrlError(
      "Invalid pawaPay return URL. Check PAWAPAY_RETURN_BASE_URL and the path your server builds for returnUrl."
    );
  }
  if (parsed.protocol !== "https:") {
    throw new PawapayReturnUrlError(
      "pawaPay live requires an HTTPS return URL. Plain http://localhost is not accepted for mobile-money STK flows. " +
        "Options: (1) Set PAWAPAY_RETURN_BASE_URL to a public HTTPS URL that tunnels to this dev server (ngrok, Cloudflare Tunnel, etc.). " +
        "(2) Or use sandbox locally: PAWAPAY_BASE_URL=https://api.sandbox.pawapay.io and a sandbox PAWAPAY_API_TOKEN."
    );
  }
}

/** pawaPay Payment Page rejects http://localhost (and 127.0.0.1) as returnUrl even in sandbox. */
function assertPawapayReturnUrlNotRejectedLoopbackHttp(returnUrl: string): void {
  let u: URL;
  try {
    u = new URL(returnUrl);
  } catch {
    throw new PawapayReturnUrlError("returnUrl must be a valid absolute URL.");
  }
  if (u.protocol !== "http:") return;
  const h = u.hostname.replace(/^\[|\]$/g, "");
  if (h !== "localhost" && h !== "127.0.0.1" && h !== "::1") return;
  throw new PawapayReturnUrlError(
    "pawaPay does not accept http://localhost (or 127.0.0.1) as Payment Page returnUrl. " +
      "Browse via HTTPS (for example run `ngrok http 3000` and use your https://….ngrok-free.app link as the app URL), " +
      "or set PAWAPAY_RETURN_BASE_URL to a public https URL so checkout can complete (you will land there after payment until you use an https tunnel to localhost)."
  );
}

function tryParsePawapayReturnOrigin(value: string): string | null {
  const raw = value.trim().replace(/\/+$/, "");
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.hostname === "0.0.0.0") {
      u.hostname = "localhost";
    }
    return u.origin;
  } catch {
    return null;
  }
}

function isLoopbackHttpOrigin(origin: string | null): boolean {
  if (!origin?.startsWith("http:")) return false;
  try {
    const u = new URL(origin);
    const h = u.hostname.replace(/^\[|\]$/g, "");
    return h === "localhost" || h === "127.0.0.1" || h === "::1";
  } catch {
    return false;
  }
}

/**
 * Public origin for pawaPay Payment Page `returnUrl` (scheme + host + port, no path).
 *
 * - **Sandbox:** uses the checkout request `Origin` when it is **HTTPS** (Vercel, ngrok, etc.).
 *   If you use **http://localhost**, pawaPay rejects that as `returnUrl`; when `PAWAPAY_RETURN_BASE_URL`
 *   is an **https** URL, that base is used instead so checkout succeeds (redirect after pay goes there).
 * - **Live:** prefers an HTTPS `Origin` when present; otherwise uses `PAWAPAY_RETURN_BASE_URL` when it
 *   is HTTPS (needed for http://localhost with live API). Replaces host `0.0.0.0` with `localhost`.
 */
export function resolvePawapayReturnOrigin(requestOrigin: string): string {
  const configured = tryParsePawapayReturnOrigin(process.env.PAWAPAY_RETURN_BASE_URL || "");
  const fromRequest = tryParsePawapayReturnOrigin(requestOrigin);

  if (!isPawapayLiveApi()) {
    if (fromRequest?.startsWith("https:")) {
      return fromRequest;
    }
    if (isLoopbackHttpOrigin(fromRequest) && configured?.startsWith("https:")) {
      return configured;
    }
    if (fromRequest) return fromRequest;
    if (configured) return configured;
    throw new Error(
      "Cannot resolve pawaPay return URL origin (missing Origin on the checkout request and PAWAPAY_RETURN_BASE_URL is unset or invalid)."
    );
  }

  if (fromRequest?.startsWith("https:")) {
    return fromRequest;
  }
  if (configured?.startsWith("https:")) {
    return configured;
  }
  if (fromRequest) {
    return fromRequest;
  }
  if (configured) {
    return configured;
  }
  throw new Error("Cannot resolve pawaPay return URL origin (missing Origin and PAWAPAY_RETURN_BASE_URL).");
}

function normalizePawapayReturnUrl(returnUrl: string): string {
  try {
    const u = new URL(returnUrl);
    if (u.hostname === "0.0.0.0") {
      u.hostname = "localhost";
      return u.href;
    }
  } catch {
    // leave as-is; API will validate
  }
  return returnUrl;
}

function requireToken() {
  if (!apiToken) {
    throw new Error("Missing PAWAPAY_API_TOKEN");
  }
}

function toAmountString(amountCents: number): string {
  return (amountCents / 100).toFixed(2);
}

function toPawaSafeText(value: string, maxLen: number): string {
  return value
    .replace(/[^\p{L}\p{N}\s.,:;!?()\-_/]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

function toPawaCustomerMessage(value: string): string {
  const normalized = value
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const sliced = normalized.slice(0, 22);
  return sliced.length >= 4 ? sliced : "Yamale Payment";
}

function toPawaMetadataWire(metadata?: PawaPayMetadata): PawaPayMetadataWire | undefined {
  if (!metadata) return undefined;
  const entries = Object.entries(metadata).filter(([k, v]) => k.trim() && String(v).trim());
  if (entries.length === 0) return undefined;
  return entries.map(([k, v]) => ({ [k]: String(v) }));
}

function fromPawaMetadataWire(value: unknown): Record<string, string> {
  if (!value) return {};
  if (Array.isArray(value)) {
    const merged: Record<string, string> = {};
    for (const item of value) {
      if (!item || typeof item !== "object") continue;
      for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
        if (!k) continue;
        merged[k] = typeof v === "string" ? v : String(v ?? "");
      }
    }
    return merged;
  }
  if (typeof value === "object") {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (!k) continue;
      out[k] = typeof v === "string" ? v : String(v ?? "");
    }
    return out;
  }
  return {};
}

async function pawapayFetch(path: string, init?: RequestInit): Promise<Response> {
  requireToken();
  const headers = new Headers(init?.headers || {});
  headers.set("Authorization", `Bearer ${apiToken}`);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(`${baseUrl}${path}`, { ...init, headers, cache: "no-store" });
}

async function getActiveConfiguration(): Promise<ActiveConfResponse | null> {
  const now = Date.now();
  if (activeConfCache && now - activeConfCache.at < ACTIVE_CONF_TTL_MS) {
    return activeConfCache.data;
  }
  const res = await pawapayFetch("/v2/active-conf", { method: "GET" });
  if (!res.ok) return null;
  const data = (await res.json().catch(() => null)) as ActiveConfResponse | null;
  if (!data) return null;
  activeConfCache = { at: now, data };
  return data;
}

async function assertCountryCurrencyConfigured(country: string, currency: string): Promise<void> {
  const conf = await getActiveConfiguration();
  if (!conf?.countries?.length) return;

  const targetCountry = conf.countries.find((c) => (c.country || "").toUpperCase() === country.toUpperCase());
  if (!targetCountry) {
    const available = conf.countries
      .map((c) => (c.country || "").toUpperCase())
      .filter(Boolean)
      .sort()
      .join(", ");
    throw new Error(`pawaPay account is not configured for country ${country}. Available countries: ${available || "none"}.`);
  }

  const supportedCurrencies = new Set<string>();
  for (const provider of targetCountry.providers || []) {
    for (const cur of provider.currencies || []) {
      const code = (cur.currency || "").toUpperCase();
      if (code) supportedCurrencies.add(code);
    }
  }

  if (supportedCurrencies.size > 0 && !supportedCurrencies.has(currency.toUpperCase())) {
    throw new Error(
      `pawaPay country ${country} does not support currency ${currency}. Supported currencies: ${Array.from(supportedCurrencies).sort().join(", ")}.`
    );
  }
}

export async function createPaymentPageSession(input: PaymentPageSessionInput): Promise<{ redirectUrl: string }> {
  const normalizedCountry = (input.country || "").trim().toUpperCase();
  if (!normalizedCountry) {
    throw new Error(
      "pawaPay Payment Page requires country (ISO 3166-1 alpha-3). Pass the user's selected country from checkout."
    );
  }
  if (!/^[A-Z]{3}$/.test(normalizedCountry)) {
    throw new Error("Invalid pawaPay country format. Use ISO 3166-1 alpha-3 (e.g. RWA, GHA, KEN).");
  }
  const normalizedCurrency = input.currency.toUpperCase();
  await assertCountryCurrencyConfigured(normalizedCountry, normalizedCurrency);

  const returnUrl = normalizePawapayReturnUrl(input.returnUrl);
  assertPawapayReturnUrlNotRejectedLoopbackHttp(returnUrl);
  assertLivePawapayReturnUrlIsHttps(returnUrl);

  const payload: Record<string, unknown> = {
    depositId: input.depositId,
    returnUrl,
    amountDetails: {
      amount: toAmountString(input.amountCents),
      currency: normalizedCurrency,
    },
    country: normalizedCountry,
  };
  if (input.reason) payload.reason = toPawaSafeText(input.reason, 50);
  payload.customerMessage = toPawaCustomerMessage(
    input.customerMessage || process.env.PAWAPAY_CUSTOMER_MESSAGE || "Yamale Payment"
  );
  const metadataWire = toPawaMetadataWire(input.metadata);
  if (metadataWire) payload.metadata = metadataWire;

  const res = await pawapayFetch("/v2/paymentpage", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as { redirectUrl?: string; failureReason?: { failureMessage?: string } };
  if (!res.ok || !data.redirectUrl) {
    const details = data.failureReason?.failureMessage || `HTTP ${res.status}`;
    throw new Error(`Failed to create pawaPay session: ${details}`);
  }
  return { redirectUrl: data.redirectUrl };
}

export async function getDepositStatus(depositId: string): Promise<PawaPayDepositData | null> {
  const res = await pawapayFetch(`/v2/deposits/${encodeURIComponent(depositId)}`, { method: "GET" });
  if (!res.ok) return null;
  const payload = (await res.json().catch(() => null)) as { status?: string; data?: PawaPayDepositData } | null;
  if (!payload || payload.status !== "FOUND" || !payload.data) return null;
  const normalized: PawaPayDepositData = {
    ...payload.data,
    metadata: fromPawaMetadataWire((payload.data as { metadata?: unknown }).metadata),
  };
  return normalized;
}

export function isDepositCompleted(status?: string | null): boolean {
  return String(status || "").toUpperCase() === "COMPLETED";
}

export type PollPawaPayDepositResult =
  | { ok: true; deposit: PawaPayDepositData }
  | { ok: false; reason: "pending" | "failed"; message: string };

/**
 * Poll GET /deposits/:id until COMPLETED or a terminal failure.
 * The Payment Page may redirect back before the deposit status is readable as COMPLETED.
 */
export async function pollPawaPayDepositUntilComplete(
  depositId: string,
  options?: { maxAttempts?: number; delayMs?: number }
): Promise<PollPawaPayDepositResult> {
  const maxAttempts = Math.min(30, Math.max(1, options?.maxAttempts ?? 12));
  const delayMs = Math.min(5000, Math.max(100, options?.delayMs ?? 750));
  let last: PawaPayDepositData | null = null;
  for (let i = 0; i < maxAttempts; i++) {
    last = await getDepositStatus(depositId);
    if (last && isDepositCompleted(last.status)) {
      return { ok: true, deposit: last };
    }
    if (last) {
      const st = String(last.status || "").toUpperCase();
      if (["FAILED", "REJECTED", "CANCELLED", "DECLINED"].includes(st)) {
        return { ok: false, reason: "failed", message: `Payment was not completed (${st}).` };
      }
    }
    if (i < maxAttempts - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return {
    ok: false,
    reason: "pending",
    message:
      "We could not confirm payment with pawaPay yet. If you finished in your wallet, wait a few seconds and tap Retry. If pawaPay showed success but this message stays, check the pawaPay dashboard or contact support — your plan only activates after we receive COMPLETED from pawaPay.",
  };
}

/**
 * Convert a USD-cent amount (platform base pricing) into minor units of the
 * configured pawaPay currency.
 *
 * - If PAWAPAY_CURRENCY=USD, returns the input unchanged.
 * - Otherwise requires PAWAPAY_USD_EXCHANGE_RATE (target currency per 1 USD).
 *   Example for KES: PAWAPAY_USD_EXCHANGE_RATE=130
 */
export function convertUsdCentsToPawapayMinor(usdCents: number, currencyInput?: string): number {
  const currency = (currencyInput || process.env.PAWAPAY_CURRENCY || "USD").toUpperCase();
  if (currency === "USD") return usdCents;

  const specificRateKey = `PAWAPAY_USD_EXCHANGE_RATE_${currency}`;
  const rateRaw = process.env[specificRateKey] ?? process.env.PAWAPAY_USD_EXCHANGE_RATE;
  const rate = Number(rateRaw);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(
      `Missing/invalid ${specificRateKey} (or PAWAPAY_USD_EXCHANGE_RATE) for currency ${currency}. ` +
        "Set target-per-USD rate (e.g. 130 for KES)."
    );
  }

  return Math.max(1, Math.round(usdCents * rate));
}
