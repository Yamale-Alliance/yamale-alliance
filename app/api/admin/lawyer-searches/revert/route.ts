import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";

/** POST: Revert a paid lawyer search (remove grant or legacy unlock so user has not paid). */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  let body: { grantId?: string; source?: "unlock"; userId?: string; country?: string; expertise?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  if (body.grantId) {
    const { error } = await (supabase.from("lawyer_search_unlock_grants") as any)
      .delete()
      .eq("id", body.grantId);

    if (error) {
      console.error("Revert grant error:", error);
      return NextResponse.json(
        { error: "Failed to revert search", details: error.message },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, reverted: "grant" });
  }

  if (body.source === "unlock" && body.userId != null && body.country != null && body.expertise != null) {
    const { error } = await (supabase.from("lawyer_search_unlocks") as any)
      .delete()
      .eq("user_id", body.userId)
      .eq("country", body.country)
      .eq("expertise", body.expertise);

    if (error) {
      console.error("Revert unlock error:", error);
      return NextResponse.json(
        { error: "Failed to revert search", details: error.message },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, reverted: "unlock" });
  }

  return NextResponse.json(
    { error: "Provide grantId or source=unlock with userId, country, expertise" },
    { status: 400 }
  );
}
