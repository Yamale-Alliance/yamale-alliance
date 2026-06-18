import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAdvisoryWorkspaceAccess } from "@/lib/law-firm-development/access-server";
import {
  ensureAdvisoryWorkspaceProfile,
  loadAdvisoryWorkspace,
  patchAdvisoryWorkspace,
} from "@/lib/advisory-workspace-server";
import type { AdvisoryDocumentStatus } from "@/lib/law-firm-development/types";

const VALID_STATUS = new Set<AdvisoryDocumentStatus>(["not_started", "in_progress", "complete"]);

/** GET: load advisory workspace state for the signed-in purchaser. */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const courseKey = request.nextUrl.searchParams.get("course");
    const access = await getAdvisoryWorkspaceAccess(courseKey);
    if (!access.hasPackage) {
      return NextResponse.json({ error: "Package required" }, { status: 403 });
    }

    await ensureAdvisoryWorkspaceProfile(userId);
    const workspace = await loadAdvisoryWorkspace(userId);
    return NextResponse.json(
      { workspace },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (err) {
    console.error("Advisory workspace GET error:", err);
    return NextResponse.json({ error: "Failed to load workspace" }, { status: 500 });
  }
}

/** PATCH: update profile, document status, notes, or milestones. */
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const courseKey = request.nextUrl.searchParams.get("course");
    const access = await getAdvisoryWorkspaceAccess(courseKey);
    if (!access.hasPackage) {
      return NextResponse.json({ error: "Package required" }, { status: 403 });
    }

    const body = (await request.json()) as Record<string, unknown>;

    let documentStatus: Record<string, AdvisoryDocumentStatus> | undefined;
    if (body.documentStatus && typeof body.documentStatus === "object") {
      documentStatus = {};
      for (const [id, value] of Object.entries(body.documentStatus as Record<string, string>)) {
        if (VALID_STATUS.has(value as AdvisoryDocumentStatus)) {
          documentStatus[id] = value as AdvisoryDocumentStatus;
        }
      }
    }

    const documentNotes =
      body.documentNotes && typeof body.documentNotes === "object"
        ? (body.documentNotes as Record<string, string | null>)
        : undefined;

    const profile =
      body.profile && typeof body.profile === "object"
        ? (body.profile as {
            firmName?: string;
            firmLocation?: string;
            subscriptionLabel?: string;
          })
        : undefined;

    const milestone =
      body.milestone && typeof body.milestone === "object"
        ? (body.milestone as {
            action: "create" | "complete" | "delete";
            title?: string;
            dueAt?: string | null;
            id?: string;
          })
        : undefined;

    if (milestone?.action === "create" && !milestone.title?.trim()) {
      return NextResponse.json({ error: "Milestone title required" }, { status: 400 });
    }
    if (
      (milestone?.action === "complete" || milestone?.action === "delete") &&
      !milestone.id
    ) {
      return NextResponse.json({ error: "Milestone id required" }, { status: 400 });
    }

    const workspace = await patchAdvisoryWorkspace(userId, {
      profile: profile
        ? {
            firmName: profile.firmName,
            firmLocation: profile.firmLocation,
            subscriptionLabel: profile.subscriptionLabel,
          }
        : undefined,
      documentStatus,
      documentNotes,
      milestone: milestone
        ? milestone.action === "create"
          ? {
              action: "create",
              title: milestone.title!.trim(),
              dueAt: milestone.dueAt ?? null,
            }
          : milestone.action === "complete"
            ? { action: "complete", id: milestone.id! }
            : { action: "delete", id: milestone.id! }
        : undefined,
    });

    return NextResponse.json({ workspace });
  } catch (err) {
    console.error("Advisory workspace PATCH error:", err);
    return NextResponse.json({ error: "Failed to save workspace" }, { status: 500 });
  }
}
