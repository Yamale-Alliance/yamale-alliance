import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { captureMonitoredException } from "@/lib/monitoring";

/**
 * Dev-only: verify Sentry DSN and server capture. GET /api/sentry-test while signed in locally.
 * Disabled in production. Remove or keep — no sensitive data sent.
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const dsnConfigured = Boolean(
    process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || process.env.SENTRY_DSN?.trim()
  );

  if (!dsnConfigured) {
    return NextResponse.json(
      {
        ok: false,
        error: "NEXT_PUBLIC_SENTRY_DSN is not set. Add it to .env and restart npm run dev.",
      },
      { status: 503 }
    );
  }

  const err = new Error("Yamale Sentry server test");
  captureMonitoredException(err, {
    area: "api",
    operation: "manual_test",
    tags: { source: "sentry-test-route" },
  });
  await Sentry.flush(2_000);

  return NextResponse.json({
    ok: true,
    message: "Sent test exception to Sentry (server). Check Issues in ~30s; filter environment: development.",
    tags: { area: "api", operation: "manual_test" },
  });
}
