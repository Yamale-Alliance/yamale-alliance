import type { SupabaseClient } from "@supabase/supabase-js";
import { buildContentSlugBase, dedupeSlug, isUuid } from "@/lib/content-slug";
import { lawSlugFromFields } from "@/lib/law-public-url";
import { marketplaceItemSlugFromTitle } from "@/lib/marketplace-public-url";

async function slugTaken(
  supabase: SupabaseClient,
  table: "laws" | "marketplace_items",
  slug: string,
  excludeId?: string
): Promise<boolean> {
  let q = supabase.from(table).select("id").eq("slug", slug).limit(1);
  if (excludeId) q = q.neq("id", excludeId);
  const { data, error } = await q;
  if (error) {
    if (/column.*slug.*does not exist/i.test(String(error.message ?? ""))) return false;
    throw error;
  }
  return (data?.length ?? 0) > 0;
}

async function pickUniqueSlug(
  supabase: SupabaseClient,
  table: "laws" | "marketplace_items",
  base: string,
  id: string
): Promise<string> {
  const used = new Set<string>();
  let candidate = dedupeSlug(base, used, id);
  for (let n = 0; n < 20 && (await slugTaken(supabase, table, candidate, id)); n++) {
    candidate = dedupeSlug(`${base}-${n + 2}`, used, id);
  }
  if (await slugTaken(supabase, table, candidate, id)) {
    candidate = `${base}-${id.replace(/-/g, "").slice(0, 8).toLowerCase()}`;
  }
  return candidate;
}

export async function assignLawSlug(
  supabase: SupabaseClient,
  law: {
    id: string;
    title: string;
    year?: number | null;
    countries?: { name: string } | null;
  }
): Promise<string> {
  const base = lawSlugFromFields(law.title, law.countries?.name ?? null, law.year ?? null);
  const slug = await pickUniqueSlug(supabase, "laws", base, law.id);
  const { error } = await supabase.from("laws").update({ slug }).eq("id", law.id);
  if (error && !/column.*slug/i.test(String(error.message ?? ""))) throw error;
  return slug;
}

export async function assignMarketplaceItemSlug(
  supabase: SupabaseClient,
  item: { id: string; title: string }
): Promise<string> {
  const base = marketplaceItemSlugFromTitle(item.title);
  const slug = await pickUniqueSlug(supabase, "marketplace_items", base, item.id);
  const { error } = await supabase.from("marketplace_items").update({ slug }).eq("id", item.id);
  if (error && !/column.*slug/i.test(String(error.message ?? ""))) throw error;
  return slug;
}

export type LawPublicMeta = {
  id: string;
  slug: string;
  title: string;
  year?: number | null;
  status: string;
  country: string;
  category: string;
};

const LAW_PUBLIC_SELECT =
  "id, slug, title, year, status, country_id, category_id, countries(name), categories!laws_category_id_fkey(name)";

export async function resolveLawPublicMeta(
  supabase: SupabaseClient,
  slugOrId: string
): Promise<LawPublicMeta | null> {
  const param = slugOrId.trim();
  if (!param) return null;

  const fetchRow = async (column: "id" | "slug") => {
    const { data, error } = await supabase
      .from("laws")
      .select(LAW_PUBLIC_SELECT)
      .eq(column, param)
      .maybeSingle();
    if (error) {
      if (/column.*slug/i.test(String(error.message ?? "")) && column === "slug") return null;
      throw error;
    }
    return data as Record<string, unknown> | null;
  };

  let row = isUuid(param) ? await fetchRow("id") : await fetchRow("slug");
  if (!row && isUuid(param) === false) row = await fetchRow("id");

  if (!row?.id || typeof row.title !== "string") return null;

  let slug = typeof row.slug === "string" ? row.slug.trim() : "";
  if (!slug) {
    try {
      slug = await assignLawSlug(supabase, {
        id: String(row.id),
        title: row.title,
        year: row.year as number | null | undefined,
        countries: row.countries as { name: string } | null,
      });
    } catch {
      slug = lawSlugFromFields(
        row.title,
        (row.countries as { name?: string } | null)?.name,
        row.year as number | null | undefined
      );
    }
  }

  return {
    id: String(row.id),
    slug,
    title: row.title,
    year: (row.year as number | null) ?? null,
    status: String(row.status ?? "In force"),
    country: (row.countries as { name?: string } | null)?.name ?? "",
    category: (row.categories as { name?: string } | null)?.name ?? "",
  };
}

export type MarketplacePublicMeta = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
};

export async function resolveMarketplacePublicMeta(
  supabase: SupabaseClient,
  slugOrId: string
): Promise<MarketplacePublicMeta | null> {
  const param = slugOrId.trim();
  if (!param) return null;

  const baseSelect = "id, slug, title, description, published";

  const fetchRow = async (column: "id" | "slug") => {
    const { data, error } = await supabase
      .from("marketplace_items")
      .select(baseSelect)
      .eq(column, param)
      .eq("published", true)
      .maybeSingle();
    if (error) {
      if (/column.*slug/i.test(String(error.message ?? "")) && column === "slug") return null;
      const code = (error as { code?: string }).code;
      if (code === "22P02") return null;
      throw error;
    }
    return data as Record<string, unknown> | null;
  };

  let row = isUuid(param) ? await fetchRow("id") : await fetchRow("slug");
  if (!row && isUuid(param)) row = await fetchRow("slug");
  if (!row?.id || typeof row.title !== "string") return null;

  let slug = typeof row.slug === "string" ? row.slug.trim() : "";
  if (!slug) {
    try {
      slug = await assignMarketplaceItemSlug(supabase, {
        id: String(row.id),
        title: row.title,
      });
    } catch {
      slug = marketplaceItemSlugFromTitle(row.title);
    }
  }

  return {
    id: String(row.id),
    slug,
    title: row.title,
    description: typeof row.description === "string" ? row.description : null,
  };
}
