"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useClientSearchParams } from "@/lib/use-client-search-params";
import {
  buildMarketplacePaymentVerifyKey,
  clearMarketplacePaymentReturnParams,
  confirmMarketplacePayment,
  parseMarketplacePaymentReturn,
  shouldRunMarketplacePaymentConfirm,
  type MarketplacePaymentReturnParams,
} from "@/lib/marketplace-payment-return";

type UseMarketplacePaymentReturnOptions = {
  /** `cart` for cart / package checkout; `item` for single-item marketplace checkout. */
  mode: "cart" | "item";
  /** Optional scope prefix (e.g. marketplace item id) for dedupe keys. */
  scopeId?: string;
  /** Called after successful confirm (e.g. refetch item list). */
  onConfirmed?: () => void | Promise<void>;
  /** Clear URL params to this pathname (defaults to current path). */
  clearParamsPathname?: string;
};

export function useMarketplacePaymentReturn(options: UseMarketplacePaymentReturnOptions) {
  const searchParams = useClientSearchParams();
  const { isLoaded, isSignedIn } = useUser();
  const params: MarketplacePaymentReturnParams = parseMarketplacePaymentReturn(searchParams);
  const confirmedRef = useRef<string | null>(null);
  const onConfirmedRef = useRef(options.onConfirmed);
  onConfirmedRef.current = options.onConfirmed;
  const [paymentVerifyInProgress, setPaymentVerifyInProgress] = useState(false);
  const [showVerifiedPaymentSuccess, setShowVerifiedPaymentSuccess] = useState(false);
  const [showPaymentNotCompleted, setShowPaymentNotCompleted] = useState(false);

  const verifyKey = buildMarketplacePaymentVerifyKey(params, options.scopeId);

  const runConfirm = useCallback(async () => {
    if (
      !shouldRunMarketplacePaymentConfirm(params, {
        isLoaded,
        isSignedIn: Boolean(isSignedIn),
        verifyKey,
        confirmedKey: confirmedRef.current,
      }) ||
      !verifyKey
    ) {
      return;
    }

    confirmedRef.current = verifyKey;
    setPaymentVerifyInProgress(true);
    setShowVerifiedPaymentSuccess(false);
    setShowPaymentNotCompleted(false);

    try {
      const result = await confirmMarketplacePayment({
        mode: options.mode,
        sessionId: params.sessionId,
        fromLomiReturn: params.fromLomiReturn,
      });
      if (result.ok) {
        setShowVerifiedPaymentSuccess(true);
        setShowPaymentNotCompleted(false);
        await onConfirmedRef.current?.();
      } else {
        confirmedRef.current = null;
        setShowVerifiedPaymentSuccess(false);
        setShowPaymentNotCompleted(true);
      }
    } catch {
      confirmedRef.current = null;
      setShowVerifiedPaymentSuccess(false);
      setShowPaymentNotCompleted(true);
    } finally {
      setPaymentVerifyInProgress(false);
      const pathname =
        options.clearParamsPathname ??
        (typeof window !== "undefined" ? window.location.pathname : "/marketplace");
      clearMarketplacePaymentReturnParams(pathname);
    }
  }, [
    isLoaded,
    isSignedIn,
    options.clearParamsPathname,
    options.mode,
    params.fromLomiReturn,
    params.legacyCheckoutSuccess,
    params.paymentVerify,
    params.sessionId,
    verifyKey,
  ]);

  useEffect(() => {
    if (
      params.legacyCheckoutSuccess &&
      !params.sessionId &&
      !params.fromLomiReturn &&
      typeof window !== "undefined"
    ) {
      clearMarketplacePaymentReturnParams(
        options.clearParamsPathname ?? window.location.pathname
      );
    }
  }, [
    options.clearParamsPathname,
    params.fromLomiReturn,
    params.legacyCheckoutSuccess,
    params.sessionId,
  ]);

  useEffect(() => {
    void runConfirm();
  }, [runConfirm]);

  return {
    params,
    paymentVerifyInProgress,
    showVerifiedPaymentSuccess,
    showPaymentNotCompleted,
    retryConfirm: () => {
      confirmedRef.current = null;
      void runConfirm();
    },
  };
}
