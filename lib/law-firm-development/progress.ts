import {
  ADVISORY_PHASE_DOC_TOTALS,
  ADVISORY_PHASES,
  ADVISORY_TOTAL_DOCUMENTS,
  getAdvisoryDocument,
  listAdvisoryDocuments,
  phaseDocumentTotal,
} from "@/lib/law-firm-development/catalog";
import type {
  AdvisoryDocument,
  AdvisoryDocumentStatus,
  AdvisoryPhase,
  AdvisoryProgressSnapshot,
} from "@/lib/law-firm-development/types";

/** All documents from the active course/programme tree (ZIP or static catalog). */
export function listDocumentsFromPhases(phases: AdvisoryPhase[]): AdvisoryDocument[] {
  const out: AdvisoryDocument[] = [];
  for (const phase of phases) {
    for (const cat of phase.categories) {
      out.push(...cat.documents);
    }
  }
  return out;
}

export function countCompleteAmong(
  documents: AdvisoryDocument[],
  statuses: Record<string, AdvisoryDocumentStatus>
): number {
  return documents.filter((d) => statuses[d.id] === "complete").length;
}

export function overallPercentForDocuments(
  documents: AdvisoryDocument[],
  statuses: Record<string, AdvisoryDocumentStatus>
): number {
  if (documents.length === 0) return computeOverallProgressPercent(statuses);
  const complete = countCompleteAmong(documents, statuses);
  return Math.min(100, Math.max(0, Math.round((complete / documents.length) * 100)));
}

export function phaseCompleteCountForPhase(
  phase: AdvisoryPhase,
  statuses: Record<string, AdvisoryDocumentStatus>
): number {
  const docs = phase.categories.flatMap((c) => c.documents);
  if (docs.length === 0) return phaseCompleteCount(phase.id, statuses);
  return countCompleteAmong(docs, statuses);
}

export function phaseProgressPercentForPhase(
  phase: AdvisoryPhase,
  statuses: Record<string, AdvisoryDocumentStatus>
): number {
  const docs = phase.categories.flatMap((c) => c.documents);
  if (docs.length === 0) return phaseProgressPercent(phase.id, statuses);
  return Math.round((countCompleteAmong(docs, statuses) / docs.length) * 100);
}

export function emptyAdvisoryProgress(): AdvisoryProgressSnapshot {
  return { documentStatus: {} };
}

export function computeOverallProgressPercent(
  statuses: Record<string, AdvisoryDocumentStatus>
): number {
  const complete = totalDocumentsComplete(statuses);
  const pct = Math.round((complete / ADVISORY_TOTAL_DOCUMENTS) * 100);
  return Math.min(100, Math.max(0, pct));
}

export function phaseProgressPercent(
  phaseId: string,
  statuses: Record<string, AdvisoryDocumentStatus>
): number {
  const total = phaseDocumentTotal(phaseId);
  if (total <= 0) return 0;
  const complete = phaseCompleteCount(phaseId, statuses);
  return Math.round((complete / total) * 100);
}

export function phaseCompleteCount(
  phaseId: string,
  statuses: Record<string, AdvisoryDocumentStatus>
): number {
  const catalogDocs = listAdvisoryDocuments().filter((d) => d.phaseId === phaseId);
  if (catalogDocs.length > 0) {
    return catalogDocs.filter((d) => statuses[d.id] === "complete").length;
  }
  return 0;
}

export function totalDocumentsComplete(
  statuses: Record<string, AdvisoryDocumentStatus>
): number {
  let sum = 0;
  for (const phaseId of Object.keys(ADVISORY_PHASE_DOC_TOTALS)) {
    sum += phaseCompleteCount(phaseId, statuses);
  }
  return sum;
}

export function statusLabel(status: AdvisoryDocumentStatus | undefined): string {
  switch (status) {
    case "complete":
      return "Complete";
    case "in_progress":
      return "In progress";
    default:
      return "Not started";
  }
}

/** Documents the user has started but not finished (for dashboard "continue" cards). */
export function listInProgressDocuments(
  statuses: Record<string, AdvisoryDocumentStatus>,
  limit = 3
): string[] {
  return listAdvisoryDocuments()
    .filter((d) => statuses[d.id] === "in_progress")
    .slice(0, limit)
    .map((d) => d.id);
}

/** First phase (by programme order) that still has incomplete catalog documents. */
export function activePhaseLabel(statuses: Record<string, AdvisoryDocumentStatus>): string {
  for (const phase of ADVISORY_PHASES) {
    const docs = listAdvisoryDocuments().filter((d) => d.phaseId === phase.id);
    if (docs.length === 0) continue;
    const hasOpen = docs.some((d) => statuses[d.id] !== "complete");
    if (hasOpen) {
      return phase.title.split(" ")[0] ?? `Phase ${phase.number}`;
    }
  }
  return "Complete";
}

export function nextMilestoneDueLabel(
  milestones: { completed?: boolean; dueLabel: string }[]
): string {
  const upcoming = milestones.find((m) => !m.completed);
  return upcoming?.dueLabel ?? "—";
}

export function programmeDaysLabel(programmeStartedAt: string | null | undefined): string {
  if (!programmeStartedAt) return "—";
  const start = new Date(programmeStartedAt);
  if (Number.isNaN(start.getTime())) return "—";
  const days = Math.max(0, Math.floor((Date.now() - start.getTime()) / 86400000));
  return `${days} day${days === 1 ? "" : "s"}`;
}

export function getDocumentStatus(
  statuses: Record<string, AdvisoryDocumentStatus>,
  docId: string
): AdvisoryDocumentStatus {
  return statuses[docId] ?? "not_started";
}

export function resolveDocumentHref(docId: string): string | null {
  const doc = getAdvisoryDocument(docId);
  if (!doc) return null;
  if (doc.kind === "tool" && doc.toolPath) {
    return `/advisory/tools/${doc.toolPath}`;
  }
  return `/advisory/documents/${docId}`;
}
