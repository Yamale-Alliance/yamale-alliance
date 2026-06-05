import { getSupabaseServer } from "@/lib/supabase/server";
import type { AdvisoryPhase } from "@/lib/law-firm-development/types";
import {
  buildAdvisoryPhasesFromZipPaths,
  parseZipPathsToPhases,
  zipPhasesToAdvisoryPhases,
} from "@/lib/marketplace-course-zip-structure";
import { listMarketplaceZipFilePaths } from "@/lib/marketplace-zip-paths";

type CourseItemRow = {
  id: string;
  slug: string | null;
  title: string;
  file_format: string | null;
  file_name: string | null;
  is_course: boolean;
  file_path?: string | null;
};

type ModuleRow = {
  module_key: string;
  parent_key: string | null;
  sort_order: number;
  title: string;
  description: string | null;
  kind: string;
  source_path: string | null;
};

function countDocuments(phases: AdvisoryPhase[]): number {
  return phases.reduce((n, p) => n + p.categories.reduce((c, cat) => c + cat.documents.length, 0), 0);
}

/** Resolve a published course item by UUID or slug. */
export async function resolveMarketplaceCourseItem(
  courseKey: string
): Promise<CourseItemRow | null> {
  const key = courseKey.trim();
  if (!key) return null;

  const supabase = getSupabaseServer();
  const { data: byId } = await supabase
    .from("marketplace_items")
    .select("id, slug, title, file_format, file_name, is_course, published")
    .eq("id", key)
    .maybeSingle();

  if (byId) {
    const row = byId as CourseItemRow & { published: boolean };
    if (row.published && row.is_course) return row;
  }

  const { data: bySlug } = await supabase
    .from("marketplace_items")
    .select("id, slug, title, file_format, file_name, is_course, published")
    .eq("slug", key)
    .maybeSingle();

  if (bySlug) {
    const row = bySlug as CourseItemRow & { published: boolean };
    if (row.published && row.is_course) return row;
  }

  return null;
}

function phasesFromModuleRows(itemId: string, rows: ModuleRow[]): AdvisoryPhase[] {
  const paths = rows
    .map((r) => r.source_path?.trim())
    .filter((p): p is string => Boolean(p));
  if (paths.length > 0) {
    return buildAdvisoryPhasesFromZipPaths(itemId, paths);
  }

  const pathsFromKeys = rows.map((r) => r.module_key);
  return buildAdvisoryPhasesFromZipPaths(itemId, pathsFromKeys);
}

async function phasesFromPackageZip(
  itemId: string,
  filePath: string | null
): Promise<AdvisoryPhase[] | null> {
  if (!filePath?.trim()) return null;
  const paths = await listMarketplaceZipFilePaths(filePath);
  if (paths.length === 0) return null;
  const zipPhases = parseZipPathsToPhases(paths);
  if (zipPhases.length === 0) return null;
  return zipPhasesToAdvisoryPhases(itemId, zipPhases);
}

/** Programme structure from package ZIP folders (phases) and files (modules). */
export async function loadAdvisoryCourseCatalog(itemId: string): Promise<{
  item: CourseItemRow;
  phases: AdvisoryPhase[];
  totalDocuments: number;
}> {
  const supabase = getSupabaseServer();
  const { data: itemRaw, error: itemErr } = await supabase
    .from("marketplace_items")
    .select("id, slug, title, file_format, file_name, file_path, is_course, published")
    .eq("id", itemId)
    .single();

  if (itemErr || !itemRaw) throw new Error("Course not found");
  const item = itemRaw as CourseItemRow & { published: boolean };
  if (!item.published || !item.is_course) throw new Error("Not a published course");

  const filePath = item.file_path ?? null;

  const fromZip = await phasesFromPackageZip(item.id, filePath);
  if (fromZip && fromZip.length > 0) {
    return { item, phases: fromZip, totalDocuments: countDocuments(fromZip) };
  }

  const { data: moduleRows, error: modErr } = await supabase
    .from("marketplace_course_modules")
    .select("module_key, parent_key, sort_order, title, description, kind, source_path")
    .eq("marketplace_item_id", itemId)
    .order("sort_order", { ascending: true });

  if (modErr) throw modErr;

  const rows = (moduleRows ?? []) as ModuleRow[];
  if (rows.length > 0) {
    const phases = phasesFromModuleRows(item.id, rows);
    return { item, phases, totalDocuments: countDocuments(phases) };
  }

  return {
    item,
    phases: [
      {
        id: "phase-1",
        slug: "phase-1",
        number: 1,
        title: item.title,
        subtitle: "Awaiting package",
        description:
          "Upload a ZIP with top-level phase folders (e.g. “Phase 1 - …”) and files inside each folder, then sync in admin.",
        categories: [],
      },
    ],
    totalDocuments: 0,
  };
}
