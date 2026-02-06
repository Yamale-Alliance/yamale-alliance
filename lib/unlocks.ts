import { getSupabaseServer } from "@/lib/supabase/server";

export async function getUnlockedLawyerIds(userId: string): Promise<string[]> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("lawyer_unlocks")
    .select("lawyer_id")
    .eq("user_id", userId);
  if (error) return [];
  return (data ?? []).map((r) => r.lawyer_id);
}

export async function recordUnlock(
  userId: string,
  lawyerId: string,
  stripeSessionId?: string | null
): Promise<void> {
  const supabase = getSupabaseServer();
  await supabase.from("lawyer_unlocks").upsert(
    {
      user_id: userId,
      lawyer_id: lawyerId,
      stripe_session_id: stripeSessionId ?? null,
    },
    { onConflict: "user_id,lawyer_id" }
  );
}
