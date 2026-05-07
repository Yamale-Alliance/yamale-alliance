import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * POST thumbs up/down on an AI Research answer (audit 6.6 / 7.4).
 * Body:
 * {
 *   queryLogId?: string | null,
 *   relatedMessageId?: string | null,
 *   rating: 1 | -1,
 *   comment?: string,
 *   issueCategory?: string,
 *   conversationSnapshot?: Array<{ id?: string; role: string; content: string }>
 * }
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
    const relatedMessageId = body.relatedMessageId as string | null | undefined;
    const issueCategory =
      typeof body.issueCategory === "string" && body.issueCategory.trim()
        ? body.issueCategory.trim().slice(0, 120)
        : null;
    const comment = typeof body.comment === "string" ? body.comment.slice(0, 4000) : null;
    const conversationSnapshotRaw = Array.isArray(body.conversationSnapshot)
      ? (body.conversationSnapshot as Array<{ id?: string; role?: string; content?: string }>)
      : [];
    const conversationSnapshot = conversationSnapshotRaw
      .map((m) => ({
        id: typeof m.id === "string" ? m.id.slice(0, 120) : undefined,
        role: typeof m.role === "string" ? m.role.slice(0, 20) : "unknown",
        content: typeof m.content === "string" ? m.content.slice(0, 12000) : "",
      }))
      .filter((m) => m.content.length > 0)
      .slice(-80);

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

    // Negative feedback is escalated into admin triage queue with full conversation context.
    if (rating === -1) {
      try {
        const user = await currentUser();
        const fallbackName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
        const displayName = user?.fullName ?? (fallbackName || user?.username || null);
        const email = user?.emailAddresses?.[0]?.emailAddress ?? null;
        await (supabase.from("ai_bug_reports") as any).insert({
          user_id: userId,
          user_name: displayName,
          user_email: email,
          query_log_id: queryLogId ?? null,
          related_message_id: relatedMessageId ?? null,
          issue_category: issueCategory,
          issue_details: comment,
          conversation_snapshot: conversationSnapshot,
          status: "open",
          updated_at: new Date().toISOString(),
        });
      } catch (bugErr) {
        console.error("ai_bug_reports insert:", bugErr);
      }
    }

    return NextResponse.json({ ok: true, id: (data as { id: string })?.id });
  } catch (e) {
    console.error("feedback route:", e);
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
