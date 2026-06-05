"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ADVISORY_LIBRARY_FILTER_LABELS } from "@/lib/law-firm-development/catalog";
import {
  advisoryDocumentHref,
  advisoryToolHref,
} from "@/lib/law-firm-development/routes";
import { getDocumentStatus, statusLabel } from "@/lib/law-firm-development/progress";
import { useAdvisoryProgress } from "@/hooks/useAdvisoryProgress";
import { useAdvisoryCatalogContext } from "@/components/law-firm-development/AdvisoryCatalogContext";
import type { AdvisoryDocumentKind } from "@/lib/law-firm-development/types";

export function AdvisoryLibrary() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const q = searchParams.get("q")?.trim();
    if (q) setQuery(q);
  }, [searchParams]);
  const { statuses } = useAdvisoryProgress();
  const { listDocuments, getCategory, courseQuery, totalDocuments } = useAdvisoryCatalogContext();
  const docs = listDocuments();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return docs.filter((d) => {
      if (filter !== "all" && d.kind !== filter) return false;
      if (!q) return true;
      const cat = getCategory(d.categoryId);
      return (
        d.title.toLowerCase().includes(q) ||
        d.code.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        (cat?.name.toLowerCase().includes(q) ?? false)
      );
    });
  }, [docs, filter, query, getCategory]);

  return (
    <div className="px-4 py-8 sm:px-8 lg:px-10">
      <h1 className="[font-family:var(--font-lfp-serif),Georgia,serif] text-3xl font-semibold text-white">
        All documents and templates
      </h1>
      <p className="mt-2 text-white/50">
        {totalDocuments} documents in this course. Search, filter, or browse
        by category.
      </p>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search documents…"
        className="mt-6 w-full max-w-md rounded-md border border-[rgba(193,140,67,0.2)] bg-[#1a120d] px-4 py-2.5 text-sm text-white placeholder:text-white/30"
      />

      <div className="mt-4 flex flex-wrap gap-2">
        {ADVISORY_LIBRARY_FILTER_LABELS.map((f) => {
          const count =
            f.id === "all"
              ? totalDocuments
              : docs.filter((d) => d.kind === f.id).length;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                filter === f.id
                  ? "bg-[#C18C43] text-[#221913]"
                  : "border border-[rgba(193,140,67,0.2)] text-white/55 hover:text-white"
              }`}
            >
              {f.label} ({count})
            </button>
          );
        })}
      </div>

      <ul className="mt-8 divide-y divide-[rgba(193,140,67,0.08)]">
        {filtered.map((doc) => {
          const cat = getCategory(doc.categoryId);
          const status = getDocumentStatus(statuses, doc.id);
          const href =
            doc.kind === "tool" && doc.toolPath
              ? advisoryToolHref(doc.toolPath, courseQuery)
              : advisoryDocumentHref(doc.id, courseQuery);
          return (
            <li key={doc.id}>
              <Link
                href={href}
                className="flex flex-col gap-2 py-4 transition hover:bg-white/[0.02] sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-[0.75rem] font-semibold text-[#C18C43]">
                    {doc.code} · {cat?.name}
                  </p>
                  <p className="font-medium text-white">{doc.title}</p>
                  <p className="text-sm text-white/45">{doc.description}</p>
                </div>
                <span className="shrink-0 text-xs text-white/40">{statusLabel(status)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      {filtered.length === 0 && (
        <p className="mt-8 text-white/45">No documents match your search.</p>
      )}
    </div>
  );
}
