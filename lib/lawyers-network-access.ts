import "server-only";

import { auth } from "@clerk/nextjs/server";
import { userHasAdminAccess } from "@/lib/admin-session";
import { isLawyersNetworkLive } from "@/lib/lawyers-network-enabled";

/** Server routes: allow when live or caller is admin (preview before go-live). */
export async function isLawyersNetworkAccessible(): Promise<boolean> {
  if (isLawyersNetworkLive()) return true;
  const authState = await auth();
  return userHasAdminAccess(authState);
}
