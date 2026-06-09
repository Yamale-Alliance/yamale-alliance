"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AuthShell } from "@/components/auth/AuthShell";
import { EmbeddedSignIn } from "@/components/auth/EmbeddedSignIn";

function SignInPageContent() {
  const t = useTranslations("auth");
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect_url") || "/dashboard";
  const libraryReturn = redirectUrl.startsWith("/library");

  return (
    <AuthShell
      title={t("welcomeBack")}
      subtitle={libraryReturn ? t("signInSubtitleLibrary") : t("signInSubtitle")}
      footer={
        <>
          {t("newHere")}{" "}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            {t("createAccount")}
          </Link>
        </>
      }
    >
      <EmbeddedSignIn redirectUrl={redirectUrl} />
    </AuthShell>
  );
}

export default function SignInPage() {
  const t = useTranslations("auth");

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
          {t("loadingSignIn")}
        </div>
      }
    >
      <SignInPageContent />
    </Suspense>
  );
}
