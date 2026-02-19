"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { BookmarkCheck, ArrowLeft, BookOpen, Loader2, ArrowRight } from "lucide-react";
import { useUser } from "@clerk/nextjs";

type Bookmark = {
  law_id: string;
  created_at: string;
};

type Law = {
  id: string;
  title: string;
  country: string;
  category: string;
  status: string;
};

export default function BookmarksPage() {
  const { isSignedIn, isLoaded } = useUser();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [laws, setLaws] = useState<Law[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    
    if (!isSignedIn) {
      setError("Sign in to view your bookmarked laws");
      setLoading(false);
      return;
    }

    const fetchBookmarks = async () => {
      try {
        const res = await fetch("/api/bookmarks", { credentials: "include" });
        if (!res.ok) throw new Error("Failed to fetch bookmarks");
        const data = await res.json();
        const bookmarkList = data.bookmarks ?? [];
        setBookmarks(bookmarkList);

        if (bookmarkList.length === 0) {
          setLoading(false);
          return;
        }

        // Fetch law details for each bookmark
        const lawIds = bookmarkList.map((b: Bookmark) => b.law_id);
        const lawPromises = lawIds.map(async (lawId: string) => {
          const lawRes = await fetch(`/api/laws/${lawId}`, { credentials: "include" });
          if (lawRes.ok) {
            const lawData = await lawRes.json();
            // API returns law data directly, not wrapped
            return {
              id: lawData.id,
              title: lawData.title,
              country: lawData.countries?.name || "",
              category: lawData.categories?.name || "",
              status: lawData.status || "In force",
            };
          }
          return null;
        });

        const lawResults = await Promise.all(lawPromises);
        const validLaws = lawResults.filter((law): law is Law => law !== null);
        setLaws(validLaws);
      } catch (err) {
        console.error("Error fetching bookmarks:", err);
        setError("Failed to load bookmarked laws");
      } finally {
        setLoading(false);
      }
    };

    fetchBookmarks();
  }, [isSignedIn, isLoaded]);

  if (!isLoaded) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <p className="text-muted-foreground mb-4">Sign in to view your bookmarked laws</p>
        <Link
          href={`/sign-in?redirect_url=${encodeURIComponent("/library/bookmarks")}`}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
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
            <BookmarkCheck className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Bookmarked Laws
              </h1>
              <p className="mt-1 text-muted-foreground">
                Your saved legal references
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-4 py-8">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-8 text-center">
            <p className="text-destructive">{error}</p>
          </div>
        ) : laws.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/80 bg-card/80 px-8 py-12 text-center">
            <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold text-foreground">
              No bookmarked laws yet
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Bookmark laws from the library to save them here for quick access.
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
              {laws.length} bookmarked {laws.length === 1 ? "law" : "laws"}
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {laws.map((law) => {
                const bookmark = bookmarks.find((b) => b.law_id === law.id);
                return (
                  <Link
                    key={law.id}
                    href={`/library/${law.id}?returnTo=${encodeURIComponent("/library/bookmarks")}`}
                    className="group flex flex-col rounded-2xl border border-primary/40 bg-card p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-lg hover:shadow-primary/20"
                  >
                    <div className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-full border border-primary/30 bg-primary/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
                      <BookmarkCheck className="h-3 w-3" />
                      Bookmarked
                    </div>
                    <h2 className="font-semibold text-foreground group-hover:text-primary">
                      {law.title}
                    </h2>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      <span>{law.country}</span>
                      <span>·</span>
                      <span>{law.category}</span>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <span className="rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
                        {law.status || "In force"}
                      </span>
                      <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition group-hover:opacity-100">
                        View
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
