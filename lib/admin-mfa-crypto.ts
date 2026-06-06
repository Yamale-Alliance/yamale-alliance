import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

function getEncryptionKey(): Buffer {
  const raw = process.env.ADMIN_MFA_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error("ADMIN_MFA_ENCRYPTION_KEY is not configured");
  }
  if (raw.length === 64 && /^[0-9a-f]+$/i.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  if (raw.length >= 32) {
    return createHash("sha256").update(raw, "utf8").digest();
  }
  throw new Error("ADMIN_MFA_ENCRYPTION_KEY must be at least 32 characters");
}

/** AES-256-GCM encrypt; returns `iv.ciphertext.tag` (base64url segments). */
export function encryptTotpSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, ciphertext, tag].map((buf) => buf.toString("base64url")).join(".");
}

export function decryptTotpSecret(payload: string): string {
  const parts = payload.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted TOTP secret format");
  }
  const [ivB64, ctB64, tagB64] = parts;
  const iv = Buffer.from(ivB64, "base64url");
  const ciphertext = Buffer.from(ctB64, "base64url");
  const tag = Buffer.from(tagB64, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
