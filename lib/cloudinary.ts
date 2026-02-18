import { v2 as cloudinary } from 'cloudinary';

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

/**
 * Upload image to Cloudinary
 * @param file Buffer, data URI string, or File
 * @param folder Folder name in Cloudinary (e.g., 'logo', 'favicon', 'lawyer-directory')
 * @param publicId Optional public ID (defaults to timestamp)
 * @returns Cloudinary upload result with secure_url
 */
export async function uploadToCloudinary(
  file: Buffer | string | File,
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

    let uploadData: string;
    if (typeof file === 'string') {
      uploadData = file;
    } else if (file instanceof File) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const base64 = buffer.toString('base64');
      const mime = file.type || 'image/jpeg';
      uploadData = `data:${mime};base64,${base64}`;
    } else {
      uploadData = `data:image/png;base64,${file.toString('base64')}`;
    }

    const result = await cloudinary.uploader.upload(uploadData, uploadOptions as any);

    return {
      secure_url: result.secure_url,
      public_id: result.public_id,
    };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to upload image to Cloudinary: ${errorMessage}`);
  }
}

/**
 * Delete image from Cloudinary
 */
export async function deleteFromCloudinary(publicId: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw new Error('Failed to delete image from Cloudinary');
  }
}
