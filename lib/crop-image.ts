/**
 * Produce a cropped (and optionally resized) image blob from source image and crop area in pixels.
 * Used with react-easy-crop's croppedAreaPixels.
 */
export type CropArea = { x: number; y: number; width: number; height: number };

export async function getCroppedImageBlob(
  imageSrc: string,
  croppedAreaPixels: CropArea,
  options?: { maxWidth?: number; mimeType?: string; quality?: number }
): Promise<Blob> {
  const { maxWidth, mimeType = "image/jpeg", quality = 0.9 } = options ?? {};
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2d not available");

  let { width, height } = croppedAreaPixels;
  const { x, y } = croppedAreaPixels;

  if (maxWidth != null && width > maxWidth) {
    const scale = maxWidth / width;
    width = maxWidth;
    height = Math.round(height * scale);
  }

  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(
    image,
    x, y, croppedAreaPixels.width, croppedAreaPixels.height, // source rect
    0, 0, width, height // dest rect
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Failed to create blob"))),
      mimeType,
      quality
    );
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
