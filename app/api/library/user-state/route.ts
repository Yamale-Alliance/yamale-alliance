import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDocumentExportUnlockLawIdsForUser } from "@/lib/library-document-export-unlocks";
import { getSupabaseServer } from "@/lib/supabase/server";

/** Signed-in library UI state in one round trip (bookmarks + paid export unlocks). */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ bookmarks: [], law_ids: [] });
    }

    const supabase = getSupabaseServer();
    const [bookmarksRes, lawIds] = await Promise.all([
      supabase
        .from("law_bookmarks")
        .select("law_id, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      getDocumentExportUnlockLawIdsForUser(userId),
    ]);

    if (bookmarksRes.error) {
      console.error("Library user-state bookmarks error:", bookmarksRes.error);
      return NextResponse.json({ error: "Failed to load library state" }, { status: 500 });
    }

    return NextResponse.json(
      {
        bookmarks: bookmarksRes.data ?? [],
        law_ids: lawIds,
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (err) {
    console.error("Library user-state error:", err);
    return NextResponse.json({ error: "Failed to load library state" }, { status: 500 });
  }
}
