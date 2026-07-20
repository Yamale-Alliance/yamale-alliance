import { getSupabaseServer } from "@/lib/supabase/server";
import type {
  AdvisoryDocumentStatus,
  AdvisoryMilestone,
  AdvisoryProgressSnapshot,
} from "@/lib/law-firm-development/types";
import {
  applyLessonActivity,
  parseCourseLessonProgress,
  type CourseLessonProgress,
} from "@/lib/course-platform";

type ProfileRow = {
  user_id: string;
  firm_name: string | null;
  firm_location: string | null;
  subscription_label: string | null;
  programme_started_at: string;
};

type ProgressRow = {
  document_id: string;
  status: AdvisoryDocumentStatus;
  section_progress: Record<string, unknown> | null;
  notes: string | null;
};

function sectionProgressFromRows(rows: ProgressRow[]): Record<string, number> | undefined {
  const sectionProgress: Record<string, number> = {};
  for (const row of rows) {
    const parsed = parseCourseLessonProgress(row.section_progress);
    if (parsed?.video?.watchedPercent != null) {
      sectionProgress[`${row.document_id}:video`] = parsed.video.watchedPercent;
    }
    if (parsed?.reading?.scrollPercent != null) {
      sectionProgress[`${row.document_id}:reading`] = parsed.reading.scrollPercent;
    }
    if (parsed?.quiz?.score != null) {
      sectionProgress[`${row.document_id}:quiz`] = parsed.quiz.score;
    }
  }
  return Object.keys(sectionProgress).length > 0 ? sectionProgress : undefined;
}

