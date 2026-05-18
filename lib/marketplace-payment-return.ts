/** Parsed query params after pawaPay / Lomi redirect back to Yamalé. */
export type MarketplacePaymentReturnParams = {
  sessionId: string | null;
  fromLomiReturn: boolean;
  paymentVerify: boolean;
  legacyCheckoutSuccess: boolean;
  checkoutCancelled: boolean;
};

export function parseMarketplacePaymentReturn(
  searchParams: Pick<URLSearchParams, "get">
): MarketplacePaymentReturnParams {
  const rawSessionId = searchParams.get("session_id")?.trim() ?? "";
  const fromLomiReturn = searchParams.get("from_lomi") === "1";
  const isLomiSessionPlaceholder =
    rawSessionId === "{CHECKOUT_SESSION_ID}" ||
    decodeURIComponent(rawSessionId) === "{CHECKOUT_SESSION_ID}";
  const sessionId = rawSessionId && !isLomiSessionPlaceholder ? rawSessionId : null;
  const checkoutStatus = searchParams.get("checkout");
  return {
    sessionId,
    fromLomiReturn,
    paymentVerify: searchParams.get("payment") === "verify",
    legacyCheckoutSuccess: checkoutStatus === "success",
    checkoutCancelled: checkoutStatus === "cancelled" || searchParams.get("canceled") === "1",
  };
}

export function marketplacePaymentReturnQuerySuffix(
  params: MarketplacePaymentReturnParams
): string {
  const q = new URLSearchParams();
  if (params.paymentVerify) q.set("payment", "verify");
  if (params.sessionId) q.set("session_id", params.sessionId);
  if (params.fromLomiReturn) q.set("from_lomi", "1");
  if (params.legacyCheckoutSuccess) q.set("checkout", "success");
  const s = q.toString();
  return s ? `?${s}` : "";
}

export function clearMarketplacePaymentReturnParams(pathname: string): void {
  if (typeof window === "undefined" || !window.history.replaceState) return;
  const u = new URL(window.location.href);
  u.searchParams.delete("session_id");
  u.searchParams.delete("payment");
  u.searchParams.delete("from_lomi");
  u.searchParams.delete("checkout");
  u.searchParams.delete("canceled");
  window.history.replaceState({}, "", pathname + (u.search ? u.search : ""));
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export type ConfirmMarketplacePaymentOptions = {
  sessionId: string | null;
  fromLomiReturn: boolean;
  /** Cart checkout (package page / vault list) vs single-item checkout. */
  mode: "cart" | "item";
};

export type ConfirmMarketplacePaymentResult = {
  ok: boolean;
  pending?: boolean;
  error?: string;
};

/** Confirm pawaPay / Lomi payment and record purchase(s). Retries once on 503 pending. */
export async function confirmMarketplacePayment(
  options: ConfirmMarketplacePaymentOptions
): Promise<ConfirmMarketplacePaymentResult> {
  const endpoint =
    options.mode === "cart" ? "/api/cart/confirm-payment" : "/api/marketplace/confirm-payment";
  const body = options.sessionId
    ? { session_id: options.sessionId }
    : { from_lomi_cookie: true };

  const confirmOnce = () =>
    fetch(endpoint, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  let res = await confirmOnce();
  let data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    pending?: boolean;
    error?: string;
  };
  if (!res.ok && res.status === 503 && data.pending) {
    await new Promise((r) => setTimeout(r, 2500));
    res = await confirmOnce();
    data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      pending?: boolean;
      error?: string;
    };
  }
  if (res.ok && data.ok) {
    return { ok: true };
  }
  return {
    ok: false,
    pending: data.pending,
    error: data.error ?? "Payment not completed",
  };
}

export function shouldRunMarketplacePaymentConfirm(
  params: MarketplacePaymentReturnParams,
  options: { isLoaded: boolean; isSignedIn: boolean; verifyKey: string | null; confirmedKey: string | null }
): boolean {
  if (!options.isLoaded || !options.isSignedIn) return false;
  if (!options.verifyKey) return false;
  if (options.confirmedKey === options.verifyKey) return false;
  return params.paymentVerify || params.legacyCheckoutSuccess;
}

export function buildMarketplacePaymentVerifyKey(
  params: MarketplacePaymentReturnParams,
  scopeId?: string
): string | null {
  const base = params.sessionId ?? (params.fromLomiReturn ? "lomi_cookie" : null);
  if (!base) return null;
  return scopeId ? `${scopeId}:${base}` : base;
}
