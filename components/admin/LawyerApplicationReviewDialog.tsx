"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ExternalLink, Loader2, X } from "lucide-react";
import { normalizeExpertiseField } from "@/lib/lawyer-expertise";
import {
  collectLawyerLanguages,
  formatLawyerLanguagesLabel,
} from "@/lib/lawyer-languages";

export type LawyerApplicationSummary = {
  id: string;
  name: string;
  country: string | null;
  city: string | null;
  expertise: string;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  primary_language: string | null;
  other_languages: string | null;
  image_url: string | null;
  source: string;
  approved: boolean;
  created_at: string;
  professional_title: string | null;
  firm_name: string | null;
  office_address: string | null;
  practice_country: string | null;
  practice_city: string | null;
  years_experience: number | null;
  bar_admission_date: string | null;
  jurisdiction: string | null;
  primary_degree: string | null;
  law_school: string | null;
  additional_degree: string | null;
  additional_institution: string | null;
};

type DocumentRow = {
  id: string;
  document_type: string;
  file_name: string;
  viewUrl: string | null;
  downloadUrl: string | null;
};

type LawyerApplicationReviewDialogProps = {
  lawyerId: string | null;
  onClose: () => void;
  onUpdated: (lawyer: LawyerApplicationSummary) => void;
};

export function LawyerApplicationReviewDialog({
  lawyerId,
  onClose,
  onUpdated,
}: LawyerApplicationReviewDialogProps) {
  const t = useTranslations("admin.lawyers.review");
  const tt = useTranslations("admin.lawyers.table");
  const tc = useTranslations("admin.common");
  const [lawyer, setLawyer] = useState<LawyerApplicationSummary | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!lawyerId) {
      setLawyer(null);
      setDocuments([]);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`${window.location.origin}/api/admin/lawyers/directory/${lawyerId}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((data: { lawyer?: LawyerApplicationSummary; documents?: DocumentRow[]; error?: string }) => {
        if (!data.lawyer) {
          setError(data.error ?? "Failed to load application");
          return;
        }
        setLawyer(data.lawyer);
        setDocuments(Array.isArray(data.documents) ? data.documents : []);
      })
      .catch(() => setError("Failed to load application"))
      .finally(() => setLoading(false));
  }, [lawyerId]);

  const setApproval = async (approved: boolean) => {
    if (!lawyerId) return;
    setActionLoading(approved ? "approve" : "reject");
    setError(null);
    try {
      const res = await fetch(`${window.location.origin}/api/admin/lawyers/directory/${lawyerId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Failed to update");
        return;
      }
      const updated = data as LawyerApplicationSummary;
      setLawyer(updated);
      onUpdated(updated);
      if (approved) onClose();
    } catch {
      setError("Failed to update");
    } finally {
      setActionLoading(null);
    }
  };

  if (!lawyerId) return null;

  const docLabel = (type: string) => {
    const map: Record<string, string> = {
      bar_cert: "Bar certificate",
      law_degree: "Law degree",
      professional_id: "Professional ID",
      cv: "CV / Resume",
      profile_photo: "Profile photo",
    };
    return map[type] ?? type;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold">{t("title")}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-accent" aria-label={tc("close")}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : lawyer ? (
            <div className="space-y-6 text-sm">
              <div>
                <p className="text-lg font-medium">{lawyer.name}</p>
                {lawyer.professional_title ? (
                  <p className="text-muted-foreground">{lawyer.professional_title}</p>
                ) : null}
                {lawyer.firm_name ? <p className="text-muted-foreground">{lawyer.firm_name}</p> : null}
              </div>

              <Section title={t("sections.contact")}>
                <Row label={tc("email")} value={lawyer.email} />
                <Row label={tt("phone")} value={lawyer.phone} />
                <Row label={t("fields.officeAddress")} value={lawyer.office_address} />
                <Row label="City / Country" value={[lawyer.city, lawyer.country].filter(Boolean).join(", ")} />
              </Section>

              <Section title={t("sections.practice")}>
                <Row
                  label={t("fields.practiceLocation")}
                  value={[lawyer.practice_city, lawyer.practice_country].filter(Boolean).join(", ")}
                />
                <Row label={t("fields.yearsExperience")} value={lawyer.years_experience?.toString()} />
                <Row label="Expertise" value={normalizeExpertiseField(lawyer.expertise)} />
                <Row
                  label="Languages"
                  value={formatLawyerLanguagesLabel(
                    collectLawyerLanguages(lawyer.primary_language, lawyer.other_languages)
                  )}
                />
              </Section>

              <Section title={t("sections.bar")}>
                <Row label={t("fields.barAdmission")} value={lawyer.bar_admission_date} />
                <Row label={t("fields.jurisdiction")} value={lawyer.jurisdiction} />
              </Section>

              <Section title={t("sections.education")}>
                <Row label={t("fields.primaryDegree")} value={lawyer.primary_degree} />
                <Row label={t("fields.lawSchool")} value={lawyer.law_school} />
                <Row label={t("fields.additionalDegree")} value={lawyer.additional_degree} />
                <Row label={t("fields.additionalInstitution")} value={lawyer.additional_institution} />
              </Section>

              <div>
                <h3 className="mb-2 font-medium">{t("documents")}</h3>
                {documents.length === 0 ? (
                  <p className="text-muted-foreground">{t("noDocuments")}</p>
                ) : (
                  <ul className="space-y-2">
                    {documents.map((doc) => (
                      <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                        <span>
                          <span className="font-medium">{docLabel(doc.document_type)}</span>
                          <span className="text-muted-foreground"> — {doc.file_name}</span>
                        </span>
                        <span className="flex gap-2">
                          {doc.viewUrl ? (
                            <a
                              href={doc.viewUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                            >
                              {t("viewFile")}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : null}
                          {doc.downloadUrl ? (
                            <a href={doc.downloadUrl} className="text-primary hover:underline">
                              {t("downloadFile")}
                            </a>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            <p className="py-8 text-center text-destructive">{error ?? "Application not found"}</p>
          )}
          {error && lawyer ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
        </div>

        {lawyer && !lawyer.approved ? (
          <div className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-4">
            <button
              type="button"
              onClick={() => setApproval(false)}
              disabled={actionLoading !== null}
              className="rounded-lg border border-input px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
            >
              {actionLoading === "reject" ? t("rejecting") : t("reject")}
            </button>
            <button
              type="button"
              onClick={() => setApproval(true)}
              disabled={actionLoading !== null}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {actionLoading === "approve" ? t("approving") : t("approve")}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 font-medium">{title}</h3>
      <div className="space-y-1 rounded-lg border border-border bg-muted/20 p-3">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-wrap gap-x-2">
      <span className="text-muted-foreground">{label}:</span>
      <span>{value?.trim() ? value : "—"}</span>
    </div>
  );
}
