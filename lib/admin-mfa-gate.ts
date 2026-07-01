import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import {
  ADMIN_MFA_COOKIE_NAME,
  createAdminMfaSessionToken,
  inspectAdminMfaSessionToken,
  type AdminMfaTokenStatus,
} from "@/lib/admin-mfa-session";
import { adminHasConfirmedTotp } from "@/lib/admin-mfa-store";
import { getAdminSecuritySettings } from "@/lib/admin-security-settings";

export type AdminMfaGateState = {
  enforced: boolean;
  enrolled: boolean;
  stepUpComplete: boolean;
  /** True when a previously valid step-up expired due to inactivity. */
  idleExpired: boolean;
};

/**
 * MFA is always enforced for admin-panel roles. The env var can only be used to
 * force-disable in a controlled environment (e.g. local dev) via ADMIN_MFA_DISABLED.
 */
export function isAdminMfaRequired(): boolean {
  return !(process.env.ADMIN_MFA_DISABLED === "true" || process.env.ADMIN_MFA_DISABLED === "1");
}

async function getIdleTimeoutSec(): Promise<number | null> {
  const settings = await getAdminSecuritySettings();
  return settings.mfaIdleTimeoutSec;
}

export async function readAdminMfaGateState(
  userId: string | null | undefined
): Promise<AdminMfaGateState> {
  const enforced = isAdminMfaRequired();
  if (!userId) {
    return { enforced, enrolled: false, stepUpComplete: false, idleExpired: false };
  }

  const status = await inspectStepUpCookie(userId);
  const stepUpComplete = status.valid;
  const idleExpired = !status.valid && status.reason === "idle_expired";

  if (!enforced) {
    return { enforced: false, enrolled: false, stepUpComplete, idleExpired };
  }
  if (stepUpComplete) {
    return { enforced: true, enrolled: true, stepUpComplete: true, idleExpired: false };
  }
  const enrolled = await adminHasConfirmedTotp(userId);
  return { enforced, enrolled, stepUpComplete: false, idleExpired };
}

async function inspectStepUpCookie(userId: string): Promise<AdminMfaTokenStatus> {
  const jar = await cookies();
  const token = jar.get(ADMIN_MFA_COOKIE_NAME)?.value;
  if (!token) return { valid: false, reason: "malformed" };
  const idleTimeoutSec = await getIdleTimeoutSec();
  return inspectAdminMfaSessionToken(token, userId, { idleTimeoutSec });
}

export async function adminHasValidStepUpCookie(userId: string): Promise<boolean> {
  const status = await inspectStepUpCookie(userId);
  return status.valid;
}

/**
 * Middleware-side check. Returns validity plus whether the failure was idle expiry,
 * and (when valid) a refreshed token so the caller can slide the idle window forward.
 */
export function inspectStepUpFromRequest(
  request: NextRequest,
  userId: string,
  idleTimeoutSec: number | null
): { status: AdminMfaTokenStatus; refreshedToken: string | null } {
  const token = request.cookies.get(ADMIN_MFA_COOKIE_NAME)?.value;
  if (!token) {
    return { status: { valid: false, reason: "malformed" }, refreshedToken: null };
  }
  const status = inspectAdminMfaSessionToken(token, userId, { idleTimeoutSec });
  if (!status.valid) return { status, refreshedToken: null };
  // Slide the idle window: reissue with lastActivity = now, keeping the absolute expiry ceiling.
  const refreshedToken = createAdminMfaSessionToken(userId);
  return { status, refreshedToken };
}

export function adminHasValidStepUpFromRequest(
  request: NextRequest,
  userId: string,
  idleTimeoutSec: number | null
): boolean {
  return inspectStepUpFromRequest(request, userId, idleTimeoutSec).status.valid;
}

export async function issueAdminStepUpCookie(userId: string): Promise<{ name: string; value: string }> {
  return { name: ADMIN_MFA_COOKIE_NAME, value: createAdminMfaSessionToken(userId) };
}

export function isAdminMfaExemptPath(pathname: string): boolean {
  if (pathname === "/admin-panel/mfa" || pathname.startsWith("/admin-panel/mfa/")) return true;
  if (pathname === "/api/admin/mfa" || pathname.startsWith("/api/admin/mfa/")) return true;
  return false;
}

export function adminMfaRedirectRequired(state: AdminMfaGateState): boolean {
  if (!state.enforced) return false;
  if (state.stepUpComplete) return false;
  return true;
}
