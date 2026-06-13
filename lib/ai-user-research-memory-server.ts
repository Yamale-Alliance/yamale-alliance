import {
  buildUserResearchMemoryPromptBlock,
  buildUserResearchMemorySnapshot,
  normalizeAiChatSessionsForMemory,
} from "@/lib/ai-user-research-memory";

const MEMORY_QUERY_TIMEOUT_MS = 5000;

/** Load cross-chat research memory for the signed-in user (best-effort; null on failure). */
export async function fetchUserResearchMemoryPromptBlock(
  supabase: { from: (table: string) => unknown },
  userId: string,
  excludeSessionId?: string | null
): Promise<string | null> {
  if (!userId.trim()) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MEMORY_QUERY_TIMEOUT_MS);
    const { data, error } = await (supabase as any)
      .from("ai_chat_states")
      .select("data")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle()
      .abortSignal(controller.signal);
    clearTimeout(timeout);

    if (error || !data?.data) return null;

    const sessions = normalizeAiChatSessionsForMemory(data.data);
    const snapshot = buildUserResearchMemorySnapshot(sessions, { excludeSessionId });
    return buildUserResearchMemoryPromptBlock(snapshot);
  } catch {
    return null;
  }
}
