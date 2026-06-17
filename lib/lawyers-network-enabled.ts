import { NextResponse } from "next/server";

/** Turn on public lawyer search, unlock checkout, and directory listing. */
export function isLawyersNetworkLive(): boolean {
  return process.env.NEXT_PUBLIC_LAWYERS_NETWORK_ENABLED === "1";
}

/** Client-side: search + unlock when live, or when signed-in user is admin (preview). */
export function isLawyersNetworkSearchEnabled(options?: { isAdmin?: boolean }): boolean {
  return isLawyersNetworkLive() || Boolean(options?.isAdmin);
}

export function lawyersNetworkApiDisabledResponse(): NextResponse {
  return NextResponse.json(
    {
      error:
        "The lawyers network is coming soon. We are building an invitation-only directory of vetted African legal professionals.",
      code: "lawyers_network_coming_soon",
    },
    { status: 503 }
  );
}
