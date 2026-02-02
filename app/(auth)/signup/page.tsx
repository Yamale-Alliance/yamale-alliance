"use client";

import { SignUp } from "@clerk/nextjs";
import { useState } from "react";
import { Briefcase, User } from "lucide-react";

const ROLE_COOKIE = "signup_intent";
const COOKIE_MAX_AGE = 60 * 10; // 10 minutes

function setSignupIntentCookie(role: "user" | "lawyer") {
  document.cookie = `${ROLE_COOKIE}=${role}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
}

export default function SignUpPage() {
  const [selectedRole, setSelectedRole] = useState<"user" | "lawyer" | null>(
    null
  );

  const handleSelectRole = (role: "user" | "lawyer") => {
    setSignupIntentCookie(role);
    setSelectedRole(role);
  };

  if (selectedRole) {
    const afterSignUpUrl = `/api/auth/complete-signup?role=${selectedRole}`;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="w-full max-w-md">
          <p className="mb-4 text-center text-sm text-muted-foreground">
            {selectedRole === "lawyer"
              ? "Complete your registration to continue to lawyer onboarding"
              : "Complete your registration"}
          </p>
          <SignUp afterSignUpUrl={afterSignUpUrl} signInUrl="/login" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Join Yamalé Legal Platform
          </h1>
          <p className="mt-2 text-muted-foreground">
            Choose your account type to get started
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => handleSelectRole("user")}
            className="group flex flex-col items-center gap-4 rounded-xl border-2 border-border bg-card p-8 text-left transition-all hover:border-primary hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
              <User className="h-7 w-7" />
            </div>
            <div className="space-y-1 text-center">
              <h2 className="font-semibold">I&apos;m a Client</h2>
              <p className="text-sm text-muted-foreground">
                Search legal content, access compliance tools, and find legal
                resources
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleSelectRole("lawyer")}
            className="group flex flex-col items-center gap-4 rounded-xl border-2 border-border bg-card p-8 text-left transition-all hover:border-primary hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
              <Briefcase className="h-7 w-7" />
            </div>
            <div className="space-y-1 text-center">
              <h2 className="font-semibold">I&apos;m a Lawyer</h2>
              <p className="text-sm text-muted-foreground">
                Join as a legal professional. You&apos;ll complete document
                verification after signup
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
