"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { EmbeddedSignIn } from "@/components/auth/EmbeddedSignIn";

function SignInPageContent() {
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect_url") || "/dashboard";

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to Yamalé Legal to access your library, vault, and AI research."
      footer={
        <>
          New here?{" "}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <EmbeddedSignIn redirectUrl={redirectUrl} />
    </AuthShell>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
          Loading sign in…
        </div>
      }
    >
      <SignInPageContent />
    </Suspense>
  );
}
