import { getSupabaseServer } from "@/lib/supabase/server";
import {
  isInternalLibraryForUserDisplay,
  resolveInternalLibraryCategoryId,
} from "@/lib/internal-library-categories";
import { resolveLawPublicMeta, type LawPublicMeta } from "@/lib/content-slug-assign";

/** Public law row for SEO metadata and canonical redirects (no document body). */
export async function resolveLawForPublicPage(slugOrId: string): Promise<LawPublicMeta | null> {
  const supabase = getSupabaseServer();
  const meta = await resolveLawPublicMeta(supabase, slugOrId);
  if (!meta) return null;

  const internalCategoryId = await resolveInternalLibraryCategoryId(supabase);
  const { data } = await supabase
    .from("laws")
    .select("id, title, category_id, categories!laws_category_id_fkey(name)")
    .eq("id", meta.id)
    .maybeSingle();

  if (
    data &&
    isInternalLibraryForUserDisplay(
      data as { title?: string; category_id?: string; categories?: { name?: string } }
    )
  ) {
    return null;
  }
  if (
    data &&
    internalCategoryId &&
    (data as { category_id?: string }).category_id === internalCategoryId
  ) {
    return null;
  }

  return meta;
}