function documentLessonProgressFromRows(
  rows: ProgressRow[]
): Record<string, CourseLessonProgress> | undefined {
  const out: Record<string, CourseLessonProgress> = {};
  for (const row of rows) {
    const parsed = parseCourseLessonProgress(row.section_progress);
    if (parsed) out[row.document_id] = parsed;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

type MilestoneRow = {
  id: string;
  title: string;
  due_at: string | null;
  completed_at: string | null;
  sort_order: number;
};

export type AdvisoryWorkspacePayload = AdvisoryProgressSnapshot & {
  milestones: AdvisoryMilestone[];
  programmeStartedAt: string | null;
  /** Full lesson activity payloads keyed by document id. */
  lessonProgress?: Record<string, CourseLessonProgress>;
};

function formatDueLabel(dueAt: string | null): string {
  if (!dueAt) return "No due date";
  const d = new Date(dueAt);
  if (Number.isNaN(d.getTime())) return "No due date";
  return `Due ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
}

function formatCompletedLabel(completedAt: string | null): string {
  if (!completedAt) return "";
  const d = new Date(completedAt);
  if (Number.isNaN(d.getTime())) return "Completed";
  return `Completed ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
}

function milestoneFromRow(row: MilestoneRow): AdvisoryMilestone {
  const completed = Boolean(row.completed_at);
  return {
    id: row.id,
    title: row.title,
    dueLabel: completed ? formatCompletedLabel(row.completed_at) : formatDueLabel(row.due_at),
    completed,
    completedLabel: completed ? formatCompletedLabel(row.completed_at) : undefined,
  };
}

export async function loadAdvisoryWorkspace(userId: string): Promise<AdvisoryWorkspacePayload> {
  const supabase = getSupabaseServer();

  const [profileRes, progressRes, milestonesRes] = await Promise.all([
    supabase.from("advisory_workspace_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("advisory_document_progress").select("document_id, status, section_progress, notes").eq("user_id", userId),
    supabase
      .from("advisory_milestones")
      .select("id, title, due_at, completed_at, sort_order")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  if (profileRes.error) throw profileRes.error;
  if (progressRes.error) throw progressRes.error;
  if (milestonesRes.error) throw milestonesRes.error;

  const profile = profileRes.data as ProfileRow | null;
  const progressRows = (progressRes.data ?? []) as ProgressRow[];
  const milestoneRows = (milestonesRes.data ?? []) as MilestoneRow[];

  const documentStatus: Record<string, AdvisoryDocumentStatus> = {};
  const documentNotes: Record<string, string> = {};

  for (const row of progressRows) {
    documentStatus[row.document_id] = row.status;
    if (row.notes?.trim()) documentNotes[row.document_id] = row.notes.trim();
  }

  return {
    documentStatus,
    sectionProgress: sectionProgressFromRows(progressRows),
    documentNotes: Object.keys(documentNotes).length > 0 ? documentNotes : undefined,
    lessonProgress: documentLessonProgressFromRows(progressRows),
    firmName: profile?.firm_name ?? undefined,
    firmLocation: profile?.firm_location ?? undefined,
    subscriptionLabel: profile?.subscription_label ?? undefined,
    milestones: milestoneRows.map(milestoneFromRow),
    programmeStartedAt: profile?.programme_started_at ?? null,
  };
}

export async function ensureAdvisoryWorkspaceProfile(userId: string): Promise<void> {
  const supabase = getSupabaseServer();
  const { error } = await (supabase.from("advisory_workspace_profiles") as any).upsert(
    { user_id: userId, updated_at: new Date().toISOString() },
    { onConflict: "user_id", ignoreDuplicates: true }
  );
  if (error) throw error;
}

export async function patchAdvisoryWorkspace(
  userId: string,
  patch: {
    profile?: Partial<Pick<AdvisoryProgressSnapshot, "firmName" | "firmLocation" | "subscriptionLabel">>;
    documentStatus?: Record<string, AdvisoryDocumentStatus>;
    documentNotes?: Record<string, string | null>;
    lessonActivity?: {
      documentId: string;
      type: "video_progress" | "video_complete" | "reading_progress" | "quiz_submit" | "checklist_toggle";
      payload?: Record<string, unknown>;
    };
    milestone?: {
      action: "create";
      title: string;
      dueAt?: string | null;
    } | {
      action: "complete";
      id: string;
    } | {
      action: "delete";
      id: string;
    };
  }
): Promise<AdvisoryWorkspacePayload> {
  const supabase = getSupabaseServer();
  await ensureAdvisoryWorkspaceProfile(userId);

  if (patch.profile) {
    const row: Record<string, unknown> = { user_id: userId, updated_at: new Date().toISOString() };
    if (patch.profile.firmName !== undefined) row.firm_name = patch.profile.firmName || null;
    if (patch.profile.firmLocation !== undefined) row.firm_location = patch.profile.firmLocation || null;
    if (patch.profile.subscriptionLabel !== undefined) {
      row.subscription_label = patch.profile.subscriptionLabel || null;
    }
    const { error } = await (supabase.from("advisory_workspace_profiles") as any).upsert(row, {
      onConflict: "user_id",
    });
    if (error) throw error;
  }

  if (patch.documentStatus) {
    for (const [documentId, status] of Object.entries(patch.documentStatus)) {
      const { error } = await (supabase.from("advisory_document_progress") as any).upsert(
        {
          user_id: userId,
          document_id: documentId,
          status,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,document_id" }
      );
      if (error) throw error;
    }
  }

  if (patch.documentNotes) {
    for (const [documentId, notes] of Object.entries(patch.documentNotes)) {
      const { data: existing } = await supabase
        .from("advisory_document_progress")
        .select("status, section_progress")
        .eq("user_id", userId)
        .eq("document_id", documentId)
        .maybeSingle();

      const status = (existing as { status?: AdvisoryDocumentStatus } | null)?.status ?? "not_started";
      const { error } = await (supabase.from("advisory_document_progress") as any).upsert(
        {
          user_id: userId,
          document_id: documentId,
          status,
          notes: notes?.trim() || null,
          section_progress: (existing as { section_progress?: Record<string, unknown> } | null)?.section_progress ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,document_id" }
      );
      if (error) throw error;
    }
  }

  if (patch.lessonActivity?.documentId?.trim()) {
    const documentId = patch.lessonActivity.documentId.trim();
    const { data: existing } = await supabase
      .from("advisory_document_progress")
      .select("status, section_progress")
      .eq("user_id", userId)
      .eq("document_id", documentId)
      .maybeSingle();

    const prevRow = existing as { status?: AdvisoryDocumentStatus; section_progress?: unknown } | null;
    const prevProgress = parseCourseLessonProgress(prevRow?.section_progress);
    const nextProgress = applyLessonActivity(prevProgress, {
      type: patch.lessonActivity.type,
      payload: patch.lessonActivity.payload,
    });

    let status = prevRow?.status ?? "not_started";
    if (
      status === "not_started" &&
      (patch.lessonActivity.type === "video_progress" ||
        patch.lessonActivity.type === "reading_progress")
    ) {
      status = "in_progress";
    }
    if (
      patch.lessonActivity.type === "video_complete" ||
      (nextProgress.video?.completed && patch.lessonActivity.type === "video_progress")
    ) {
      status = "complete";
    }

    const { error } = await (supabase.from("advisory_document_progress") as any).upsert(
      {
        user_id: userId,
        document_id: documentId,
        status,
        section_progress: nextProgress,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,document_id" }
    );
    if (error) throw error;
  }

  if (patch.milestone?.action === "create") {
    const { error } = await (supabase.from("advisory_milestones") as any).insert({
      user_id: userId,
      title: patch.milestone.title.trim(),
      due_at: patch.milestone.dueAt ?? null,
    });
    if (error) throw error;
  }

  if (patch.milestone?.action === "complete") {
    const { error } = await (supabase.from("advisory_milestones") as any)
      .update({
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("id", patch.milestone.id);
    if (error) throw error;
  }

  if (patch.milestone?.action === "delete") {
    const { error } = await (supabase.from("advisory_milestones") as any)
      .delete()
      .eq("user_id", userId)
      .eq("id", patch.milestone.id);
    if (error) throw error;
  }

  return loadAdvisoryWorkspace(userId);
}
