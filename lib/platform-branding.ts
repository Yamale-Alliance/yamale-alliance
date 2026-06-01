import { unstable_noStore as noStore } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";

export type PlatformBranding = {
  logoUrl: string | null;
  faviconUrl: string | null;
  founderPortraitUrl: string | null;
};

const BRANDING_SELECT = "logo_url, favicon_url, founder_portrait_url";

/** Fresh branding URLs (no in-memory cache) — use for favicon routes and founder portrait pages. */
export async function getPlatformBranding(): Promise<PlatformBranding> {
  noStore();

  try {
    const supabase = getSupabaseServer();
    let { data, error } = await (supabase.from("platform_settings") as any)
      .select(BRANDING_SELECT)
      .eq("id", "main")
      .maybeSingle();

    if (error) {
      const msg =
        typeof error === "object" && error && "message" in error
          ? String((error as { message?: string }).message ?? "")
          : "";
      if (/founder_portrait_url|does not exist/i.test(msg)) {
        const retry = await (supabase.from("platform_settings") as any)
          .select("logo_url, favicon_url")
          .eq("id", "main")
          .maybeSingle();
        data = retry.data;
        error = retry.error;
      }
    }

    if (error || !data) {
      return { logoUrl: null, faviconUrl: null, founderPortraitUrl: null };
    }

    const row = data as Record<string, unknown>;
    return {
      logoUrl: (row.logo_url as string | null) || null,
      faviconUrl: (row.favicon_url as string | null) || null,
      founderPortraitUrl: (row.founder_portrait_url as string | null) || null,
    };
  } catch {
    return { logoUrl: null, faviconUrl: null, founderPortraitUrl: null };
  }
}
