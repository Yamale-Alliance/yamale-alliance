import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import {
  BUCKET,
  canAccessMarketplaceZip,
  isZipMarketplaceItem,
  loadMarketplaceZipItem,
} from "@/lib/marketplace-zip-access";

const MAX_ZIP_BYTES = 150 * 1024 * 1024;

/**
 * GET: stream the marketplace ZIP bytes through the app (same access rules as download).
 * Lets the browser parse the archive client-side for listing + inline previews without CORS issues.
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
      return NextResponse.json({ error: "Package browsing is only available for ZIP archives" }, { status: 400 });
    }

    const allowed = await canAccessMarketplaceZip(supabase, item);
    if (!allowed) {
      return NextResponse.json({ error: "Purchase this item to browse the package" }, { status: 403 });
    }

    const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(item.file_path);
    if (dlErr || !blob) {
      console.error("zip-archive download:", dlErr);
      return NextResponse.json({ error: "Failed to read file from storage" }, { status: 500 });
    }

    const ab = await blob.arrayBuffer();
    if (ab.byteLength > MAX_ZIP_BYTES) {
      return NextResponse.json(
        { error: `ZIP is larger than ${Math.floor(MAX_ZIP_BYTES / (1024 * 1024))} MB and cannot be previewed here.` },
        { status: 413 }
      );
    }

    const safeName = item.file_name?.replace(/[^\w.\- ()[\]]+/g, "_") || "package.zip";

    return new NextResponse(ab, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `inline; filename="${safeName}"`,
        "Cache-Control": "private, max-age=120",
      },
    });
  } catch (err) {
    console.error("zip-archive error:", err);
    return NextResponse.json({ error: "Failed to load ZIP archive" }, { status: 500 });
  }
}
