"use client";

import Link from "next/link";
import type { AdvisoryPhase } from "@/lib/law-firm-development/types";
import { AdvisoryBreadcrumbs } from "@/components/law-firm-development/AdvisoryBreadcrumbs";
import {
  advisoryDocumentHref,
  advisoryProgrammeHref,
  advisoryToolHref,
} from "@/lib/law-firm-development/routes";
import {
  getDocumentStatus,
  phaseCompleteCountForPhase,
  phaseProgressPercentForPhase,
  statusLabel,
} from "@/lib/law-firm-development/progress";
import { useAdvisoryProgress } from "@/hooks/useAdvisoryProgress";
import { useAdvisoryCatalogContext } from "@/components/law-firm-development/AdvisoryCatalogContext";
import { displayZipEntryName } from "@/lib/marketplace-zip-preview";

type Props = { phase: AdvisoryPhase };

function docSummary(description: string, sourcePath?: string): string {
  if (sourcePath) {
    return displayZipEntryName(sourcePath);
  }
  if (description.startsWith("Package file:")) {
    const path = description.replace(/^Package file:\s*/i, "").trim();
    return displayZipEntryName(path);
  }
  return description;
}

export function AdvisoryPhaseView({ phase }: Props) {
  const { courseQuery, phaseDocumentTotal } = useAdvisoryCatalogContext();
  const { ready, statuses } = useAdvisoryProgress();
  const total = phaseDocumentTotal(phase.id);
  const complete = ready ? phaseCompleteCountForPhase(phase, statuses) : 0;
  const pct = ready ? phaseProgressPercentForPhase(phase, statuses) : 0;

  if (phase.categories.length === 0) {
    return (
      <div className="px-4 py-8 sm:px-8">
        <AdvisoryBreadcrumbs
          crumbs={[
            { label: "Implementation Programme", href: advisoryProgrammeHref(courseQuery) },
            { label: `Phase ${phase.number}` },
          ]}
        />
        <p className="text-[0.7rem] font-bold uppercase tracking-widest text-[#C18C43]">
          Phase {String(phase.number).padStart(2, "0")}
        </p>
        <h1 className="mt-2 [font-family:var(--font-lfp-serif),Georgia,serif] text-3xl font-bold text-white">
          {phase.title}
        </h1>
        <p className="mt-4 max-w-xl font-medium text-white/55">{phase.description}</p>
        <p className="advisory-card advisory-card--elevated mt-8 px-5 py-6 font-medium text-white/60">
          Full document listings for this phase are being added to the workspace. The Tier 1 package includes{" "}
          {total} documents in this phase — your progress will appear here as content is published.
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 py-8 sm:px-8 lg:px-10">
      <AdvisoryBreadcrumbs
        crumbs={[
          { label: "Implementation Programme", href: advisoryProgrammeHref(courseQuery) },
          { label: `Phase ${phase.number} — ${phase.title}` },
        ]}
      />
      <p className="text-[0.7rem] font-bold uppercase tracking-widest text-[#C18C43]">
        Phase {String(phase.number).padStart(2, "0")}
      </p>
      <h1 className="mt-2 [font-family:var(--font-lfp-serif),Georgia,serif] text-[clamp(1.5rem,3vw,2.25rem)] font-bold text-white">
        {phase.title}
      </h1>
      <p className="mt-4 max-w-2xl text-[0.95rem] font-medium leading-relaxed text-white/55">
        {phase.description}
      </p>

      <div className="advisory-card advisory-card--elevated advisory-phase-summary mt-8 flex flex-wrap items-center gap-6 px-5 py-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-white/40">Phase progress</p>
          <p className="mt-1 text-sm font-semibold text-white/70">
            {complete} of {total} documents complete · {phase.categories.length} sub-categories
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-2 w-32 overflow-hidden rounded-full bg-white/10 sm:w-48">
            <div className="h-full rounded-full bg-[#C18C43]" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-lg font-bold text-[#E3BA65]">{pct}%</span>
        </div>
        {phase.estimatedWeeks && (
          <p className="text-sm font-medium text-white/45">
            Estimated {phase.estimatedWeeks} weeks to phase completion
          </p>
        )}
      </div>

      <div className="mt-10 space-y-10">
        {phase.categories.map((cat) => {
          const catComplete = cat.documents.filter((d) => statuses[d.id] === "complete").length;
          return (
            <section key={cat.id}>
              <h2 className="text-lg font-bold text-white">
                {cat.name} ({cat.code})
                <span className="ml-2 text-sm font-semibold text-white/40">
                  {catComplete} of {cat.documents.length} complete
                </span>
              </h2>
              <ul className="mt-4 space-y-3">
                {cat.documents.map((doc) => {
                  const status = getDocumentStatus(statuses, doc.id);
                  const href =
                    doc.kind === "tool" && doc.toolPath
                      ? advisoryToolHref(doc.toolPath, courseQuery)
                      : advisoryDocumentHref(doc.id, courseQuery);
                  const cta =
                    status === "complete" ? "View" : status === "in_progress" ? "Continue" : "Open";
                  return (
                    <li
                      key={doc.id}
                      className="advisory-card advisory-card--elevated advisory-phase-doc flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="advisory-phase-doc__code">{doc.code}</p>
                        <p className="advisory-phase-doc__title mt-0.5">{doc.title}</p>
                        <p className="advisory-phase-doc__desc mt-1">
                          {docSummary(doc.description, doc.sourcePath)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="advisory-phase-doc__status">{statusLabel(status)}</span>
                        <Link
                          href={href}
                          className="rounded-[2px] border border-[rgba(193,140,67,0.35)] px-4 py-2 text-[0.75rem] font-bold uppercase tracking-wide text-[#C18C43] hover:bg-[rgba(193,140,67,0.1)]"
                        >
                          {cta} →
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
