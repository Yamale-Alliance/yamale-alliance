import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function GET(_request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseServer() as any;
    const { data, error } = await supabase
      .from("ai_chat_states")
      .select("data")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.error("AI chats GET error:", error);
      return NextResponse.json(
        { error: "Failed to load chats" },
        { status: 500 }
      );
    }

    const sessions = (data?.data as unknown[]) ?? [];
    return NextResponse.json({ sessions });
  } catch (err) {
    console.error("AI chats GET unexpected error:", err);
    return NextResponse.json(
      { error: "Failed to load chats" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const sessions = body?.sessions;

    if (!Array.isArray(sessions)) {
      return NextResponse.json(
        { error: "Invalid payload: sessions must be an array" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer() as any;
    const { error } = await supabase.from("ai_chat_states").upsert({
      user_id: userId,
      data: sessions,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error("AI chats PUT error:", error);
      return NextResponse.json(
        { error: "Failed to save chats" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("AI chats PUT unexpected error:", err);
    return NextResponse.json(
      { error: "Failed to save chats" },
      { status: 500 }
    );
  }
}

