import { createHmac, timingSafeEqual } from "crypto";

export const ADMIN_MFA_COOKIE_NAME = "admin_mfa_step_up";

/**
 * Absolute maximum lifetime of a step-up session regardless of activity.
 * Idle expiry (configured in admin settings) is enforced on top of this.
 */
const DEFAULT_ABSOLUTE_TTL_SEC = 12 * 60 * 60;

export function getAdminMfaAbsoluteTtlSec(): number {
  const raw = process.env.ADMIN_MFA_SESSION_TTL_SEC?.trim();
  if (!raw) return DEFAULT_ABSOLUTE_TTL_SEC;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_ABSOLUTE_TTL_SEC;
}

/** @deprecated Use getAdminMfaAbsoluteTtlSec. Kept for older call sites. */
export const getAdminMfaSessionTtlSec = getAdminMfaAbsoluteTtlSec;

function getSigningSecret(): string {
  const secret = process.env.ADMIN_MFA_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("ADMIN_MFA_SECRET must be at least 32 characters");
  }
  return secret;
}

function signPayload(payload: string): string {
  return createHmac("sha256", getSigningSecret()).update(payload, "utf8").digest("base64url");
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Signed token: `userId.absExp.lastActivity.hmac`
 * - absExp: absolute expiry (issue time + absolute TTL)
 * - lastActivity: unix seconds of the last recorded admin activity (for idle expiry)
 */
export function createAdminMfaSessionToken(userId: string, lastActivitySec = nowSec()): string {
  const absExp = nowSec() + getAdminMfaAbsoluteTtlSec();
  const payload = `${userId}.${absExp}.${lastActivitySec}`;
  return `${payload}.${signPayload(payload)}`;
}

export type AdminMfaTokenStatus =
  | { valid: true; absExp: number; lastActivity: number }
  | { valid: false; reason: "malformed" | "wrong_user" | "bad_signature" | "absolute_expired" | "idle_expired" };

type VerifyOptions = {
  /** Idle window in seconds; null = no idle expiry (never). */
  idleTimeoutSec: number | null;
};

/**
 * Verify a step-up token, enforcing both the absolute expiry and (optionally) an idle window.
 * The signature is checked before any timestamp so tampering can't extend a session.
 */
export function inspectAdminMfaSessionToken(
  token: string,
  userId: string,
  options: VerifyOptions
): AdminMfaTokenStatus {
  const parts = token.split(".");
  if (parts.length !== 4) return { valid: false, reason: "malformed" };
  const [uid, absExpStr, lastActivityStr, sig] = parts;
  if (uid !== userId) return { valid: false, reason: "wrong_user" };

  const payload = `${uid}.${absExpStr}.${lastActivityStr}`;
  const expected = signPayload(payload);
  let signatureOk = false;
  try {
    const a = Buffer.from(sig, "base64url");
    const b = Buffer.from(expected, "base64url");
    signatureOk = a.length === b.length && timingSafeEqual(a, b);
  } catch {
    signatureOk = false;
  }
  if (!signatureOk) return { valid: false, reason: "bad_signature" };

  const absExp = parseInt(absExpStr, 10);
  const lastActivity = parseInt(lastActivityStr, 10);
  if (!Number.isFinite(absExp) || !Number.isFinite(lastActivity)) {
    return { valid: false, reason: "malformed" };
  }

  const now = nowSec();
  if (absExp < now) return { valid: false, reason: "absolute_expired" };

  if (options.idleTimeoutSec != null && options.idleTimeoutSec > 0) {
    if (now - lastActivity > options.idleTimeoutSec) {
      return { valid: false, reason: "idle_expired" };
    }
  }

  return { valid: true, absExp, lastActivity };
}

/** Serialize options for `Response.cookies.set(name, value, options)` — do not include `name`. */
export function adminMfaCookieSerializeOptions(maxAgeSec = getAdminMfaAbsoluteTtlSec()) {
  const insecure =
    process.env.ADMIN_MFA_COOKIE_INSECURE === "true" || process.env.ADMIN_MFA_COOKIE_INSECURE === "1";
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: !insecure && process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSec,
  };
}

/** @deprecated Use adminMfaCookieSerializeOptions. */
export function adminMfaCookieOptions(maxAgeSec = getAdminMfaAbsoluteTtlSec()) {
  return adminMfaCookieSerializeOptions(maxAgeSec);
}
