import { auth } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const ROLE_COOKIE = "signup_intent";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  const { searchParams } = new URL(request.url);
  const roleParam = searchParams.get("role");
  const role =
    roleParam === "user" || roleParam === "lawyer" ? roleParam : null;

  const cookieStore = await cookies();
  const signupIntent = cookieStore.get(ROLE_COOKIE)?.value;

  // Validate role from query matches cookie (prevents tampering)
  if (
    !role ||
    !signupIntent ||
    signupIntent !== role ||
    !["user", "lawyer"].includes(signupIntent)
  ) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  try {
    const metadata =
      role === "lawyer"
        ? { role: "lawyer", status: "pending" }
        : { role: "user" };

    const clerk = await clerkClient();
    await clerk.users.updateUserMetadata(userId, {
      publicMetadata: metadata,
    });

    cookieStore.delete(ROLE_COOKIE);

    if (role === "lawyer") {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.redirect(new URL("/", request.url));
  } catch (error) {
    console.error("Complete signup error:", error);
    return NextResponse.redirect(new URL("/", request.url));
  }
}
