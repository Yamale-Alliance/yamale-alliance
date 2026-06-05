import JSZip from "jszip";
import { getSupabaseServer } from "@/lib/supabase/server";
import { moduleKeyFromZipPath, titleFromZipPath } from "@/lib/marketplace-course";
import { parseZipPathsToPhases } from "@/lib/marketplace-course-zip-structure";

const BUCKET = "marketplace-files";
const MAX_ZIP_BYTES = 150 * 1024 * 1024;
const MAX_FILES = 500;

type CourseModuleRow = {
  marketplace_item_id: string;
  module_key: string;
  parent_key: string | null;
  sort_order: number;
  title: string;
  description: string | null;
  kind: string;
  source_path: string;
};

/** Import ZIP file entries as course modules (phase folder → parent_key, files → modules). */
export async function syncCourseModulesFromZip(itemId: string): Promise<{ count: number; phaseCount: number }> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("marketplace_items")
    .select("id, file_path, file_name, file_format, is_course")
    .eq("id", itemId)
    .single();

  if (error || !data) throw new Error("Item not found");
  const item = data as {
    id: string;
    file_path: string | null;
    file_name: string | null;
    file_format: string | null;
    is_course: boolean;
  };

  if (!item.is_course) throw new Error("Item is not marked as a course");
  if (!item.file_path?.trim()) throw new Error("Upload a package ZIP before syncing modules");

  const fmt = item.file_format?.toLowerCase() ?? "";
  const name = item.file_name?.toLowerCase() ?? "";
  if (fmt !== "zip" && !name.endsWith(".zip")) {
    throw new Error("Course sync requires a ZIP package file");
  }

  const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(item.file_path);
  if (dlErr || !blob) throw new Error("Could not download package file");

  const buf = Buffer.from(await blob.arrayBuffer());
  if (buf.byteLength > MAX_ZIP_BYTES) throw new Error("ZIP file is too large to sync");

  const zip = await JSZip.loadAsync(buf);
  const paths: string[] = [];
  zip.forEach((relativePath, entry) => {
    if (entry.dir) return;
    const path = relativePath.replace(/^\/+/, "");
    if (!path || path.startsWith("__MACOSX") || path.includes("/.")) return;
    paths.push(path);
  });

  paths.sort((a, b) => a.localeCompare(b));
  const slice = paths.slice(0, MAX_FILES);
  const zipPhases = parseZipPathsToPhases(slice);

  if (zipPhases.length === 0) {
    throw new Error(
      "No phase folders found. Use top-level folders like “Phase 1 - …” with document files inside each folder."
    );
  }

  const rows: CourseModuleRow[] = [];
  let sortOrder = 0;
  for (const phase of zipPhases) {
    for (const file of phase.files) {
      rows.push({
        marketplace_item_id: itemId,
        module_key: moduleKeyFromZipPath(file.sourcePath),
        parent_key: phase.slug,
        sort_order: sortOrder++,
        title: titleFromZipPath(file.sourcePath),
        description: phase.folderName,
        kind: "template",
        source_path: file.sourcePath,
      });
    }
  }

  await (supabase.from("marketplace_course_modules") as { delete: Function })
    .delete()
    .eq("marketplace_item_id", itemId);

  if (rows.length > 0) {
    const { error: insErr } = await (supabase.from("marketplace_course_modules") as { insert: Function }).insert(
      rows
    );
    if (insErr) throw insErr;
  }

  return { count: rows.length, phaseCount: zipPhases.length };
}
