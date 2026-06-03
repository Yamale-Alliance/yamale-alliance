import { getSupabaseServer } from "@/lib/supabase/server";
import { lawPublicPath } from "@/lib/law-public-url";
import { marketplaceItemPublicPath } from "@/lib/marketplace-public-url";
import {
  excludeInternalCategoryFromLawsQuery,
  resolveInternalLibraryCategoryId,
} from "@/lib/internal-library-categories";

const SITEMAP_CONTENT_LIMIT = 5000;
const PAGE_SIZE = 1000;

/** Public law detail URLs for sitemap.xml (slug required). */
export async function fetchSitemapLawPaths(): Promise<string[]> {
  const supabase = getSupabaseServer();
  const paths: string[] = [];
  let offset = 0;

  while (paths.length < SITEMAP_CONTENT_LIMIT) {
    const internalId = await resolveInternalLibraryCategoryId(supabase);
    let q = supabase
      .from("laws")
      .select("slug")
      .not("slug", "is", null)
      .neq("slug", "")
      .order("updated_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    q = excludeInternalCategoryFromLawsQuery(q, internalId);

    const { data, error } = await q;
    if (error) {
      if (/column.*slug/i.test(String(error.message ?? ""))) return paths;
      throw error;
    }
    const rows = (data ?? []) as Array<{ slug: string | null }>;
    for (const row of rows) {
      const slug = row.slug?.trim();
      if (slug) paths.push(lawPublicPath(slug));
    }
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return paths.slice(0, SITEMAP_CONTENT_LIMIT);
}

/** Published Vault item URLs for sitemap.xml. */
export async function fetchSitemapMarketplacePaths(): Promise<string[]> {
  const supabase = getSupabaseServer();
  const paths: string[] = [];
  let offset = 0;

  while (paths.length < SITEMAP_CONTENT_LIMIT) {
    const { data, error } = await supabase
      .from("marketplace_items")
      .select("slug")
      .eq("published", true)
      .not("slug", "is", null)
      .neq("slug", "")
      .order("updated_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      if (/column.*slug/i.test(String(error.message ?? ""))) return paths;
      throw error;
    }
    const rows = (data ?? []) as Array<{ slug: string | null }>;
    for (const row of rows) {
      const slug = row.slug?.trim();
      if (slug) paths.push(marketplaceItemPublicPath(slug));
    }
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return paths.slice(0, SITEMAP_CONTENT_LIMIT);
}
