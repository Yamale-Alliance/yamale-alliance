import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupportDataClient } from "@/lib/support-supabase";
import { userMayReopenTicket } from "@/lib/support-tickets";
import { isSupportCenterLive, supportApiDisabledResponse } from "@/lib/support-center-enabled";

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isSupportCenterLive()) return supportApiDisabledResponse();
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }
    const { id } = await context.params;
    const supabase = getSupportDataClient();

    const { data: ticket, error: tErr } = await supabase
      .from("support_tickets")
      .select("id, clerk_user_id, status, reopen_until")
      .eq("id", id)
      .maybeSingle();

    if (tErr || !ticket) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const row = ticket as {
      clerk_user_id: string;
      status: string;
      reopen_until: string | null;
    };
    if (row.clerk_user_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!userMayReopenTicket(row.status, row.reopen_until)) {
      return NextResponse.json(
        { error: "You can only reopen within 24 hours after the ticket was resolved." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    await supabase
      .from("support_tickets")
      .update({
        status: "open",
        resolved_at: null,
        closed_at: null,
        reopen_until: null,
        updated_at: now,
        last_activity_at: now,
      })
      .eq("id", id);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("support reopen:", e);
    return NextResponse.json({ error: "Could not reopen" }, { status: 500 });
  }
}
