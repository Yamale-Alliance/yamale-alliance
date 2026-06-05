/** Client + server: allow advisory workspace UI without a purchase (dev/staging only). */
export function isAdvisoryWorkspacePreviewEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_ADVISORY_WORKSPACE_PREVIEW === "1" ||
    process.env.ADVISORY_WORKSPACE_PREVIEW === "1"
  );
}

/** Show Vault “View course” and package owned CTAs when purchased or preview is on. */
export function canUseLawFirmAdvisoryWorkspace(
  owned?: boolean,
  previewEnabled?: boolean
): boolean {
  return Boolean(owned) || Boolean(previewEnabled) || isAdvisoryWorkspacePreviewEnabled();
}
