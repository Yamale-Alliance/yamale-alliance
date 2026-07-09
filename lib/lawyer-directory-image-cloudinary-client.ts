export type LawyerDirectoryImageUploadSign = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
};

const SIGN_CACHE_TTL_MS = 10 * 60 * 1000;
let signCache: { sign: LawyerDirectoryImageUploadSign; expiresAt: number } | null = null;
let signFetchInFlight: Promise<LawyerDirectoryImageUploadSign> | null = null;

async function fetchLawyerDirectoryImageUploadSignature(
  origin: string
): Promise<LawyerDirectoryImageUploadSign> {
  const signRes = await fetch(`${origin}/api/admin/lawyers/upload-image/signature`, {
    credentials: "include",
  });
  const sign = (await signRes.json()) as {
    error?: string;
    cloudName?: string;
    apiKey?: string;
    timestamp?: number;
    signature?: string;
    folder?: string;
  };
  if (!signRes.ok) {
    throw new Error(sign.error ?? "Failed to prepare photo upload");
  }

  const { cloudName, apiKey, timestamp, signature, folder } = sign;
  if (!cloudName || !apiKey || !timestamp || !signature || !folder) {
    throw new Error("Invalid upload signature from server");
  }

  const payload: LawyerDirectoryImageUploadSign = {
    cloudName,
    apiKey,
    timestamp,
    signature,
    folder,
  };
  signCache = { sign: payload, expiresAt: Date.now() + SIGN_CACHE_TTL_MS };
  return payload;
}

async function getLawyerDirectoryImageUploadSignature(
  origin: string
): Promise<LawyerDirectoryImageUploadSign> {
  if (signCache && signCache.expiresAt > Date.now()) {
    return signCache.sign;
  }
  if (!signFetchInFlight) {
    signFetchInFlight = fetchLawyerDirectoryImageUploadSignature(origin).finally(() => {
      signFetchInFlight = null;
    });
  }
  return signFetchInFlight;
}

/** Warm the upload signature while the admin lawyer form is open. */
export function prefetchLawyerDirectoryImageUploadSignature(origin: string): void {
  if (signCache && signCache.expiresAt > Date.now()) return;
  void getLawyerDirectoryImageUploadSignature(origin).catch(() => {
    signCache = null;
  });
}

const MAX_MB = 5;

function validateLawyerDirectoryImageFile(file: File): void {
  if (file.size > MAX_MB * 1024 * 1024) {
    throw new Error(`File must be under ${MAX_MB} MB`);
  }
  const mime = (file.type || "").toLowerCase();
  const name = file.name.toLowerCase();
  const allowed =
    mime === "image/jpeg" ||
    mime === "image/png" ||
    mime === "image/webp" ||
    mime === "image/heic" ||
    mime === "image/heif" ||
    /\.(jpe?g|png|webp|heic|heif)$/.test(name);
  if (!allowed) {
    throw new Error("Only JPEG, PNG, WebP, or HEIC images are allowed");
  }
}

/**
 * Upload a lawyer directory photo straight from the admin browser to Cloudinary.
 * Avoids sending the file through the Next.js server (prevents UI freezes on slow links).
 */
export async function uploadLawyerDirectoryImageToCloudinaryDirect(
  origin: string,
  file: File
): Promise<string> {
  validateLawyerDirectoryImageFile(file);

  const { cloudName, apiKey, timestamp, signature, folder } =
    await getLawyerDirectoryImageUploadSignature(origin);

  const uploadForm = new FormData();
  uploadForm.append("file", file);
  uploadForm.append("api_key", apiKey);
  uploadForm.append("timestamp", String(timestamp));
  uploadForm.append("signature", signature);
  uploadForm.append("folder", folder);

  const cloudRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: uploadForm,
  });
  const cloudData = (await cloudRes.json()) as {
    secure_url?: string;
    error?: { message?: string };
  };
  if (!cloudRes.ok) {
    throw new Error(cloudData.error?.message ?? "Cloudinary upload failed");
  }
  if (!cloudData.secure_url) {
    throw new Error("Cloudinary did not return an image URL");
  }
  return cloudData.secure_url;
}
