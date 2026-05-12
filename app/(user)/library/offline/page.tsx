"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen, CloudDownload, Loader2 } from "lucide-react";
import type { OfflineLawSnapshot } from "@/lib/library-offline-storage";
import { listOfflineLawSnapshots } from "@/lib/library-offline-storage";

const RETURN_PATH = "/library/offline";

function snapshotTitle(snap: OfflineLawSnapshot): string {
  const t = snap.law?.title;
  return typeof t === "string" && t.trim() ? t.trim() : "Untitled law";
}

function snapshotMeta(snap: OfflineLawSnapshot): { country: string; category: string } {
  const law = snap.law as {
    countries?: { name?: string } | null;
    categories?: { name?: string } | null;
  };
  return {
    country: typeof law.countries?.name === "string" ? law.countries.name : "",
    category: typeof law.categories?.name === "string" ? law.categories.name : "",
  };
}

function formatDay(ts: number): string {
  try {
    return new Date(ts).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export default function LibraryOfflineContentPage() {
  const [snapshots, setSnapshots] = useState<OfflineLawSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    void listOfflineLawSnapshots().then((list) => {
      setSnapshots(list);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

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
            <CloudDownload className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Offline content</h1>
              <p className="mt-1 text-muted-foreground">
                Laws you saved on this device for offline reading. They are removed automatically after the retention period you chose when saving.
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
        ) : snapshots.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/80 bg-card/80 px-8 py-12 text-center">
            <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h2 className="mt-4 text-lg font-semibold text-foreground">No offline laws on this device</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Open a law in the library and use &quot;Save for offline&quot; to store a copy here.
            </p>
            <Link
              href="/library"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Browse library
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm font-medium text-muted-foreground">
              {snapshots.length} saved {snapshots.length === 1 ? "law" : "laws"} on this device
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {snapshots.map((snap) => {
                const { country, category } = snapshotMeta(snap);
                return (
                  <Link
                    key={snap.lawId}
                    href={`/library/${snap.lawId}?returnTo=${encodeURIComponent(RETURN_PATH)}`}
                    className="group flex flex-col rounded-2xl border border-primary/40 bg-card p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-lg hover:shadow-primary/20"
                  >
                    <div className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-full border border-primary/30 bg-primary/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
                      <CloudDownload className="h-3 w-3" />
                      Offline
                    </div>
                    <h2 className="font-semibold text-foreground group-hover:text-primary">{snapshotTitle(snap)}</h2>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      {country ? <span>{country}</span> : null}
                      {country && category ? <span>·</span> : null}
                      {category ? <span>{category}</span> : null}
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Saved {formatDay(snap.savedAt)}
                      {snap.expiresAt > snap.savedAt ? (
                        <>
                          {" "}
                          · Expires {formatDay(snap.expiresAt)}
                        </>
                      ) : null}
                    </p>
                    <div className="mt-4 flex items-center gap-2">
                      <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition group-hover:opacity-100">
                        Open
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
