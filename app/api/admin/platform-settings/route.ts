import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
  publicIdFromCloudinaryUrl,
} from "@/lib/cloudinary";
import { getPlatformSettings, clearPlatformSettingsCache } from "@/lib/platform-settings";

/** GET: Retrieve platform settings (logo, favicon, hero). Uses server cache so logo/favicon don't slow every page. */
export async function GET() {
  try {
    const settings = await getPlatformSettings();
    return NextResponse.json({
      logoUrl: settings.logoUrl ?? null,
      faviconUrl: settings.faviconUrl ?? null,
      heroImageUrl: settings.heroImageUrl ?? null,
      founderPortraitUrl: settings.founderPortraitUrl ?? null,
    });
  } catch (err) {
    console.error("Platform settings GET unexpected error:", err);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

/** POST: Update platform settings (upload logo or favicon) */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const type = formData.get("type") as string | null; // "logo" or "favicon"
    const oldPublicId = formData.get("oldPublicId") as string | null;

    if (!file || !type) {
      return NextResponse.json(
        { error: "File and type are required" },
        { status: 400 }
      );
    }

    if (type !== "logo" && type !== "favicon" && type !== "hero" && type !== "founder_portrait") {
      return NextResponse.json(
        { error: "Type must be 'logo', 'favicon', 'hero', or 'founder_portrait'" },
        { status: 400 }
      );
    }

    // Validate favicon format
    if (type === "favicon" && !file.name.toLowerCase().endsWith(".ico")) {
      return NextResponse.json(
        { error: "Favicon must be a .ico file" },
        { status: 400 }
      );
    }

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString("base64");
    const dataUri = `data:${file.type};base64,${base64}`;

    // Upload to Cloudinary
    const publicId = oldPublicId || `yamale/${type}/${Date.now()}`;
    const { secure_url, public_id } = await uploadToCloudinary(
      dataUri,
      type,
      publicId
    );

    // Delete old image if public_id changed
    if (oldPublicId && oldPublicId !== public_id) {
      try {
        await deleteFromCloudinary(oldPublicId);
      } catch (err) {
        console.warn("Failed to delete old image:", err);
      }
    }

    // Update database
    const supabase = getSupabaseServer();
    const updateField =
      type === "logo"
        ? "logo_url"
        : type === "favicon"
          ? "favicon_url"
          : type === "hero"
            ? "hero_image_url"
            : "founder_portrait_url";
    const { error: updateError } = await (supabase.from("platform_settings") as any)
      .update({
        [updateField]: secure_url,
        updated_at: new Date().toISOString(),
        updated_by: admin.userId,
      })
      .eq("id", "main");

    if (updateError) {
      const msg =
        typeof updateError === "object" && updateError && "message" in updateError
          ? String((updateError as { message?: string }).message ?? "")
          : "";
      console.error("Platform settings update error:", updateError);
      if (type === "founder_portrait" && /founder_portrait_url|does not exist/i.test(msg)) {
        return NextResponse.json(
          {
            error:
              "Database column founder_portrait_url is missing. Run the Supabase migration supabase/migrations/20260518120000_add_founder_portrait_url.sql",
          },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
    }

    clearPlatformSettingsCache();

    return NextResponse.json({
      success: true,
      url: secure_url,
      publicId: public_id,
    });
  } catch (err) {
    console.error("Platform settings POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update settings" },
      { status: 500 }
    );
  }
}

const DELETE_FIELD_MAP = {
  logo: "logo_url",
  favicon: "favicon_url",
  founder_portrait: "founder_portrait_url",
  hero: "hero_image_url",
} as const;

type DeleteBrandingType = keyof typeof DELETE_FIELD_MAP;

/** DELETE: Clear a branding asset (query: ?type=logo|favicon|founder_portrait|hero) */
export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const type = request.nextUrl.searchParams.get("type") as DeleteBrandingType | null;
  if (!type || !(type in DELETE_FIELD_MAP)) {
    return NextResponse.json(
      { error: "Query type must be logo, favicon, founder_portrait, or hero" },
      { status: 400 }
    );
  }

  try {
    const settings = await getPlatformSettings();
    const field = DELETE_FIELD_MAP[type];
    const currentUrl =
      type === "logo"
        ? settings.logoUrl
        : type === "favicon"
          ? settings.faviconUrl
          : type === "founder_portrait"
            ? settings.founderPortraitUrl
            : settings.heroImageUrl;

    if (currentUrl) {
      const publicId = publicIdFromCloudinaryUrl(currentUrl);
      if (publicId) {
        try {
          await deleteFromCloudinary(publicId, "image");
        } catch (err) {
          console.warn("Cloudinary delete failed (continuing DB clear):", err);
        }
      }
    }

    const supabase = getSupabaseServer();
    const { error: updateError } = await (supabase.from("platform_settings") as any)
      .update({
        [field]: null,
        updated_at: new Date().toISOString(),
        updated_by: admin.userId,
      })
      .eq("id", "main");

    if (updateError) {
      const msg =
        typeof updateError === "object" && updateError && "message" in updateError
          ? String((updateError as { message?: string }).message ?? "")
          : "";
      console.error("Platform settings delete error:", updateError);
      if (type === "founder_portrait" && /founder_portrait_url|does not exist/i.test(msg)) {
        return NextResponse.json(
          {
            error:
              "Database column founder_portrait_url is missing. Run supabase/migrations/20260518120000_add_founder_portrait_url.sql",
          },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: "Failed to remove image" }, { status: 500 });
    }

    clearPlatformSettingsCache();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Platform settings DELETE error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to remove image" },
      { status: 500 }
    );
  }
}
