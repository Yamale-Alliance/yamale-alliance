import "server-only";

import type { auth } from "@clerk/nextjs/server";
import { userHasAdminAccess } from "@/lib/admin-session";

type SessionAuthObject = Awaited<ReturnType<typeof auth>>;

/** Treat course packages as purchased for admins (preview before/at go-live). */
export async function marketplaceCourseAccessGranted(
  authState: SessionAuthObject,
  options: { purchased: boolean; isCourse: boolean }
): Promise<boolean> {
  if (options.purchased) return true;
  if (!options.isCourse || !authState.userId) return false;
  return userHasAdminAccess(authState);
}
