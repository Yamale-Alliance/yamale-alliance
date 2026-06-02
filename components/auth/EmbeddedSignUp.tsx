"use client";

import { SignUp } from "@clerk/nextjs";
import { yamaleEmbeddedAuthAppearance } from "@/lib/clerk-appearance";
import { isClerkConfigured } from "@/lib/clerk-config";
import { ClerkAuthMountGuard } from "@/components/auth/ClerkAuthMountGuard";

const SIGN_UP_PATH = "/signup";

type EmbeddedSignUpProps = {
  afterSignUpUrl: string;
};

export function EmbeddedSignUp({ afterSignUpUrl }: EmbeddedSignUpProps) {
  if (!isClerkConfigured()) {
    return (
      <p className="text-sm text-muted-foreground">
        Sign-up is temporarily unavailable. Please contact support@yamalelegal.com.
      </p>
    );
  }

  return (
    <ClerkAuthMountGuard mode="sign-up">
      <SignUp
        routing="path"
        path={SIGN_UP_PATH}
        appearance={yamaleEmbeddedAuthAppearance}
        afterSignUpUrl={afterSignUpUrl}
        signInUrl="/sign-in"
        fallback={
          <div className="flex justify-center py-10" aria-hidden>
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        }
      />
    </ClerkAuthMountGuard>
  );
}
