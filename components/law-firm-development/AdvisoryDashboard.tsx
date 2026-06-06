"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { getTimeOfDayGreeting } from "@/lib/time-of-day-greeting";
import { useAppUser } from "@/components/auth/AppAuthProvider";
import {
  advisoryDocumentHref,
  advisoryPhaseHref,
  advisoryProgrammeHref,
  advisoryToolHref,
} from "@/lib/law-firm-development/routes";
import { useAdvisoryCatalogContext } from "@/components/law-firm-development/AdvisoryCatalogContext";
import {
  nextMilestoneDueLabel,
  phaseProgressPercentForPhase,
  statusLabel,
} from "@/lib/law-firm-development/progress";
import { useAdvisoryProgress } from "@/hooks/useAdvisoryProgress";
import { AdvisoryFirmSettingsDialog } from "@/components/law-firm-development/AdvisoryFirmSettingsDialog";

export function AdvisoryDashboard() {
  const t = useTranslations("advisory");
  const { user } = useAppUser();
  const {
    phases,
    courseQuery,
    totalDocuments,
    listDocuments,
    getDocument,
    getCategory,
    phaseDocumentTotal,
  } = useAdvisoryCatalogContext();
  const {
    snapshot,
    milestones,
    ready,
    loading,
    saving,
    statuses,
    overallPercent,
    documentsComplete,
    updateProfile,
    createMilestone,
    completeMilestone,
  } = useAdvisoryProgress();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [milestoneDue, setMilestoneDue] = useState("");
  const [timeGreeting, setTimeGreeting] = useState<string | null>(null);

  useEffect(() => {
    setTimeGreeting(getTimeOfDayGreeting());
  }, []);

  const firstName =
    user?.firstName?.trim() ||
    snapshot?.firmName?.split(/\s+/)[0] ||
    "there";
  const inProgressDocs = listDocuments()
    .filter((d) => statuses[d.id] === "in_progress")
    .slice(0, 3);
  const recentlyCompletedDocs = listDocuments()
    .filter((d) => statuses[d.id] === "complete")
    .slice(0, 3);
  const resumeDocs = inProgressDocs.length > 0 ? inProgressDocs : recentlyCompletedDocs;
  const resumeKind = inProgressDocs.length > 0 ? "in_progress" : recentlyCompletedDocs.length > 0 ? "complete" : "none";
  const activePhase = (() => {
    for (const phase of phases) {
      const docs = phase.categories.flatMap((c) => c.documents);
      if (docs.length === 0) continue;
      if (docs.some((d) => statuses[d.id] !== "complete")) {
        return `Phase ${phase.number}`;
      }
    }
    return phases.length > 0 ? t("complete") : "—";
  })();
  const trackableCount = phases.reduce(
    (n, p) => n + p.categories.reduce((c, cat) => c + cat.documents.length, 0),
    0
  );

  return (
    <div className="min-w-0 px-4 py-8 sm:px-8 lg:px-10">
      <div className="advisory-dash-hero">
        <div className="advisory-dash-hero__head">
          <div>
            <p className="advisory-dash-hero__eyebrow text-sm">
              {timeGreeting ? `${timeGreeting}, ${firstName}` : `Hello, ${firstName}`}
            </p>
            <h1 className="advisory-dash-hero__title font-semibold">
              {loading ? t("loadingProgramme") : t("progressComplete", { percent: overallPercent })}
            </h1>
            <p className="advisory-dash-hero__sub text-[0.95rem] leading-relaxed">
              {documentsComplete === 0
                ? t("startPhase1")
                : `You have completed ${documentsComplete} of ${totalDocuments} documents (${trackableCount} available in the workspace so far).`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="advisory-dash-hero__profile-btn shrink-0 px-4 py-2 text-[0.75rem] font-semibold uppercase tracking-wide"
          >
            Firm profile
          </button>
        </div>

        <div className="advisory-dash-stats">
          {[
            { label: t("overallProgress"), value: loading ? "—" : `${overallPercent}%` },
            {
              label: t("documentsComplete"),
              value: loading ? "—" : `${documentsComplete}/${totalDocuments}`,
            },
            { label: t("activePhase"), value: loading ? "—" : activePhase },
            { label: t("nextMilestone"), value: loading ? "—" : nextMilestoneDueLabel(milestones) },
          ].map((stat) => (
            <div key={stat.label} className="advisory-dash-stat">
              <p className="advisory-dash-stat__label">{stat.label}</p>
              <p className="advisory-dash-stat__value">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-white">Continue where you left off</h2>
        <p className="mt-1 text-sm text-white/45">
          {resumeKind === "in_progress"
            ? "Documents you have marked as in progress."
            : resumeKind === "complete"
              ? "Recently completed modules — open to review or keep going in the programme."
              : "Open a module from your implementation programme to start tracking progress."}
        </p>
        {resumeKind === "none" ? (
          <p className="advisory-card advisory-card--elevated mt-4 px-4 py-6 text-sm font-medium text-white/55">
            No modules started yet. Open a document from the{" "}
            <Link href={advisoryProgrammeHref(courseQuery)} className="advisory-nav-pill advisory-nav-pill--sm">
              implementation programme
            </Link>{" "}
            and mark it in progress or complete as you work.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {resumeDocs.map((doc) => {
              const cat = getCategory(doc.categoryId);
              const status = statuses[doc.id];
              const href =
                doc.kind === "tool" && doc.toolPath
                  ? advisoryToolHref(doc.toolPath, courseQuery)
                  : advisoryDocumentHref(doc.id, courseQuery);
              return (
                <Link
                  key={doc.id}
                  href={href}
                  className="advisory-card advisory-card--elevated block p-4 transition hover:border-[#c18c43]"
                >
                  <p className="text-[0.7rem] font-bold uppercase tracking-wide text-[#C18C43]">
                    {doc.code} · {cat?.name}
                  </p>
                  <p className="advisory-phase-doc__title mt-2">{doc.title}</p>
                  <p className="advisory-phase-doc__status mt-2">{statusLabel(status)}</p>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-white">Milestones</h2>
        <p className="mt-1 text-sm text-white/45">Set targets for your partners and implementation lead.</p>
        <form
          className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            const title = milestoneTitle.trim();
            if (!title) return;
            void createMilestone(title, milestoneDue ? new Date(milestoneDue).toISOString() : null).then(() => {
              setMilestoneTitle("");
              setMilestoneDue("");
            });
          }}
        >
          <div className="min-w-0 flex-1">
            <label className="text-xs uppercase text-white/40">Title</label>
            <input
              value={milestoneTitle}
              onChange={(e) => setMilestoneTitle(e.target.value)}
              className="mt-1 w-full rounded-md border border-[rgba(193,140,67,0.2)] bg-[#1a120d] px-3 py-2 text-sm text-white"
              placeholder="e.g. Partner sign-off on governance"
            />
          </div>
          <div>
            <label className="text-xs uppercase text-white/40">Due date</label>
            <input
              type="date"
              value={milestoneDue}
              onChange={(e) => setMilestoneDue(e.target.value)}
              className="mt-1 rounded-md border border-[rgba(193,140,67,0.2)] bg-[#1a120d] px-3 py-2 text-sm text-white"
            />
          </div>
          <button
            type="submit"
            disabled={saving || !milestoneTitle.trim()}
            className="rounded-[2px] bg-[#C18C43] px-4 py-2 text-sm font-semibold text-[#221913] disabled:opacity-50"
          >
            Add milestone
          </button>
        </form>
        {milestones.length === 0 ? (
          <p className="mt-4 text-sm text-white/40">No milestones yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {milestones.map((m) => (
              <li
                key={m.id}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-3 ${
                  m.completed
                    ? "border-[rgba(193,140,67,0.08)] bg-white/[0.02] text-white/40"
                    : "border-[rgba(193,140,67,0.12)] bg-[#221913]"
                }`}
              >
                <span className={m.completed ? "line-through" : "text-white/85"}>{m.title}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-white/45">
                    {m.completed ? m.completedLabel : m.dueLabel}
                  </span>
                  {!m.completed && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void completeMilestone(m.id)}
                      className="text-xs font-semibold uppercase text-[#C18C43] hover:text-[#E3BA65]"
                    >
                      Mark done
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12 border-t border-[rgba(193,140,67,0.1)] pt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Implementation by phase</h2>
            <p className="mt-1 text-sm text-white/45">
              Click any phase to see its categories and documents. Progress saves to your account automatically.
            </p>
          </div>
          <Link href={advisoryProgrammeHref(courseQuery)} className="advisory-nav-pill">
            View programme →
          </Link>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {phases.map((phase) => {
            const pct = ready ? phaseProgressPercentForPhase(phase, statuses) : 0;
            const total = phaseDocumentTotal(phase.id);
            const subCount = phase.categories.length || 0;
            return (
              <Link
                key={phase.id}
                href={advisoryPhaseHref(phase.slug, courseQuery)}
                className="advisory-card advisory-card--elevated block p-5 transition hover:border-[#c18c43]"
              >
                <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-[#C18C43]">
                  Phase {String(phase.number).padStart(2, "0")}
                </p>
                <h3 className="mt-2 font-semibold text-white">{phase.title}</h3>
                <p className="mt-2 text-sm text-white/45">{phase.subtitle}</p>
                <div className="mt-4 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-[#C18C43] transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-[#E3BA65]">{pct}%</span>
                </div>
                <p className="mt-2 text-xs text-white/40">
                  {subCount > 0
                    ? `${subCount} sub-categories · ${total} documents`
                    : "Content coming to workspace"}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      <AdvisoryFirmSettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        initial={{
          firmName: snapshot?.firmName,
          firmLocation: snapshot?.firmLocation,
          subscriptionLabel: snapshot?.subscriptionLabel,
        }}
        onSave={updateProfile}
        saving={saving}
      />
    </div>
  );
}
