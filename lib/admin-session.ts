import { clerkClient, type auth } from "@clerk/nextjs/server";
import {
  ADMIN_ROLE,
  type AdminPanelRole,
  isAdminPanelRole,
  isFullAdminRole,
  normalizeClerkRole,
} from "@/lib/admin-roles";

type SessionClaims = Record<string, unknown> | null | undefined;
type SessionAuthObject = Awaited<ReturnType<typeof auth>>;

/** Clerk publicMetadata.role from session JWT claims. */
export function getRoleFromSessionClaims(sessionClaims: SessionClaims): string | undefined {
  const metadata = sessionClaims?.metadata;
  if (!metadata || typeof metadata !== "object") return undefined;
  const role = (metadata as Record<string, unknown>).role;
  return typeof role === "string" ? role : undefined;
}

export function isAdminSessionClaims(sessionClaims: SessionClaims): boolean {
  return getRoleFromSessionClaims(sessionClaims) === ADMIN_ROLE;
}

const ADMIN_ROLE_CACHE_TTL_MS = 5 * 60 * 1000;
const adminRoleCache = new Map<string, { role: AdminPanelRole | null; expiresAt: number }>();

function readCachedAdminPanelRole(userId: string): AdminPanelRole | null | undefined {
  const entry = adminRoleCache.get(userId);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    adminRoleCache.delete(userId);
    return undefined;
  }
  return entry.role;
}

function writeCachedAdminPanelRole(userId: string, role: AdminPanelRole | null): void {
  adminRoleCache.set(userId, { role, expiresAt: Date.now() + ADMIN_ROLE_CACHE_TTL_MS });
}

async function resolveAdminPanelRoleFromClerk(userId: string): Promise<AdminPanelRole | null> {
  const cached = readCachedAdminPanelRole(userId);
  if (cached !== undefined) return cached;

  try {
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const role = normalizeClerkRole(user.publicMetadata?.role as string | undefined);
    const panelRole = role && isAdminPanelRole(role) ? role : null;
    writeCachedAdminPanelRole(userId, panelRole);
    return panelRole;
  } catch (err) {
    console.error("resolveAdminPanelRoleFromClerk: Clerk lookup failed:", err);
    return null;
  }
}

function roleFromSessionClaims(claims: SessionClaims): AdminPanelRole | null {
  const role = normalizeClerkRole(getRoleFromSessionClaims(claims));
  return role && isAdminPanelRole(role) ? role : null;
}

/** Full admin only (not legal admin). */
export async function userHasAdminAccess(authState: SessionAuthObject): Promise<boolean> {
  const role = await getUserAdminPanelRole(authState);
  return isFullAdminRole(role);
}

/** Full admin or legal admin. */
export async function userHasAdminPanelAccess(authState: SessionAuthObject): Promise<boolean> {
  const role = await getUserAdminPanelRole(authState);
  return isAdminPanelRole(role);
}

export async function getUserAdminPanelRole(
  authState: SessionAuthObject
): Promise<AdminPanelRole | null> {
  const claims = authState.sessionClaims as SessionClaims;
  const claimRole = roleFromSessionClaims(claims);
  if (claimRole) return claimRole;

  const userId = authState.userId;
  if (!userId) return null;

  return resolveAdminPanelRoleFromClerk(userId);
}

/**
 * Admin gate for middleware: JWT `metadata.role` when present, else Clerk publicMetadata
 * (matches `requireAdmin()` on API routes — no session-token customization required).
 */
export const userHasAdminPanelAccessLegacy = userHasAdminPanelAccess;

/**
 * Legacy Clerk `fva` second-factor claim. App-level admin MFA uses `admin_mfa_step_up` cookie instead.
 * Clerk `fva` claim: [firstFactorAgeMinutes, secondFactorAgeMinutes?].
 */
export function sessionHasCompletedClerkMfa(sessionClaims: SessionClaims): boolean {
  const fva = sessionClaims?.fva;
  if (!Array.isArray(fva) || fva.length < 2) return false;
  return typeof fva[1] === "number" && Number.isFinite(fva[1]);
}

/** @deprecated Use app-level TOTP step-up via `adminStepUpComplete()` / `readAdminMfaGateState()`. */
export const sessionHasCompletedMfa = sessionHasCompletedClerkMfa;

export function isAdminMfaEnforced(): boolean {
  return process.env.ADMIN_MFA_ENFORCED === "true" || process.env.ADMIN_MFA_ENFORCED === "1";
}

export function adminAuthFromClerk(authState: SessionAuthObject): {
  userId: string | null;
  role: string | undefined;
  /** Clerk `fva` only — prefer app-level step-up for admin panel enforcement. */
  clerkMfaCompleted: boolean;
} {
  const sessionClaims = authState.sessionClaims as SessionClaims;
  return {
    userId: authState.userId ?? null,
    role: getRoleFromSessionClaims(sessionClaims),
    clerkMfaCompleted: sessionHasCompletedClerkMfa(sessionClaims),
  };
}
