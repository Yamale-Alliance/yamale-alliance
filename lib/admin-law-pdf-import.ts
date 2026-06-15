import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ADMIN_LAW_IMPORT_BUCKET,
  ADMIN_LAW_PDF_MAX_BYTES,
} from "@/lib/admin-law-upload-limits";

const IMPORT_PREFIX = "imports";

export function buildAdminLawImportPath(adminUserId: string, filename: string): string {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "upload.pdf";
  const suffix = safeName.toLowerCase().endsWith(".pdf") ? safeName : `${safeName}.pdf`;
  return `${IMPORT_PREFIX}/${adminUserId}/${randomUUID()}-${suffix}`;
}

export function isAllowedAdminLawImportPath(path: string, adminUserId: string): boolean {
  const expectedPrefix = `${IMPORT_PREFIX}/${adminUserId}/`;
  return path.startsWith(expectedPrefix) && !path.includes("..") && path.toLowerCase().endsWith(".pdf");
}

export async function ensureAdminLawImportBucket(supabase: SupabaseClient): Promise<void> {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === ADMIN_LAW_IMPORT_BUCKET);
  if (exists) return;
  const { error } = await supabase.storage.createBucket(ADMIN_LAW_IMPORT_BUCKET, { public: false });
  if (error && !/already exists|duplicate/i.test(error.message)) {
    throw new Error(`Could not create storage bucket: ${error.message}`);
  }
}

export async function createAdminLawPdfUploadUrl(
  supabase: SupabaseClient,
  adminUserId: string,
  filename: string,
  sizeBytes: number
): Promise<{ path: string; signedUrl: string; token: string }> {
  if (sizeBytes <= 0 || sizeBytes > ADMIN_LAW_PDF_MAX_BYTES) {
    throw new Error(`PDF must be between 1 byte and ${ADMIN_LAW_PDF_MAX_BYTES / (1024 * 1024)} MB`);
  }

  await ensureAdminLawImportBucket(supabase);
  const path = buildAdminLawImportPath(adminUserId, filename);
  const { data, error } = await supabase.storage
    .from(ADMIN_LAW_IMPORT_BUCKET)
    .createSignedUploadUrl(path, { upsert: true });

  if (error || !data?.signedUrl || !data.path) {
    throw new Error(error?.message ?? "Could not create upload URL");
  }

  return {
    path: data.path,
    signedUrl: data.signedUrl,
    token: data.token,
  };
}

export async function downloadAdminLawPdfBuffer(
  supabase: SupabaseClient,
  path: string
): Promise<Buffer> {
  const { data, error } = await supabase.storage.from(ADMIN_LAW_IMPORT_BUCKET).download(path);
  if (error || !data) {
    throw new Error(error?.message ?? "Could not download uploaded PDF");
  }
  return Buffer.from(await data.arrayBuffer());
}

export async function deleteAdminLawPdfImport(
  supabase: SupabaseClient,
  path: string
): Promise<void> {
  await supabase.storage.from(ADMIN_LAW_IMPORT_BUCKET).remove([path]);
}
