"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { EmbeddedSignUp } from "@/components/auth/EmbeddedSignUp";
import { SignupIntentCookie } from "@/components/auth/SignupIntentCookie";

function SignUpPageContent() {
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
        title="Join Yamalé Legal"
        subtitle={
          safeRedirect?.startsWith("/library")
            ? "Create a free account to search African statutes, regulations, and treaties in the legal library."
            : "Create a client account to access the library, AfCFTA tools, The Yamalé Vault, and AI research."
        }
        footer={
          <>
            Already have an account?{" "}
            <Link href={signInHref} className="font-medium text-primary hover:underline">
              Sign in
            </Link>
            <p className="mt-4 text-xs leading-relaxed">
              Lawyer accounts are created and invited by the admin team. If you are a lawyer, use
              the secure sign-in link sent to your email.
            </p>
          </>
        }
      >
      <EmbeddedSignUp afterSignUpUrl={afterSignUpUrl} />
    </AuthShell>
    </>
  );
}

export default function SignUpPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
          Loading sign up…
        </div>
      }
    >
      <SignUpPageContent />
    </Suspense>
  );
}
