import { getSupabaseServer } from "@/lib/supabase/server";

let cachedSettings: { logoUrl: string | null; faviconUrl: string | null; heroImageUrl: string | null } | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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
export async function getPlatformSettings(): Promise<{ logoUrl: string | null; faviconUrl: string | null; heroImageUrl: string | null }> {
  const now = Date.now();
  
  // Return cached settings if still valid
  if (cachedSettings && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedSettings;
  }

  try {
    const supabase = getSupabaseServer();
    const { data, error } = await (supabase.from("platform_settings") as any)
      .select("logo_url, favicon_url, hero_image_url")
      .eq("id", "main")
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Platform settings error:", error);
      return { logoUrl: null, faviconUrl: null, heroImageUrl: null };
    }

    const row = data as { logo_url?: string | null; favicon_url?: string | null; hero_image_url?: string | null } | null;
    const settings = {
      logoUrl: row?.logo_url || null,
      faviconUrl: row?.favicon_url || null,
      heroImageUrl: row?.hero_image_url || null,
    };

    cachedSettings = settings;
    cacheTimestamp = now;
    return settings;
  } catch (err) {
    console.error("Platform settings unexpected error:", err);
    return { logoUrl: null, faviconUrl: null, heroImageUrl: null };
  }
}

/**
 * Clear platform settings cache (call after updates)
 */
export function clearPlatformSettingsCache(): void {
  cachedSettings = null;
  cacheTimestamp = 0;
}
