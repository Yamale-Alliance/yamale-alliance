import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { adminHasValidStepUpCookie, readAdminMfaGateState } from "@/lib/admin-mfa-gate";
import {
  canApproveRagLaws,
  canDeleteLaws,
  canEditLaw,
  type AdminPanelRole,
} from "@/lib/admin-roles";
import { adminAuthFromClerk, getUserAdminPanelRole, userHasAdminAccess } from "@/lib/admin-session";

export type AdminAuth = { userId: string; role: AdminPanelRole; email: string | null };

export type RequireAdminOptions = {
  /** Allow admin role check without app-level TOTP step-up (MFA enrollment/verify routes). */
  skipMfa?: boolean;
};

async function requireAdminPanelAuth(
  options?: RequireAdminOptions
): Promise<AdminAuth | NextResponse> {
  const authState = await auth();
  const { userId } = authState;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = await getUserAdminPanelRole(authState);
  if (!role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!options?.skipMfa) {
    const mfa = await readAdminMfaGateState(userId);
    if (mfa.enforced && !mfa.stepUpComplete) {
      if (!mfa.enrolled) {
        return NextResponse.json(
          { error: "MFA enrollment required", code: "MFA_ENROLLMENT_REQUIRED" },
          { status: 403 }
        );
      }
      return NextResponse.json({ error: "MFA required", code: "MFA_REQUIRED" }, { status: 403 });
    }
  }

  const claims = authState.sessionClaims as { email?: string } | undefined;
  const email = typeof claims?.email === "string" ? claims.email : null;
  return { userId, role, email };
}

/**
 * Use in admin API routes. Returns auth if the user is a full admin, otherwise 403.
 */
export async function requireAdmin(options?: RequireAdminOptions): Promise<AdminAuth | NextResponse> {
  const authResult = await requireAdminPanelAuth(options);
  if (authResult instanceof NextResponse) return authResult;
  if (authResult.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return authResult;
}

/** Full admin or legal admin — MFA, session, and other panel-wide routes. */
export async function requireAdminPanel(
  options?: RequireAdminOptions
): Promise<AdminAuth | NextResponse> {
  return requireAdminPanelAuth(options);
}

/** Full admin or legal admin (laws section). */
export async function requireLawsAccess(
  options?: RequireAdminOptions
): Promise<AdminAuth | NextResponse> {
  return requireAdminPanelAuth(options);
}

export function assertCanDeleteLaw(admin: AdminAuth): NextResponse | null {
  if (!canDeleteLaws(admin.role)) {
    return NextResponse.json({ error: "You do not have permission to delete laws" }, { status: 403 });
  }
  return null;
}

export function assertCanApproveRag(admin: AdminAuth): NextResponse | null {
  if (!canApproveRagLaws(admin.role)) {
    return NextResponse.json(
      { error: "You do not have permission to approve laws for AI search" },
      { status: 403 }
    );
  }
  return null;
}

export function assertCanEditLaw(
  admin: AdminAuth,
  ingestedBy: string | null | undefined
): NextResponse | null {
  if (!canEditLaw(admin.role, admin.userId, ingestedBy)) {
    return NextResponse.json({ error: "You can only edit laws you added" }, { status: 403 });
  }
  return null;
}

/** Check app-level admin TOTP step-up for server components. */
export async function adminStepUpComplete(userId: string): Promise<boolean> {
  return adminHasValidStepUpCookie(userId);
}

/** Non-route helper for server components that need admin + MFA state. */
export function readAdminAuthState(authState: Awaited<ReturnType<typeof auth>>) {
  return adminAuthFromClerk(authState);
}

/** @deprecated Use getUserAdminPanelRole — kept for callers that only need full-admin boolean. */
export { userHasAdminAccess };
