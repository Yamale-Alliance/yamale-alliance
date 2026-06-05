import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/** Require a signed-in user for legal library API routes. */
export async function requireLibraryApiSession(): Promise<
  { userId: string } | NextResponse<{ error: string }>
> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "Sign in to access the legal library." },
      { status: 401 }
    );
  }
  return { userId };
}
