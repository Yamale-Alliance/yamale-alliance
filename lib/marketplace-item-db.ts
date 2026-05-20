/** Supabase helpers for marketplace_items (optional package_offers column). */

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
export async function fetchPublishedMarketplaceItem(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- loose client typing avoids Postgrest builder depth errors
  supabase: any,
  id: string,
  baseSelect: string
): Promise<{ data: Record<string, unknown> | null; error: unknown }> {
  const withOffers = `${baseSelect}, package_offers`;
  const first = await supabase.from("marketplace_items").select(withOffers).eq("id", id).single();
  if (!first.error) {
    return { data: first.data as Record<string, unknown>, error: null };
  }
  if (isMissingDbColumnError(first.error, "package_offers")) {
    const second = await supabase.from("marketplace_items").select(baseSelect).eq("id", id).single();
    return {
      data: second.data ? { ...(second.data as Record<string, unknown>), package_offers: null } : null,
      error: second.error,
    };
  }
  return { data: null, error: first.error };
}
