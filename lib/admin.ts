import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { adminHasValidStepUpCookie, readAdminMfaGateState } from "@/lib/admin-mfa-gate";
import { adminAuthFromClerk, userHasAdminAccess } from "@/lib/admin-session";

export type AdminAuth = { userId: string; role: "admin"; email: string | null };

export type RequireAdminOptions = {
  /** Allow admin role check without app-level TOTP step-up (MFA enrollment/verify routes). */
  skipMfa?: boolean;
};

/**
 * Use in admin API routes. Returns { userId, role, email } if the user is an admin, otherwise returns a 403 Response.
 */
export async function requireAdmin(options?: RequireAdminOptions): Promise<AdminAuth | NextResponse> {
  const authState = await auth();
  const { userId } = authState;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAdmin = await userHasAdminAccess(authState);
  if (!hasAdmin) {
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
  return { userId, role: "admin", email };
}

/** Check app-level admin TOTP step-up for server components. */
export async function adminStepUpComplete(userId: string): Promise<boolean> {
  return adminHasValidStepUpCookie(userId);
}

/** Non-route helper for server components that need admin + MFA state. */
export function readAdminAuthState(authState: Awaited<ReturnType<typeof auth>>) {
  return adminAuthFromClerk(authState);
}
