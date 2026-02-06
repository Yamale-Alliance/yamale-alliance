import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { requireAdmin } from "@/lib/admin";

export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    const clerk = await clerkClient();
    const { data: users } = await clerk.users.getUserList({ limit: 200 });
    const list = (users ?? []).map((u) => ({
      id: u.id,
      email: u.emailAddresses[0]?.emailAddress ?? null,
      firstName: u.firstName,
      lastName: u.lastName,
      tier: (u.publicMetadata?.tier as string) ?? (u.publicMetadata?.subscriptionTier as string) ?? "free",
      role: (u.publicMetadata?.role as string) ?? null,
    }));
    return NextResponse.json(list);
  } catch (err) {
    console.error("Admin users GET error:", err);
    return NextResponse.json(
      { error: "Failed to list users" },
      { status: 500 }
    );
  }
}
