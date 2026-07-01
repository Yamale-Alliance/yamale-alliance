import { getSupabaseServer } from "@/lib/supabase/server";

/** Secure default: re-prompt for the MFA code after 30 minutes of inactivity. */
export const DEFAULT_MFA_IDLE_TIMEOUT_SEC = 30 * 60;

/** Minimum selectable idle window (guards against unusably short sessions). */
export const MIN_MFA_IDLE_TIMEOUT_SEC = 5 * 60;

/** Maximum finite idle window (24h). Above this, admins should pick "never". */
export const MAX_MFA_IDLE_TIMEOUT_SEC = 24 * 60 * 60;

/** Preset options offered in the admin settings UI (seconds; null = never). */
export const MFA_IDLE_TIMEOUT_PRESETS_SEC: Array<number | null> = [
  5 * 60,
  15 * 60,
  30 * 60,
  60 * 60,
  2 * 60 * 60,
  8 * 60 * 60,
  null,
];

export type AdminSecuritySettings = {
  /** Seconds of inactivity before MFA step-up expires. null = never expires on inactivity. */
  mfaIdleTimeoutSec: number | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

const CACHE_TTL_MS = 60 * 1000;
let cached: { value: AdminSecuritySettings; expiresAt: number } | null = null;

function normalizeIdleTimeout(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const n = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(MAX_MFA_IDLE_TIMEOUT_SEC, Math.max(MIN_MFA_IDLE_TIMEOUT_SEC, Math.round(n)));
}

/** Validate a client-provided idle timeout. Returns the clamped value, or null for "never". */
export function coerceIdleTimeoutInput(raw: unknown): number | null {
  if (raw === null || raw === "never" || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(MAX_MFA_IDLE_TIMEOUT_SEC, Math.max(MIN_MFA_IDLE_TIMEOUT_SEC, Math.round(n)));
}

function defaults(): AdminSecuritySettings {
  return { mfaIdleTimeoutSec: DEFAULT_MFA_IDLE_TIMEOUT_SEC, updatedAt: null, updatedBy: null };
}

export function clearAdminSecuritySettingsCache(): void {
  cached = null;
}

export async function getAdminSecuritySettings(): Promise<AdminSecuritySettings> {
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  try {
    const supabase = getSupabaseServer();
    const { data, error } = await (supabase.from("admin_security_settings") as any)
      .select("mfa_idle_timeout_sec, updated_at, updated_by")
      .eq("id", "main")
      .maybeSingle();

    if (error) {
      // Table may not exist yet (migration not applied) — fall back to secure default.
      return defaults();
    }

    const row = data as
      | { mfa_idle_timeout_sec: number | null; updated_at: string | null; updated_by: string | null }
      | null;

    const value: AdminSecuritySettings = row
      ? {
          mfaIdleTimeoutSec: normalizeIdleTimeout(row.mfa_idle_timeout_sec),
          updatedAt: row.updated_at ?? null,
          updatedBy: row.updated_by ?? null,
        }
      : defaults();

    cached = { value, expiresAt: Date.now() + CACHE_TTL_MS };
    return value;
  } catch {
    return defaults();
  }
}

export async function updateAdminMfaIdleTimeout(
  idleTimeoutSec: number | null,
  updatedBy: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = getSupabaseServer();
    const { error } = await (supabase.from("admin_security_settings") as any).upsert(
      {
        id: "main",
        mfa_idle_timeout_sec: idleTimeoutSec,
        updated_at: new Date().toISOString(),
        updated_by: updatedBy,
      },
      { onConflict: "id" }
    );
    if (error) {
      return { ok: false, error: error.message ?? "Failed to save security settings" };
    }
    clearAdminSecuritySettingsCache();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to save security settings" };
  }
}
