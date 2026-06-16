/** Whether Sentry should load (instrumentation, build plugin, tagged captures). */
export function isSentryEnabled(): boolean {
  const dsn =
    process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || process.env.SENTRY_DSN?.trim();
  if (!dsn) return false;
  if (
    process.env.NODE_ENV === "development" &&
    process.env.SENTRY_ENABLE_IN_DEV !== "true"
  ) {
    return false;
  }
  return true;
}
