"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ADVISORY_PHASES } from "@/lib/law-firm-development/catalog";
import type { AdvisoryPhase } from "@/lib/law-firm-development/types";

type CatalogState = {
  phases: AdvisoryPhase[];
  courseId: string | null;
  courseTitle: string | null;
  totalDocuments: number;
  loading: boolean;
  error: string | null;
};

export function useAdvisoryCatalog(): CatalogState {
  const searchParams = useSearchParams();
  const courseKey = searchParams.get("course")?.trim() || null;

  const [state, setState] = useState<CatalogState>({
    phases: ADVISORY_PHASES,
    courseId: null,
    courseTitle: null,
    totalDocuments: 124,
    loading: Boolean(courseKey),
    error: null,
  });

  useEffect(() => {
    if (!courseKey) {
      setState({
        phases: ADVISORY_PHASES,
        courseId: null,
        courseTitle: null,
        totalDocuments: 124,
        loading: false,
        error: null,
      });
      return;
    }

    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));

    fetch(`/api/advisory/courses/${encodeURIComponent(courseKey)}/catalog`, {
      credentials: "include",
    })
      .then(async (r) => {
        const data = (await r.json()) as {
          phases?: AdvisoryPhase[];
          totalDocuments?: number;
          course?: { id: string; title: string };
          error?: string;
        };
        if (!r.ok) throw new Error(data.error ?? "Failed to load course");
        if (cancelled) return;
        setState({
          phases: data.phases ?? ADVISORY_PHASES,
          courseId: data.course?.id ?? null,
          courseTitle: data.course?.title ?? null,
          totalDocuments: data.totalDocuments ?? 0,
          loading: false,
          error: null,
        });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setState({
          phases: ADVISORY_PHASES,
          courseId: null,
          courseTitle: null,
          totalDocuments: 124,
          loading: false,
          error: e instanceof Error ? e.message : "Failed to load course",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [courseKey]);

  return state;
}
