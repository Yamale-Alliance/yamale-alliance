import { NextRequest, NextResponse } from "next/server";
import { requireLawsAccess } from "@/lib/admin";
import { extractLawTextFromPdfUpload } from "@/lib/admin-law-pdf-extract";
import {
  sanitizeLawContent,
  hasUsableLawContent,
  EMPTY_PDF_EXTRACT_MESSAGE,
} from "@/lib/admin-law-utils";

// Allow up to 5 minutes for PDF extraction and OCR (large or scanned PDFs)
export const maxDuration = 300;

/**
 * Extract text from an uploaded law PDF and return it WITHOUT saving.
 * Used by the law edit page so an admin can replace the body from a PDF,
 * review it, and then persist via the normal Save (PUT) flow.
 */
export async function POST(request: NextRequest) {
  const admin = await requireLawsAccess();
  if (admin instanceof NextResponse) return admin;

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Expected multipart/form-data body with a PDF file or storage path." },
      { status: 400 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (parseErr) {
    console.error("Admin laws extract-pdf: formData parse failed:", parseErr);
    return NextResponse.json(
      {
        error:
          "Could not read the upload (often the PDF is too large for the server limit, or the connection was cut). Try a smaller PDF or upload it directly.",
      },
      { status: 413 }
    );
  }

  const file = formData.get("file") as File | null;
  const pdfStoragePath = (formData.get("pdfStoragePath") as string | null)?.trim() || "";
  const forceOcr = formData.get("forceOcr") === "true";

  if (!(file && file.size > 0) && !pdfStoragePath) {
    return NextResponse.json({ error: "Provide a PDF file to extract." }, { status: 400 });
  }

  let text: string;
  try {
    text = await extractLawTextFromPdfUpload({
      file,
      pdfStoragePath: pdfStoragePath || null,
      adminUserId: admin.userId,
      forceOcr,
    });
  } catch (e) {
    const err = e as Error;
    if (err.message === "MISSING_PDF") {
      return NextResponse.json({ error: "Provide a PDF file to extract." }, { status: 400 });
    }
    if (err.message === "MALWARE") {
      return NextResponse.json(
        { error: "File failed malware scan and was rejected." },
        { status: 422 }
      );
    }
    if (err.message === "File must be a PDF") {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: `PDF extraction failed: ${err.message}` },
      { status: 400 }
    );
  }

  const contentTrimmed = sanitizeLawContent(text) || null;
  if (!hasUsableLawContent(contentTrimmed)) {
    return NextResponse.json({ error: EMPTY_PDF_EXTRACT_MESSAGE }, { status: 400 });
  }

  return NextResponse.json({ ok: true, text: contentTrimmed, characters: contentTrimmed.length });
}
