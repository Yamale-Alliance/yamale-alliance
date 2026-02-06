import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { getSubmission } from "@/lib/lawyer-submissions";
import { getSupabaseServer } from "@/lib/supabase/server";

/** GET: current lawyer's profile, application status, and documents (for lawyer panel). */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const submission = getSubmission(userId);
  const clerk = await clerkClient();
  const user = await clerk.users.getUser(userId);
  const clerkStatus = user.publicMetadata?.status as string | undefined;
  const status = clerkStatus ?? submission?.status ?? "pending";

  const supabase = getSupabaseServer();
  const [profileRes, docsRes] = await Promise.all([
    supabase.from("lawyer_profiles").select("user_id, email, phone, practice, country, avatar_url").eq("user_id", userId).maybeSingle(),
    supabase.from("lawyer_documents").select("id, document_type, file_name, created_at").eq("user_id", userId).order("document_type"),
  ]);
  const profile = profileRes.data as { user_id: string; email: string | null; phone: string | null; practice: string; country: string | null; avatar_url: string | null; pronouns: string | null } | null;
  const documents = (docsRes.data ?? []) as Array<{ id: string; document_type: string; file_name: string; created_at: string }>;

  return NextResponse.json({
    userId,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.emailAddresses[0]?.emailAddress ?? null,
    status,
    profile: profile ?? { user_id: userId, email: null, phone: null, practice: "", country: null, avatar_url: null, pronouns: null },
    documents,
    submission: submission
      ? {
          submittedAt: submission.submittedAt,
          specialty: submission.form.specialty,
          experience: submission.form.experience,
          location: submission.form.location,
          barNumber: submission.form.barNumber,
          bio: submission.form.bio,
        }
      : null,
  });
}
