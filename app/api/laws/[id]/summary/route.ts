import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getEffectiveTierForUser } from "@/lib/team";

/** GET: fetch law summary (Team plan only) */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Invalid law id" }, { status: 400 });
    }

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    // Check if user has Team plan
    const tier = await getEffectiveTierForUser(userId);
    if (tier !== "team") {
      return NextResponse.json(
        { error: "Law summaries are available for Team plan only" },
        { status: 403 }
      );
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("law_summaries")
      .select("id, summary_text, generated_at, updated_at")
      .eq("law_id", id)
      .maybeSingle();

    if (error) {
      console.error("Law summary GET error:", error);
      return NextResponse.json({ error: "Failed to fetch summary" }, { status: 500 });
    }

    if (!data) {
      // Generate summary if it doesn't exist
      // For now, return null - we can add AI generation later
      return NextResponse.json({ summary: null });
    }

    return NextResponse.json({ summary: data });
  } catch (err) {
    console.error("Law summary GET error:", err);
    return NextResponse.json({ error: "Failed to fetch summary" }, { status: 500 });
  }
}

/** POST: generate/update law summary (Team plan only, admin or system) */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Invalid law id" }, { status: 400 });
    }

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    // Check if user has Team plan
    const tier = await getEffectiveTierForUser(userId);
    if (tier !== "team") {
      return NextResponse.json(
        { error: "Law summaries are available for Team plan only" },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const summaryText = body.summary_text as string | undefined;
    if (!summaryText || typeof summaryText !== "string") {
      return NextResponse.json({ error: "summary_text is required" }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data, error } = await (supabase.from("law_summaries") as any).upsert(
      {
        law_id: id,
        summary_text: summaryText,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "law_id" }
    );

    if (error) {
      console.error("Law summary POST error:", error);
      return NextResponse.json({ error: "Failed to save summary" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, summary: data });
  } catch (err) {
    console.error("Law summary POST error:", err);
    return NextResponse.json({ error: "Failed to save summary" }, { status: 500 });
  }
}
