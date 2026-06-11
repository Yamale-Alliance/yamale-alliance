import { Readable } from "node:stream";
import { v2 as cloudinary } from "cloudinary";

// Configure Cloudinary (set CLOUDINARY_* in .env)
const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (!cloudName || !apiKey || !apiSecret) {
  console.warn(
    'Cloudinary credentials not found in environment variables. ' +
    'Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your .env file.'
  );
}

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
});

export { cloudinary };

function uploadBufferStream(
  buffer: Buffer,
  uploadOptions: Record<string, unknown>
): Promise<{ secure_url: string; public_id: string }> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(uploadOptions as any, (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        if (!result?.secure_url || !result.public_id) {
          reject(new Error("Cloudinary returned no URL"));
          return;
        }
        resolve({ secure_url: result.secure_url, public_id: result.public_id });
      }
    );
    Readable.from(buffer).pipe(stream);
  });
}

/**
 * Upload image to Cloudinary
 * @param file Buffer, data URI string, or File
 * @param folder Folder name in Cloudinary (e.g., 'logo', 'favicon', 'lawyer-directory')
 * @param publicId Optional public ID (defaults to timestamp)
 * @returns Cloudinary upload result with secure_url
 */
export async function uploadToCloudinary(
  file: Buffer | string | File | Blob,
  folder: string,
  publicId?: string
): Promise<{ secure_url: string; public_id: string }> {
  // Validate credentials are set
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      'Cloudinary credentials not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your .env file.'
    );
  }

  try {
    const uploadOptions: Record<string, unknown> = {
      folder: `yamale/${folder}`,
      resource_type: 'image' as const,
      overwrite: true,
    };

    if (publicId) {
      uploadOptions.public_id = publicId;
    }

    if (typeof file === "string") {
      const result = await cloudinary.uploader.upload(file, uploadOptions as any);
      return { secure_url: result.secure_url, public_id: result.public_id };
    }

    const buffer =
      file instanceof File || file instanceof Blob
        ? Buffer.from(await file.arrayBuffer())
        : (file as Buffer);

    return uploadBufferStream(buffer, uploadOptions);
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to upload image to Cloudinary: ${errorMessage}`);
  }
}

const VIDEO_MIMES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-m4v',
]);

export const LAWYERS_ONBOARDING_VIDEO_MAX_MB = 100;

export const LAWYERS_ONBOARDING_VIDEO_FOLDER = 'yamale/lawyers-onboarding';
export const LAWYERS_ONBOARDING_VIDEO_PUBLIC_ID = 'yamale/lawyers-onboarding/current';

export const MARKETPLACE_COVER_CLOUDINARY_FOLDER = 'yamale/marketplace';

function cloudinaryErrorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const nested = (error as { error?: { message?: string } }).error;
    if (nested?.message) return nested.message;
    if ('message' in error && typeof (error as { message: unknown }).message === 'string') {
      return (error as { message: string }).message;
    }
  }
  return error instanceof Error ? error.message : 'Unknown error';
}

/** Params for a signed direct browser upload (avoids server timeout on large MP4s). */
export function signLawyersOnboardingVideoUpload(): {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  publicId: string;
} {
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      'Cloudinary credentials not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your .env file.'
    );
  }

  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = {
    timestamp,
    folder: LAWYERS_ONBOARDING_VIDEO_FOLDER,
    public_id: LAWYERS_ONBOARDING_VIDEO_PUBLIC_ID,
    overwrite: 'true',
  };
  const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);

  return {
    cloudName,
    apiKey,
    timestamp,
    signature,
    folder: LAWYERS_ONBOARDING_VIDEO_FOLDER,
    publicId: LAWYERS_ONBOARDING_VIDEO_PUBLIC_ID,
  };
}

/** Signed direct browser upload for Vault product covers (skips proxying through Next.js). */
export function signMarketplaceCoverImageUpload(): {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
} {
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      'Cloudinary credentials not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your .env file.'
    );
  }

  const timestamp = Math.round(Date.now() / 1000);
  const folder = MARKETPLACE_COVER_CLOUDINARY_FOLDER;
  const paramsToSign = { timestamp, folder };
  const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);

  return { cloudName, apiKey, timestamp, signature, folder };
}

export function isLawyersOnboardingCloudinaryDeliveryUrl(url: string): boolean {
  if (!cloudName) return false;
  try {
    const u = new URL(url);
    return (
      u.protocol === 'https:' &&
      u.hostname === 'res.cloudinary.com' &&
      u.pathname.includes(`/${cloudName}/`) &&
      u.pathname.includes('/video/upload/')
    );
  } catch {
    return false;
  }
}

/**
 * Upload video to Cloudinary (MP4, WebM, MOV).
 * Prefer signed direct browser upload for large files (see signLawyersOnboardingVideoUpload).
 */
export async function uploadVideoToCloudinary(
  file: File | Blob | Buffer,
  folder: string,
  publicId?: string
): Promise<{ secure_url: string; public_id: string }> {
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      'Cloudinary credentials not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your .env file.'
    );
  }

  try {
    const uploadOptions: Record<string, unknown> = {
      folder: `yamale/${folder}`,
      resource_type: 'video' as const,
      overwrite: true,
    };

    if (publicId) {
      uploadOptions.public_id = publicId;
    }

    let uploadData: string;
    let mime = 'video/mp4';

    if (file instanceof File) {
      mime = file.type || mime;
      if (!VIDEO_MIMES.has(mime) && !file.name.toLowerCase().endsWith('.mp4')) {
        throw new Error('Only MP4, WebM, or MOV videos are allowed');
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      uploadData = `data:${mime};base64,${buffer.toString('base64')}`;
    } else if (file instanceof Blob) {
      mime = file.type || mime;
      const buffer = Buffer.from(await file.arrayBuffer());
      uploadData = `data:${mime};base64,${buffer.toString('base64')}`;
    } else {
      uploadData = `data:video/mp4;base64,${(file as Buffer).toString('base64')}`;
    }

    const result = await cloudinary.uploader.upload(uploadData, uploadOptions as any);

    return {
      secure_url: result.secure_url,
      public_id: result.public_id,
    };
  } catch (error) {
    console.error('Cloudinary video upload error:', error);
    throw new Error(`Failed to upload video to Cloudinary: ${cloudinaryErrorMessage(error)}`);
  }
}

/** Best-effort public_id from a Cloudinary delivery URL (for admin deletes). */
export function publicIdFromCloudinaryUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const marker = "/upload/";
    const idx = trimmed.indexOf(marker);
    if (idx === -1) return null;
    let path = trimmed.slice(idx + marker.length);
    path = path.replace(/^v\d+\//, "");
    const dot = path.lastIndexOf(".");
    if (dot > 0) path = path.slice(0, dot);
    return path || null;
  } catch {
    return null;
  }
}

/**
 * Delete image or video from Cloudinary
 */
export async function deleteFromCloudinary(
  publicId: string,
  resourceType: 'image' | 'video' = 'image'
): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw new Error('Failed to delete asset from Cloudinary');
  }
}
