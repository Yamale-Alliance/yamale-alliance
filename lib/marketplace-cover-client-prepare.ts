/** Max long edge for vault cover uploads (keeps quality, cuts upload time). */
const MAX_EDGE_PX = 1200;
const JPEG_QUALITY = 0.82;
/** Re-encode / resize when larger than this. */
const COMPRESS_ABOVE_BYTES = 180_000;

function isHeicLike(file: File): boolean {
  const t = file.type.toLowerCase();
  if (t.includes("heic") || t.includes("heif")) return true;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return ext === "heic" || ext === "heif";
}

function canResizeInBrowser(file: File): boolean {
  const t = file.type.toLowerCase();
  return t === "image/jpeg" || t === "image/png" || t === "image/webp" || t === "image/jpg";
}

/**
 * Downscale large JPEG/PNG/WebP covers in the browser before admin upload.
 * HEIC files are sent as-is (Cloudinary converts on ingest).
 */
export async function prepareMarketplaceCoverFile(file: File): Promise<File> {
  if (typeof window === "undefined" || isHeicLike(file) || !canResizeInBrowser(file)) {
    return file;
  }
  if (file.size <= COMPRESS_ABOVE_BYTES) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(width, height));
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY);
    });
    if (!blob) return file;

    const base = file.name.replace(/\.[^.]+$/, "") || "cover";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}
