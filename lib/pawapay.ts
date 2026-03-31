type PawaPayMetadata = Record<string, string>;

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

const apiToken = process.env.PAWAPAY_API_TOKEN ?? "";
const baseUrl = (process.env.PAWAPAY_BASE_URL || "https://api.sandbox.pawapay.io").replace(/\/+$/, "");

function requireToken() {
  if (!apiToken) {
    throw new Error("Missing PAWAPAY_API_TOKEN");
  }
}

function toAmountString(amountCents: number): string {
  return (amountCents / 100).toFixed(2);
}

async function pawapayFetch(path: string, init?: RequestInit): Promise<Response> {
  requireToken();
  const headers = new Headers(init?.headers || {});
  headers.set("Authorization", `Bearer ${apiToken}`);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(`${baseUrl}${path}`, { ...init, headers, cache: "no-store" });
}

export async function createPaymentPageSession(input: PaymentPageSessionInput): Promise<{ redirectUrl: string }> {
  const payload: Record<string, unknown> = {
    depositId: input.depositId,
    returnUrl: input.returnUrl,
    amountDetails: {
      amount: toAmountString(input.amountCents),
      currency: input.currency.toUpperCase(),
    },
  };
  if (input.reason) payload.reason = input.reason.slice(0, 50);
  if (input.customerMessage) payload.customerMessage = input.customerMessage;
  if (input.country) payload.country = input.country;
  if (input.metadata && Object.keys(input.metadata).length > 0) payload.metadata = input.metadata;

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
  return payload.data;
}

export function isDepositCompleted(status?: string | null): boolean {
  return String(status || "").toUpperCase() === "COMPLETED";
}

export function getPlanAmountCents(planId: string, interval: "monthly" | "annual"): number | null {
  const key =
    interval === "annual"
      ? `PAWAPAY_PLAN_${planId.toUpperCase()}_ANNUAL_CENTS`
      : `PAWAPAY_PLAN_${planId.toUpperCase()}_MONTHLY_CENTS`;
  const raw = process.env[key];
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}
