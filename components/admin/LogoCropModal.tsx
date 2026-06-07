"use client";

import { useState, useCallback, useRef } from "react";
import ReactCrop, { type Crop, centerCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { getCroppedImageBlob } from "@/lib/crop-image";
import { X, ZoomIn, ZoomOut } from "lucide-react";
import { useTranslations } from "next-intl";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2.5;
const DEFAULT_ZOOM = 1;

const MAX_WIDTH_VALUES = [0, 200, 300, 400, 512] as const;

interface LogoCropModalProps {
  imageSrc: string;
  onComplete: (blob: Blob, fileName: string, imageSrcToRevoke: string) => void;
  onCancel: () => void;
}

export function LogoCropModal({ imageSrc, onComplete, onCancel }: LogoCropModalProps) {
  const t = useTranslations("admin.vault.logoCropModal");
  const tc = useTranslations("admin.common");
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>();
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [imageSize, setImageSize] = useState<{ naturalWidth: number; naturalHeight: number } | null>(null);
  const [maxWidth, setMaxWidth] = useState(400);
  const [applying, setApplying] = useState(false);

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    setImageSize({ naturalWidth, naturalHeight });
    // Initial crop: centered, ~85% of image; user can pan and drag corners/edges to resize
    const initialCrop = centerCrop(
      { unit: "%", width: 85, height: 85 },
      naturalWidth,
      naturalHeight
    );
    setCrop(initialCrop);
  }, []);

  const handleApply = async () => {
    if (!crop || !imageSize || !imgRef.current) return;
    setApplying(true);
    try {
      // Convert percent crop to natural image pixels
      const n = imageSize;
      const pixelCrop =
        crop.unit === "%"
          ? {
              x: (crop.x / 100) * n.naturalWidth,
              y: (crop.y / 100) * n.naturalHeight,
              width: (crop.width / 100) * n.naturalWidth,
              height: (crop.height / 100) * n.naturalHeight,
            }
          : { x: crop.x, y: crop.y, width: crop.width, height: crop.height };

      const blob = await getCroppedImageBlob(imageSrc, pixelCrop, {
        maxWidth: maxWidth > 0 ? maxWidth : undefined,
        mimeType: "image/png",
        quality: 0.95,
      });
      const fileName = `logo-${Date.now()}.png`;
      onComplete(blob, fileName, imageSrc);
    } catch (e) {
      console.error("Crop failed:", e);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">{t("title")}</h3>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label={tc("close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative min-h-[280px] sm:min-h-[360px] max-h-[50vh] flex items-center justify-center bg-muted/30 overflow-auto p-4">
          <ReactCrop
            crop={crop}
            onChange={(_, percentCrop) => setCrop({ ...percentCrop, unit: "%" })}
            aspect={undefined}
            className="max-h-full"
            ruleOfThirds
          >
            <img
              ref={imgRef}
              src={imageSrc}
              alt={t("cropAlt")}
              onLoad={onImageLoad}
              className="max-h-full w-auto object-contain block"
              style={
                imageSize
                  ? {
                      width: imageSize.naturalWidth * zoom,
                      height: imageSize.naturalHeight * zoom,
                      maxWidth: "none",
                      maxHeight: "none",
                    }
                  : { maxWidth: "100%", maxHeight: "45vh" }
              }
            />
          </ReactCrop>
        </div>

        <div className="px-4 py-4 space-y-4 border-t border-border">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">{t("zoom")}</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 0.25))}
                className="rounded-lg border border-border bg-background p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label={t("zoomOut")}
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <input
                type="range"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 h-2 rounded-lg appearance-none bg-muted accent-primary"
              />
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 0.25))}
                className="rounded-lg border border-border bg-background p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label={t("zoomIn")}
              >
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {t.rich("instructions", {
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </p>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">{t("outputSize")}</label>
            <select
              value={maxWidth}
              onChange={(e) => setMaxWidth(Number(e.target.value))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              {MAX_WIDTH_VALUES.map((value) => (
                <option key={value} value={value}>
                  {t(`widthOptions.${value}` as "widthOptions.0")}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("outputHint")}
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              {tc("cancel")}
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={applying || !crop}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {applying ? t("applying") : t("applyAndUpload")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
