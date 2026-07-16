import { getSupabaseServer } from "@/lib/supabase/server";
import { extractTextFromPdf } from "@/lib/pdf-extract";
import { scanFile } from "@/lib/uploads/scanner";
import {
  deleteAdminLawPdfImport,
  downloadAdminLawPdfBuffer,
  isAllowedAdminLawImportPath,
} from "@/lib/admin-law-pdf-import";

export type ExtractLawPdfOptions = {
  file: File | null;
  pdfStoragePath: string | null;
  adminUserId: string;
  forceOcr: boolean;
};

/**
 * Extract text from an uploaded law PDF (direct file or a Supabase storage path).
 * Malware-scans the buffer, runs extraction/OCR, and cleans up any temp storage import.
 * Throws with a `MISSING_PDF`, `MALWARE`, or "File must be a PDF" message for the caller to map.
 */
export async function extractLawTextFromPdfUpload(
  options: ExtractLawPdfOptions
): Promise<string> {
  const { file, pdfStoragePath, adminUserId, forceOcr } = options;
  const supabase = getSupabaseServer();
  let buffer: Buffer;
  let filename: string;
  let cleanupPath: string | null = null;

  if (pdfStoragePath) {
    if (!isAllowedAdminLawImportPath(pdfStoragePath, adminUserId)) {
      throw new Error("Invalid uploaded PDF path");
    }
    buffer = await downloadAdminLawPdfBuffer(supabase, pdfStoragePath);
    filename = pdfStoragePath.split("/").pop() ?? "upload.pdf";
    cleanupPath = pdfStoragePath;
  } else if (file && file.size > 0) {
    if (file.type !== "application/pdf") {
      throw new Error("File must be a PDF");
    }
    buffer = Buffer.from(await file.arrayBuffer());
    filename = file.name || "upload.pdf";
  } else {
    throw new Error("MISSING_PDF");
  }

  const scan = await scanFile(buffer, filename);
  if (!scan.clean) {
    console.error("Admin law PDF upload rejected by VirusTotal:", {
      filename,
      detections: scan.detections,
    });
    throw new Error("MALWARE");
  }

  try {
    const text = await extractTextFromPdf(buffer, { forceOcr });
    if (cleanupPath) {
      await deleteAdminLawPdfImport(supabase, cleanupPath).catch((err) => {
        console.warn("Admin laws: failed to delete temp PDF import:", err);
      });
    }
    return text;
  } catch (e) {
    if (cleanupPath) {
      await deleteAdminLawPdfImport(supabase, cleanupPath).catch(() => {});
    }
    throw e;
  }
}
