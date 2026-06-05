"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AdvisoryPhaseView } from "@/components/law-firm-development/AdvisoryPhaseView";
import { useAdvisoryCatalogContext } from "@/components/law-firm-development/AdvisoryCatalogContext";

type Props = { phaseSlug: string };

export function AdvisoryPhasePageClient({ phaseSlug }: Props) {
  const { getPhase, loading, error, courseQuery } = useAdvisoryCatalogContext();
  const phase = getPhase(phaseSlug);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 px-6 py-24 text-white/50">
        <Loader2 className="h-6 w-6 animate-spin text-[#C18C43]" />
        Loading phase…
      </div>
    );
  }

  if (!courseQuery) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center text-white/55">
        <p>Open the implementation workspace from your purchased course in the Vault.</p>
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

  if (!phase) {
    notFound();
  }

  return <AdvisoryPhaseView phase={phase} />;
}

export function AdvisoryPhasePageClientFromParams({
  params,
}: {
  params: Promise<{ phaseSlug: string }>;
}) {
  const { phaseSlug } = use(params);
  return <AdvisoryPhasePageClient phaseSlug={phaseSlug} />;
}
