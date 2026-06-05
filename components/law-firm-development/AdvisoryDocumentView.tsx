"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AdvisoryDocument } from "@/lib/law-firm-development/types";
import { AdvisoryBreadcrumbs } from "@/components/law-firm-development/AdvisoryBreadcrumbs";
import { useAdvisoryCatalogContext } from "@/components/law-firm-development/AdvisoryCatalogContext";
import {
  advisoryDocumentHref,
  advisoryPhaseHref,
  advisoryProgrammeHref,
  advisoryToolHref,
} from "@/lib/law-firm-development/routes";
import { getDocumentStatus, statusLabel } from "@/lib/law-firm-development/progress";
import { useAdvisoryProgress } from "@/hooks/useAdvisoryProgress";
import { AdvisoryDocumentWorkspace } from "@/components/law-firm-development/AdvisoryDocumentWorkspace";

type Props = { document: AdvisoryDocument };

export function AdvisoryDocumentView({ document: doc }: Props) {
  const { courseQuery, courseId, getPhaseById, getCategory } = useAdvisoryCatalogContext();
  const { statuses, ready, setDocumentStatus, setDocumentNotes, saving, snapshot } =
    useAdvisoryProgress();
  const status = getDocumentStatus(statuses, doc.id);
  const [notes, setNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(false);

  const phase = getPhaseById(doc.phaseId);
  const category = getCategory(doc.categoryId);
  const related = category?.documents.filter((d) => d.id !== doc.id).slice(0, 3) ?? [];

  useEffect(() => {
    if (!ready) return;
    setNotes(snapshot?.documentNotes?.[doc.id] ?? "");
  }, [ready, snapshot?.documentNotes, doc.id]);

  useEffect(() => {
    if (!ready || status !== "not_started") return;
    void setDocumentStatus(doc.id, "in_progress");
  }, [ready, doc.id, status, setDocumentStatus]);

  return (
    <div className="px-4 py-8 sm:px-8 lg:px-10">
      <AdvisoryBreadcrumbs
        crumbs={[
          { label: "Implementation Programme", href: advisoryProgrammeHref(courseQuery) },
          ...(phase
            ? [{ label: `Phase ${phase.number}`, href: advisoryPhaseHref(phase.slug, courseQuery) }]
            : []),
          ...(category ? [{ label: category.name }] : []),
          { label: doc.code },
        ]}
      />

      <p className="advisory-page-eyebrow">
        {doc.code} · {category?.name}
      </p>
      <h1 className="advisory-page-title">{doc.title}</h1>
      <p className="advisory-page-meta">
        {doc.lastUpdated && <>Last updated: {doc.lastUpdated} · </>}
        {doc.estimatedMinutes && <>Estimated reading time: {doc.estimatedMinutes} minutes · </>}
        {statusLabel(status)}
      </p>

      <div className="mt-8 space-y-6 text-[0.95rem] leading-relaxed text-white/70">
        {courseId && doc.sourcePath ? (
          <AdvisoryDocumentWorkspace
            marketplaceItemId={courseId}
            sourcePath={doc.sourcePath}
            notes={notes}
            onSaveNotes={(encoded) =>
              setDocumentNotes(doc.id, encoded).then(() => {
                setNotes(encoded);
                setNotesSaved(true);
              })
            }
            onDraftDirty={() => setNotesSaved(false)}
            saving={saving}
            notesSaved={notesSaved}
          />
        ) : (
          <>
            {(doc.sections ?? [{ title: "Summary", body: doc.description }]).map((section) => (
              <section key={section.title}>
                <h2 className="text-lg font-semibold text-white">{section.title}</h2>
                <p className="mt-2">{section.body}</p>
              </section>
            ))}
          </>
        )}

        {courseId && !doc.sourcePath ? (
          <p className="rounded-lg border border-[rgba(193,140,67,0.12)] bg-[#221913] px-4 py-4 text-sm text-white/45">
            No matching file was found in your package for this module. Ask an administrator to sync course
            modules from the ZIP in the marketplace admin panel, or open another document from the library.
          </p>
        ) : (
          <p className="text-sm italic text-white/40">
            Open this workspace from your purchased course in the Vault to view package files inline.
          </p>
        )}
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        {!(courseId && doc.sourcePath) ? (
          <div>
            <h3 className="advisory-sidebar-heading">Your notes</h3>
            <p className="mt-1 text-xs text-white/40">Private to your firm. Saved to your account.</p>
            <textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setNotesSaved(false);
              }}
              rows={5}
              className="mt-3 w-full rounded-md border border-[rgba(193,140,67,0.2)] bg-[#1a120d] px-3 py-2 text-sm text-white"
              placeholder="Add implementation notes for your partners…"
            />
            <button
              type="button"
              disabled={saving}
              onClick={() =>
                void setDocumentNotes(doc.id, notes).then(() => setNotesSaved(true))
              }
              className="mt-2 rounded-[2px] border border-[rgba(193,140,67,0.35)] px-4 py-2 text-sm text-[#C18C43] hover:bg-[rgba(193,140,67,0.08)] disabled:opacity-50"
            >
              {saving ? "Saving…" : notesSaved ? "Saved" : "Save notes"}
            </button>
          </div>
        ) : (
          <p className="text-sm text-white/45">
            Type directly in the document, save your draft, and download your filled-in Word file when
            ready. Mark complete when you are done with this module.
          </p>
        )}

        <aside className="rounded-lg border border-[rgba(193,140,67,0.15)] bg-[#221913] p-5">
          <h3 className="advisory-sidebar-heading">Actions</h3>
          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              disabled={saving || status === "complete"}
              onClick={() => void setDocumentStatus(doc.id, "complete")}
              className="rounded-[2px] bg-[#C18C43] px-4 py-2 text-sm font-semibold text-[#221913] hover:bg-[#E3BA65] disabled:opacity-50"
            >
              Mark as complete
            </button>
            {status === "complete" && (
              <button
                type="button"
                disabled={saving}
                onClick={() => void setDocumentStatus(doc.id, "in_progress")}
                className="rounded-[2px] border border-[rgba(193,140,67,0.35)] px-4 py-2 text-sm text-[#C18C43]"
              >
                Mark in progress again
              </button>
            )}
            {courseId && doc.sourcePath ? (
              <a
                href={`/api/marketplace/${courseId}/zip-archive`}
                download
                className="rounded-[2px] border border-[rgba(193,140,67,0.35)] px-4 py-2 text-center text-sm text-[#C18C43] hover:bg-[rgba(193,140,67,0.08)]"
              >
                Download full package (ZIP)
              </a>
            ) : (
              <button
                type="button"
                disabled
                className="rounded-[2px] border border-[rgba(193,140,67,0.25)] px-4 py-2 text-sm text-white/40"
              >
                Package file unavailable
              </button>
            )}
            {doc.toolPath && (
              <Link
                href={advisoryToolHref(doc.toolPath, courseQuery)}
                className="advisory-nav-pill w-full justify-center"
              >
                Open fillable template
              </Link>
            )}
          </div>
          {related.length > 0 && (
            <>
              <h3 className="advisory-sidebar-heading mt-6">Related documents</h3>
              <ul className="mt-2 space-y-1 text-sm">
                {related.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={advisoryDocumentHref(r.id, courseQuery)}
                      className="advisory-nav-pill advisory-nav-pill--sm w-full max-w-full justify-start"
                    >
                      {r.code} {r.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
