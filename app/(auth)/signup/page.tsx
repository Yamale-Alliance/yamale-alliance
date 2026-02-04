"use client";

import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  // Public sign-up is only for clients. Lawyer accounts are created by admin.
  const afterSignUpUrl = "/api/auth/complete-signup?role=user";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Join Yamalé Legal Platform
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Create a client account to access the library, AfCFTA tools,
            marketplace, and AI research.
          </p>
        </div>

        <SignUp
          afterSignUpUrl={afterSignUpUrl}
          signInUrl="/login"
          routing="hash"
        />

        <p className="text-center text-xs text-muted-foreground">
          Lawyer accounts are created and invited by the admin team. If you are
          a lawyer, please use the secure sign-in link sent to your email.
        </p>
      </div>
    </div>
  );
}
