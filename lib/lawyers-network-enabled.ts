import { NextResponse } from "next/server";

/** Lawyer directory search and paid unlock are publicly available. */
export function isLawyersNetworkLive(): boolean {
  return true;
}

/** Client-side search + unlock (always on). */
export function isLawyersNetworkSearchEnabled(_options?: { isAdmin?: boolean }): boolean {
  return true;
}

export function lawyersNetworkApiDisabledResponse(): NextResponse {
  return NextResponse.json(
    {
      error: "The lawyers network is temporarily unavailable. Please try again shortly.",
      code: "lawyers_network_unavailable",
    },
    { status: 503 }
  );
}
