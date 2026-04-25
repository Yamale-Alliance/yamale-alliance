import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getUnlockedLawyerIds, getUnlockedLawyerIdsFromSearchCriteria, getUnlockedLawyerIdsFromSearchGrants } from "@/lib/unlocks";

type LawyerRow = {
  id: string;
  name: string;
  country: string | null;
  expertise: string;
  linkedin_url: string | null;
  image_url: string | null;
  email: string | null;
  phone: string | null;
  contacts: string | null;
};

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ lawyers: [] }, { status: 401 });
  }

  try {
    const [perLawyerIds, criteriaIds, grantIds] = await Promise.all([
      getUnlockedLawyerIds(userId),
      getUnlockedLawyerIdsFromSearchCriteria(userId),
      getUnlockedLawyerIdsFromSearchGrants(userId),
    ]);
    const lawyerIds = Array.from(new Set([...perLawyerIds, ...criteriaIds, ...grantIds]));
    if (lawyerIds.length === 0) {
      return NextResponse.json({ lawyers: [] });
    }

    const supabase = getSupabaseServer();
    const { data, error } = await (supabase.from("lawyers") as any)
      .select("id, name, country, expertise, linkedin_url, image_url, email, phone, contacts")
      .in("id", lawyerIds)
      .eq("approved", true)
      .order("name");

    if (error) {
      return NextResponse.json({ error: "Failed to list unlocked lawyers" }, { status: 500 });
    }

    const rows = (data ?? []) as LawyerRow[];
    const lawyers = rows.map((row) => ({
      id: row.id,
      name: row.name,
      country: row.country ?? "",
      expertise: row.expertise,
      linkedinUrl: row.linkedin_url ?? null,
      imageUrl: row.image_url ?? null,
      email: row.email ?? null,
      phone: row.phone ?? null,
      contacts: row.contacts ?? null,
    }));

    return NextResponse.json({ lawyers });
  } catch (err) {
    console.error("Unlocked lawyers list error:", err);
    return NextResponse.json({ error: "Failed to list unlocked lawyers" }, { status: 500 });
  }
}
