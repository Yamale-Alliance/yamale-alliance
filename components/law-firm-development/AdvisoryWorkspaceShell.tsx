"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  advisoryDashboardHref,
  advisoryLibraryHref,
  advisoryPhaseHref,
  advisoryProgrammeHref,
  advisoryProgressHref,
  advisoryToolsHref,
} from "@/lib/law-firm-development/routes";
import { phaseCompleteCountForPhase } from "@/lib/law-firm-development/progress";
import { useAdvisoryProgress } from "@/hooks/useAdvisoryProgress";
import { useAdvisoryCatalogContext } from "@/components/law-firm-development/AdvisoryCatalogContext";
import { marketplaceItemDetailHref } from "@/lib/marketplace-public-url";
import { AdvisoryWorkspaceTopBar } from "@/components/law-firm-development/AdvisoryWorkspaceTopBar";
import { PLATFORM_BUSINESS_EMAIL } from "@/lib/platform-emails";
import { PlatformLogo } from "@/components/platform/PlatformLogo";
import { X } from "lucide-react";

function navActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === advisoryDashboardHref()) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

type Props = {
  children: ReactNode;
};

export function AdvisoryWorkspaceShell({ children }: Props) {
  const pathname = usePathname();
  const { phases, courseQuery, phaseDocumentTotal, courseId } = useAdvisoryCatalogContext();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedPhase, setExpandedPhase] = useState<string | null>(
    phases[0]?.id ?? "phase-1"
  );
  const [packageHref, setPackageHref] = useState<string | null>(null);
  const { snapshot, ready, statuses } = useAdvisoryProgress();

  const workspaceLinks = [
    { href: advisoryDashboardHref(courseQuery), label: "Dashboard", icon: "⌂" },
    { href: advisoryProgressHref(courseQuery), label: "Progress Tracker", icon: "◐" },
    { href: advisoryToolsHref(courseQuery), label: "Tools & Templates", icon: "◇" },
    { href: advisoryLibraryHref(courseQuery), label: "Document Library", icon: "≡" },
  ] as const;

  useEffect(() => {
    const qs = courseQuery ? `?course=${encodeURIComponent(courseQuery)}` : "";
    fetch(`/api/advisory/access${qs}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data: { access?: { marketplaceItemId?: string | null; marketplaceSlug?: string | null } }) => {
        const a = data.access;
        if (a?.marketplaceItemId) {
          setPackageHref(
            marketplaceItemDetailHref({
              id: a.marketplaceItemId,
              slug: a.marketplaceSlug,
              packagePage: true,
            })
          );
        }
      })
      .catch(() => setPackageHref(null));
  }, [courseQuery, courseId]);

  const firmName = snapshot?.firmName?.trim() || "Your firm";
  const firmLocation = snapshot?.firmLocation?.trim() ?? "";
  const subscription =
    snapshot?.subscriptionLabel?.trim() || "Tier 1 — Implementation programme";

  return (
    <div className="advisory-workspace">
      {sidebarOpen && (
        <button
          type="button"
          className="advisory-overlay"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`advisory-sidebar${sidebarOpen ? " is-open" : ""}`}>
        <div className="advisory-sidebar__brand">
          <PlatformLogo height={36} width={120} className="advisory-sidebar__brand-logo h-9 w-auto" />
          <div className="advisory-sidebar__brand-text">
            Yamalé
            <small>Advisory</small>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="ml-auto rounded p-1 text-[#d4c7b3] hover:bg-white/5 md:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="advisory-sidebar__nav" aria-label="Workspace">
          <div className="advisory-sidebar__section-label">Workspace</div>
          <ul>
            {workspaceLinks.map((link) => {
              const active = navActive(pathname, link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`advisory-sidebar__nav-item${active ? " is-active" : ""}`}
                  >
                    <span className="advisory-sidebar__nav-icon" aria-hidden>
                      {link.icon}
                    </span>
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="advisory-sidebar__section-label">Implementation programme</div>
          <ul>
            {phases.map((phase) => {
              const expanded = expandedPhase === phase.id;
              const complete = ready ? phaseCompleteCountForPhase(phase, statuses) : 0;
              const total = phaseDocumentTotal(phase.id);
              const phaseActive = pathname?.includes(phase.slug) ?? false;
              return (
                <li key={phase.id} className="advisory-sidebar__phase">
                  <button
                    type="button"
                    onClick={() => setExpandedPhase(expanded ? null : phase.id)}
                    className={`advisory-sidebar__phase-header${phaseActive ? " is-active" : ""}`}
                  >
                    <span className="min-w-0 truncate">
                      Phase {String(phase.number).padStart(2, "0")} — {phase.title.split(" ")[0]}…
                    </span>
                    <span aria-hidden>{expanded ? "▾" : "▸"}</span>
                  </button>
                  {expanded && phase.categories.length > 0 && (
                    <ul>
                      {phase.categories.map((cat) => {
                        const catComplete = cat.documents.filter(
                          (d) => statuses[d.id] === "complete"
                        ).length;
                        return (
                          <li key={cat.id}>
                            <Link
                              href={advisoryPhaseHref(phase.slug, courseQuery)}
                              onClick={() => setSidebarOpen(false)}
                              className="advisory-sidebar__subitem"
                            >
                              <span>{cat.name}</span>
                              <span className="advisory-sidebar__subitem-progress">
                                {ready ? `${catComplete}/${cat.documents.length}` : ""}
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {expanded && phase.categories.length === 0 && (
                    <Link
                      href={advisoryPhaseHref(phase.slug, courseQuery)}
                      className="advisory-sidebar__subitem"
                      onClick={() => setSidebarOpen(false)}
                    >
                      <span>{ready ? `${complete}/${total} docs` : "Coming soon"}</span>
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
          <Link
            href={advisoryProgrammeHref(courseQuery)}
            className="advisory-sidebar__view-all"
            onClick={() => setSidebarOpen(false)}
          >
            View all phases →
          </Link>
        </nav>

        <div className="advisory-sidebar__footer">
          <span className="advisory-sidebar__footer-title">Yamalé Advisory</span>
          <br />
          Dakar, Senegal
          <br />
          <a href={`mailto:${PLATFORM_BUSINESS_EMAIL}`}>{PLATFORM_BUSINESS_EMAIL}</a>
        </div>
      </aside>

      <div className="advisory-topbar-wrap">
        <AdvisoryWorkspaceTopBar
          firmName={firmName}
          firmLocation={firmLocation}
          subscription={subscription}
          onOpenMenu={() => setSidebarOpen(true)}
        />
      </div>

      <main className="advisory-main">
        {packageHref && (
          <div className="flex justify-end px-4 pt-3 sm:px-8">
            <Link href={packageHref} className="advisory-nav-pill advisory-nav-pill--sm">
              Package download →
            </Link>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
