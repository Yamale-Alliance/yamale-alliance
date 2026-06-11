export type MarketplaceCoverUploadSign = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
};

const SIGN_CACHE_TTL_MS = 10 * 60 * 1000;
let signCache: { sign: MarketplaceCoverUploadSign; expiresAt: number } | null = null;
let signFetchInFlight: Promise<MarketplaceCoverUploadSign> | null = null;

async function fetchMarketplaceCoverUploadSignature(
  origin: string
): Promise<MarketplaceCoverUploadSign> {
  const signRes = await fetch(`${origin}/api/admin/marketplace/upload-image/signature`, {
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
    throw new Error(sign.error ?? "Failed to prepare cover upload");
  }

  const { cloudName, apiKey, timestamp, signature, folder } = sign;
  if (!cloudName || !apiKey || !timestamp || !signature || !folder) {
    throw new Error("Invalid upload signature from server");
  }

  const payload: MarketplaceCoverUploadSign = {
    cloudName,
    apiKey,
    timestamp,
    signature,
    folder,
  };
  signCache = { sign: payload, expiresAt: Date.now() + SIGN_CACHE_TTL_MS };
  return payload;
}

async function getMarketplaceCoverUploadSignature(
  origin: string
): Promise<MarketplaceCoverUploadSign> {
  if (signCache && signCache.expiresAt > Date.now()) {
    return signCache.sign;
  }
  if (!signFetchInFlight) {
    signFetchInFlight = fetchMarketplaceCoverUploadSignature(origin).finally(() => {
      signFetchInFlight = null;
    });
  }
  return signFetchInFlight;
}

/** Warm the upload signature while the admin form is open (hides latency on first pick). */
export function prefetchMarketplaceCoverUploadSignature(origin: string): void {
  if (signCache && signCache.expiresAt > Date.now()) return;
  void getMarketplaceCoverUploadSignature(origin).catch(() => {
    signCache = null;
  });
}

/**
 * Upload a Vault cover image straight from the admin browser to Cloudinary.
 * Avoids sending the file through the Next.js server (much faster on slow links).
 */
export async function uploadMarketplaceCoverToCloudinaryDirect(
  origin: string,
  file: File
): Promise<string> {
  const { cloudName, apiKey, timestamp, signature, folder } =
    await getMarketplaceCoverUploadSignature(origin);

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
