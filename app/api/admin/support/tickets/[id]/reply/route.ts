import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getSupportDataClient } from "@/lib/support-supabase";
import { notifyUserTicketReply } from "@/lib/support-email";
import { reopenUntilFromClosed } from "@/lib/support-tickets";
import { isSupportCenterLive, supportApiDisabledResponse } from "@/lib/support-center-enabled";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isSupportCenterLive()) return supportApiDisabledResponse();
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { body?: string; markResolved?: boolean };
    const text = typeof body.body === "string" ? body.body.trim() : "";
    if (text.length < 2) {
      return NextResponse.json({ error: "Message is too short." }, { status: 400 });
    }

    const supabase = getSupportDataClient();
    const { data: ticket, error: tErr } = await supabase
      .from("support_tickets")
      .select("id, title, contact_email, status")
      .eq("id", id)
      .maybeSingle();

    if (tErr || !ticket) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const row = ticket as { status: string; contact_email: string; title: string };
    if (row.status === "archived") {
      return NextResponse.json({ error: "Ticket is archived." }, { status: 400 });
    }

    const now = new Date();
    const nowIso = now.toISOString();

    const { error: mErr } = await supabase.from("support_ticket_messages").insert({
      ticket_id: id,
      author_role: "admin",
      clerk_user_id: admin.userId,
      body: text,
    });
    if (mErr) throw mErr;

    const markResolved = body.markResolved === true;
    const update: Record<string, unknown> = {
      updated_at: nowIso,
      last_activity_at: nowIso,
    };

    if (markResolved) {
      update.status = "resolved";
      update.resolved_at = nowIso;
      update.closed_at = nowIso;
      update.reopen_until = reopenUntilFromClosed(now).toISOString();
    } else {
      update.status = "in_progress";
    }

    await supabase.from("support_tickets").update(update).eq("id", id);

    await notifyUserTicketReply({
      to: row.contact_email,
      ticketTitle: row.title,
      excerpt: text,
      ticketId: id,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("admin support reply:", e);
    return NextResponse.json({ error: "Could not send" }, { status: 500 });
  }
}
