"use client";

import Link from "next/link";
import { advisoryPhaseHref } from "@/lib/law-firm-development/routes";
import { useAdvisoryCatalogContext } from "@/components/law-firm-development/AdvisoryCatalogContext";
import { phaseProgressPercentForPhase } from "@/lib/law-firm-development/progress";
import { useAdvisoryProgress } from "@/hooks/useAdvisoryProgress";
import { AdvisoryBreadcrumbs } from "@/components/law-firm-development/AdvisoryBreadcrumbs";

export function AdvisoryProgrammeOverview() {
  const { phases, courseQuery, phaseDocumentTotal } = useAdvisoryCatalogContext();
  const { ready, statuses } = useAdvisoryProgress();

  return (
    <div className="px-4 py-8 sm:px-8 lg:px-10">
      <AdvisoryBreadcrumbs crumbs={[{ label: "Implementation Programme" }]} />
      <h1 className="[font-family:var(--font-lfp-serif),Georgia,serif] text-3xl font-semibold text-white">
        Implementation programme
      </h1>
      <p className="mt-3 max-w-2xl text-white/55">
        Phases and documents come from your package ZIP: each top-level folder is a phase, and each file inside
        that folder is a module you can open in the workspace.
      </p>
      <div className="mt-8 space-y-4">
        {phases.map((phase) => {
          const pct = ready ? phaseProgressPercentForPhase(phase, statuses) : 0;
          const total = phaseDocumentTotal(phase.id);
          return (
            <Link
              key={phase.id}
              href={advisoryPhaseHref(phase.slug, courseQuery)}
              className="flex flex-col gap-3 rounded-lg border border-[rgba(193,140,67,0.12)] bg-[#221913] p-5 transition hover:border-[rgba(193,140,67,0.3)] sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-[#C18C43]">
                  Phase {String(phase.number).padStart(2, "0")}
                </p>
                <h2 className="mt-1 text-lg font-semibold text-white">{phase.title}</h2>
                <p className="mt-1 text-sm text-white/45">{phase.subtitle}</p>
              </div>
              <div className="flex items-center gap-3 sm:w-40">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full bg-[#C18C43]" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-sm font-medium text-[#E3BA65]">{pct}%</span>
              </div>
              <p className="text-xs text-white/35 sm:w-28 sm:text-right">{total} documents</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
