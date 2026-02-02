"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Loader2, Clock } from "lucide-react";

export default function LawyerPendingPage() {
  const { isLoaded, userId } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;
    if (!userId) {
      router.replace("/sign-up");
    }
  }, [isLoaded, userId, router]);

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!userId) {
    return null;
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Clock className="h-8 w-8" />
      </div>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">
        Under review
      </h1>
      <p className="mt-3 text-muted-foreground">
        Your lawyer onboarding has been submitted and is with our admin team.
        We’ll review your documents and profile and get back to you soon.
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        You’ll be notified when your account is approved.
      </p>
    </div>
  );
}
