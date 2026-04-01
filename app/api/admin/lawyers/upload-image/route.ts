import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { uploadToCloudinary } from "@/lib/cloudinary";

/** Normalized MIME types we accept (plus image/jpg → jpeg). */
const ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const MAX_MB = 5;

function isBlobLike(value: unknown): value is Blob {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Blob).arrayBuffer === "function" &&
    typeof (value as Blob).size === "number"
  );
}

function normalizeMime(type: string): string {
  const t = type.toLowerCase().trim();
  if (t === "image/jpg") return "image/jpeg";
  return t;
}

function inferMimeFromFilename(name: string): string | null {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    heic: "image/heic",
    heif: "image/heif",
  };
  return map[ext] ?? null;
}

function effectiveMime(file: Blob & { name?: string }): string | null {
  const fromType = normalizeMime(file.type || "");
  if (fromType && ALLOWED_MIMES.has(fromType)) return fromType;

  const name = "name" in file && typeof (file as File).name === "string" ? (file as File).name : "";
  const inferred = name ? inferMimeFromFilename(name) : null;
  const normalized = inferred ? normalizeMime(inferred) : null;
  if (normalized && ALLOWED_MIMES.has(normalized)) return normalized;

  return null;
}

/** POST: upload a lawyer directory photo. Admin only. Returns { url }. Stored in Cloudinary. */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (parseErr) {
    console.error("Lawyer image upload: formData parse failed:", parseErr);
    return NextResponse.json(
      {
        error:
          "Could not read the upload (file may be too large for the server body limit, or the connection was cut). Try a smaller image under 5 MB.",
      },
      { status: 413 }
    );
  }

  const raw = formData.get("file");
  if (!isBlobLike(raw) || raw.size === 0) {
    return NextResponse.json(
      { error: "file is required (or upload was empty). Choose a JPEG, PNG, WebP, or HEIC image." },
      { status: 400 }
    );
  }

  const file = raw as File | Blob;
  const mime = effectiveMime(file as Blob & { name?: string });

  if (!mime || !ALLOWED_MIMES.has(mime)) {
    const hint = ` Got type “${file.type || "empty"}”.`;
    return NextResponse.json(
      {
        error: `Only JPEG, PNG, WebP, or HEIC images are allowed.${hint} If the type is empty, ensure the filename ends in .jpg, .png, .webp, or .heic.`,
      },
      { status: 400 }
    );
  }

  if (file.size > MAX_MB * 1024 * 1024) {
    return NextResponse.json({ error: `File must be under ${MAX_MB} MB` }, { status: 400 });
  }

  const displayName =
    file instanceof File && file.name ? file.name : "photo.jpg";
  const fileForUpload = new File([file], displayName, { type: mime });

  try {
    const { secure_url } = await uploadToCloudinary(fileForUpload, "lawyer-directory");
    return NextResponse.json({ url: secure_url });
  } catch (err) {
    console.error("Lawyer directory image upload error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
