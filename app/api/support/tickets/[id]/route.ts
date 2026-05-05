import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupportDataClient } from "@/lib/support-supabase";
import { processSupportTicketArchival, userMayReopenTicket } from "@/lib/support-tickets";
import { isSupportCenterLive, supportApiDisabledResponse } from "@/lib/support-center-enabled";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isSupportCenterLive()) return supportApiDisabledResponse();
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }
    const { id } = await context.params;
    const supabase = getSupportDataClient();
    await processSupportTicketArchival();

    const { data: ticket, error: tErr } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("id", id)
      .eq("clerk_user_id", userId)
      .maybeSingle();

    if (tErr) throw tErr;
    if (!ticket) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { data: messages, error: mErr } = await supabase
      .from("support_ticket_messages")
      .select("id, author_role, body, created_at, clerk_user_id")
      .eq("ticket_id", id)
      .order("created_at", { ascending: true });

    if (mErr) throw mErr;

    const canReopen = userMayReopenTicket(ticket.status as string, ticket.reopen_until as string | null);

    return NextResponse.json({
      ticket,
      messages: messages ?? [],
      canReopen,
    });
  } catch (e) {
    console.error("support ticket GET:", e);
    return NextResponse.json({ error: "Failed to load ticket" }, { status: 500 });
  }
}
