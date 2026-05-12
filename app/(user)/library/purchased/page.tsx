"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, FileDown, Loader2, BookOpen } from "lucide-react";
import { readPaidLawIdsFromStorage, PAID_LAWS_STORAGE_KEY } from "@/lib/library-paid-laws-storage";
import { syncDocumentExportUnlocksToLocalStorage } from "@/lib/library-document-export-unlocks-client";

type Law = {
  id: string;
  title: string;
  country: string;
  category: string;
  status: string;
};

const RETURN_PATH = "/library/purchased";

export default function LibraryPurchasedLawsPage() {
  const [lawIds, setLawIds] = useState<string[]>([]);
  const [laws, setLaws] = useState<Law[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [idsHydrated, setIdsHydrated] = useState(false);

  const hydrateIds = useCallback(async () => {
    try {
      await syncDocumentExportUnlocksToLocalStorage();
    } catch {
      // ignore
    }
    setLawIds(readPaidLawIdsFromStorage());
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await hydrateIds();
      if (!cancelled) setIdsHydrated(true);
    })();
    const onStorage = (e: StorageEvent) => {
      if (e.key === PAID_LAWS_STORAGE_KEY || e.key === null) void hydrateIds();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
    };
  }, [hydrateIds]);

  useEffect(() => {
    const onFocus = () => {
      void hydrateIds();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [hydrateIds]);

  useEffect(() => {
    if (!idsHydrated) return;
    if (lawIds.length === 0) {
      setLaws([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const load = async () => {
      try {
        const lawPromises = lawIds.map(async (lawId) => {
          const lawRes = await fetch(`/api/laws/${lawId}`, { credentials: "include" });
          if (!lawRes.ok) return null;
          const lawData = (await lawRes.json()) as {
            id: string;
            title: string;
            countries?: { name: string } | null;
            categories?: { name: string } | null;
            status?: string;
          };
          return {
            id: lawData.id,
            title: lawData.title,
            country: lawData.countries?.name ?? "",
            category: lawData.categories?.name ?? "",
            status: lawData.status ?? "In force",
          } satisfies Law;
        });
        const lawResults = await Promise.all(lawPromises);
        if (cancelled) return;
        const valid = lawResults.filter((law): law is Law => law !== null);
        setLaws(valid);
      } catch {
        if (!cancelled) setError("Could not load purchased laws.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [lawIds, idsHydrated]);

  return (
    <div className="min-h-screen">
      <div className="relative overflow-hidden border-b border-border/50 bg-gradient-to-b from-primary/5 to-transparent">
        <div
          className="absolute inset-0 -z-10 opacity-50 dark:opacity-30"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23c18c43' fill-opacity='0.06' fill-rule='evenodd'%3E%3Cpath d='M0 40L40 0H20L0 20m40 20V20L20 40'/%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
        <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
          <Link
            href="/library"
            className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to library
          </Link>
          <div className="flex items-center gap-3">
            <FileDown className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Purchased laws</h1>
              <p className="mt-1 text-muted-foreground">
                Documents you unlocked for PDF export on your account — open one to preview, download, or print again.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-8 text-center">
            <p className="text-destructive">{error}</p>
          </div>
        ) : lawIds.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/80 bg-card/80 px-8 py-12 text-center">
            <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h2 className="mt-4 text-lg font-semibold text-foreground">No purchased laws yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              When you pay to export a law from the library, it will appear here while you are signed in.
            </p>
            <Link
              href="/library"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Browse library
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : lawIds.length > 0 && laws.length === 0 && !loading ? (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-8 py-10 text-center">
            <p className="font-medium text-foreground">Could not load law details</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {lawIds.length} {lawIds.length === 1 ? "entry is" : "entries are"} saved on this device, but the library no longer returned those documents. They may have been removed or your session may have expired.
            </p>
            <Link href="/library" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
              <ArrowLeft className="h-4 w-4" /> Back to library
            </Link>
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm font-medium text-muted-foreground">
              {laws.length} purchased {laws.length === 1 ? "law" : "laws"}
              {laws.length < lawIds.length ? (
                <span className="text-amber-700 dark:text-amber-400">
                  {" "}
                  — some entries could not be loaded (they may have been removed).
                </span>
              ) : null}
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {laws.map((law) => (
                <Link
                  key={law.id}
                  href={`/library/${law.id}?returnTo=${encodeURIComponent(RETURN_PATH)}`}
                  className="group flex flex-col rounded-2xl border border-primary/40 bg-card p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-lg hover:shadow-primary/20"
                >
                  <div className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-full border border-primary/30 bg-primary/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
                    <FileDown className="h-3 w-3" />
                    PDF unlocked
                  </div>
                  <h2 className="font-semibold text-foreground group-hover:text-primary">{law.title}</h2>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    {law.country ? <span>{law.country}</span> : null}
                    {law.country && law.category ? <span>·</span> : null}
                    {law.category ? <span>{law.category}</span> : null}
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <span className="rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
                      {law.status || "In force"}
                    </span>
                    <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition group-hover:opacity-100">
                      Open
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
