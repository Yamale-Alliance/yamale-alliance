"use client";

import { Suspense, type ReactNode } from "react";
import { useAppAuth } from "@/components/auth/AppAuthProvider";
import { Loader2 } from "lucide-react";
import { LibrarySignInPrompt } from "@/components/library/LibrarySignInPrompt";

function LibraryAuthGateInner({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAppAuth();

  if (!isLoaded) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSignedIn) {
    return <LibrarySignInPrompt />;
  }

  return <>{children}</>;
}

/** Blocks library UI until the user signs in or creates an account. */
export function LibraryAuthGate({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <LibraryAuthGateInner>{children}</LibraryAuthGateInner>
    </Suspense>
  );
}
