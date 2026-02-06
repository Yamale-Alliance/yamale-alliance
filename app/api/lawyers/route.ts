import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";

/** GET: public list of approved lawyers with profile (practice, contact). Used by Find a Lawyer page. */
export async function GET() {
  try {
    const clerk = await clerkClient();
    const { data: users } = await clerk.users.getUserList({ limit: 300 });
    const lawyers = (users ?? []).filter(
      (u) =>
        (u.publicMetadata?.role as string) === "lawyer" &&
        ((u.publicMetadata?.status as string) ?? "pending") === "approved"
    );

    const supabase = getSupabaseServer();
    const ids = lawyers.map((u) => u.id);
    if (ids.length === 0) {
      return NextResponse.json({ lawyers: [] });
    }

    const [profilesRes, ratingsRes] = await Promise.all([
      supabase.from("lawyer_profiles").select("user_id, email, phone, practice, country, avatar_url, pronouns").in("user_id", ids),
      supabase.from("lawyer_ratings").select("lawyer_user_id, rating").in("lawyer_user_id", ids),
    ]);
    const profiles = profilesRes.data ?? [];
    const ratings = (ratingsRes.data ?? []) as Array<{ lawyer_user_id: string; rating: number }>;

    const profileMap = new Map(
      profiles.map((p: { user_id: string; email: string | null; phone: string | null; practice: string; country: string | null; avatar_url: string | null; pronouns: string | null }) => [
        p.user_id,
        p,
      ])
    );

    const ratingByLawyer = new Map<string, { mean: number; count: number }>();
    for (const id of ids) {
      const list = ratings.filter((r) => r.lawyer_user_id === id);
      if (list.length === 0) continue;
      const sum = list.reduce((a, r) => a + Number(r.rating), 0);
      ratingByLawyer.set(id, { mean: sum / list.length, count: list.length });
    }

    const list = lawyers.map((u) => {
      const p = profileMap.get(u.id) as { email: string | null; phone: string | null; practice: string; country: string | null; avatar_url: string | null; pronouns: string | null } | undefined;
      const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || "Lawyer";
      const r = ratingByLawyer.get(u.id);
      const avatarUrl = p?.avatar_url ?? (u as { imageUrl?: string }).imageUrl ?? null;
      return {
        id: u.id,
        name,
        specialty: p?.practice ?? "",
        country: p?.country ?? "",
        email: p?.email ?? null,
        phone: p?.phone ?? null,
        avatarUrl,
        pronouns: p?.pronouns ?? null,
        meanRating: r ? Math.round(r.mean * 10) / 10 : null,
        ratingCount: r?.count ?? 0,
      };
    });

    return NextResponse.json({ lawyers: list });
  } catch (err) {
    console.error("Public lawyers GET error:", err);
    return NextResponse.json(
      { error: "Failed to list lawyers" },
      { status: 500 }
    );
  }
}
