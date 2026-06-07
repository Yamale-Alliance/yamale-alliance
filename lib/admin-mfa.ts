import { generateSecret, generateURI, verifySync } from "otplib";
import QRCode from "qrcode";
import {
  adminHasConfirmedTotp,
  confirmAdminTotpEnrollment,
  deleteAdminTotp,
  getAdminTotpLockoutRemainingSec,
  savePendingTotpSecret,
  verifyAdminTotpCode,
} from "@/lib/admin-mfa-store";

const TOTP_ISSUER = "Yamale Legal Admin";

export function generateTotpSecret(): string {
  return generateSecret();
}

export function buildTotpKeyUri(email: string, secret: string): string {
  return generateURI({
    issuer: TOTP_ISSUER,
    label: email || "admin",
    secret,
  });
}

export async function buildTotpQrDataUrl(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl, { margin: 1, width: 220 });
}

export function verifyTotpToken(secret: string, token: string): boolean {
  try {
    const result = verifySync({ secret, token, epochTolerance: 60 });
    return result.valid;
  } catch {
    return false;
  }
}

export async function startAdminTotpEnrollment(
  userId: string,
  email: string
): Promise<{
  secret: string;
  otpauthUrl: string;
  qrDataUrl: string;
} | null> {
  const secret = generateTotpSecret();
  const saved = await savePendingTotpSecret(userId, secret);
  if (!saved) return null;
  const otpauthUrl = buildTotpKeyUri(email, secret);
  const qrDataUrl = await buildTotpQrDataUrl(otpauthUrl);
  return { secret, otpauthUrl, qrDataUrl };
}

export async function completeAdminTotpEnrollment(
  userId: string,
  code: string
): Promise<{ ok: true } | { ok: false; reason: string; lockoutSec?: number }> {
  const lockoutSec = await getAdminTotpLockoutRemainingSec(userId);
  if (lockoutSec > 0) {
    return { ok: false, reason: "locked", lockoutSec };
  }

  const result = await verifyAdminTotpCode(userId, code, verifyTotpToken);
  if (!result.ok) {
    if (result.reason === "locked") {
      return { ok: false, reason: "locked", lockoutSec: await getAdminTotpLockoutRemainingSec(userId) };
    }
    return { ok: false, reason: result.reason };
  }

  const confirmed = await confirmAdminTotpEnrollment(userId);
  if (!confirmed) {
    return { ok: false, reason: "save_failed" };
  }
  return { ok: true };
}

export async function verifyAdminStepUpCode(
  userId: string,
  code: string
): Promise<{ ok: true } | { ok: false; reason: string; lockoutSec?: number }> {
  const enrolled = await adminHasConfirmedTotp(userId);
  if (!enrolled) {
    return { ok: false, reason: "not_enrolled" };
  }

  const lockoutSec = await getAdminTotpLockoutRemainingSec(userId);
  if (lockoutSec > 0) {
    return { ok: false, reason: "locked", lockoutSec };
  }

  const result = await verifyAdminTotpCode(userId, code, verifyTotpToken);
  if (!result.ok) {
    if (result.reason === "locked") {
      return { ok: false, reason: "locked", lockoutSec: await getAdminTotpLockoutRemainingSec(userId) };
    }
    return { ok: false, reason: result.reason };
  }
  return { ok: true };
}

export async function disableAdminTotp(
  userId: string,
  code: string
): Promise<{ ok: true } | { ok: false; reason: string; lockoutSec?: number }> {
  const stepUp = await verifyAdminStepUpCode(userId, code);
  if (!stepUp.ok) return stepUp;
  const removed = await deleteAdminTotp(userId);
  if (!removed) return { ok: false, reason: "delete_failed" };
  return { ok: true };
}

export { adminHasConfirmedTotp };
