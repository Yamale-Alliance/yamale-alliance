"use client";

import { UserProfile } from "@clerk/nextjs";

export default function AccountProfilePage() {
  return (
    <div>
      <h1 className="heading text-2xl font-bold text-foreground">Profile</h1>
      <p className="mt-2 text-muted-foreground">Update your name, email, password, and security settings.</p>
      <div className="mt-8 flex justify-center">
        <UserProfile appearance={{ elements: { rootBox: "w-full max-w-4xl mx-auto" } }} />
      </div>
    </div>
  );
}
