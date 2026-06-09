"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AuthShell } from "@/components/auth/AuthShell";
import { EmbeddedSignUp } from "@/components/auth/EmbeddedSignUp";
import { SignupIntentCookie } from "@/components/auth/SignupIntentCookie";

function SignUpPageContent() {
  const t = useTranslations("auth");
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect_url");
  const safeRedirect =
    redirectUrl && redirectUrl.startsWith("/") && !redirectUrl.startsWith("//") ? redirectUrl : null;
  const afterSignUpUrl = safeRedirect
    ? `/api/auth/complete-signup?role=user&redirect_url=${encodeURIComponent(safeRedirect)}`
    : "/api/auth/complete-signup?role=user";
  const signInHref = safeRedirect
    ? `/sign-in?redirect_url=${encodeURIComponent(safeRedirect)}`
    : "/sign-in";

  return (
    <>
      <SignupIntentCookie role="user" />
      <AuthShell
        title={t("joinTitle")}
        subtitle={
          safeRedirect?.startsWith("/library") ? t("signUpSubtitleLibrary") : t("signUpSubtitle")
        }
        footer={
          <>
            {t("alreadyHaveAccount")}{" "}
            <Link href={signInHref} className="font-medium text-primary hover:underline">
              {t("signIn")}
            </Link>
            <p className="mt-4 text-xs leading-relaxed">{t("lawyerInviteNote")}</p>
          </>
        }
      >
      <EmbeddedSignUp afterSignUpUrl={afterSignUpUrl} />
    </AuthShell>
    </>
  );
}

export default function SignUpPage() {
  const t = useTranslations("auth");

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
          {t("loadingSignUp")}
        </div>
      }
    >
      <SignUpPageContent />
    </Suspense>
  );
}
