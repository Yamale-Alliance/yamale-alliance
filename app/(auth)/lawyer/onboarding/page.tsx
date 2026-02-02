"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { FileUp, Loader2, FileCheck } from "lucide-react";

const DOC_LABELS: { key: string; label: string }[] = [
  { key: "degree", label: "Degree / qualification" },
  { key: "license", label: "Law license" },
  { key: "id", label: "ID (national / passport)" },
  { key: "barCert", label: "Bar certificate" },
  { key: "practiceCert", label: "Practice certificate" },
];

const ACCEPT = ".pdf,.jpg,.jpeg,.png";
const MAX_MB = 10;

export default function LawyerOnboardingPage() {
  const { isLoaded, userId } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [documents, setDocuments] = useState<Record<string, File | null>>({
    degree: null,
    license: null,
    id: null,
    barCert: null,
    practiceCert: null,
  });
  const [specialty, setSpecialty] = useState("");
  const [experience, setExperience] = useState("");
  const [location, setLocation] = useState("");
  const [barNumber, setBarNumber] = useState("");
  const [bio, setBio] = useState("");

  useEffect(() => {
    if (!isLoaded) return;
    if (!userId) {
      router.replace("/sign-up");
    }
  }, [isLoaded, userId, router]);

  const handleFile = (key: string, file: File | null) => {
    if (file && file.size > MAX_MB * 1024 * 1024) {
      setError(`File must be under ${MAX_MB} MB`);
      return;
    }
    setDocuments((prev) => ({ ...prev, [key]: file }));
    setError(null);
  };

  const allDocsUploaded = DOC_LABELS.every(({ key }) => documents[key] != null);
  const canSubmit =
    allDocsUploaded &&
    specialty.trim() &&
    experience.trim() &&
    location.trim() &&
    barNumber.trim() &&
    bio.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !userId) return;
    setSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("specialty", specialty.trim());
      formData.set("experience", experience.trim());
      formData.set("location", location.trim());
      formData.set("barNumber", barNumber.trim());
      formData.set("bio", bio.trim());
      DOC_LABELS.forEach(({ key }) => {
        const file = documents[key];
        if (file) formData.set(key, file);
      });

      const res = await fetch("/api/lawyer/onboarding", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Submission failed");
        return;
      }
      router.replace("/lawyer/pending");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!userId) {
    return null;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Lawyer Onboarding
          </h1>
          <p className="mt-2 text-muted-foreground">
            Upload your verification documents and complete your profile. Your
            application will be sent to admin for review.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Document uploads */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="font-medium">Documents (required)</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              PDF, JPG or PNG. Max {MAX_MB} MB per file.
            </p>
            <div className="mt-4 space-y-4">
              {DOC_LABELS.map(({ key, label }) => (
                <div key={key} className="flex flex-col gap-2">
                  <label className="text-sm font-medium">{label}</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="file"
                      accept={ACCEPT}
                      className="block w-full max-w-xs text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary file:hover:bg-primary/20"
                      onChange={(e) =>
                        handleFile(key, e.target.files?.[0] ?? null)
                      }
                    />
                    {documents[key] ? (
                      <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                        <FileCheck className="h-4 w-4" />
                        {documents[key]?.name}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        No file
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Form fields */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h2 className="font-medium">Profile</h2>
            <div>
              <label htmlFor="specialty" className="block text-sm font-medium">
                Specialty
              </label>
              <input
                id="specialty"
                type="text"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder="e.g. Commercial Law, Corporate & M&A"
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>
            <div>
              <label htmlFor="experience" className="block text-sm font-medium">
                Experience
              </label>
              <input
                id="experience"
                type="text"
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
                placeholder="e.g. 8 years"
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>
            <div>
              <label htmlFor="location" className="block text-sm font-medium">
                Location
              </label>
              <input
                id="location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Accra, Ghana"
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>
            <div>
              <label htmlFor="barNumber" className="block text-sm font-medium">
                Bar number
              </label>
              <input
                id="barNumber"
                type="text"
                value={barNumber}
                onChange={(e) => setBarNumber(e.target.value)}
                placeholder="e.g. BAR-2020-12345"
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>
            <div>
              <label htmlFor="bio" className="block text-sm font-medium">
                Bio
              </label>
              <textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Short professional summary"
                rows={4}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-y"
                required
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={!canSubmit || submitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting…
              </>
            ) : (
              <>
                <FileUp className="h-4 w-4" />
                Submit for review
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
