"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useAdvisoryCatalog } from "@/hooks/useAdvisoryCatalog";
import type { AdvisoryDocument, AdvisoryPhase } from "@/lib/law-firm-development/types";
import { ADVISORY_PHASE_DOC_TOTALS } from "@/lib/law-firm-development/catalog";

type AdvisoryCatalogContextValue = {
  phases: AdvisoryPhase[];
  courseId: string | null;
  courseTitle: string | null;
  totalDocuments: number;
  loading: boolean;
  error: string | null;
  courseQuery: string | null;
  getPhase: (slug: string) => AdvisoryPhase | undefined;
  getPhaseById: (phaseId: string) => AdvisoryPhase | undefined;
  listDocuments: () => AdvisoryDocument[];
  getDocument: (docId: string) => AdvisoryDocument | undefined;
  getCategory: (categoryId: string) => import("@/lib/law-firm-development/types").AdvisoryCategory | undefined;
  phaseDocumentTotal: (phaseId: string) => number;
};

const AdvisoryCatalogContext = createContext<AdvisoryCatalogContextValue | null>(null);

export function AdvisoryCatalogProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const courseQuery = searchParams.get("course")?.trim() || null;
  const catalog = useAdvisoryCatalog();

  const value = useMemo<AdvisoryCatalogContextValue>(() => {
    const listDocuments = (): AdvisoryDocument[] => {
      const out: AdvisoryDocument[] = [];
      for (const phase of catalog.phases) {
        for (const cat of phase.categories) {
          out.push(...cat.documents);
        }
      }
      return out;
    };

    return {
      phases: catalog.phases,
      courseId: catalog.courseId,
      courseTitle: catalog.courseTitle,
      totalDocuments: catalog.totalDocuments,
      loading: catalog.loading,
      error: catalog.error,
      courseQuery,
      getPhase: (slug: string) => catalog.phases.find((p) => p.slug === slug),
      getPhaseById: (phaseId: string) => catalog.phases.find((p) => p.id === phaseId),
      listDocuments,
      getDocument: (docId: string) => listDocuments().find((d) => d.id === docId),
      getCategory: (categoryId: string) => {
        for (const phase of catalog.phases) {
          const cat = phase.categories.find((c) => c.id === categoryId);
          if (cat) return cat;
        }
        return undefined;
      },
      phaseDocumentTotal: (phaseId: string) => {
        const phase = catalog.phases.find((p) => p.id === phaseId);
        if (!phase) return ADVISORY_PHASE_DOC_TOTALS[phaseId] ?? 0;
        const inCatalog = phase.categories.reduce((n, c) => n + c.documents.length, 0);
        return inCatalog > 0 ? inCatalog : (ADVISORY_PHASE_DOC_TOTALS[phaseId] ?? 0);
      },
    };
  }, [catalog, courseQuery]);

  return (
    <AdvisoryCatalogContext.Provider value={value}>{children}</AdvisoryCatalogContext.Provider>
  );
}

export function useAdvisoryCatalogContext(): AdvisoryCatalogContextValue {
  const ctx = useContext(AdvisoryCatalogContext);
  if (!ctx) {
    throw new Error("useAdvisoryCatalogContext must be used within AdvisoryCatalogProvider");
  }
  return ctx;
}
