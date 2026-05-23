import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV || "development",
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
  sendDefaultPii: false,
});

/** Dev-only: run `window.__yamaleSentryTest()` in the browser console (not `import('@sentry/nextjs')`). */
if (process.env.NODE_ENV === "development" && typeof window !== "undefined" && dsn) {
  (window as Window & { __yamaleSentryTest?: () => Promise<boolean> }).__yamaleSentryTest =
    async () => {
      Sentry.captureException(new Error("Yamale Sentry client test"));
      return Sentry.flush(2000);
    };
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
