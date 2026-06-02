"use client";

import { useEffect } from "react";

const ROLE_COOKIE = "signup_intent";
const MAX_AGE_SEC = 60 * 60;

/** Sets signup role cookie so /api/auth/complete-signup can attach publicMetadata. */
export function SignupIntentCookie({ role }: { role: "user" | "lawyer" }) {
  useEffect(() => {
    document.cookie = `${ROLE_COOKIE}=${role}; path=/; max-age=${MAX_AGE_SEC}; samesite=lax`;
  }, [role]);
  return null;
}
