export const ADMIN_ROLE = "admin" as const;
export const LEGAL_ADMIN_ROLE = "legal_admin" as const;
export const USER_ROLE = "user" as const;

export const ADMIN_PANEL_ROLES = [ADMIN_ROLE, LEGAL_ADMIN_ROLE] as const;
export type AdminPanelRole = (typeof ADMIN_PANEL_ROLES)[number];

export const CLERK_USER_ROLES = [USER_ROLE, ADMIN_ROLE, LEGAL_ADMIN_ROLE] as const;
export type ClerkUserRole = (typeof CLERK_USER_ROLES)[number];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const LAWS_ADMIN_BLOCKED_PANEL_SEGMENTS = new Set([
  "rag-approval",
  "deleted",
  "categories",
  "link-by-title",
  "duplicates",
  "fix-ocr",
  "linked",
  "updated",
]);

const LEGAL_ADMIN_BLOCKED_LAW_API_SEGMENTS = new Set([
  "batch-delete",
  "deleted",
  "rag-approval",
  "duplicates",
  "export",
  "batch-update",
  "fix-ocr",
  "shared-links",
  "treaty-bulk",
  "title-link-candidates",
  "recent-updates",
]);

export function normalizeClerkRole(role: string | null | undefined): ClerkUserRole | null {
  if (role === ADMIN_ROLE || role === LEGAL_ADMIN_ROLE || role === USER_ROLE) return role;
  return null;
}

export function isAdminPanelRole(role: string | null | undefined): role is AdminPanelRole {
  return role === ADMIN_ROLE || role === LEGAL_ADMIN_ROLE;
}

export function isFullAdminRole(role: string | null | undefined): boolean {
  return role === ADMIN_ROLE;
}

export function isLegalAdminRole(role: string | null | undefined): boolean {
  return role === LEGAL_ADMIN_ROLE;
}

export function canDeleteLaws(role: AdminPanelRole): boolean {
  return role === ADMIN_ROLE;
}

export function canApproveRagLaws(role: AdminPanelRole): boolean {
  return role === ADMIN_ROLE;
}

export function canEditLaw(
  role: AdminPanelRole,
  userId: string,
  ingestedBy: string | null | undefined
): boolean {
  if (role === ADMIN_ROLE) return true;
  return Boolean(ingestedBy && ingestedBy === userId);
}

/** Legal admins may only open laws list, add law, and edit a law by UUID. */
export function isLegalAdminAllowedPanelPath(pathname: string): boolean {
  if (pathname === "/admin-panel/mfa") return true;
  if (pathname === "/admin-panel/laws") return true;
  if (pathname === "/admin-panel/laws/add") return true;
  if (!pathname.startsWith("/admin-panel/laws/")) return false;

  const segment = pathname.slice("/admin-panel/laws/".length).split("/")[0] ?? "";
  if (!segment || LAWS_ADMIN_BLOCKED_PANEL_SEGMENTS.has(segment)) return false;
  return UUID_RE.test(segment);
}

export function isLegalAdminAllowedApiPath(pathname: string, method: string): boolean {
  if (pathname === "/api/admin/session") return method === "GET";
  if (pathname === "/api/admin/mfa" || pathname.startsWith("/api/admin/mfa/")) return true;
  if (pathname === "/api/admin/categories") return method === "GET";

  if (!pathname.startsWith("/api/admin/laws")) return false;
  if (pathname === "/api/admin/laws") return true;

  const rest = pathname.slice("/api/admin/laws/".length);
  const segment = rest.split("/")[0] ?? "";
  if (LEGAL_ADMIN_BLOCKED_LAW_API_SEGMENTS.has(segment)) return false;

  if (segment && UUID_RE.test(segment)) {
    return method === "GET" || method === "PUT";
  }

  return true;
}
