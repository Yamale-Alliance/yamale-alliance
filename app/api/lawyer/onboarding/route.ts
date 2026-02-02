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

  const form: Record<string, string> = {};
  for (const key of FORM_KEYS) {
    const v = formData.get(key);
    form[key] = typeof v === "string" ? v.trim() : "";
  }

  const documents: Record<string, string> = {};
  for (const key of DOC_KEYS) {
    documents[key] = getFileName(formData.get(key));
  }

  const missingDocs = DOC_KEYS.filter((k) => !documents[k]);
  if (missingDocs.length > 0) {
    return NextResponse.json(
      { error: `Missing documents: ${missingDocs.join(", ")}` },
      { status: 400 }
    );
  }

  addSubmission(userId, form, documents as { degree: string; license: string; id: string; barCert: string; practiceCert: string });
  return NextResponse.json({ success: true });
}
