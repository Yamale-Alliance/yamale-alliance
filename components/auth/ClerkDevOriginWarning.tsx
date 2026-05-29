"use client";

import { useEffect } from "react";
import { isProductionClerkKey } from "@/lib/clerk-config";

/**
 * Warns when pk_live_* is used on localhost — Clerk production keys only allow yamalelegal.com origins.
 */
export function ClerkDevOriginWarning() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    if (!isProductionClerkKey()) return;
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      console.error(
        "[Yamalé] Clerk production keys (pk_live_*) do not work on localhost. " +
          "Use pk_test_ / sk_test_ from your Clerk *Development* instance in .env.local, " +
          "or test auth at https://www.yamalelegal.com. See docs/CLERK_PRODUCTION.md."
      );
    }
  }, []);

  return null;
}
