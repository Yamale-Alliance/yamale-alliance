import { auth } from "@clerk/nextjs/server";
import { userHasAdminAccess } from "@/lib/admin-session";
import { LawyersPageClient } from "./LawyersPageClient";

export default async function LawyersPage() {
  const authState = await auth();
  const isAdmin = await userHasAdminAccess(authState);
  return <LawyersPageClient isAdmin={isAdmin} />;
}
