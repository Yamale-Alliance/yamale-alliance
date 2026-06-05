export const ADVISORY_BASE = "/advisory";

export function withAdvisoryCourseQuery(href: string, courseQuery?: string | null): string {
  if (!courseQuery?.trim()) return href;
  const sep = href.includes("?") ? "&" : "?";
  return `${href}${sep}course=${encodeURIComponent(courseQuery.trim())}`;
}

export function advisoryDashboardHref(courseQuery?: string | null): string {
  return withAdvisoryCourseQuery(ADVISORY_BASE, courseQuery);
}

export function advisoryProgressHref(courseQuery?: string | null): string {
  return withAdvisoryCourseQuery(`${ADVISORY_BASE}/progress`, courseQuery);
}

export function advisoryToolsHref(courseQuery?: string | null): string {
  return withAdvisoryCourseQuery(`${ADVISORY_BASE}/tools`, courseQuery);
}

export function advisoryLibraryHref(courseQuery?: string | null): string {
  return withAdvisoryCourseQuery(`${ADVISORY_BASE}/library`, courseQuery);
}

export function advisoryProgrammeHref(courseQuery?: string | null): string {
  return withAdvisoryCourseQuery(`${ADVISORY_BASE}/programme`, courseQuery);
}

export function advisoryPhaseHref(phaseSlug: string, courseQuery?: string | null): string {
  return withAdvisoryCourseQuery(`${ADVISORY_BASE}/programme/${phaseSlug}`, courseQuery);
}

export function advisoryDocumentHref(docId: string, courseQuery?: string | null): string {
  return withAdvisoryCourseQuery(
    `${ADVISORY_BASE}/documents/${encodeURIComponent(docId)}`,
    courseQuery
  );
}

export function advisoryToolHref(toolSlug: string, courseQuery?: string | null): string {
  return withAdvisoryCourseQuery(`${ADVISORY_BASE}/tools/${toolSlug}`, courseQuery);
}
