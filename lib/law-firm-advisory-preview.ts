/** Client + server: allow advisory workspace UI without a purchase (dev/staging only). */
export function isAdvisoryWorkspacePreviewEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_ADVISORY_WORKSPACE_PREVIEW === "1" ||
    process.env.ADVISORY_WORKSPACE_PREVIEW === "1"
  );
}

/** Show Vault “View course” and package owned CTAs when purchased, preview is on, or admin on a course package. */
export function canUseLawFirmAdvisoryWorkspace(
  owned?: boolean,
  previewEnabled?: boolean,
  options?: { isAdmin?: boolean; isCourse?: boolean }
): boolean {
  if (Boolean(owned) || Boolean(previewEnabled) || isAdvisoryWorkspacePreviewEnabled()) {
    return true;
  }
  return Boolean(options?.isAdmin && options?.isCourse);
}
