/** True when Sentry DSN is configured (skip heavy edge bundle in local dev without DSN). */
function sentryEnabled(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || process.env.SENTRY_DSN?.trim()
  );
}

export async function register() {
  if (!sentryEnabled()) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export async function onRequestError(
  ...args: Parameters<
    typeof import("@sentry/nextjs").captureRequestError
  >
): Promise<void> {
  if (!sentryEnabled()) {
    console.error(args[0]);
    return;
  }
  const Sentry = await import("@sentry/nextjs");
  return Sentry.captureRequestError(...args);
}
