"use client";

import { useState, useEffect, useCallback } from "react";
import { Upload, Image as ImageIcon, CheckCircle2, Loader2 } from "lucide-react";
import { HeroImageCropModal } from "@/components/admin/HeroImageCropModal";

function showToast(message: string, type: "success" | "error" = "success") {
  // Simple toast implementation
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
  faviconUrl: string | null;
  heroImageUrl: string | null;
}

export default function BrandingSettingsPage() {
  const [settings, setSettings] = useState<PlatformSettings>({ logoUrl: null, faviconUrl: null, heroImageUrl: null });
  const [loading, setLoading] = useState(true);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);
  const [heroCropImage, setHeroCropImage] = useState<{ url: string; fileName: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/admin/platform-settings");
      if (res.ok) {
        const data = await res.json();
        setSettings({ logoUrl: data.logoUrl, faviconUrl: data.faviconUrl, heroImageUrl: data.heroImageUrl ?? null });
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (type: "logo" | "favicon" | "hero", file: File) => {
    if (type === "favicon" && !file.name.toLowerCase().endsWith(".ico")) {
      showToast("Favicon must be a .ico file", "error");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);

    const setUploading = type === "logo" ? setUploadingLogo : type === "favicon" ? setUploadingFavicon : setUploadingHero;
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
      } else if (type === "favicon") {
        setSettings((prev) => ({ ...prev, faviconUrl: data.url }));
      } else {
        setSettings((prev) => ({ ...prev, heroImageUrl: data.url }));
      }

      const label = type === "logo" ? "Logo" : type === "favicon" ? "Favicon" : "Main page image";
      showToast(`${label} updated successfully`, "success");
      
      // Reload page after a short delay to show new favicon
      if (type === "favicon") {
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleHeroCropComplete = useCallback((blob: Blob, fileName: string, imageSrcToRevoke: string) => {
    URL.revokeObjectURL(imageSrcToRevoke);
    setHeroCropImage(null);
    const file = new File([blob], fileName, { type: blob.type });
    handleUpload("hero", file);
  }, []);

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
          Upload your platform logo and favicon. Changes will be reflected immediately across the site.
        </p>
      </div>

      <div className="mt-8 space-y-8">
        {/* Logo Upload */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-foreground">Logo</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Your platform logo appears in the header and PDF exports. Supports PNG, JPG, SVG, and other image formats.
              </p>
              
              {settings.logoUrl && (
                <div className="mt-4">
                  <div className="relative inline-block rounded-lg border border-border p-2 bg-background">
                    <img
                      src={settings.logoUrl}
                      alt="Current logo"
                      className="h-16 max-w-[200px] object-contain"
                    />
                  </div>
                </div>
              )}

              <div className="mt-4">
                <label className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent cursor-pointer">
                  <Upload className="h-4 w-4" />
                  {uploadingLogo ? "Uploading..." : settings.logoUrl ? "Change Logo" : "Upload Logo"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload("logo", file);
                    }}
                    disabled={uploadingLogo}
                  />
                </label>
              </div>
            </div>
            {settings.logoUrl && (
              <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 ml-4" />
            )}
          </div>
        </div>

        {/* Main page / Hero image */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-foreground">Main page image</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Shown large on the home page above the headline. Use a high-quality image (e.g. 400–600px wide) so it stays sharp. PNG, JPG, or WebP.
              </p>
              {settings.heroImageUrl && (
                <div className="mt-4">
                  <div className="relative inline-block rounded-lg border border-border p-2 bg-background">
                    <img
                      src={settings.heroImageUrl}
                      alt="Main page image"
                      className="max-h-32 w-auto max-w-[280px] object-contain"
                    />
                  </div>
                </div>
              )}
              <div className="mt-4">
                <label className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent cursor-pointer">
                  <Upload className="h-4 w-4" />
                  {uploadingHero ? "Uploading..." : settings.heroImageUrl ? "Change main page image" : "Upload main page image"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const url = URL.createObjectURL(file);
                        setHeroCropImage({ url, fileName: file.name });
                      }
                      e.target.value = "";
                    }}
                    disabled={uploadingHero}
                  />
                </label>
              </div>
              {heroCropImage && (
                <HeroImageCropModal
                  imageSrc={heroCropImage.url}
                  onComplete={handleHeroCropComplete}
                  onCancel={() => {
                    URL.revokeObjectURL(heroCropImage.url);
                    setHeroCropImage(null);
                  }}
                />
              )}
            </div>
            {settings.heroImageUrl && (
              <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 ml-4" />
            )}
          </div>
        </div>

        {/* Favicon Upload */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-foreground">Favicon</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                The favicon appears in browser tabs. Must be a .ico file format.
              </p>
              
              {settings.faviconUrl && (
                <div className="mt-4">
                  <div className="relative inline-block rounded-lg border border-border p-2 bg-background">
                    <img
                      src={settings.faviconUrl}
                      alt="Current favicon"
                      className="h-8 w-8 object-contain"
                    />
                  </div>
                </div>
              )}

              <div className="mt-4">
                <label className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent cursor-pointer">
                  <ImageIcon className="h-4 w-4" />
                  {uploadingFavicon ? "Uploading..." : settings.faviconUrl ? "Change Favicon" : "Upload Favicon"}
                  <input
                    type="file"
                    accept=".ico"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload("favicon", file);
                    }}
                    disabled={uploadingFavicon}
                  />
                </label>
              </div>
            </div>
            {settings.faviconUrl && (
              <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 ml-4" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
