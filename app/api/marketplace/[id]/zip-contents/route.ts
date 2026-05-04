import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import JSZip from "jszip";

const BUCKET = "marketplace-files";
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
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data, error: itemErr } = await supabase
      .from("marketplace_items")
      .select("id, file_path, file_name, file_format, published, price_cents")
      .eq("id", id)
      .single();

    if (itemErr || !data) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const item = data as {
      id: string;
      file_path: string | null;
      file_name: string | null;
      file_format: string | null;
      published: boolean;
      price_cents: number | null;
    };

    if (!item.published) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    if (!item.file_path?.trim()) {
      return NextResponse.json({ error: "No file available" }, { status: 404 });
    }

    const fmt = item.file_format?.toLowerCase() ?? "";
    const nameLower = item.file_name?.toLowerCase() ?? "";
    const isZip = fmt === "zip" || nameLower.endsWith(".zip");
    if (!isZip) {
      return NextResponse.json({ error: "Preview is only available for ZIP packages" }, { status: 400 });
    }

    const isFree = !item.price_cents || item.price_cents <= 0;
    if (!isFree) {
      const { userId } = await auth();
      if (!userId) {
        return NextResponse.json({ error: "Sign in to access" }, { status: 401 });
      }
      const { data: purchase } = await supabase
        .from("marketplace_purchases")
        .select("id")
        .eq("user_id", userId)
        .eq("marketplace_item_id", id)
        .maybeSingle();
      if (!purchase) {
        return NextResponse.json({ error: "Purchase this item to preview" }, { status: 403 });
      }
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
