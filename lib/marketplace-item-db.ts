/** Supabase helpers for marketplace_items (optional package_offers column). */

import { isUuid } from "@/lib/content-slug";
import { assignMarketplaceItemSlug } from "@/lib/content-slug-assign";

export function isMissingDbColumnError(error: unknown, column: string): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { message?: string; code?: string; details?: string; hint?: string };
  const blob = `${e.message ?? ""} ${e.details ?? ""} ${e.hint ?? ""}`.toLowerCase();
  const col = column.toLowerCase();
  return (
    blob.includes(col) ||
    e.code === "42703" ||
    e.code === "PGRST204" ||
    /column.*does not exist/i.test(blob)
  );
}

/**
 * Fetch one marketplace row; retries without package_offers if the column is not migrated yet.
 */
async function fetchPublishedMarketplaceItemByColumn(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  column: "id" | "slug",
  value: string,
  baseSelect: string
): Promise<{ data: Record<string, unknown> | null; error: unknown }> {
  const withOffers = `${baseSelect}, package_offers`;
  const first = await supabase.from("marketplace_items").select(withOffers).eq(column, value).single();
  if (!first.error) {
    return { data: first.data as Record<string, unknown>, error: null };
  }
  if (isMissingDbColumnError(first.error, "package_offers")) {
    const second = await supabase
      .from("marketplace_items")
      .select(baseSelect)
      .eq(column, value)
      .single();
    return {
      data: second.data ? { ...(second.data as Record<string, unknown>), package_offers: null } : null,
      error: second.error,
    };
  }
  if (isMissingDbColumnError(first.error, "slug") && column === "slug") {
    return { data: null, error: first.error };
  }
  const code = (first.error as { code?: string })?.code;
  if (code === "22P02" || code === "PGRST116") {
    return { data: null, error: null };
  }
  return { data: null, error: first.error };
}

export async function fetchPublishedMarketplaceItem(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- loose client typing avoids Postgrest builder depth errors
  supabase: any,
  slugOrId: string,
  baseSelect: string
): Promise<{ data: Record<string, unknown> | null; error: unknown }> {
  const param = slugOrId.trim();
  const column: "id" | "slug" = isUuid(param) ? "id" : "slug";
  let result = await fetchPublishedMarketplaceItemByColumn(supabase, column, param, baseSelect);
  if (!result.data && column === "id") {
    result = await fetchPublishedMarketplaceItemByColumn(supabase, "slug", param, baseSelect);
  }

  const row = result.data;
  if (row && typeof row.id === "string" && typeof row.title === "string") {
    const slug = typeof row.slug === "string" ? row.slug.trim() : "";
    if (!slug) {
      try {
        const assigned = await assignMarketplaceItemSlug(supabase, {
          id: row.id,
          title: row.title,
        });
        return { data: { ...row, slug: assigned }, error: null };
      } catch {
        /* column may not exist yet */
      }
    }
  }

  return result;
}
