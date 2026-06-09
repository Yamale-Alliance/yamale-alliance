"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { BookOpen } from "lucide-react";

export function LibrarySignInPrompt() {
  const t = useTranslations("library.signInPrompt");
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const returnPath = qs ? `${pathname}?${qs}` : pathname;
  const signInHref = `/sign-in?redirect_url=${encodeURIComponent(returnPath)}`;
  const signUpHref = `/signup?redirect_url=${encodeURIComponent(returnPath)}`;

  return (
    <div className="min-h-[70vh]">
      <div className="relative overflow-hidden border-b border-border/50 bg-gradient-to-b from-primary/5 to-transparent">
        <div
          className="absolute inset-0 -z-10 opacity-50 dark:opacity-30"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23c18c43' fill-opacity='0.06' fill-rule='evenodd'%3E%3Cpath d='M0 40L40 0H20L0 20m40 20V20L20 40'/%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
        <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:py-20">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <BookOpen className="h-7 w-7" aria-hidden />
          </div>
          <h1 className="heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t("title")}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t("body")}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={signInHref}
              className="inline-flex min-w-[10rem] items-center justify-center rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              {t("signIn")}
            </Link>
            <Link
              href={signUpHref}
              className="inline-flex min-w-[10rem] items-center justify-center rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground hover:bg-accent"
            >
              {t("createAccount")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
