import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getSupportDataClient } from "@/lib/support-supabase";
import { processSupportTicketArchival } from "@/lib/support-tickets";
import { isSupportCenterLive, supportApiDisabledResponse } from "@/lib/support-center-enabled";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isSupportCenterLive()) return supportApiDisabledResponse();
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    const { id } = await context.params;
    const supabase = getSupportDataClient();
    await processSupportTicketArchival();

    const { data: ticket, error: tErr } = await supabase.from("support_tickets").select("*").eq("id", id).maybeSingle();
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

    return NextResponse.json({ ticket, messages: messages ?? [] });
  } catch (e) {
    console.error("admin support ticket GET:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
