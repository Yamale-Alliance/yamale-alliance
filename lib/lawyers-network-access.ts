import "server-only";

/** Server routes: lawyer search and unlock checkout are publicly available. */
export async function isLawyersNetworkAccessible(): Promise<boolean> {
  return true;
}
