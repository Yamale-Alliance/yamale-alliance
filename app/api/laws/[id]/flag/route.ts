import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { isValidLawFlagCategoryId } from "@/lib/law-flag-categories";
import { notifyAdminLawFlag } from "@/lib/law-flag-email";
import { lawCountryDisplayName, lawSourceDisplayLabel } from "@/lib/law-source-display";
import { getSupabaseServer } from "@/lib/supabase/server";

const LAWS_FLAG_SELECT =
  "id, title, status, countries(name), categories(name), applies_to_all_countries, source_name";

/**
 * POST — flag a library law for admin review.
 * Body: { issueCategory: string, issueDetails?: string }
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: lawId } = await context.params;
    if (!lawId?.trim()) {
      return NextResponse.json({ error: "Law id required" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const issueCategory =
      typeof body.issueCategory === "string" ? body.issueCategory.trim() : "";
    const issueDetails =
      typeof body.issueDetails === "string" ? body.issueDetails.trim().slice(0, 4000) : null;

    if (!isValidLawFlagCategoryId(issueCategory)) {
      return NextResponse.json({ error: "Invalid issue category" }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data: law, error: lawErr } = await supabase
      .from("laws")
      .select(LAWS_FLAG_SELECT)
      .eq("id", lawId)
      .maybeSingle();

    if (lawErr) {
      console.error("law flag fetch law:", lawErr);
      return NextResponse.json({ error: "Failed to load law" }, { status: 500 });
    }
    if (!law) {
      return NextResponse.json({ error: "Law not found" }, { status: 404 });
    }

    const user = await currentUser();
    const fallbackName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
    const displayName = user?.fullName ?? (fallbackName || user?.username || null);
    const email = user?.emailAddresses?.[0]?.emailAddress ?? null;

    const lawRow = law as {
      id: string;
      title: string;
      countries?: { name?: string } | null;
      categories?: { name?: string } | null;
      applies_to_all_countries?: boolean | null;
      source_name?: string | null;
    };

    const lawTitle = String(lawRow.title ?? "").trim() || "Untitled law";
    const lawCountry = lawSourceDisplayLabel(lawRow) || lawCountryDisplayName(lawRow) || null;
    const lawCategory = lawRow.categories?.name?.trim() || null;
    const now = new Date().toISOString();

    const { data: inserted, error: insertErr } = await (supabase.from("law_flags") as any)
      .insert({
        law_id: lawId,
        user_id: userId,
        user_name: displayName,
        user_email: email,
        law_title: lawTitle,
        law_country: lawCountry,
        law_category: lawCategory,
        issue_category: issueCategory,
        issue_details: issueDetails,
        status: "open",
        updated_at: now,
      })
      .select("id")
      .maybeSingle();

    if (insertErr) {
      console.error("law_flags insert:", insertErr);
      return NextResponse.json({ error: "Failed to save flag" }, { status: 500 });
    }

    const flagId = (inserted as { id: string } | null)?.id;
    if (flagId) {
      try {
        await notifyAdminLawFlag({
          flagId,
          lawId,
          lawTitle,
          lawCountry,
          lawCategory,
          issueCategory,
          issueDetails,
          userName: displayName,
          userEmail: email,
        });
      } catch (emailErr) {
        console.error("law flag email:", emailErr);
      }
    }

    return NextResponse.json({ ok: true, id: flagId });
  } catch (e) {
    console.error("law flag POST:", e);
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
