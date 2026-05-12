import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * Law IDs the signed-in user has unlocked for PDF export (document pay-as-you-go),
 * keyed by `pay_as_you_go_purchases.law_id` for `item_type = document`.
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const supabase = getSupabaseServer();
    const { data, error } = await (supabase.from("pay_as_you_go_purchases") as any)
      .select("law_id")
      .eq("user_id", userId)
      .eq("item_type", "document");

    if (error) {
      console.error("document-export-unlocks:", error);
      return NextResponse.json({ error: "Failed to load unlocks" }, { status: 500 });
    }

    const rows = (data ?? []) as Array<{ law_id: string | null }>;
    const law_ids = Array.from(
      new Set(rows.map((r) => r.law_id).filter((id): id is string => typeof id === "string" && id.length > 0))
    );

    return NextResponse.json({ law_ids });
  } catch (err) {
    console.error("document-export-unlocks:", err);
    return NextResponse.json({ error: "Failed to load unlocks" }, { status: 500 });
  }
}
