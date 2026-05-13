import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDocumentExportUnlockLawIdsForUser } from "@/lib/library-document-export-unlocks";

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

    const law_ids = await getDocumentExportUnlockLawIdsForUser(userId);

    return NextResponse.json({ law_ids });
  } catch (err) {
    console.error("document-export-unlocks:", err);
    return NextResponse.json({ error: "Failed to load unlocks" }, { status: 500 });
  }
}
