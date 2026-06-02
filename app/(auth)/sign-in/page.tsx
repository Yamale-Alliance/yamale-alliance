"use client";

import Link from "next/link";
import { SignIn } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { yamaleEmbeddedAuthAppearance } from "@/lib/clerk-appearance";

export default function SignInPage() {
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
      <SignIn
        appearance={yamaleEmbeddedAuthAppearance}
        signUpUrl="/signup"
        routing="hash"
        redirectUrl={redirectUrl}
        afterSignInUrl={redirectUrl}
      />
    </AuthShell>
  );
}
