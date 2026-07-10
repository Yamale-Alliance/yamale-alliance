export const LAWYER_DIRECTORY_PHOTO_MAX_MB = 5;

export const LAWYER_DIRECTORY_PHOTO_MAX_BYTES =
  LAWYER_DIRECTORY_PHOTO_MAX_MB * 1024 * 1024;

export function isLawyerDirectoryPhotoTooLarge(sizeBytes: number): boolean {
  return sizeBytes > LAWYER_DIRECTORY_PHOTO_MAX_BYTES;
}
