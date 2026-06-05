import { auth } from "@clerk/nextjs/server";
import { isAdvisoryWorkspacePreviewEnabled } from "@/lib/law-firm-advisory-preview";
import { resolveMarketplaceCourseItem } from "@/lib/advisory-course-catalog";
import { getSupabaseServer } from "@/lib/supabase/server";

export type AdvisoryAccessResult = {
  signedIn: boolean;
  hasPackage: boolean;
  marketplaceItemId: string | null;
  marketplaceSlug: string | null;
  courseTitle: string | null;
};

async function userOwnsCourse(userId: string, itemId: string): Promise<boolean> {
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from("marketplace_purchases")
    .select("id")
    .eq("user_id", userId)
    .eq("marketplace_item_id", itemId)
    .maybeSingle();
  return Boolean(data);
}

async function firstPublishedCourseItem(): Promise<{
  id: string;
  slug: string | null;
  title: string;
} | null> {
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from("marketplace_items")
    .select("id, slug, title")
    .eq("published", true)
    .eq("is_course", true)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as { id: string; slug: string | null; title: string } | null) ?? null;
}

/** Access to the implementation workspace for a specific course (or default course). */
export async function getAdvisoryWorkspaceAccess(
  courseKey?: string | null
): Promise<AdvisoryAccessResult> {
  const { userId } = await auth();
  if (!userId) {
    return {
      signedIn: false,
      hasPackage: false,
      marketplaceItemId: null,
      marketplaceSlug: null,
      courseTitle: null,
    };
  }

  const key = courseKey?.trim() || null;
  let course: { id: string; slug: string | null; title: string } | null = key
    ? await resolveMarketplaceCourseItem(key)
    : null;

  if (isAdvisoryWorkspacePreviewEnabled()) {
    if (!course) course = await firstPublishedCourseItem();
    return {
      signedIn: true,
      hasPackage: Boolean(course),
      marketplaceItemId: course?.id ?? null,
      marketplaceSlug: course?.slug ?? null,
      courseTitle: course?.title ?? null,
    };
  }

  if (course) {
    const owned = await userOwnsCourse(userId, course.id);
    return {
      signedIn: true,
      hasPackage: owned,
      marketplaceItemId: course.id,
      marketplaceSlug: course.slug,
      courseTitle: course.title,
    };
  }

  const supabase = getSupabaseServer();
  const { data: purchases } = await supabase
    .from("marketplace_purchases")
    .select("marketplace_item_id")
    .eq("user_id", userId);

  const purchaseIds = (purchases ?? []).map((p) => (p as { marketplace_item_id: string }).marketplace_item_id);
  if (purchaseIds.length === 0) {
    return {
      signedIn: true,
      hasPackage: false,
      marketplaceItemId: null,
      marketplaceSlug: null,
      courseTitle: null,
    };
  }

  const { data: ownedCourses } = await supabase
    .from("marketplace_items")
    .select("id, slug, title")
    .eq("published", true)
    .eq("is_course", true)
    .in("id", purchaseIds)
    .order("sort_order", { ascending: true })
    .limit(1);

  const first = (ownedCourses ?? [])[0] as { id: string; slug: string | null; title: string } | undefined;
  return {
    signedIn: true,
    hasPackage: Boolean(first),
    marketplaceItemId: first?.id ?? null,
    marketplaceSlug: first?.slug ?? null,
    courseTitle: first?.title ?? null,
  };
}
