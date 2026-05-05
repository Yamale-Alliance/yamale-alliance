import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getSupportDataClient } from "@/lib/support-supabase";
import { notifyAdminNewTicket } from "@/lib/support-email";
import { processSupportTicketArchival } from "@/lib/support-tickets";
import { isSupportCenterLive, supportApiDisabledResponse } from "@/lib/support-center-enabled";

export async function GET() {
  if (!isSupportCenterLive()) return supportApiDisabledResponse();
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }
    const supabase = getSupportDataClient();
    await processSupportTicketArchival();

    const { data, error } = await supabase
      .from("support_tickets")
      .select("id, title, status, created_at, updated_at, closed_at, reopen_until, last_activity_at")
      .eq("clerk_user_id", userId)
      .order("last_activity_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ tickets: data ?? [] });
  } catch (e) {
    console.error("support tickets GET:", e);
    return NextResponse.json({ error: "Failed to load tickets" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isSupportCenterLive()) return supportApiDisabledResponse();
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    let contactName = typeof body.contactName === "string" ? body.contactName.trim() : "";
    let contactEmail = typeof body.contactEmail === "string" ? body.contactEmail.trim() : "";

    const user = await currentUser();
    const primary = user?.emailAddresses?.[0]?.emailAddress ?? "";
    const fullName = user?.fullName ?? "";
    if (!contactEmail && primary) contactEmail = primary;
    if (!contactName && fullName) contactName = fullName;
    if (!contactName) contactName = user?.username ?? primary.split("@")[0] ?? "User";

    if (!title || title.length < 3) {
      return NextResponse.json({ error: "Please enter a clear title (at least 3 characters)." }, { status: 400 });
    }
    if (!description || description.length < 10) {
      return NextResponse.json({ error: "Please describe your issue (at least 10 characters)." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
    }

    const supabase = getSupportDataClient();
    const now = new Date().toISOString();

    const { data: ticket, error: tErr } = await supabase
      .from("support_tickets")
      .insert({
        clerk_user_id: userId,
        contact_name: contactName,
        contact_email: contactEmail,
        title,
        status: "open",
        created_at: now,
        updated_at: now,
        last_activity_at: now,
      })
      .select("id")
      .single();

    if (tErr || !ticket) throw tErr ?? new Error("insert ticket");

    const ticketId = (ticket as { id: string }).id;

    const { error: mErr } = await supabase.from("support_ticket_messages").insert({
      ticket_id: ticketId,
      author_role: "user",
      clerk_user_id: userId,
      body: description,
    });
    if (mErr) throw mErr;

    await notifyAdminNewTicket({
      ticketId,
      title,
      contactName,
      contactEmail,
      descriptionPreview: description,
    });

    return NextResponse.json({ ok: true, id: ticketId });
  } catch (e) {
    console.error("support tickets POST:", e);
    return NextResponse.json({ error: "Could not create ticket" }, { status: 500 });
  }
}
