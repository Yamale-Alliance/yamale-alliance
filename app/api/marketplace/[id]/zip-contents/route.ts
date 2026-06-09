import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import JSZip from "jszip";
import {
  BUCKET,
  canAccessMarketplaceZip,
  isZipMarketplaceItem,
  loadMarketplaceZipItem,
} from "@/lib/marketplace-zip-access";
/** Avoid loading huge archives into server memory for listing. */
const MAX_ZIP_BYTES = 150 * 1024 * 1024;
const MAX_ENTRIES = 2500;

type ZipRow = {
  path: string;
  dir: boolean;
  size: number | null;
  date: string | null;
};

/**
 * GET: list paths inside the marketplace ZIP (same access rules as download).
 * Used for an attachment-style preview without downloading the whole file to the user device.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const language = request.nextUrl.searchParams.get("lang");
    const supabase = getSupabaseServer();
    const item = await loadMarketplaceZipItem(supabase, id, language);
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    if (!isZipMarketplaceItem(item)) {
      return NextResponse.json({ error: "Preview is only available for ZIP packages" }, { status: 400 });
    }

    const allowed = await canAccessMarketplaceZip(supabase, item);
    if (!allowed) {
      return NextResponse.json({ error: "Purchase this item to preview" }, { status: 403 });
    }

    const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(item.file_path);
    if (dlErr || !blob) {
      console.error("zip-contents download:", dlErr);
      return NextResponse.json({ error: "Failed to read file from storage" }, { status: 500 });
    }

    const ab = await blob.arrayBuffer();
    if (ab.byteLength > MAX_ZIP_BYTES) {
      return NextResponse.json(
        { error: `ZIP is larger than ${Math.floor(MAX_ZIP_BYTES / (1024 * 1024))} MB and cannot be previewed here.` },
        { status: 413 }
      );
    }

    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(ab);
    } catch {
      return NextResponse.json({ error: "Could not read ZIP structure" }, { status: 400 });
    }

    const rows: ZipRow[] = [];
    zip.forEach((relativePath, file) => {
      if (relativePath.startsWith("__MACOSX/")) return;
      if (relativePath === ".DS_Store" || relativePath.endsWith("/.DS_Store")) return;

      const path = relativePath.replace(/\/$/, "");
      if (!path) return;

      const isDir = file.dir || relativePath.endsWith("/");
      const dataBlock = file as unknown as { _data?: { uncompressedSize?: number } };
      const size =
        isDir ? null : typeof dataBlock._data?.uncompressedSize === "number" ? dataBlock._data.uncompressedSize : null;

      let dateStr: string | null = null;
      try {
        if (file.date && file.date instanceof Date && !Number.isNaN(file.date.getTime())) {
          dateStr = file.date.toISOString();
        }
      } catch {
        dateStr = null;
      }

      rows.push({ path, dir: isDir, size, date: dateStr });
    });

    rows.sort((a, b) => a.path.localeCompare(b.path, undefined, { sensitivity: "base", numeric: true }));

    const truncated = rows.length > MAX_ENTRIES;
    const slice = truncated ? rows.slice(0, MAX_ENTRIES) : rows;

    return NextResponse.json({
      file_name: item.file_name,
      total_entries: rows.length,
      truncated,
      entries: slice,
    });
  } catch (err) {
    console.error("zip-contents error:", err);
    return NextResponse.json({ error: "Failed to list ZIP contents" }, { status: 500 });
  }
}
