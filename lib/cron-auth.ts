import { NextRequest, NextResponse } from "next/server";

/** Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set in the project. */
export function verifyCronRequest(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }
  const header = request.headers.get("authorization")?.trim() ?? "";
  return header === `Bearer ${secret}`;
}

export function unauthorizedCronResponse(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
