import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
import { clerkClient } from "@clerk/nextjs/server";

export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    const supabase = getSupabaseServer();
    const now = new Date().toISOString();
    
    // Get all active search grants (not expired)
    const { data: grants, error } = await supabase
      .from("lawyer_search_unlock_grants")
      .select("user_id, lawyer_ids, expires_at, created_at, stripe_session_id")
      .gt("expires_at", now)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching search grants:", error);
      return NextResponse.json({ error: "Failed to fetch searches" }, { status: 500 });
    }

    if (!grants || grants.length === 0) {
      return NextResponse.json([]);
    }

    // Get unique user IDs
    const userIds = Array.from(new Set(grants.map((g) => g.user_id)));
    
    // Fetch user details from Clerk
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

    // Process grants and calculate days left
    const searches = grants.map((grant) => {
      const user = usersMap.get(grant.user_id) || { name: "Unknown", email: null };
      const expiresAt = new Date(grant.expires_at);
      const nowDate = new Date();
      const daysLeft = Math.ceil((expiresAt.getTime() - nowDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Extract search criteria from lawyer_ids (stored as [country, expertise] in new format, or lawyer IDs in old format)
      const lawyerIds = grant.lawyer_ids;
      let country = "all";
      let expertise = "";
      let searchQuery = "Unknown search";
      
      if (Array.isArray(lawyerIds) && lawyerIds.length >= 2) {
        const first = lawyerIds[0];
        const second = lawyerIds[1];
        if (typeof first === "string" && typeof second === "string") {
          // Check if it's new format [country, expertise] or old format [lawyer_id, ...]
          if (first.length < 36 && !first.includes("-")) {
            // New format: [country, expertise]
            country = first;
            expertise = second;
            searchQuery = country === "all" ? expertise : `${country} + ${expertise}`;
          } else {
            // Old format: stored lawyer IDs (can't determine search criteria)
            searchQuery = `${lawyerIds.length} lawyer${lawyerIds.length !== 1 ? "s" : ""} (legacy format)`;
          }
        }
      } else if (Array.isArray(lawyerIds) && lawyerIds.length > 0) {
        // Old format: array of lawyer IDs
        searchQuery = `${lawyerIds.length} lawyer${lawyerIds.length !== 1 ? "s" : ""} (legacy format)`;
      }

      return {
        userId: grant.user_id,
        userName: user.name,
        userEmail: user.email,
        search: searchQuery,
        country,
        expertise,
        datePurchased: grant.created_at,
        expiresAt: grant.expires_at,
        daysLeft: Math.max(0, daysLeft),
        stripeSessionId: grant.stripe_session_id,
      };
    });

    return NextResponse.json(searches);
  } catch (err) {
    console.error("Admin lawyer searches GET error:", err);
    return NextResponse.json(
      { error: "Failed to fetch searches" },
      { status: 500 }
    );
  }
}
