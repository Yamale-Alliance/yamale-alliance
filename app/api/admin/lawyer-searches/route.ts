import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
import { clerkClient } from "@clerk/nextjs/server";
import type { Database } from "@/lib/database.types";

type LawyerSearchUnlockGrant = Database["public"]["Tables"]["lawyer_search_unlock_grants"]["Row"];
type LawyerSearchUnlock = Database["public"]["Tables"]["lawyer_search_unlocks"]["Row"];

const SEARCH_GRANT_DAYS = 30;

/** Return ISO expiry date: 30 days after purchase. Handles null/undefined/invalid dates. */
function expiryFromPurchased(purchasedAt: string | null | undefined): string {
  const d = new Date(purchasedAt ?? 0);
  const ts = d.getTime();
  if (Number.isNaN(ts) || ts <= 0) return new Date(Date.now() + SEARCH_GRANT_DAYS * 24 * 60 * 60 * 1000).toISOString();
  return new Date(ts + SEARCH_GRANT_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

type SearchRow = {
  userId: string;
  userName: string;
  userEmail: string | null;
  search: string;
  country: string;
  expertise: string;
  datePurchased: string;
  expiresAt: string;
  stripeSessionId: string | null;
};

function buildSearchLabel(country: string, expertise: string): string {
  if (!expertise) return "Unknown search";
  return country === "all" ? expertise : `${country} + ${expertise}`;
}

export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    const supabase = getSupabaseServer();
    const searches: SearchRow[] = [];
    const userIds = new Set<string>();

    // 1) 30-day grants from lawyer_search_unlock_grants (all, not only active)
    const { data: grants, error: grantsError } = await (supabase.from("lawyer_search_unlock_grants") as any)
      .select("user_id, lawyer_ids, expires_at, created_at, stripe_session_id")
      .order("created_at", { ascending: false });

    if (grantsError) {
      console.error("Error fetching search grants:", grantsError);
      const details = grantsError.message || String(grantsError);
      const isMissingTable = /relation.*does not exist|no such table/i.test(details);
      if (isMissingTable) {
        // Don't fail the whole request; we'll still try lawyer_search_unlocks
      } else {
        return NextResponse.json(
          { error: "Failed to fetch searches", details },
          { status: 500 }
        );
      }
    }

    if (grants?.length) {
      const grantRows = grants as LawyerSearchUnlockGrant[];
      for (const grant of grantRows) {
        userIds.add(grant.user_id);
        let country = "all";
        let expertise = "";
        let searchQuery = "Unknown search";
        const lawyerIds = grant.lawyer_ids;
        if (Array.isArray(lawyerIds) && lawyerIds.length >= 2) {
          const first = lawyerIds[0];
          const second = lawyerIds[1];
          if (typeof first === "string" && typeof second === "string") {
            if (first.length < 36 && !first.includes("-")) {
              country = first;
              expertise = second;
              searchQuery = buildSearchLabel(country, expertise);
            } else {
              searchQuery = `${lawyerIds.length} lawyer${lawyerIds.length !== 1 ? "s" : ""} (legacy)`;
            }
          }
        } else if (Array.isArray(lawyerIds) && lawyerIds.length > 0) {
          searchQuery = `${lawyerIds.length} lawyer${lawyerIds.length !== 1 ? "s" : ""} (legacy)`;
        }
        const purchased = grant.created_at ?? "";
        searches.push({
          userId: grant.user_id,
          userName: "",
          userEmail: null,
          search: searchQuery,
          country,
          expertise,
          datePurchased: purchased,
          expiresAt: grant.expires_at && !Number.isNaN(new Date(grant.expires_at).getTime())
            ? grant.expires_at
            : expiryFromPurchased(purchased),
          stripeSessionId: grant.stripe_session_id,
        });
      }
    }

    // 2) Legacy unlocks from lawyer_search_unlocks — treat as 30-day from purchase
    const { data: unlocks, error: unlocksError } = await (supabase.from("lawyer_search_unlocks") as any)
      .select("user_id, country, expertise, created_at, stripe_session_id")
      .order("created_at", { ascending: false });

    if (unlocksError) {
      console.error("Error fetching search unlocks:", unlocksError);
      const details = unlocksError.message || String(unlocksError);
      const isMissingTable = /relation.*does not exist|no such table/i.test(details);
      if (!isMissingTable) {
        return NextResponse.json(
          { error: "Failed to fetch searches", details },
          { status: 500 }
        );
      }
    }

    if (unlocks?.length) {
      const unlockRows = unlocks as LawyerSearchUnlock[];
      for (const row of unlockRows) {
        userIds.add(row.user_id);
        const country = row.country ?? "all";
        const expertise = row.expertise ?? "";
        const datePurchased = row.created_at ?? new Date().toISOString();
        searches.push({
          userId: row.user_id,
          userName: "",
          userEmail: null,
          search: buildSearchLabel(country, expertise),
          country,
          expertise,
          datePurchased,
          expiresAt: expiryFromPurchased(datePurchased),
          stripeSessionId: row.stripe_session_id,
        });
      }
    }

    if (searches.length === 0) {
      return NextResponse.json([]);
    }

    // Fetch user details from Clerk for all user IDs
    const clerk = await clerkClient();
    const usersMap = new Map<string, { name: string; email: string | null }>();
    for (const userId of userIds) {
      try {
        const user = await clerk.users.getUser(userId);
        const firstName = user.firstName || "";
        const lastName = user.lastName || "";
        const name = `${firstName} ${lastName}`.trim() || "Unknown";
        const email = user.emailAddresses[0]?.emailAddress || null;
        usersMap.set(userId, { name, email });
      } catch (err) {
        console.error(`Error fetching user ${userId}:`, err);
        usersMap.set(userId, { name: "Unknown", email: null });
      }
    }

    const withUsers = searches.map((s) => {
      const user = usersMap.get(s.userId) || { name: "Unknown", email: null };
      return { ...s, userName: user.name, userEmail: user.email };
    });

    // Sort by date purchased descending
    withUsers.sort((a, b) => new Date(b.datePurchased).getTime() - new Date(a.datePurchased).getTime());

    return NextResponse.json(withUsers);
  } catch (err) {
    console.error("Admin lawyer searches GET error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to fetch searches", details: message },
      { status: 500 }
    );
  }
}
