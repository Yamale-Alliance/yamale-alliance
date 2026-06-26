import { NextRequest, NextResponse } from "next/server";
import {
  deleteLawyerDirectoryDocuments,
  readJoinFormFile,
  saveLawyerDirectoryDocumentRow,
  uploadLawyerDirectoryDocument,
  uploadLawyerJoinProfilePhoto,
} from "@/lib/lawyer-directory-documents";
import {
  lawyerJoinRowFromPayload,
  OPTIONAL_LAWYER_JOIN_DOCS,
  parseLawyerJoinFormData,
  REQUIRED_LAWYER_JOIN_DOCS,
  type LawyerJoinDocumentType,
} from "@/lib/lawyer-join";
import {
  isLawyersNetworkLive,
  lawyersNetworkApiDisabledResponse,
} from "@/lib/lawyers-network-enabled";
import { getSupabaseServer } from "@/lib/supabase/server";

/** POST: public lawyer directory application (multipart). Pending admin approval. */
export async function POST(request: NextRequest) {
  if (!isLawyersNetworkLive()) {
    return lawyersNetworkApiDisabledResponse();
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const { payload, error: parseError } = parseLawyerJoinFormData(formData);
  if (!payload || parseError) {
    return NextResponse.json({ error: parseError ?? "Invalid submission" }, { status: 400 });
  }

  for (const docType of REQUIRED_LAWYER_JOIN_DOCS) {
    if (!readJoinFormFile(formData, docType)) {
      return NextResponse.json(
        { error: `Required document missing: ${docType.replace(/_/g, " ")}` },
        { status: 400 }
      );
    }
  }

  const supabase = getSupabaseServer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  let lawyerId: string | null = null;

  try {
    const row = lawyerJoinRowFromPayload(payload);
    const { data, error } = await db.from("lawyers").insert(row).select("id").single();
    if (error || !data?.id) {
      console.error("Lawyer join insert error:", error);
      return NextResponse.json({ error: "Failed to submit application" }, { status: 500 });
    }
    lawyerId = data.id as string;

    const docTypes: LawyerJoinDocumentType[] = [
      ...REQUIRED_LAWYER_JOIN_DOCS,
      ...OPTIONAL_LAWYER_JOIN_DOCS,
    ];

    for (const docType of docTypes) {
      const file = readJoinFormFile(formData, docType);
      if (!file) continue;

      if (docType === "profile_photo") {
        const imageUrl = await uploadLawyerJoinProfilePhoto(lawyerId, file);
        await db.from("lawyers").update({ image_url: imageUrl }).eq("id", lawyerId);
        const stored = await uploadLawyerDirectoryDocument(lawyerId, docType, file);
        await saveLawyerDirectoryDocumentRow(
          lawyerId,
          docType,
          stored.storagePath,
          stored.fileName,
          stored.contentType
        );
        continue;
      }

      const stored = await uploadLawyerDirectoryDocument(lawyerId, docType, file);
      await saveLawyerDirectoryDocumentRow(
        lawyerId,
        docType,
        stored.storagePath,
        stored.fileName,
        stored.contentType
      );
    }

    return NextResponse.json({ ok: true, id: lawyerId });
  } catch (err) {
    console.error("Lawyer join POST error:", err);
    if (lawyerId) {
      try {
        await deleteLawyerDirectoryDocuments(lawyerId);
        await db.from("lawyers").delete().eq("id", lawyerId);
      } catch (cleanupErr) {
        console.error("Lawyer join cleanup error:", cleanupErr);
      }
    }
    const message = err instanceof Error ? err.message : "Failed to submit application";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
