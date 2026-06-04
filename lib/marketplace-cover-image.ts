import "server-only";

import { uploadToCloudinary } from "@/lib/cloudinary";
import { MARKETPLACE_COVER_MAX_MB } from "@/lib/marketplace-cover-limits";

export { MARKETPLACE_COVER_MAX_MB };

const ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

function normalizeMime(type: string): string {
  const t = type.toLowerCase().trim();
  if (t === "image/jpg") return "image/jpeg";
  return t;
}

function inferMimeFromFilename(name: string): string | null {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    heic: "image/heic",
    heif: "image/heif",
  };
  return map[ext] ?? null;
}

export function effectiveCoverImageMime(file: File): string | null {
  const fromType = normalizeMime(file.type || "");
  if (fromType && ALLOWED_MIMES.has(fromType)) return fromType;
  const inferred = inferMimeFromFilename(file.name);
  const normalized = inferred ? normalizeMime(inferred) : null;
  if (normalized && ALLOWED_MIMES.has(normalized)) return normalized;
  return null;
}

function assertCloudinaryConfigured(): void {
  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    throw new Error(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET."
    );
  }
}

/** Upload a vault product cover to Cloudinary (`yamale/marketplace` folder). */
export async function uploadMarketplaceCoverImage(file: File): Promise<{ url: string }> {
  if (file.size > MARKETPLACE_COVER_MAX_MB * 1024 * 1024) {
    throw new Error(`Cover image must be under ${MARKETPLACE_COVER_MAX_MB} MB`);
  }

  const mime = effectiveCoverImageMime(file);
  if (!mime) {
    throw new Error("Only JPEG, PNG, WebP, or HEIC images are allowed");
  }

  assertCloudinaryConfigured();

  const uploadFile = new File([file], file.name || "cover.jpg", { type: mime });
  const { secure_url } = await uploadToCloudinary(uploadFile, "marketplace");
  return { url: secure_url };
}
