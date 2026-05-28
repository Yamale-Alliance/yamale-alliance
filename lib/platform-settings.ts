import { cache } from "react";
import { getSupabaseServer } from "@/lib/supabase/server";
import {
  type ContentPricingSnapshot,
  CONTENT_PRICING_DEFAULTS,
  readContentPricingFromRow,
} from "@/lib/content-pricing";

export type PlatformSettingsSnapshot = {
  logoUrl: string | null;
  faviconUrl: string | null;
  heroImageUrl: string | null;
  founderPortraitUrl: string | null;
  lawyersOnboardingVideoUrl: string | null;
} & ContentPricingSnapshot;

let cachedSettings: PlatformSettingsSnapshot | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function stripNoise(s: string): string {
  return s
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const PLATFORM_SETTINGS_BRANDING_SELECT =
  "logo_url, favicon_url, hero_image_url, founder_portrait_url";
const PLATFORM_SETTINGS_PRICING_SELECT =
  "law_print_price_usd_cents, lawyer_search_unlock_price_usd_cents, day_pass_price_usd_cents, ai_query_price_usd_cents, afcfta_report_price_usd_cents";
const PLATFORM_SETTINGS_BASE_SELECT = `logo_url, favicon_url, hero_image_url, ${PLATFORM_SETTINGS_PRICING_SELECT}`;
const PLATFORM_SETTINGS_FULL_SELECT = `${PLATFORM_SETTINGS_BASE_SELECT}, founder_portrait_url, lawyers_onboarding_video_url`;

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

function isMissingColumnError(error: unknown, columnHint: string): boolean {
  const text = formatSupabaseError(error).toLowerCase();
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: string }).code ?? "") : "";
  return (
    text.includes(columnHint.toLowerCase()) ||
    (text.includes("column") && text.includes("does not exist")) ||
    code === "42703" ||
    code === "PGRST204"
  );
}

function rowToSnapshot(row: Record<string, unknown> | null): PlatformSettingsSnapshot {
  const pricing = readContentPricingFromRow(row);
  return {
    logoUrl: (row?.logo_url as string | null) || null,
    faviconUrl: (row?.favicon_url as string | null) || null,
    heroImageUrl: (row?.hero_image_url as string | null) || null,
    founderPortraitUrl: (row?.founder_portrait_url as string | null) || null,
    lawyersOnboardingVideoUrl: (row?.lawyers_onboarding_video_url as string | null) || null,
    ...pricing,
  };
}

function emptyPlatformSettings(): PlatformSettingsSnapshot {
  return {
    logoUrl: null,
    faviconUrl: null,
    heroImageUrl: null,
    founderPortraitUrl: null,
    lawyersOnboardingVideoUrl: null,
    ...CONTENT_PRICING_DEFAULTS,
  };
}

export async function getPlatformLogo(): Promise<string | null> {
  const settings = await getPlatformSettings();
  return settings.logoUrl;
}

export async function getPlatformFavicon(): Promise<string | null> {
  const settings = await getPlatformSettings();
  return settings.faviconUrl;
}

export async function getPlatformHeroImage(): Promise<string | null> {
  const settings = await getPlatformSettings();
  return settings.heroImageUrl;
}

export const getPlatformSettings = cache(async function getPlatformSettings(): Promise<PlatformSettingsSnapshot> {
  const now = Date.now();

  if (cachedSettings && now - cacheTimestamp < CACHE_TTL) {
    return cachedSettings;
  }

  try {
    const supabase = getSupabaseServer();

    let { data, error } = await (supabase.from("platform_settings") as any)
      .select(PLATFORM_SETTINGS_FULL_SELECT)
      .eq("id", "main")
      .maybeSingle();

    if (error && isMissingColumnError(error, "lawyers_onboarding_video_url")) {
      const retry = await (supabase.from("platform_settings") as any)
        .select(`${PLATFORM_SETTINGS_FULL_SELECT.replace(", lawyers_onboarding_video_url", "")}`)
        .eq("id", "main")
        .maybeSingle();
      data = retry.data;
      error = retry.error;
    }

    if (error && isMissingColumnError(error, "founder_portrait_url")) {
      const retry = await (supabase.from("platform_settings") as any)
        .select(PLATFORM_SETTINGS_BASE_SELECT)
        .eq("id", "main")
        .maybeSingle();
      data = retry.data;
      error = retry.error;
    }

    if (error && isMissingColumnError(error, "day_pass_price_usd_cents")) {
      const retry = await (supabase.from("platform_settings") as any)
        .select(`${PLATFORM_SETTINGS_BRANDING_SELECT}, law_print_price_usd_cents`)
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

    const settings = rowToSnapshot(data as Record<string, unknown> | null);

    cachedSettings = settings;
    cacheTimestamp = now;
    return settings;
  } catch (err) {
    console.error("Platform settings unexpected error:", err);
    return emptyPlatformSettings();
  }
});

export async function getLawPrintPriceUsdCents(): Promise<number> {
  return (await getPlatformSettings()).lawPrintPriceUsdCents;
}

export async function getDayPassPriceUsdCents(): Promise<number> {
  return (await getPlatformSettings()).dayPassPriceUsdCents;
}

export async function getLawyerSearchUnlockPriceUsdCents(): Promise<number> {
  return (await getPlatformSettings()).lawyerSearchUnlockPriceUsdCents;
}

/** Legacy per-lawyer unlock checkout — uses the same price as lawyer directory search. */
export async function getLawyerUnlockPriceUsdCents(): Promise<number> {
  return getLawyerSearchUnlockPriceUsdCents();
}

export async function getAiQueryPriceUsdCents(): Promise<number> {
  return (await getPlatformSettings()).aiQueryPriceUsdCents;
}

export async function getAfcftaReportPriceUsdCents(): Promise<number> {
  return (await getPlatformSettings()).afcftaReportPriceUsdCents;
}

export function clearPlatformSettingsCache(): void {
  cachedSettings = null;
  cacheTimestamp = 0;
}
