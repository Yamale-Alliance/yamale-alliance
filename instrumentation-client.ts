import { isSentryEnabled } from "@/lib/sentry-enabled";

if (isSentryEnabled()) {
  void import("./sentry-client.config");
}

export function onRouterTransitionStart(href: string, navigationType: string) {
  if (!isSentryEnabled()) return;
  void import("@sentry/nextjs").then((Sentry) => {
    Sentry.captureRouterTransitionStart(href, navigationType);
  });
}
