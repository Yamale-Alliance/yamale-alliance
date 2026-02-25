"use client";

import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-4 py-10">
        <div className="mb-6 flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
          <Search className="h-3.5 w-3.5" />
          <span>Page not found</span>
        </div>
        <h1 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
          We couldn&apos;t find that page
        </h1>
        <p className="mt-3 max-w-xl text-center text-sm text-slate-600">
          The link may be broken, expired, or the page may have moved. Use the library or tools to keep
          exploring African law.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
          <Link
            href="/library"
            className="inline-flex items-center gap-2 rounded-lg bg-[#c18c43] px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-[#b27f36]"
          >
            Browse African Legal Library
          </Link>
        </div>
      </div>
    </div>
  );
}

