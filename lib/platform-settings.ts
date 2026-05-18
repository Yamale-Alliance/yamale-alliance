import { getSupabaseServer } from "@/lib/supabase/server";
import {
  clampLawPrintPriceUsdCents,
  DEFAULT_LAW_PRINT_PRICE_USD_CENTS,
} from "@/lib/law-print-pricing";

export type PlatformSettingsSnapshot = {
  logoUrl: string | null;
  faviconUrl: string | null;
  heroImageUrl: string | null;
  founderPortraitUrl: string | null;
  lawPrintPriceUsdCents: number;
};

let cachedSettings: PlatformSettingsSnapshot | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function stripNoise(s: string): string {
  return s
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const PLATFORM_SETTINGS_BASE_SELECT =
  "logo_url, favicon_url, hero_image_url, law_print_price_usd_cents";
const PLATFORM_SETTINGS_FULL_SELECT = `${PLATFORM_SETTINGS_BASE_SELECT}, founder_portrait_url`;

function formatSupabaseError(error: unknown): string {
  if (!error || typeof error !== "object" || Array.isArray(error)) {
    return typeof error === "string" ? error : "";
  }
  const e = error as Record<string, unknown>;
  const pick = (key: string) => {
    const v = e[key];
    return typeof v === "string" ? stripNoise(v) : "";
  };
  return [pick("code"), pick("message"), pick("details"), pick("hint"), typeof e.error === "string" ? stripNoise(e.error) : ""]
    .filter(Boolean)
    .join(" — ");
}

function isMissingFounderPortraitColumnError(error: unknown): boolean {
  const text = formatSupabaseError(error).toLowerCase();
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: string }).code ?? "") : "";
  return (
    text.includes("founder_portrait_url") ||
    (text.includes("column") && text.includes("does not exist")) ||
    code === "42703" ||
    code === "PGRST204"
  );
}

function rowToSnapshot(row: {
  logo_url?: string | null;
  favicon_url?: string | null;
  hero_image_url?: string | null;
  founder_portrait_url?: string | null;
  law_print_price_usd_cents?: number | null;
} | null): PlatformSettingsSnapshot {
  const rawPrintCents = row?.law_print_price_usd_cents;
  const lawPrintPriceUsdCents =
    typeof rawPrintCents === "number" && Number.isFinite(rawPrintCents)
      ? clampLawPrintPriceUsdCents(rawPrintCents)
      : DEFAULT_LAW_PRINT_PRICE_USD_CENTS;
  return {
    logoUrl: row?.logo_url || null,
    faviconUrl: row?.favicon_url || null,
    heroImageUrl: row?.hero_image_url || null,
    founderPortraitUrl: row?.founder_portrait_url || null,
    lawPrintPriceUsdCents,
  };
}

function emptyPlatformSettings(): PlatformSettingsSnapshot {
  return {
    logoUrl: null,
    faviconUrl: null,
    heroImageUrl: null,
    founderPortraitUrl: null,
    lawPrintPriceUsdCents: DEFAULT_LAW_PRINT_PRICE_USD_CENTS,
  };
}

/**
 * Get platform logo URL (server-side)
 */
export async function getPlatformLogo(): Promise<string | null> {
  const settings = await getPlatformSettings();
  return settings.logoUrl;
}

/**
 * Get platform favicon URL (server-side)
 */
export async function getPlatformFavicon(): Promise<string | null> {
  const settings = await getPlatformSettings();
  return settings.faviconUrl;
}

/**
 * Get platform hero image URL (server-side) — shown large on the main page
 */
export async function getPlatformHeroImage(): Promise<string | null> {
  const settings = await getPlatformSettings();
  return settings.heroImageUrl;
}

/**
 * Get platform settings (server-side, cached)
 */
export async function getPlatformSettings(): Promise<PlatformSettingsSnapshot> {
  const now = Date.now();
  
  // Return cached settings if still valid
  if (cachedSettings && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedSettings;
  }

  try {
    const supabase = getSupabaseServer();

    let { data, error } = await (supabase.from("platform_settings") as any)
      .select(PLATFORM_SETTINGS_FULL_SELECT)
      .eq("id", "main")
      .maybeSingle();

    // Backward-compatible: DBs without the founder portrait migration still load logo/favicon.
    if (error && isMissingFounderPortraitColumnError(error)) {
      const retry = await (supabase.from("platform_settings") as any)
        .select(PLATFORM_SETTINGS_BASE_SELECT)
        .eq("id", "main")
        .maybeSingle();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      const isNotFound = (error as { code?: string })?.code === "PGRST116";
      const detail = formatSupabaseError(error);
      if (!isNotFound && detail) {
        console.error("Platform settings error:", detail);
      }
      return emptyPlatformSettings();
    }

    const settings = rowToSnapshot(
      data as {
        logo_url?: string | null;
        favicon_url?: string | null;
        hero_image_url?: string | null;
        founder_portrait_url?: string | null;
        law_print_price_usd_cents?: number | null;
      } | null
    );

    cachedSettings = settings;
    cacheTimestamp = now;
    return settings;
  } catch (err) {
    console.error("Platform settings unexpected error:", err);
    return emptyPlatformSettings();
  }
}

/** Pay-as-you-go law PDF unlock price (USD cents) for checkout and display. */
export async function getLawPrintPriceUsdCents(): Promise<number> {
  const settings = await getPlatformSettings();
  return settings.lawPrintPriceUsdCents;
}

/**
 * Clear platform settings cache (call after updates)
 */
export function clearPlatformSettingsCache(): void {
  cachedSettings = null;
  cacheTimestamp = 0;
}
