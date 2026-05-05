import { NextResponse } from "next/server";

/** Enable support tickets + Resend emails after you have a verified sending domain. */
export function isSupportCenterLive(): boolean {
  return process.env.NEXT_PUBLIC_SUPPORT_CENTER_ENABLED === "1";
}

export function supportApiDisabledResponse(): NextResponse {
  return NextResponse.json(
    {
      error: "Support centre is coming soon. We’re waiting on transactional email (verified domain).",
      code: "support_coming_soon",
    },
    { status: 503 }
  );
}
