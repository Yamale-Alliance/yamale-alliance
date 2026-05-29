/** Client-safe Clerk publishable key (inlined at build time). */
export const CLERK_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ?? "";

export function isClerkConfigured(): boolean {
  return CLERK_PUBLISHABLE_KEY.length > 0;
}

export function isProductionClerkKey(): boolean {
  return CLERK_PUBLISHABLE_KEY.startsWith("pk_live_");
}
