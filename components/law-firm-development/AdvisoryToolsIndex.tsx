"use client";

import Link from "next/link";
import { AdvisoryBreadcrumbs } from "@/components/law-firm-development/AdvisoryBreadcrumbs";
import { advisoryToolHref } from "@/lib/law-firm-development/routes";
import { useAdvisoryCatalogContext } from "@/components/law-firm-development/AdvisoryCatalogContext";

export function AdvisoryToolsIndex() {
  const { listDocuments, courseQuery } = useAdvisoryCatalogContext();
  const tools = listDocuments().filter((d) => d.kind === "tool");

  return (
    <div className="px-4 py-8 sm:px-8 lg:px-10">
      <AdvisoryBreadcrumbs crumbs={[{ label: "Tools & Templates" }]} />
      <h1 className="[font-family:var(--font-lfp-serif),Georgia,serif] text-3xl font-semibold text-white">
        Tools & templates
      </h1>
      <p className="mt-2 text-white/50">Interactive calculators and fillable tools from the Tier 1 package.</p>
      <ul className="mt-8 space-y-4">
        {tools.map((tool) => (
          <li key={tool.id}>
            <Link
              href={tool.toolPath ? advisoryToolHref(tool.toolPath, courseQuery) : "#"}
              className="block rounded-lg border border-[rgba(193,140,67,0.12)] bg-[#221913] p-5 hover:border-[rgba(193,140,67,0.3)]"
            >
              <p className="text-[0.75rem] font-semibold text-[#C18C43]">{tool.code}</p>
              <p className="mt-1 font-medium text-white">{tool.title}</p>
              <p className="mt-1 text-sm text-white/45">{tool.description}</p>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-sm text-white/40">
        More interactive tools from Phases 2–8 will appear here as content is published to the workspace.
      </p>
    </div>
  );
}
