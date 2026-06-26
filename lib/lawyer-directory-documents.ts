import { uploadToCloudinary } from "@/lib/cloudinary";
import {
  isAllowedJoinDocumentMime,
  LAWYER_JOIN_MAX_MB,
  type LawyerJoinDocumentType,
} from "@/lib/lawyer-join";
import { getSupabaseServer } from "@/lib/supabase/server";

export const LAWYER_DIRECTORY_DOCS_BUCKET = "lawyer-directory-documents";
const SIGNED_URL_EXPIRY = 3600;

function isBlobLike(value: unknown): value is Blob {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Blob).arrayBuffer === "function" &&
    typeof (value as Blob).size === "number"
  );
}

function extensionForMime(mime: string): string {
  const normalized = mime.toLowerCase();
  if (normalized === "application/pdf") return ".pdf";
  if (normalized === "image/png") return ".png";
  if (normalized === "image/webp") return ".webp";
  if (normalized === "image/heic" || normalized === "image/heif") return ".heic";
  return ".jpg";
}

async function ensureBucket(supabase: ReturnType<typeof getSupabaseServer>) {
  try {
    await supabase.storage.createBucket(LAWYER_DIRECTORY_DOCS_BUCKET, { public: false });
  } catch {
    // bucket may already exist
  }
}

export async function uploadLawyerDirectoryDocument(
  lawyerId: string,
  documentType: LawyerJoinDocumentType,
  file: Blob & { name?: string }
): Promise<{ storagePath: string; fileName: string; contentType: string }> {
  if (file.size > LAWYER_JOIN_MAX_MB * 1024 * 1024) {
    throw new Error(`File must be under ${LAWYER_JOIN_MAX_MB} MB`);
  }

  const mime = (file.type || "application/octet-stream").toLowerCase();
  if (!isAllowedJoinDocumentMime(mime)) {
    throw new Error("Only PDF or image files are allowed");
  }

  const fileName = file instanceof File && file.name ? file.name : `${documentType}${extensionForMime(mime)}`;
  const storagePath = `${lawyerId}/${documentType}${extensionForMime(mime)}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const supabase = getSupabaseServer();
  await ensureBucket(supabase);

  const { error } = await supabase.storage
    .from(LAWYER_DIRECTORY_DOCS_BUCKET)
    .upload(storagePath, buffer, { contentType: mime, upsert: true });

  if (error) {
    throw new Error(error.message ?? "Upload failed");
  }

  return { storagePath, fileName, contentType: mime };
}

export async function saveLawyerDirectoryDocumentRow(
  lawyerId: string,
  documentType: LawyerJoinDocumentType,
  storagePath: string,
  fileName: string,
  contentType: string
) {
  const supabase = getSupabaseServer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("lawyer_directory_documents").upsert(
    {
      lawyer_id: lawyerId,
      document_type: documentType,
      storage_path: storagePath,
      file_name: fileName,
      content_type: contentType,
    },
    { onConflict: "lawyer_id,document_type" }
  );
  if (error) throw new Error(error.message ?? "Failed to save document record");
}

export async function uploadLawyerJoinProfilePhoto(
  lawyerId: string,
  file: Blob & { name?: string }
): Promise<string> {
  const mime = (file.type || "").toLowerCase();
  if (!mime.startsWith("image/")) {
    throw new Error("Profile photo must be an image");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const displayName =
    file instanceof File && file.name ? file.name : `${lawyerId}-profile.jpg`;
  const uploadFile = new File([buffer], displayName, { type: mime || "image/jpeg" });
  const { secure_url } = await uploadToCloudinary(uploadFile, "lawyer-directory");
  return secure_url;
}

export function readJoinFormFile(
  formData: FormData,
  key: string
): (Blob & { name?: string }) | null {
  const raw = formData.get(key);
  if (!isBlobLike(raw) || raw.size === 0) return null;
  return raw;
}

export async function listLawyerDirectoryDocumentsWithUrls(lawyerId: string) {
  const supabase = getSupabaseServer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("lawyer_directory_documents")
    .select("id, document_type, storage_path, file_name, content_type, created_at")
    .eq("lawyer_id", lawyerId)
    .order("document_type");

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<{
    id: string;
    document_type: string;
    storage_path: string;
    file_name: string;
    content_type: string;
    created_at: string;
  }>;

  return Promise.all(
    rows.map(async (row) => {
      const { data: signed } = await supabase.storage
        .from(LAWYER_DIRECTORY_DOCS_BUCKET)
        .createSignedUrl(row.storage_path, SIGNED_URL_EXPIRY, { download: false });
      const { data: download } = await supabase.storage
        .from(LAWYER_DIRECTORY_DOCS_BUCKET)
        .createSignedUrl(row.storage_path, SIGNED_URL_EXPIRY, { download: row.file_name });
      return {
        ...row,
        viewUrl: signed?.signedUrl ?? null,
        downloadUrl: download?.signedUrl ?? null,
      };
    })
  );
}

export async function deleteLawyerDirectoryDocuments(lawyerId: string) {
  const supabase = getSupabaseServer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("lawyer_directory_documents")
    .select("storage_path")
    .eq("lawyer_id", lawyerId);

  const paths = ((data ?? []) as Array<{ storage_path: string }>).map((row) => row.storage_path);
  if (paths.length > 0) {
    await supabase.storage.from(LAWYER_DIRECTORY_DOCS_BUCKET).remove(paths);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("lawyer_directory_documents").delete().eq("lawyer_id", lawyerId);
}
