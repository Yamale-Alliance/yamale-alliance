import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import {
  ADMIN_MFA_COOKIE_NAME,
  createAdminMfaSessionToken,
  verifyAdminMfaSessionToken,
} from "@/lib/admin-mfa-session";
import { adminHasConfirmedTotp } from "@/lib/admin-mfa-store";
import { isAdminMfaEnforced } from "@/lib/admin-session";

export type AdminMfaGateState = {
  enforced: boolean;
  enrolled: boolean;
  stepUpComplete: boolean;
};

export async function readAdminMfaGateState(userId: string | null | undefined): Promise<AdminMfaGateState> {
  const enforced = isAdminMfaEnforced();
  if (!userId) {
    return { enforced, enrolled: false, stepUpComplete: false };
  }
  const stepUpComplete = await adminHasValidStepUpCookie(userId);
  if (!enforced) {
    return { enforced: false, enrolled: false, stepUpComplete };
  }
  if (stepUpComplete) {
    return { enforced: true, enrolled: true, stepUpComplete: true };
  }
  const enrolled = await adminHasConfirmedTotp(userId);
  return { enforced, enrolled, stepUpComplete: false };
}

export async function adminHasValidStepUpCookie(userId: string): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(ADMIN_MFA_COOKIE_NAME)?.value;
  if (!token) return false;
  return verifyAdminMfaSessionToken(token, userId);
}

export function adminHasValidStepUpFromRequest(request: NextRequest, userId: string): boolean {
  const token = request.cookies.get(ADMIN_MFA_COOKIE_NAME)?.value;
  if (!token) return false;
  return verifyAdminMfaSessionToken(token, userId);
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
