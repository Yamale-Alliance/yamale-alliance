import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { addSubmission } from "@/lib/lawyer-submissions";

const DOC_KEYS = ["degree", "license", "id", "barCert", "practiceCert"] as const;
const FORM_KEYS = ["specialty", "experience", "location", "barNumber", "bio"] as const;

function getFileName(value: FormDataEntryValue | null): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return value.name || "file";
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "Sign in to submit onboarding" },
      { status: 401 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid form data" },
      { status: 400 }
    );
  }

  const form = {
    specialty: typeof formData.get("specialty") === "string" ? formData.get("specialty") as string : "",
    experience: typeof formData.get("experience") === "string" ? formData.get("experience") as string : "",
    location: typeof formData.get("location") === "string" ? formData.get("location") as string : "",
    barNumber: typeof formData.get("barNumber") === "string" ? formData.get("barNumber") as string : "",
    bio: typeof formData.get("bio") === "string" ? formData.get("bio") as string : "",
  };
  form.specialty = form.specialty.trim();
  form.experience = form.experience.trim();
  form.location = form.location.trim();
  form.barNumber = form.barNumber.trim();
  form.bio = form.bio.trim();

  const documents = {
    degree: getFileName(formData.get("degree")),
    license: getFileName(formData.get("license")),
    id: getFileName(formData.get("id")),
    barCert: getFileName(formData.get("barCert")),
    practiceCert: getFileName(formData.get("practiceCert")),
  };

  const missingDocs = DOC_KEYS.filter((k) => !documents[k]);
  if (missingDocs.length > 0) {
    return NextResponse.json(
      { error: `Missing documents: ${missingDocs.join(", ")}` },
      { status: 400 }
    );
  }

  addSubmission(userId, form, documents);
  return NextResponse.json({ success: true });
}
