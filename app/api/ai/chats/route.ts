import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";

const CHAT_STATE_QUERY_TIMEOUT_MS = 8000;

function isTransientNetworkPersistenceError(err: unknown): boolean {
  const text = String((err as any)?.message ?? "") + "\n" + String((err as any)?.details ?? "");
  const status = Number((err as any)?.status ?? 0);
  const errorCode = Number((err as any)?.error_code ?? 0);
  const cloudflare = Boolean((err as any)?.cloudflare_error);
  if (status === 522 || errorCode === 522 || cloudflare) return true;
  return /connect timeout|und_err_connect_timeout|fetch failed|network|etimedout|econnreset|error 522|connection timed out/i.test(
    text
  );
}

function parseRetryAfterSeconds(err: unknown): number | null {
  const direct = Number((err as any)?.retry_after);
  if (Number.isFinite(direct) && direct > 0) return direct;
  return null;
}

export async function GET(_request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseServer() as any;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CHAT_STATE_QUERY_TIMEOUT_MS);
    const { data, error } = await supabase
      .from("ai_chat_states")
      .select("data")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle()
      .abortSignal(controller.signal);
    clearTimeout(timeout);

    if (error && error.code !== "PGRST116") {
      if (isTransientNetworkPersistenceError(error)) {
        const retryAfter = parseRetryAfterSeconds(error);
        console.warn("AI chats GET transient persistence error:", error);
        return NextResponse.json(
          {
            sessions: [],
            transient: true,
            persisted: false,
            ...(retryAfter ? { retryAfterSeconds: retryAfter } : {}),
          },
          { status: 200 }
        );
      }
      console.error("AI chats GET error:", error);
      return NextResponse.json(
        { error: "Failed to load chats" },
        { status: 500 }
      );
    }

    const sessions = (data?.data as unknown[]) ?? [];
    return NextResponse.json({ sessions });
  } catch (err) {
    if (isTransientNetworkPersistenceError(err)) {
      const retryAfter = parseRetryAfterSeconds(err);
      console.warn("AI chats GET transient unexpected error:", err);
      return NextResponse.json(
        {
          sessions: [],
          transient: true,
          persisted: false,
          ...(retryAfter ? { retryAfterSeconds: retryAfter } : {}),
        },
        { status: 200 }
      );
    }
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CHAT_STATE_QUERY_TIMEOUT_MS);
    const { error } = await supabase.from("ai_chat_states").upsert({
      user_id: userId,
      data: sessions,
      updated_at: new Date().toISOString(),
    }).abortSignal(controller.signal);
    clearTimeout(timeout);

    if (error) {
      if (isTransientNetworkPersistenceError(error)) {
        console.warn("AI chats PUT transient persistence error:", error);
        // Do not block user flow when persistence backend has a transient timeout.
        return NextResponse.json({ ok: true, persisted: false, transient: true }, { status: 202 });
      }
      console.error("AI chats PUT error:", error);
      return NextResponse.json({ error: "Failed to save chats" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isTransientNetworkPersistenceError(err)) {
      console.warn("AI chats PUT transient unexpected error:", err);
      return NextResponse.json({ ok: true, persisted: false, transient: true }, { status: 202 });
    }
    console.error("AI chats PUT unexpected error:", err);
    return NextResponse.json(
      { error: "Failed to save chats" },
      { status: 500 }
    );
  }
}

