import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupportDataClient } from "@/lib/support-supabase";
import { notifyAdminUserReply } from "@/lib/support-email";
import { isSupportCenterLive, supportApiDisabledResponse } from "@/lib/support-center-enabled";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isSupportCenterLive()) return supportApiDisabledResponse();
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { body?: string };
    const text = typeof body.body === "string" ? body.body.trim() : "";
    if (text.length < 2) {
      return NextResponse.json({ error: "Message is too short." }, { status: 400 });
    }

    const supabase = getSupportDataClient();
    const { data: ticket, error: tErr } = await supabase
      .from("support_tickets")
      .select("id, clerk_user_id, title, status, contact_email")
      .eq("id", id)
      .maybeSingle();

    if (tErr || !ticket) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if ((ticket as { clerk_user_id: string }).clerk_user_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const st = (ticket as { status: string }).status;
    if (st === "archived") {
      return NextResponse.json({ error: "This ticket is archived." }, { status: 400 });
    }
    if (st === "resolved") {
      return NextResponse.json(
        { error: "This ticket is resolved. Reopen it within 24 hours to reply, or open a new ticket." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const { error: mErr } = await supabase.from("support_ticket_messages").insert({
      ticket_id: id,
      author_role: "user",
      clerk_user_id: userId,
      body: text,
    });
    if (mErr) throw mErr;

    await supabase
      .from("support_tickets")
      .update({
        status: "open",
        updated_at: now,
        last_activity_at: now,
      })
      .eq("id", id);

    await notifyAdminUserReply({
      ticketId: id,
      title: (ticket as { title: string }).title,
      userEmail: (ticket as { contact_email: string }).contact_email,
      excerpt: text,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("support reply POST:", e);
    return NextResponse.json({ error: "Could not send reply" }, { status: 500 });
  }
}
