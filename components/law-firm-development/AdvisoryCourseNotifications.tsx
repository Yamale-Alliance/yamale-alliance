"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Bell } from "lucide-react";
import { useAdvisoryCatalogContext } from "@/components/law-firm-development/AdvisoryCatalogContext";
import {
  advisoryDashboardHref,
  advisoryDocumentHref,
  advisoryProgrammeHref,
  advisoryToolHref,
} from "@/lib/law-firm-development/routes";
import { useAdvisoryProgress } from "@/hooks/useAdvisoryProgress";
import { displayZipEntryName } from "@/lib/marketplace-zip-preview";

type NotificationItem = {
  id: string;
  title: string;
  detail: string;
  href: string;
};

function docHref(
  doc: { id: string; kind: string; toolPath?: string },
  courseQuery: string | null
): string {
  if (doc.kind === "tool" && doc.toolPath) {
    return advisoryToolHref(doc.toolPath, courseQuery);
  }
  return advisoryDocumentHref(doc.id, courseQuery);
}

export function AdvisoryCourseNotifications() {
  const { courseQuery, listDocuments, getCategory } = useAdvisoryCatalogContext();
  const { statuses, milestones, ready, overallPercent, documentsComplete, loading } =
    useAdvisoryProgress();
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const items = useMemo((): NotificationItem[] => {
    if (!ready) return [];

    const list: NotificationItem[] = [];
    const docs = listDocuments();

    const inProgress = docs.filter((d) => statuses[d.id] === "in_progress");
    for (const doc of inProgress.slice(0, 5)) {
      const cat = getCategory(doc.categoryId);
      list.push({
        id: `progress-${doc.id}`,
        title: `Continue ${doc.code}`,
        detail: `${doc.title}${cat ? ` · ${cat.name}` : ""}`,
        href: docHref(doc, courseQuery),
      });
    }

    const notStarted = docs.filter((d) => statuses[d.id] === "not_started").length;
    if (notStarted > 0 && inProgress.length === 0) {
      list.push({
        id: "not-started",
        title: `${notStarted} module${notStarted === 1 ? "" : "s"} not started`,
        detail: "Open your implementation programme to begin the next template.",
        href: advisoryProgrammeHref(courseQuery),
      });
    }

    if (overallPercent > 0 && overallPercent < 100) {
      list.push({
        id: "overall-progress",
        title: `Course progress: ${overallPercent}%`,
        detail: `${documentsComplete} document${documentsComplete === 1 ? "" : "s"} completed in this package.`,
        href: advisoryDashboardHref(courseQuery),
      });
    }

    const upcoming = milestones.filter((m) => !m.completed).slice(0, 3);
    for (const m of upcoming) {
      list.push({
        id: `milestone-${m.id}`,
        title: m.title,
        detail: m.dueLabel ? `Due ${m.dueLabel}` : "Milestone on your implementation plan",
        href: advisoryDashboardHref(courseQuery),
      });
    }

    const withPaths = docs.filter((d) => d.sourcePath).length;
    if (withPaths > 0 && list.length < 6) {
      const sample = docs.find((d) => d.sourcePath && statuses[d.id] !== "complete");
      if (sample?.sourcePath) {
        list.push({
          id: "package-ready",
          title: "Package templates available",
          detail: `Latest file: ${displayZipEntryName(sample.sourcePath)}`,
          href: docHref(sample, courseQuery),
        });
      }
    }

    return list.slice(0, 8);
  }, [
    ready,
    listDocuments,
    statuses,
    getCategory,
    courseQuery,
    milestones,
    overallPercent,
    documentsComplete,
  ]);

  const count = items.length;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || !btnRef.current) return;

    const updatePosition = () => {
      const rect = btnRef.current!.getBoundingClientRect();
      setPanelStyle({
        position: "fixed",
        top: rect.bottom + 8,
        right: Math.max(16, window.innerWidth - rect.right),
        width: "min(360px, calc(100vw - 2rem))",
        zIndex: 10000,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const panel =
    open && mounted ? (
      <div
        ref={panelRef}
        className="advisory-notifications__panel"
        style={panelStyle}
        role="menu"
      >
        <div className="advisory-notifications__panel-head">
          <p className="advisory-notifications__panel-title">Course updates</p>
          <p className="advisory-notifications__panel-sub">
            Progress and modules in your implementation package
          </p>
        </div>
        <ul className="advisory-notifications__list">
          {loading && (
            <li className="advisory-notifications__empty">Loading course activity…</li>
          )}
          {!loading && items.length === 0 && (
            <li className="advisory-notifications__empty">
              You are up to date. Open a module from the programme to start tracking progress.
            </li>
          )}
          {!loading &&
            items.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="advisory-notifications__item"
                >
                  <p className="advisory-notifications__item-title">{item.title}</p>
                  <p className="advisory-notifications__item-detail">{item.detail}</p>
                </Link>
              </li>
            ))}
        </ul>
        <div className="advisory-notifications__panel-foot">
          <Link
            href={advisoryProgrammeHref(courseQuery)}
            onClick={() => setOpen(false)}
            className="advisory-nav-pill advisory-nav-pill--sm"
          >
            View full programme →
          </Link>
        </div>
      </div>
    ) : null;

  return (
    <div className="advisory-notifications hidden sm:block">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="advisory-topbar__btn advisory-topbar__btn--ghost"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Course updates${count > 0 ? `, ${count} items` : ""}`}
      >
        <Bell className="h-4 w-4" aria-hidden />
        {count > 0 && <span className="advisory-topbar__badge">{count > 9 ? "9+" : count}</span>}
      </button>
      {panel && createPortal(panel, document.body)}
    </div>
  );
}
