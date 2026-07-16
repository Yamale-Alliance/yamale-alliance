/**
 * Upload a large law PDF directly to Supabase Storage from the browser,
 * bypassing the Next.js API multipart body size limit. Returns the storage path
 * that server routes accept as `pdfStoragePath`.
 */
export async function uploadLawPdfViaStorage(file: File): Promise<string> {
  const metaRes = await fetch(`${window.location.origin}/api/admin/laws/pdf-upload-url`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sizeBytes: file.size, filename: file.name }),
  });
  const meta = (await metaRes.json().catch(() => ({}))) as {
    error?: string;
    signedUrl?: string;
    path?: string;
  };
  if (!metaRes.ok || !meta.signedUrl || !meta.path) {
    throw new Error(meta.error ?? "Could not prepare large PDF upload");
  }

  const putRes = await fetch(meta.signedUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/pdf" },
    body: file,
  });
  if (!putRes.ok) {
    throw new Error("Direct PDF upload failed. Check Supabase storage configuration.");
  }
  return meta.path;
}
