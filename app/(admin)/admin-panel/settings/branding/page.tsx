"use client";

import { useState, useEffect, useCallback } from "react";
import { Upload, CheckCircle2, Loader2, Trash2 } from "lucide-react";
import { LogoCropModal } from "@/components/admin/LogoCropModal";

function showToast(message: string, type: "success" | "error" = "success") {
  const toast = document.createElement("div");
  toast.className = `fixed bottom-4 right-4 z-50 rounded-lg px-4 py-3 shadow-lg ${
    type === "success" ? "bg-green-500 text-white" : "bg-red-500 text-white"
  }`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    try {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    } catch {
      // Ignore if DOM changed (e.g. navigation)
    }
  }, 3000);
}

interface PlatformSettings {
  logoUrl: string | null;
  founderPortraitUrl: string | null;
}

export default function BrandingSettingsPage() {
  const [settings, setSettings] = useState<PlatformSettings>({
    logoUrl: null,
    founderPortraitUrl: null,
  });
  const [loading, setLoading] = useState(true);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFounderPortrait, setUploadingFounderPortrait] = useState(false);
  const [removingLogo, setRemovingLogo] = useState(false);
  const [removingFounderPortrait, setRemovingFounderPortrait] = useState(false);
  const [logoCropImage, setLogoCropImage] = useState<{ url: string; fileName: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/admin/platform-settings");
      if (res.ok) {
        const data = await res.json();
        setSettings({
          logoUrl: data.logoUrl,
          founderPortraitUrl: data.founderPortraitUrl ?? null,
        });
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = useCallback(async (type: "logo" | "founder_portrait", file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);

    const setUploading = type === "logo" ? setUploadingLogo : setUploadingFounderPortrait;
    setUploading(true);

    try {
      const res = await fetch("/api/admin/platform-settings", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Upload failed");
      }

      const data = await res.json();

      if (type === "logo") {
        setSettings((prev) => ({ ...prev, logoUrl: data.url }));
      } else {
        setSettings((prev) => ({ ...prev, founderPortraitUrl: data.url }));
      }

      const label = type === "logo" ? "Logo" : "Founder portrait";
      showToast(`${label} updated successfully`, "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  }, []);

  const handleRemove = useCallback(async (type: "logo" | "founder_portrait") => {
    const label = type === "logo" ? "logo" : "founder portrait";
    if (!window.confirm(`Remove the current ${label}? This cannot be undone.`)) return;

    const setRemoving = type === "logo" ? setRemovingLogo : setRemovingFounderPortrait;
    setRemoving(true);

    try {
      const res = await fetch(`/api/admin/platform-settings?type=${type}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Remove failed");
      }

      if (type === "logo") {
        setSettings((prev) => ({ ...prev, logoUrl: null }));
      } else {
        setSettings((prev) => ({ ...prev, founderPortraitUrl: null }));
      }

      showToast(`${label.charAt(0).toUpperCase()}${label.slice(1)} removed`, "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Remove failed", "error");
    } finally {
      setRemoving(false);
    }
  }, []);

  const handleLogoCropComplete = useCallback(
    (blob: Blob, fileName: string, imageSrcToRevoke: string) => {
      URL.revokeObjectURL(imageSrcToRevoke);
      setLogoCropImage(null);
      const file = new File([blob], fileName, { type: blob.type });
      handleUpload("logo", file);
    },
    [handleUpload]
  );

  if (loading) {
    return (
      <div className="p-4 sm:p-6 md:p-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="rounded-2xl border border-border bg-card px-4 py-6 shadow-sm sm:px-6 sm:py-8 md:px-8 md:py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Branding Settings</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Upload your platform logo and the founder portrait shown on the founder&apos;s note and welcome
          modal. The favicon is managed as static files in the repo under <code className="text-xs">public/</code>.
        </p>
      </div>

      <div className="mt-8 space-y-8">
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-foreground">Logo</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Your platform logo appears in the header and on the home page. Upload an image to crop, zoom, and resize it. Supports PNG, JPG, SVG, and other image formats.
              </p>

              {settings.logoUrl && (
                <div className="mt-4">
                  <div className="relative inline-block rounded-lg border border-border bg-background p-2">
                    <img
                      src={settings.logoUrl}
                      alt="Current logo"
                      className="h-20 max-w-[300px] object-contain"
                    />
                  </div>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent">
                  <Upload className="h-4 w-4" />
                  {uploadingLogo ? "Uploading..." : settings.logoUrl ? "Change Logo" : "Upload Logo"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const url = URL.createObjectURL(file);
                        setLogoCropImage({ url, fileName: file.name });
                      }
                      e.target.value = "";
                    }}
                    disabled={uploadingLogo || removingLogo}
                  />
                </label>
                {settings.logoUrl && (
                  <button
                    type="button"
                    onClick={() => void handleRemove("logo")}
                    disabled={removingLogo || uploadingLogo}
                    className="inline-flex items-center gap-2 rounded-lg border border-destructive/40 bg-background px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    {removingLogo ? "Removing..." : "Remove logo"}
                  </button>
                )}
              </div>
              {logoCropImage && (
                <LogoCropModal
                  imageSrc={logoCropImage.url}
                  onComplete={handleLogoCropComplete}
                  onCancel={() => {
                    URL.revokeObjectURL(logoCropImage.url);
                    setLogoCropImage(null);
                  }}
                />
              )}
            </div>
            {settings.logoUrl && (
              <CheckCircle2 className="ml-4 h-5 w-5 shrink-0 text-green-500" />
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-foreground">Founder portrait</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Photo of Meghan Waters for the founder&apos;s note (<code className="text-xs">/founders-note</code>),
                the one-time welcome dialog, and related pages. Use a square or portrait image (PNG or JPG).
              </p>

              {settings.founderPortraitUrl && (
                <div className="mt-4">
                  <div className="relative inline-block overflow-hidden rounded-full border-2 border-[#C8922A]/40 p-0.5">
                    <img
                      src={settings.founderPortraitUrl}
                      alt="Founder portrait preview"
                      className="h-32 w-32 rounded-full object-cover"
                    />
                  </div>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent">
                  <Upload className="h-4 w-4" />
                  {uploadingFounderPortrait
                    ? "Uploading..."
                    : settings.founderPortraitUrl
                      ? "Change portrait"
                      : "Upload portrait"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleUpload("founder_portrait", file);
                      e.target.value = "";
                    }}
                    disabled={uploadingFounderPortrait || removingFounderPortrait}
                  />
                </label>
                {settings.founderPortraitUrl && (
                  <button
                    type="button"
                    onClick={() => void handleRemove("founder_portrait")}
                    disabled={removingFounderPortrait || uploadingFounderPortrait}
                    className="inline-flex items-center gap-2 rounded-lg border border-destructive/40 bg-background px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    {removingFounderPortrait ? "Removing..." : "Remove portrait"}
                  </button>
                )}
              </div>
            </div>
            {settings.founderPortraitUrl && (
              <CheckCircle2 className="ml-4 h-5 w-5 shrink-0 text-green-500" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
