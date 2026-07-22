import { getSupabaseServer } from "@/lib/supabase/server";
import { extractTextFromPdf } from "@/lib/pdf-extract";
import {
  deleteAdminLawPdfImport,
  downloadAdminLawPdfBuffer,
  isAllowedAdminLawImportPath,
} from "@/lib/admin-law-pdf-import";

export type ExtractLawPdfPhase =
  | { phase: "downloading" }
  | { phase: "extracting" }
  | {
      phase: "cloud_ocr";
      pageNumber: number;
      totalPages: number;
      pagesProcessed: number;
    };

export type ExtractLawPdfOptions = {
  file: File | null;
  pdfStoragePath: string | null;
  adminUserId: string;
  forceOcr: boolean;
  onPhase?: (update: ExtractLawPdfPhase) => void | Promise<void>;
};

/**
 * Extract text from an uploaded law PDF (direct file or a Supabase storage path).
 * Runs extraction/OCR and cleans up any temp storage import.
 * VirusTotal malware scanning is disabled for law PDFs (too slow on large files).
 * Throws with a `MISSING_PDF` or "File must be a PDF" message for the caller to map.
 */
export async function extractLawTextFromPdfUpload(
  options: ExtractLawPdfOptions
): Promise<string> {
  const { file, pdfStoragePath, adminUserId, forceOcr, onPhase } = options;
  const supabase = getSupabaseServer();
  let buffer: Buffer;
  let cleanupPath: string | null = null;

  if (pdfStoragePath) {
    if (!isAllowedAdminLawImportPath(pdfStoragePath, adminUserId)) {
      throw new Error("Invalid uploaded PDF path");
    }
    await onPhase?.({ phase: "downloading" });
    buffer = await downloadAdminLawPdfBuffer(supabase, pdfStoragePath);
    cleanupPath = pdfStoragePath;
  } else if (file && file.size > 0) {
    if (file.type !== "application/pdf") {
      throw new Error("File must be a PDF");
    }
    buffer = Buffer.from(await file.arrayBuffer());
  } else {
    throw new Error("MISSING_PDF");
  }

  try {
    await onPhase?.({ phase: "extracting" });
    const text = await extractTextFromPdf(buffer, {
      forceOcr,
      onCloudOcrProgress: async (progress) => {
        await onPhase?.({
          phase: "cloud_ocr",
          pageNumber: progress.pageNumber,
          totalPages: progress.totalPages,
          pagesProcessed: progress.pagesProcessed,
        });
      },
    });
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
