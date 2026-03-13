"use client";

import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";

type HeroButtonsProps = {
  isSignedIn: boolean;
};

export function HeroButtons({ isSignedIn }: HeroButtonsProps) {
  if (isSignedIn) {
    return (
      <>
        {/* Mobile: Show dashboard button (visible on mobile, hidden on md+) */}
        <Link
          href="/dashboard"
          className="group relative inline-flex md:hidden items-center gap-2 rounded-2xl bg-primary px-7 py-3.5 text-sm font-bold text-primary-foreground shadow-xl shadow-primary/30 transition-all duration-300 hover:scale-[1.04] hover:shadow-2xl hover:shadow-primary/40 sm:text-base"
        >
          Open dashboard
          <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
        </Link>
        
        {/* Desktop: Show Legal Library button (hidden on mobile, visible on md+) */}
        <Link
          href="/library"
          className="group relative hidden md:inline-flex items-center gap-2 rounded-2xl bg-primary px-7 py-3.5 text-sm font-bold text-primary-foreground shadow-xl shadow-primary/30 transition-all duration-300 hover:scale-[1.04] hover:shadow-2xl hover:shadow-primary/40 sm:text-base"
        >
          <BookOpen className="h-5 w-5 transition group-hover:scale-110" />
          Legal Library
          <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
        </Link>
        
        <Link
          href="/ai-research"
          className="group inline-flex items-center gap-2 rounded-2xl border-2 border-primary/60 bg-background/90 px-7 py-3.5 text-sm font-bold backdrop-blur-sm transition-all duration-300 hover:scale-[1.04] hover:border-primary hover:bg-primary/10 sm:text-base"
        >
          AI Legal Research
          <ArrowRight className="h-5 w-5 opacity-70 transition group-hover:translate-x-1 group-hover:opacity-100" />
        </Link>
      </>
    );
  }

  return (
    <>
      <Link
        href="/marketplace"
        className="group relative inline-flex items-center gap-2 overflow-hidden rounded-2xl bg-primary px-7 py-3.5 text-sm font-bold text-primary-foreground shadow-xl shadow-primary/30 transition-all duration-300 hover:scale-[1.04] hover:shadow-2xl hover:shadow-primary/40 sm:text-base"
      >
        Browse marketplace
        <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
      </Link>
    </>
  );
}
