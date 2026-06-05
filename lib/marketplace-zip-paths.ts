import JSZip from "jszip";
import { getSupabaseServer } from "@/lib/supabase/server";

const BUCKET = "marketplace-files";
const MAX_ZIP_BYTES = 150 * 1024 * 1024;

/** Non-directory file paths inside a marketplace ZIP (sorted). */
export async function listMarketplaceZipFilePaths(filePath: string): Promise<string[]> {
  const supabase = getSupabaseServer();
  const { data: blob, error } = await supabase.storage.from(BUCKET).download(filePath);
  if (error || !blob) return [];

  const buf = Buffer.from(await blob.arrayBuffer());
  if (buf.byteLength > MAX_ZIP_BYTES) return [];

  const zip = await JSZip.loadAsync(buf);
  const paths: string[] = [];
  zip.forEach((relativePath, entry) => {
    if (entry.dir) return;
    const path = relativePath.replace(/^\/+/, "");
    if (!path || path.startsWith("__MACOSX") || path.includes("/.")) return;
    paths.push(path);
  });
  paths.sort((a, b) => a.localeCompare(b));
  return paths;
}
