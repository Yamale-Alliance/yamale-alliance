/**
 * In-memory store for lawyer onboarding submissions (for admin review).
 * Replace with database (e.g. Prisma) for production.
 */

export type LawyerSubmission = {
  userId: string;
  submittedAt: string; // ISO
  status: "pending" | "approved" | "rejected";
  form: {
    specialty: string;
    experience: string;
    location: string;
    barNumber: string;
    bio: string;
  };
  documents: {
    degree: string; // filename
    license: string;
    id: string;
    barCert: string;
    practiceCert: string;
  };
};

const submissions = new Map<string, LawyerSubmission>(); // userId -> submission

export function addSubmission(
  userId: string,
  form: LawyerSubmission["form"],
  documents: LawyerSubmission["documents"]
): void {
  submissions.set(userId, {
    userId,
    submittedAt: new Date().toISOString(),
    status: "pending",
    form,
    documents,
  });
}

export function getSubmission(userId: string): LawyerSubmission | undefined {
  return submissions.get(userId);
}

export function getPendingSubmissions(): LawyerSubmission[] {
  return Array.from(submissions.values()).filter((s) => s.status === "pending");
}

export function getAllSubmissions(): LawyerSubmission[] {
  return Array.from(submissions.values());
}
