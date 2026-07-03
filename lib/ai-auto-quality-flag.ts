import {
  aiBugCategoryForGap,
  detectAiResponseQualityGap,
  detectVersionMetadataFlags,
  extractRequestedInstrumentHint,
  lawFlagCategoryForGap,
  lawsToFlagForGap,
  type AiResponseGapKind,
  type LawFlagCategoryForGap,
} from "@/lib/ai-response-gap-detect";
import { lawFlagCategoryLabel } from "@/lib/law-flag-categories";

export type AutoQualityLawContext = {
  id: string;
  title: string;
  country: string;
  category: string;
};

export type RecordAutoAiQualityFlagsParams = {
  supabase: unknown;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  queryLogId: string | null;
  userQuery: string;
  assistantText: string;
  legalContext: AutoQualityLawContext[];
  skip?: boolean;
};

const DEDUPE_HOURS = 24;

export function isAutoAiQualityFlagsEnabled(): boolean {
  const raw = process.env.AI_AUTO_QUALITY_FLAGS?.trim();
  if (raw === "0" || raw?.toLowerCase() === "false") return false;
  return true;
}

/**
 * When the model hedges on missing/thin library text, open law_flags + ai_bug_reports
 * for admin AI quality review (reporter = chat user).
 */
export async function recordAutoAiQualityFlags(params: RecordAutoAiQualityFlagsParams): Promise<void> {
  if (params.skip || !isAutoAiQualityFlagsEnabled()) return;

  const detection = detectAiResponseQualityGap(params.assistantText, {
    userQuery: params.userQuery,
  });
  if (!detection.hasGap || !detection.kind) return;

  const gapKind = detection.kind;
  const laws = params.legalContext.filter((l) => l.id?.trim());
  const hadRetrievedLaws = laws.length > 0;
  const gapLawFlags = lawsToFlagForGap(params.assistantText, laws, params.userQuery, gapKind);
  const versionLawFlags = detectVersionMetadataFlags(params.assistantText, laws);
  const gapFlagIds = new Set(gapLawFlags.map((l) => l.id));
  const lawsToFlag: Array<{ id: string; title: string; flagCategory: LawFlagCategoryForGap }> = [
    ...gapLawFlags.map((l) => ({ ...l, flagCategory: lawFlagCategoryForGap(gapKind, hadRetrievedLaws) })),
    ...versionLawFlags
      .filter((l) => !gapFlagIds.has(l.id))
      .map((l) => ({ ...l, flagCategory: "ai_version_metadata" as const })),
  ];
  const requestedHint = extractRequestedInstrumentHint(params.userQuery);
  const flagCategory = lawFlagCategoryForGap(gapKind, hadRetrievedLaws);
  const bugCategory = aiBugCategoryForGap(gapKind);
  const now = new Date().toISOString();
  const since = new Date(Date.now() - DEDUPE_HOURS * 60 * 60 * 1000).toISOString();

  const sb = params.supabase as any;

  try {
    if (params.queryLogId) {
      const { data: existingBug } = await sb
        .from("ai_bug_reports")
        .select("id")
        .eq("query_log_id", params.queryLogId)
        .like("issue_category", "auto_ai_%")
        .limit(1)
        .maybeSingle();
      if (existingBug?.id) return;
    }

    const categoryLabel = lawFlagCategoryLabel(flagCategory);
    const lawSummaries = lawsToFlag.map((l) => {
      const full = laws.find((x) => x.id === l.id);
      return {
        lawId: l.id,
        title: l.title,
        country: full?.country ?? null,
        category: full?.category ?? null,
        flagCategory: l.flagCategory,
      };
    });

    const issueDetails = [
      `Auto-flagged: AI reported a library coverage gap (${categoryLabel}).`,
      requestedHint ? `User likely sought: ${requestedHint}` : null,
      params.userQuery.trim()
        ? `Question: ${params.userQuery.trim().slice(0, 500)}`
        : null,
      detection.matchedPhrases.length ? `Matched: "${detection.matchedPhrases.join('"; "')}"` : null,
      laws.length
        ? `Retrieved this turn: ${laws.map((l) => l.title).join("; ")}`
        : "No instruments were attached to this turn.",
      lawsToFlag.length
        ? `Law records flagged: ${lawsToFlag.map((l) => l.title).join("; ")}`
        : hadRetrievedLaws
          ? "No library records flagged — gap is likely an unindexed instrument or retrieval mismatch."
          : null,
      params.queryLogId ? `Query log: ${params.queryLogId}` : null,
    ]
      .filter(Boolean)
      .join("\n")
      .slice(0, 4000);

    const conversationSnapshot = [
      { role: "user", content: params.userQuery.slice(0, 12_000) },
      { role: "assistant", content: params.assistantText.slice(0, 12_000) },
    ];

    const autoGapMeta = {
      trigger: "auto_gap_detect" as const,
      gapKind,
      matchedPhrases: detection.matchedPhrases,
      laws: lawSummaries,
    };

    await sb.from("ai_bug_reports").insert({
      user_id: params.userId,
      user_name: params.userName,
      user_email: params.userEmail,
      query_log_id: params.queryLogId,
      related_message_id: null,
      issue_category: bugCategory,
      issue_details: issueDetails,
      conversation_snapshot: { messages: conversationSnapshot, autoGapMeta },
      status: "open",
      updated_at: now,
    });

    for (const law of lawsToFlag) {
      const full = laws.find((x) => x.id === law.id);
      if (!full) continue;

      const { data: dup } = await sb
        .from("law_flags")
        .select("id")
        .eq("law_id", law.id)
        .eq("issue_category", law.flagCategory)
        .eq("user_id", params.userId)
        .eq("status", "open")
        .gte("created_at", since)
        .limit(1)
        .maybeSingle();

      if (dup?.id) continue;

      const lawCategoryLabel = lawFlagCategoryLabel(law.flagCategory);
      const lawIssueDetails = [
        issueDetails,
        `Flag category: ${lawCategoryLabel}`,
        `Reporter (AI chat user): ${params.userName || params.userEmail || params.userId}`,
      ]
        .join("\n")
        .slice(0, 4000);

      await sb.from("law_flags").insert({
        law_id: law.id,
        user_id: params.userId,
        user_name: params.userName,
        user_email: params.userEmail,
        law_title: full.title,
        law_country: full.country || null,
        law_category: full.category || null,
        issue_category: law.flagCategory,
        issue_details: lawIssueDetails,
        status: "open",
        updated_at: now,
      });
    }

    if (!hadRetrievedLaws && lawsToFlag.length === 0) {
      return;
    }

    console.info("[ai-auto-quality-flag]", {
      bugCategory,
      flagCategory,
      gapKind,
      laws: lawsToFlag.length,
      userId: params.userId,
      queryLogId: params.queryLogId,
    });
  } catch (err) {
    console.error("[ai-auto-quality-flag] failed:", err);
  }
}

export function gapKindLabel(kind: AiResponseGapKind): string {
  switch (kind) {
    case "no_retrieval":
      return "No retrieval";
    case "missing_from_library":
      return "Missing from library";
    case "excerpt_insufficient":
      return "Excerpt insufficient";
    default:
      return "Quality gap";
  }
}
