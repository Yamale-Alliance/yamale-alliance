/** Max PDF size for admin law ingestion (browser or direct storage upload). */
export const ADMIN_LAW_PDF_MAX_MB = 95;

export const ADMIN_LAW_PDF_MAX_BYTES = ADMIN_LAW_PDF_MAX_MB * 1024 * 1024;

/**
 * PDFs larger than this bypass the Next.js API multipart body (Vercel ~4.5MB, proxy default 10MB)
 * and upload directly to Supabase Storage from the browser.
 */
export const ADMIN_LAW_DIRECT_UPLOAD_THRESHOLD_BYTES = 4 * 1024 * 1024;

export const ADMIN_LAW_IMPORT_BUCKET = "admin-law-imports";

export function isAdminLawPdfTooLarge(sizeBytes: number): boolean {
  return sizeBytes > ADMIN_LAW_PDF_MAX_BYTES;
}

export function shouldUseDirectLawPdfUpload(sizeBytes: number): boolean {
  return sizeBytes > ADMIN_LAW_DIRECT_UPLOAD_THRESHOLD_BYTES;
}
