import { getSupabaseServer } from "@/lib/supabase/server";
import {
  clampLawPrintPriceUsdCents,
  DEFAULT_LAW_PRINT_PRICE_USD_CENTS,
} from "@/lib/law-print-pricing";

export type PlatformSettingsSnapshot = {
  logoUrl: string | null;
  faviconUrl: string | null;
  heroImageUrl: string | null;
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

function hasMeaningfulErrorDetails(error: unknown): boolean {
  if (!error || typeof error !== "object" || Array.isArray(error)) return false;
  const e = error as Record<string, unknown>;
  const pick = (key: string) => {
    const v = e[key];
    return typeof v === "string" ? stripNoise(v) : "";
  };
  const parts = [pick("code"), pick("message"), pick("details"), pick("hint")];
  if (typeof e.error === "string") parts.push(stripNoise(e.error));
  return parts.some((p) => p.length > 0);
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
    const { data, error } = await (supabase.from("platform_settings") as any)
      .select("logo_url, favicon_url, hero_image_url, law_print_price_usd_cents")
      .eq("id", "main")
      .maybeSingle();

    // Missing row is expected until configured; avoid noisy logs for empty/placeholder errors.
    if (error) {
      const isNotFound = (error as any)?.code === "PGRST116";
      
      if (!isNotFound && hasMeaningfulErrorDetails(error)) {
        console.error("Platform settings error:", error);
        return {
          logoUrl: null,
          faviconUrl: null,
          heroImageUrl: null,
          lawPrintPriceUsdCents: DEFAULT_LAW_PRINT_PRICE_USD_CENTS,
        };
      }
      // Continue with null values on benign/empty driver responses.
    }

    const row = data as {
      logo_url?: string | null;
      favicon_url?: string | null;
      hero_image_url?: string | null;
      law_print_price_usd_cents?: number | null;
    } | null;
    const rawPrintCents = row?.law_print_price_usd_cents;
    const lawPrintPriceUsdCents =
      typeof rawPrintCents === "number" && Number.isFinite(rawPrintCents)
        ? clampLawPrintPriceUsdCents(rawPrintCents)
        : DEFAULT_LAW_PRINT_PRICE_USD_CENTS;
    const settings: PlatformSettingsSnapshot = {
      logoUrl: row?.logo_url || null,
      faviconUrl: row?.favicon_url || null,
      heroImageUrl: row?.hero_image_url || null,
      lawPrintPriceUsdCents,
    };

    cachedSettings = settings;
    cacheTimestamp = now;
    return settings;
  } catch (err) {
    console.error("Platform settings unexpected error:", err);
    return {
      logoUrl: null,
      faviconUrl: null,
      heroImageUrl: null,
      lawPrintPriceUsdCents: DEFAULT_LAW_PRINT_PRICE_USD_CENTS,
    };
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
