import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { requireAdmin } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";

export type AdminLibraryDocumentPurchaseRow = {
  id: string;
  user_id: string;
  buyer_name: string;
  law_id: string | null;
  law_title: string | null;
  stripe_session_id: string | null;
  created_at: string;
};

/**
 * List library law PDF export purchases (PawaPay / Lomi metadata kind `payg_document`),
 * stored in `pay_as_you_go_purchases` with `item_type = document`.
 */
export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    const supabase = getSupabaseServer();
    const { data, error } = await (supabase.from("pay_as_you_go_purchases") as any)
      .select("id, user_id, law_id, stripe_session_id, created_at")
      .eq("item_type", "document")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      console.error("Admin library document purchases GET error:", error);
      return NextResponse.json({ error: "Failed to load purchases" }, { status: 500 });
    }

    const rows = (data ?? []) as Array<{
      id: string;
      user_id: string;
      law_id: string | null;
      stripe_session_id: string | null;
      created_at: string;
    }>;

    const uniqueUserIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
    const userNameMap = new Map<string, string>();
    try {
      if (uniqueUserIds.length > 0) {
        const clerk = await clerkClient();
        await Promise.all(
          uniqueUserIds.map(async (userId) => {
            try {
              const user = await clerk.users.getUser(userId);
              const name =
                [user.firstName, user.lastName].filter(Boolean).join(" ") ||
                (user.username ?? "") ||
                (user.emailAddresses?.[0]?.emailAddress ?? "") ||
                userId;
              userNameMap.set(userId, name);
            } catch {
              userNameMap.set(userId, userId);
            }
          })
        );
      }
    } catch (e) {
      console.error("Admin library document purchases: Clerk user lookup failed", e);
    }

    const lawIds = Array.from(
      new Set(rows.map((r) => r.law_id).filter((id): id is string => Boolean(id?.trim())))
    );
    const lawTitleMap = new Map<string, string>();
    if (lawIds.length > 0) {
      const { data: laws, error: lawsErr } = await supabase.from("laws").select("id, title").in("id", lawIds);
      if (lawsErr) {
        console.error("Admin library document purchases: laws lookup", lawsErr);
      } else {
        for (const law of (laws ?? []) as Array<{ id: string; title: string | null }>) {
          if (law.id) lawTitleMap.set(law.id, law.title?.trim() || "(untitled)");
        }
      }
    }

    const purchases: AdminLibraryDocumentPurchaseRow[] = rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      buyer_name: userNameMap.get(row.user_id) ?? row.user_id,
      law_id: row.law_id,
      law_title: row.law_id ? (lawTitleMap.get(row.law_id) ?? null) : null,
      stripe_session_id: row.stripe_session_id,
      created_at: row.created_at,
    }));

    return NextResponse.json({ purchases });
  } catch (err) {
    console.error("Admin library document purchases GET error:", err);
    return NextResponse.json({ error: "Failed to load purchases" }, { status: 500 });
  }
}
