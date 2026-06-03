import { getSupabaseServer } from "@/lib/supabase/server";
import { resolveMarketplacePublicMeta } from "@/lib/content-slug-assign";

/** Public marketplace row for SEO metadata and canonical redirects. */
export async function resolveMarketplaceForPublicPage(slugOrId: string) {
  const supabase = getSupabaseServer();
  return resolveMarketplacePublicMeta(supabase, slugOrId);
}
