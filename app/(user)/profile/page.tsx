"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";

type Tier = "free" | "basic" | "pro" | "plus" | "team";

const TIER_LABELS: Record<Tier, string> = {
  free: "Free",
  basic: "Basic",
  pro: "Pro",
  plus: "Plus",
  team: "Team",
};

const TIER_DESCRIPTIONS: Record<Tier, string> = {
  free: "Browse the public library. AI research is locked.",
  basic: "Includes limited AI Legal Research each month.",
  pro: "Higher AI limits and access to advanced tools.",
  plus: "Unlimited AI Legal Research for individual users.",
  team: "Team or enterprise tier with Plus features.",
};

export default function ProfilePage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName ?? "");
      setLastName(user.lastName ?? "");
    }
  }, [user]);

  if (!isLoaded) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSignedIn || !user) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-md flex-col items-center justify-center px-4 text-center">
        <h1 className="text-xl font-semibold text-foreground">Profile</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You need to be signed in to view and edit your profile.
        </p>
        <Link
          href="/login"
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Sign in
        </Link>
      </div>
    );
  }

  const email =
    user.primaryEmailAddress?.emailAddress ??
    user.emailAddresses?.[0]?.emailAddress ??
    "";

  const tierRaw = (user.publicMetadata?.tier ??
    user.publicMetadata?.subscriptionTier ??
    "free") as Tier;
  const tier: Tier = ["free", "basic", "pro", "plus", "team"].includes(
    tierRaw,
  )
    ? tierRaw
    : "free";

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setStatus(null);
    try {
      await user.update({
        firstName: firstName.trim() || null,
        lastName: lastName.trim() || null,
      });
      setStatus("Profile updated.");
    } catch (err) {
      console.error("Profile update error:", err);
      setStatus("Could not update profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Profile & settings
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage your personal details and see your current subscription.
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-card px-5 py-6 shadow-sm sm:px-6 sm:py-7">
        <h2 className="text-sm font-semibold text-foreground">Personal info</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Your name appears on your account and in any invoices.
        </p>
        <form onSubmit={handleSave} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="firstName"
                className="block text-xs font-medium text-muted-foreground"
              >
                First name
              </label>
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="lastName"
                className="block text-xs font-medium text-muted-foreground"
              >
                Last name
              </label>
              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-muted-foreground">
              Email
            </span>
            <p className="text-sm text-foreground">{email || "Not set"}</p>
            <p className="text-xs text-muted-foreground">
              To change your email or password, use the account menu in the top
              right.
            </p>
          </div>
          <div className="flex items-center justify-between gap-3">
            {status && (
              <p className="text-xs text-muted-foreground">{status}</p>
            )}
            <button
              type="submit"
              disabled={saving}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {saving && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary-foreground" />
              )}
              <span>Save changes</span>
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-border bg-card px-5 py-6 shadow-sm sm:px-6 sm:py-7">
        <h2 className="text-sm font-semibold text-foreground">
          Subscription
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Your current plan and access level on Yamalé.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              {TIER_LABELS[tier]} plan
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {TIER_DESCRIPTIONS[tier]}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/pricing"
              className="inline-flex items-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              Change plan
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

