import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * POST thumbs up/down on an AI Research answer (audit 6.6 / 7.4).
 * Body: { queryLogId?: string | null, rating: 1 | -1, comment?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const rating = body.rating as number | undefined;
    const queryLogId = body.queryLogId as string | null | undefined;
    const comment = typeof body.comment === "string" ? body.comment.slice(0, 4000) : null;

    if (rating !== 1 && rating !== -1) {
      return NextResponse.json({ error: "rating must be 1 or -1" }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data, error } = await (supabase.from("ai_response_feedback") as any)
      .insert({
        user_id: userId,
        query_log_id: queryLogId ?? null,
        rating,
        comment,
      })
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("ai_response_feedback insert:", error);
      return NextResponse.json({ error: "Failed to save feedback" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: (data as { id: string })?.id });
  } catch (e) {
    console.error("feedback route:", e);
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
