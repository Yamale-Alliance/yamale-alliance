export type BugConversationMessage = {
  id?: string;
  role: string;
  content: string;
};

export type AutoGapSnapshotMeta = {
  trigger: "auto_gap_detect";
  gapKind?: string;
  matchedPhrases?: string[];
  laws?: Array<{
    lawId: string;
    title: string;
    country: string | null;
    category: string | null;
    flagCategory: string;
  }>;
  userQuery?: string;
  assistantExcerpt?: string;
};

export type ParsedBugConversation =
  | { kind: "messages"; messages: BugConversationMessage[] }
  | { kind: "auto_gap"; messages: BugConversationMessage[]; meta: AutoGapSnapshotMeta }
  | { kind: "empty" };

/** Normalize `ai_bug_reports.conversation_snapshot` (chat array, wrapped, or legacy auto object). */
export function parseBugConversationSnapshot(snapshot: unknown): ParsedBugConversation {
  if (!snapshot) return { kind: "empty" };

  if (Array.isArray(snapshot)) {
    const messages = snapshot.filter(isMessage);
    return messages.length > 0 ? { kind: "messages", messages } : { kind: "empty" };
  }

  if (typeof snapshot === "object" && snapshot !== null) {
    const obj = snapshot as Record<string, unknown>;

    if (Array.isArray(obj.messages)) {
      const messages = obj.messages.filter(isMessage);
      const meta = isAutoGapMeta(obj.autoGapMeta) ? obj.autoGapMeta : undefined;
      if (messages.length > 0) {
        return meta
          ? { kind: "auto_gap", messages, meta }
          : { kind: "messages", messages };
      }
    }

    if (obj.trigger === "auto_gap_detect") {
      const meta = obj as AutoGapSnapshotMeta;
      const messages: BugConversationMessage[] = [];
      if (typeof meta.userQuery === "string" && meta.userQuery.trim()) {
        messages.push({ role: "user", content: meta.userQuery });
      }
      if (typeof meta.assistantExcerpt === "string" && meta.assistantExcerpt.trim()) {
        messages.push({ role: "assistant", content: meta.assistantExcerpt });
      }
      if (messages.length > 0) return { kind: "auto_gap", messages, meta };
      return { kind: "auto_gap", messages: [], meta };
    }
  }

  return { kind: "empty" };
}

function isMessage(value: unknown): value is BugConversationMessage {
  if (!value || typeof value !== "object") return false;
  const m = value as Record<string, unknown>;
  return typeof m.role === "string" && typeof m.content === "string" && m.content.length > 0;
}

function isAutoGapMeta(value: unknown): value is AutoGapSnapshotMeta {
  return Boolean(value && typeof value === "object" && (value as AutoGapSnapshotMeta).trigger === "auto_gap_detect");
}
