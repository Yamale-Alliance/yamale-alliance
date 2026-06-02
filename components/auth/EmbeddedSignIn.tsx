"use client";

import { SignIn } from "@clerk/nextjs";
import { yamaleEmbeddedAuthAppearance } from "@/lib/clerk-appearance";
import { isClerkConfigured } from "@/lib/clerk-config";
import { ClerkAuthMountGuard } from "@/components/auth/ClerkAuthMountGuard";

const SIGN_IN_PATH = "/sign-in";

type EmbeddedSignInProps = {
  redirectUrl?: string;
};

export function EmbeddedSignIn({ redirectUrl = "/dashboard" }: EmbeddedSignInProps) {
  if (!isClerkConfigured()) {
    return (
      <p className="text-sm text-muted-foreground">
        Sign-in is temporarily unavailable. Please contact support@yamalelegal.com.
      </p>
    );
  }

  return (
    <ClerkAuthMountGuard mode="sign-in">
      <SignIn
        routing="path"
        path={SIGN_IN_PATH}
        appearance={yamaleEmbeddedAuthAppearance}
        signUpUrl="/signup"
        redirectUrl={redirectUrl}
        afterSignInUrl={redirectUrl}
        fallback={
          <div className="flex justify-center py-10" aria-hidden>
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        }
      />
    </ClerkAuthMountGuard>
  );
}
