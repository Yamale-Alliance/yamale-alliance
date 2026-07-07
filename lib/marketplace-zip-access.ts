import { auth } from "@clerk/nextjs/server";
import { isAdvisoryWorkspacePreviewEnabled } from "@/lib/law-firm-advisory-preview";
import { marketplaceCourseAccessGranted } from "@/lib/marketplace-course-access";
import { fetchPublishedMarketplaceItem } from "@/lib/marketplace-item-db";
import { resolveMarketplaceItemFileForAccess } from "@/lib/marketplace-item-files";
import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "marketplace-files";

export type MarketplaceZipItem = {
  id: string;
  file_path: string;
  file_name: string | null;
  file_format: string | null;
  published: boolean;
  price_cents: number | null;
  is_course?: boolean;
};

export async function loadMarketplaceZipItem(
  supabase: SupabaseClient,
  slugOrId: string,
  languageCode?: string | null
): Promise<MarketplaceZipItem | null> {
  const { data, error } = await fetchPublishedMarketplaceItem(
    supabase,
    slugOrId,
    "id, file_path, file_name, file_format, published, price_cents, is_course"
  );

  if (error || !data) return null;
  const row = data as MarketplaceZipItem & { file_path: string | null };
  if (!row.published) return null;

  const itemId = String(row.id);
  const resolved = await resolveMarketplaceItemFileForAccess(supabase, itemId, languageCode, {
    file_path: row.file_path,
    file_name: row.file_name,
    file_format: row.file_format,
  });
  if (!resolved?.file_path?.trim()) return null;

  return {
    ...row,
    file_path: resolved.file_path,
    file_name: resolved.file_name,
    file_format: resolved.file_format,
  };
}

export function isZipMarketplaceItem(item: {
  file_format: string | null;
  file_name: string | null;
}): boolean {
  const fmt = item.file_format?.toLowerCase() ?? "";
  const name = item.file_name?.toLowerCase() ?? "";
  return fmt === "zip" || name.endsWith(".zip");
}

/** Purchasers, free items, or advisory preview on course packages may browse the ZIP. */
export async function canAccessMarketplaceZip(
  supabase: SupabaseClient,
  item: MarketplaceZipItem
): Promise<boolean> {
  const isFree = !item.price_cents || item.price_cents <= 0;
  if (isFree) return true;

  const authState = await auth();
  const { userId } = authState;
  if (!userId) return false;

  const { data: purchase } = await supabase
    .from("marketplace_purchases")
    .select("id")
    .eq("user_id", userId)
    .eq("marketplace_item_id", item.id)
    .maybeSingle();

  if (purchase) return true;

  if (
    await marketplaceCourseAccessGranted(authState, {
      purchased: false,
      isCourse: Boolean(item.is_course),
    })
  ) {
    return true;
  }

  if (item.is_course && isAdvisoryWorkspacePreviewEnabled()) return true;

  return false;
}

export { BUCKET };
