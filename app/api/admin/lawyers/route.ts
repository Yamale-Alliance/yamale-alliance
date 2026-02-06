import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { requireAdmin } from "@/lib/admin";
import { getSubmission } from "@/lib/lawyer-submissions";
import { getSupabaseServer } from "@/lib/supabase/server";

/** GET: list all users with role lawyer, with submission + profile (contact) for admin review. */
export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    const clerk = await clerkClient();
    const { data: users } = await clerk.users.getUserList({ limit: 200 });
    const lawyers = (users ?? []).filter(
      (u) => (u.publicMetadata?.role as string) === "lawyer"
    );
    const ids = lawyers.map((u) => u.id);
    const supabase = getSupabaseServer();
    const { data: profiles } = ids.length > 0
      ? await supabase.from("lawyer_profiles").select("user_id, email, phone, practice, country").in("user_id", ids)
      : { data: [] };
    const profileMap = new Map(
      (profiles ?? []).map((p: { user_id: string; email: string | null; phone: string | null; practice: string; country: string | null }) => [p.user_id, p])
    );

    const list = lawyers.map((u) => {
      const submission = getSubmission(u.id);
      const status =
        (u.publicMetadata?.status as string) ??
        submission?.status ??
        "pending";
      const profile = profileMap.get(u.id) as { email: string | null; phone: string | null; practice: string; country: string | null } | undefined;
      return {
        id: u.id,
        email: u.emailAddresses[0]?.emailAddress ?? null,
        firstName: u.firstName,
        lastName: u.lastName,
        status,
        createdAt: u.createdAt,
        profile: profile
          ? { email: profile.email, phone: profile.phone, practice: profile.practice, country: profile.country }
          : null,
        submission: submission
          ? {
              submittedAt: submission.submittedAt,
              specialty: submission.form.specialty,
              experience: submission.form.experience,
              location: submission.form.location,
              barNumber: submission.form.barNumber,
              bio: submission.form.bio,
              documents: submission.documents,
            }
          : null,
      };
    });
    return NextResponse.json(list);
  } catch (err) {
    console.error("Admin lawyers GET error:", err);
    return NextResponse.json(
      { error: "Failed to list lawyers" },
      { status: 500 }
    );
  }
}
