import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";

/** GET: fetch user's bookmarked laws */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ bookmarks: [] });
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("law_bookmarks")
      .select("law_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Bookmarks GET error:", error);
      return NextResponse.json({ error: "Failed to fetch bookmarks" }, { status: 500 });
    }

    return NextResponse.json({ bookmarks: data ?? [] });
  } catch (err) {
    console.error("Bookmarks GET error:", err);
    return NextResponse.json({ error: "Failed to fetch bookmarks" }, { status: 500 });
  }
}

/** POST: add a bookmark */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const lawId = body.law_id as string | undefined;
    if (!lawId || typeof lawId !== "string") {
      return NextResponse.json({ error: "law_id is required" }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { error } = await (supabase.from("law_bookmarks") as any).upsert(
      {
        user_id: userId,
        law_id: lawId,
      },
      { onConflict: "user_id,law_id" }
    );

    if (error) {
      console.error("Bookmarks POST error:", error);
      return NextResponse.json({ error: "Failed to add bookmark" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Bookmarks POST error:", err);
    return NextResponse.json({ error: "Failed to add bookmark" }, { status: 500 });
  }
}

/** DELETE: remove a bookmark */
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const lawId = searchParams.get("law_id");
    if (!lawId) {
      return NextResponse.json({ error: "law_id is required" }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { error } = await supabase
      .from("law_bookmarks")
      .delete()
      .eq("user_id", userId)
      .eq("law_id", lawId);

    if (error) {
      console.error("Bookmarks DELETE error:", error);
      return NextResponse.json({ error: "Failed to remove bookmark" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Bookmarks DELETE error:", err);
    return NextResponse.json({ error: "Failed to remove bookmark" }, { status: 500 });
  }
}
