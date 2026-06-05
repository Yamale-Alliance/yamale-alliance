"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useAdvisoryCatalogContext } from "@/components/law-firm-development/AdvisoryCatalogContext";
import { advisoryDashboardHref } from "@/lib/law-firm-development/routes";

export type AdvisoryCrumb = { label: string; href?: string };

export function AdvisoryBreadcrumbs({ crumbs }: { crumbs: AdvisoryCrumb[] }) {
  const { courseQuery } = useAdvisoryCatalogContext();

  return (
    <nav aria-label="Breadcrumb" className="advisory-breadcrumbs mb-6">
      <ol className="advisory-breadcrumbs__list">
        <li>
          <Link href={advisoryDashboardHref(courseQuery)} className="advisory-breadcrumbs__link">
            Dashboard
          </Link>
        </li>
        {crumbs.map((crumb, i) => (
          <li key={`${crumb.label}-${i}`} className="advisory-breadcrumbs__item">
            <ChevronRight className="advisory-breadcrumbs__sep h-3.5 w-3.5 shrink-0" aria-hidden />
            {crumb.href ? (
              <Link href={crumb.href} className="advisory-breadcrumbs__link">
                {crumb.label}
              </Link>
            ) : (
              <span
                className="advisory-breadcrumbs__current"
                aria-current={i === crumbs.length - 1 ? "page" : undefined}
              >
                {crumb.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
