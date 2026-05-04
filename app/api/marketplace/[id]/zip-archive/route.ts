import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";

const BUCKET = "marketplace-files";
/** Same limit as zip-contents — full archive is buffered for client-side browsing. */
const MAX_ZIP_BYTES = 150 * 1024 * 1024;

/**
 * GET: stream the marketplace ZIP bytes through the app (same access rules as download).
 * Lets the browser parse the archive client-side for listing + inline previews without CORS issues.
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
      return NextResponse.json({ error: "Package browsing is only available for ZIP archives" }, { status: 400 });
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
        return NextResponse.json({ error: "Purchase this item to browse the package" }, { status: 403 });
      }
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
