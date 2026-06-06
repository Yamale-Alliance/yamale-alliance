import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import { decryptTotpSecret, encryptTotpSecret } from "@/lib/admin-mfa-crypto";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

type TotpRow = Database["public"]["Tables"]["admin_totp_secrets"]["Row"];
type TotpInsert = Database["public"]["Tables"]["admin_totp_secrets"]["Insert"];
type TotpUpdate = Database["public"]["Tables"]["admin_totp_secrets"]["Update"];

function table(client: SupabaseClient<Database> = getSupabaseServer()) {
  // Postgrest typings lag new tables until Supabase codegen is re-run.
  return client.from("admin_totp_secrets") as unknown as {
    select: (columns?: string) => {
      eq: (col: string, val: string) => {
        maybeSingle: () => Promise<{ data: TotpRow | null; error: { message: string } | null }>;
        single: () => Promise<{ data: TotpRow; error: { message: string } | null }>;
      };
    };
    upsert: (
      values: TotpInsert,
      options?: { onConflict?: string }
    ) => Promise<{ error: { message: string } | null }>;
    update: (values: TotpUpdate) => {
      eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
    };
    delete: () => {
      eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
    };
  };
}

export async function adminHasConfirmedTotp(userId: string): Promise<boolean> {
  const { data, error } = await table()
    .select("confirmed_at")
    .eq("clerk_user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("adminHasConfirmedTotp:", error.message);
    return false;
  }
  const row = data as { confirmed_at: string | null } | null;
  return Boolean(row?.confirmed_at);
}

export async function getAdminTotpRecord(userId: string): Promise<TotpRow | null> {
  const { data, error } = await table().select("*").eq("clerk_user_id", userId).maybeSingle();
  if (error) {
    console.error("getAdminTotpRecord:", error.message);
    return null;
  }
  return (data as TotpRow | null) ?? null;
}

export async function savePendingTotpSecret(userId: string, secret: string): Promise<boolean> {
  const encrypted = encryptTotpSecret(secret);
  const now = new Date().toISOString();
  const { error } = await table().upsert(
    {
      clerk_user_id: userId,
      encrypted_secret: encrypted,
      confirmed_at: null,
      failed_attempts: 0,
      locked_until: null,
      updated_at: now,
    },
    { onConflict: "clerk_user_id" }
  );
  if (error) {
    console.error("savePendingTotpSecret:", error.message);
    return false;
  }
  return true;
}

export async function confirmAdminTotpEnrollment(userId: string): Promise<boolean> {
  const now = new Date().toISOString();
  const { error } = await table()
    .update({
      confirmed_at: now,
      failed_attempts: 0,
      locked_until: null,
      updated_at: now,
    })
    .eq("clerk_user_id", userId);
  if (error) {
    console.error("confirmAdminTotpEnrollment:", error.message);
    return false;
  }
  return true;
}

export async function deleteAdminTotp(userId: string): Promise<boolean> {
  const { error } = await table().delete().eq("clerk_user_id", userId);
  if (error) {
    console.error("deleteAdminTotp:", error.message);
    return false;
  }
  return true;
}

export type TotpVerifyResult =
  | { ok: true; secret: string }
  | { ok: false; reason: "not_enrolled" | "locked" | "invalid" };

export async function verifyAdminTotpCode(userId: string, code: string, verifyFn: (secret: string, token: string) => boolean): Promise<TotpVerifyResult> {
  const row = await getAdminTotpRecord(userId);
  if (!row?.encrypted_secret) {
    return { ok: false, reason: "not_enrolled" };
  }

  if (row.locked_until) {
    const lockedUntil = new Date(row.locked_until).getTime();
    if (lockedUntil > Date.now()) {
      return { ok: false, reason: "locked" };
    }
  }

  let secret: string;
  try {
    secret = decryptTotpSecret(row.encrypted_secret);
  } catch (err) {
    console.error("verifyAdminTotpCode decrypt:", err);
    return { ok: false, reason: "invalid" };
  }

  const normalized = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) {
    return { ok: false, reason: "invalid" };
  }

  if (!verifyFn(secret, normalized)) {
    await recordFailedTotpAttempt(userId, row.failed_attempts ?? 0);
    return { ok: false, reason: "invalid" };
  }

  await clearTotpFailures(userId);
  return { ok: true, secret };
}

async function recordFailedTotpAttempt(userId: string, currentAttempts: number): Promise<void> {
  const attempts = currentAttempts + 1;
  const patch: TotpUpdate = {
    failed_attempts: attempts,
    updated_at: new Date().toISOString(),
  };
  if (attempts >= MAX_FAILED_ATTEMPTS) {
    patch.locked_until = new Date(Date.now() + LOCKOUT_MS).toISOString();
    patch.failed_attempts = 0;
  }
  await table().update(patch).eq("clerk_user_id", userId);
}

async function clearTotpFailures(userId: string): Promise<void> {
  await table()
    .update({
      failed_attempts: 0,
      locked_until: null,
      updated_at: new Date().toISOString(),
    })
    .eq("clerk_user_id", userId);
}

export async function getAdminTotpLockoutRemainingSec(userId: string): Promise<number> {
  const row = await getAdminTotpRecord(userId);
  if (!row?.locked_until) return 0;
  const ms = new Date(row.locked_until).getTime() - Date.now();
  return ms > 0 ? Math.ceil(ms / 1000) : 0;
}
