"use client";

import Link from "next/link";
import { SignUp } from "@clerk/nextjs";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignupIntentCookie } from "@/components/auth/SignupIntentCookie";
import { yamaleEmbeddedAuthAppearance } from "@/lib/clerk-appearance";

export default function SignUpPage() {
  const afterSignUpUrl = "/api/auth/complete-signup?role=user";

  return (
    <>
      <SignupIntentCookie role="user" />
      <AuthShell
        title="Join Yamalé Legal"
        subtitle="Create a client account to access the library, AfCFTA tools, The Yamalé Vault, and AI research."
        footer={
          <>
            Already have an account?{" "}
            <Link href="/sign-in" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
            <p className="mt-4 text-xs leading-relaxed">
              Lawyer accounts are created and invited by the admin team. If you are a lawyer, use
              the secure sign-in link sent to your email.
            </p>
          </>
        }
      >
        <SignUp
          appearance={yamaleEmbeddedAuthAppearance}
          afterSignUpUrl={afterSignUpUrl}
          signInUrl="/sign-in"
          routing="hash"
        />
      </AuthShell>
    </>
  );
}
