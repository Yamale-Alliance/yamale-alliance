"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AdvisoryDocumentView } from "@/components/law-firm-development/AdvisoryDocumentView";
import { useAdvisoryCatalogContext } from "@/components/law-firm-development/AdvisoryCatalogContext";

type Props = { docId: string };

export function AdvisoryDocumentPageClient({ docId }: Props) {
  const { getDocument, loading, error, courseQuery } = useAdvisoryCatalogContext();
  const decodedId = decodeURIComponent(docId);
  const document = getDocument(decodedId);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 px-6 py-24 text-white/50">
        <Loader2 className="h-6 w-6 animate-spin text-[#C18C43]" />
        Loading module…
      </div>
    );
  }

  if (!courseQuery) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center text-white/55">
        <p>Open this module from your course in the Vault (View course) so the correct package files load.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center text-red-300/90">
        <p>{error}</p>
      </div>
    );
  }

  if (!document || document.kind === "tool") {
    notFound();
  }

  return <AdvisoryDocumentView document={document} />;
}

/** Wrapper for async params in app router page. */
export function AdvisoryDocumentPageClientFromParams({
  params,
}: {
  params: Promise<{ docId: string }>;
}) {
  const { docId } = use(params);
  return <AdvisoryDocumentPageClient docId={docId} />;
}
