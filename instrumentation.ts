import { isSentryEnabled } from "@/lib/sentry-enabled";

export async function register() {
  if (!isSentryEnabled()) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export async function onRequestError(
  error: unknown,
  request: {
    path: string;
    method: string;
    headers: { [key: string]: string | string[] | undefined };
  },
  context: {
    routerKind: "Pages Router" | "App Router";
    routePath: string;
    routeType: "render" | "route" | "action" | "proxy";
  }
): Promise<void> {
  if (!isSentryEnabled()) {
    console.error(error);
    return;
  }
  const Sentry = await import("@sentry/nextjs");
  return Sentry.captureRequestError(error, request, context);
}
