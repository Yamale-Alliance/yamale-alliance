"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAdvisoryCatalogContext } from "@/components/law-firm-development/AdvisoryCatalogContext";
import {
  computeOverallProgressPercent,
  countCompleteAmong,
  emptyAdvisoryProgress,
  overallPercentForDocuments,
  totalDocumentsComplete,
} from "@/lib/law-firm-development/progress";
import type {
  AdvisoryDocumentStatus,
  AdvisoryMilestone,
  AdvisoryProgressSnapshot,
} from "@/lib/law-firm-development/types";
import type { CourseLessonProgress } from "@/lib/course-platform";

type WorkspaceResponse = AdvisoryProgressSnapshot & {
  milestones: AdvisoryMilestone[];
  programmeStartedAt: string | null;
  lessonProgress?: Record<string, CourseLessonProgress>;
};

export function useAdvisoryProgress() {
  const { listDocuments, courseQuery } = useAdvisoryCatalogContext();
  const searchParams = useSearchParams();
  const courseKey = courseQuery ?? searchParams.get("course")?.trim() ?? null;
  const [snapshot, setSnapshot] = useState<WorkspaceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = courseKey ? `?course=${encodeURIComponent(courseKey)}` : "";
      const res = await fetch(`/api/advisory/workspace${qs}`, { credentials: "include" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to load workspace");
      }
      const data = (await res.json()) as { workspace: WorkspaceResponse };
      setSnapshot(data.workspace);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load workspace");
      setSnapshot({
        ...emptyAdvisoryProgress(),
        milestones: [],
        programmeStartedAt: null,
      });
    } finally {
      setLoading(false);
    }
  }, [courseKey]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const patch = useCallback(
    async (body: Record<string, unknown>) => {
      setSaving(true);
      setError(null);
      try {
        const qs = courseKey ? `?course=${encodeURIComponent(courseKey)}` : "";
        const res = await fetch(`/api/advisory/workspace${qs}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? "Failed to save");
        }
        const data = (await res.json()) as { workspace: WorkspaceResponse };
        setSnapshot(data.workspace);
        return data.workspace;
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to save";
        setError(message);
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [courseKey]
  );

  const setDocumentStatus = useCallback(
    async (docId: string, status: AdvisoryDocumentStatus) => {
      const prev = snapshot ?? {
        ...emptyAdvisoryProgress(),
        milestones: [],
        programmeStartedAt: null,
      };
      setSnapshot({
        ...prev,
        documentStatus: { ...prev.documentStatus, [docId]: status },
      });
      await patch({ documentStatus: { [docId]: status } });
    },
    [patch, snapshot]
  );

  const setDocumentNotes = useCallback(
    async (docId: string, notes: string) => {
      await patch({ documentNotes: { [docId]: notes } });
    },
    [patch]
  );

  const reportLessonActivity = useCallback(
    async (
      docId: string,
      activity: {
        type: "video_progress" | "video_complete" | "reading_progress" | "quiz_submit" | "checklist_toggle";
        payload?: Record<string, unknown>;
      }
    ) => {
      await patch({
        lessonActivity: {
          documentId: docId,
          type: activity.type,
          payload: activity.payload,
        },
      });
    },
    [patch]
  );

  const updateProfile = useCallback(
    async (profile: {
      firmName?: string;
      firmLocation?: string;
      subscriptionLabel?: string;
    }) => {
      await patch({ profile });
    },
    [patch]
  );

  const createMilestone = useCallback(
    async (title: string, dueAt?: string | null) => {
      await patch({ milestone: { action: "create", title, dueAt: dueAt ?? null } });
    },
    [patch]
  );

  const completeMilestone = useCallback(
    async (id: string) => {
      await patch({ milestone: { action: "complete", id } });
    },
    [patch]
  );

  const statuses = snapshot?.documentStatus ?? {};
  const milestones = snapshot?.milestones ?? [];
  const catalogDocs = listDocuments();
  const documentsComplete =
    catalogDocs.length > 0
      ? countCompleteAmong(catalogDocs, statuses)
      : totalDocumentsComplete(statuses);
  const overallPercent =
    catalogDocs.length > 0
      ? overallPercentForDocuments(catalogDocs, statuses)
      : computeOverallProgressPercent(statuses);

  return {
    snapshot,
    milestones,
    programmeStartedAt: snapshot?.programmeStartedAt ?? null,
    loading,
    saving,
    error,
    ready: !loading && snapshot !== null,
    statuses,
    overallPercent,
    documentsComplete,
    setDocumentStatus,
    setDocumentNotes,
    reportLessonActivity,
    updateProfile,
    createMilestone,
    completeMilestone,
    reload,
  };
}
