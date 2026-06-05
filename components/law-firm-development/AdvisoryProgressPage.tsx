"use client";

import Link from "next/link";
import { advisoryPhaseHref } from "@/lib/law-firm-development/routes";
import { useAdvisoryCatalogContext } from "@/components/law-firm-development/AdvisoryCatalogContext";
import {
  phaseCompleteCountForPhase,
  phaseProgressPercentForPhase,
  programmeDaysLabel,
} from "@/lib/law-firm-development/progress";
import { useAdvisoryProgress } from "@/hooks/useAdvisoryProgress";

export function AdvisoryProgressPage() {
  const { phases, courseQuery, totalDocuments, phaseDocumentTotal } = useAdvisoryCatalogContext();
  const { ready, loading, statuses, overallPercent, documentsComplete, programmeStartedAt } =
    useAdvisoryProgress();

  return (
    <div className="px-4 py-8 sm:px-8 lg:px-10">
      <h1 className="[font-family:var(--font-lfp-serif),Georgia,serif] text-3xl font-semibold text-white">
        Your firm&apos;s progress at a glance
      </h1>
      <p className="mt-2 text-white/50">
        Track where your firm stands across all phases. Export the report for your partners&apos; meeting.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Overall progress", value: loading ? "—" : `${overallPercent}%` },
          {
            label: "Documents complete",
            value: loading ? "—" : `${documentsComplete}/${totalDocuments}`,
          },
          {
            label: "Days in programme",
            value: loading ? "—" : programmeDaysLabel(programmeStartedAt),
          },
          {
            label: "In workspace",
            value: loading
              ? "—"
              : `${Object.values(statuses).filter((s) => s && s !== "not_started").length} started`,
          },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-[rgba(193,140,67,0.12)] bg-[#221913] px-4 py-4"
          >
            <p className="text-xs uppercase tracking-wide text-white/40">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold text-[#C18C43]">{s.value}</p>
          </div>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-white">Progress by phase</h2>
        <ul className="mt-4 space-y-4">
          {phases.map((phase) => {
            const pct = ready ? phaseProgressPercentForPhase(phase, statuses) : 0;
            const complete = ready ? phaseCompleteCountForPhase(phase, statuses) : 0;
            const total = phaseDocumentTotal(phase.id);
            return (
              <li key={phase.id}>
                <Link
                  href={advisoryPhaseHref(phase.slug, courseQuery)}
                  className="block rounded-lg border border-[rgba(193,140,67,0.1)] bg-[rgba(34,25,19,0.5)] p-4 hover:border-[rgba(193,140,67,0.25)]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-white">Phase {phase.number} — {phase.title}</p>
                      <p className="text-sm text-white/45">{phase.subtitle}</p>
                    </div>
                    <p className="text-sm font-semibold text-[#E3BA65]">
                      {pct}% · {complete} of {total} docs
                    </p>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-[#C18C43]" style={{ width: `${pct}%` }} />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="mt-10 rounded-lg border border-[rgba(193,140,67,0.15)] bg-[#221913] p-6 text-center">
        <h3 className="font-semibold text-white">Export your progress report</h3>
        <p className="mt-2 text-sm text-white/45">
          Download a branded PDF for your partners&apos; meeting or board review.
        </p>
        <button
          type="button"
          disabled
          className="mt-4 rounded-[2px] border border-[rgba(193,140,67,0.3)] px-6 py-2.5 text-sm font-semibold text-white/40"
        >
          Export PDF Report (soon)
        </button>
      </div>
    </div>
  );
}
