import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getSupportDataClient } from "@/lib/support-supabase";
import { processSupportTicketArchival } from "@/lib/support-tickets";
import { isSupportCenterLive, supportApiDisabledResponse } from "@/lib/support-center-enabled";

export async function GET(request: NextRequest) {
  if (!isSupportCenterLive()) return supportApiDisabledResponse();
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "all";
    const supabase = getSupportDataClient();
    await processSupportTicketArchival();

    let q = supabase
      .from("support_tickets")
      .select("id, title, status, contact_name, contact_email, created_at, last_activity_at, closed_at, archived_at")
      .order("last_activity_at", { ascending: false });

    if (status !== "all" && ["open", "in_progress", "resolved", "archived"].includes(status)) {
      q = q.eq("status", status);
    }

    const { data, error } = await q;
    if (error) throw error;
    return NextResponse.json({ tickets: data ?? [] });
  } catch (e) {
    console.error("admin support list:", e);
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}
