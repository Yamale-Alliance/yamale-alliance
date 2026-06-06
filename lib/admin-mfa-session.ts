import { createHmac, timingSafeEqual } from "crypto";

export const ADMIN_MFA_COOKIE_NAME = "admin_mfa_step_up";

const DEFAULT_SESSION_TTL_SEC = 12 * 60 * 60;

export function getAdminMfaSessionTtlSec(): number {
  const raw = process.env.ADMIN_MFA_SESSION_TTL_SEC?.trim();
  if (!raw) return DEFAULT_SESSION_TTL_SEC;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_SESSION_TTL_SEC;
}

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

/** Signed token: `userId.exp.hmac` */
export function createAdminMfaSessionToken(userId: string): string {
  const exp = Math.floor(Date.now() / 1000) + getAdminMfaSessionTtlSec();
  const payload = `${userId}.${exp}`;
  return `${payload}.${signPayload(payload)}`;
}

export function verifyAdminMfaSessionToken(token: string, userId: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [uid, expStr, sig] = parts;
  if (uid !== userId) return false;
  const exp = parseInt(expStr, 10);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const payload = `${uid}.${expStr}`;
  const expected = signPayload(payload);
  try {
    const a = Buffer.from(sig, "base64url");
    const b = Buffer.from(expected, "base64url");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function adminMfaCookieOptions(maxAgeSec = getAdminMfaSessionTtlSec()) {
  return {
    name: ADMIN_MFA_COOKIE_NAME,
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSec,
  };
}
