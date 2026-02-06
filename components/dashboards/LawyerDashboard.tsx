"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Users, FileText, ArrowRight, Loader2, Check, X, Clock } from "lucide-react";

type LawyerMe = {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  status: string;
  submission: {
    submittedAt: string;
    specialty: string;
    experience: string;
    location: string;
    barNumber: string;
    bio: string;
  } | null;
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export function LawyerDashboard() {
  const [data, setData] = useState<LawyerMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/lawyer/me", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-4 sm:p-6 md:p-8 flex justify-center items-center min-h-[280px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 sm:p-6 md:p-8">
        <div className="rounded-2xl border border-border bg-card px-4 py-6 sm:px-6 sm:py-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Lawyer Panel</h1>
          <p className="mt-2 text-destructive">{error ?? "Failed to load your profile."}</p>
        </div>
      </div>
    );
  }

  const status = (data.status || "pending").toLowerCase();
  const isApproved = status === "approved";
  const isRejected = status === "rejected";
  const isPending = status === "pending";
  const sub = data.submission;

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="rounded-2xl border border-border bg-card px-4 py-6 shadow-sm sm:px-6 sm:py-8 md:px-8 md:py-10">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Lawyer Panel
        </h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Manage your practice and clients. Use the sidebar or the links below.
        </p>
      </div>

      {/* Application status card */}
      <div className="mt-6 rounded-xl border border-border bg-card p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-foreground">Application status</h2>
        <div className="mt-3 flex items-center gap-3">
          {isApproved && (
            <span className="inline-flex items-center gap-2 rounded-full bg-green-500/15 px-3 py-1.5 text-sm font-medium text-green-700 dark:text-green-400">
              <Check className="h-4 w-4" /> Approved
            </span>
          )}
          {isRejected && (
            <span className="inline-flex items-center gap-2 rounded-full bg-red-500/15 px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-400">
              <X className="h-4 w-4" /> Rejected
            </span>
          )}
          {isPending && (
            <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/15 px-3 py-1.5 text-sm font-medium text-amber-700 dark:text-amber-400">
              <Clock className="h-4 w-4" /> Pending review
            </span>
          )}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {isApproved && "Your lawyer profile is active. Clients can find you in the directory."}
          {isRejected && "Your application was not approved. Contact support if you have questions."}
          {isPending && "Your application is under review. We will notify you once it is processed."}
        </p>
      </div>

      {/* Profile summary (if submitted) */}
      {sub && (
        <div className="mt-6 rounded-xl border border-border bg-card p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-foreground">Your profile</h2>
          <dl className="mt-3 grid gap-2 sm:grid-cols-2 text-sm">
            <div>
              <dt className="text-muted-foreground">Specialty</dt>
              <dd className="font-medium text-foreground">{sub.specialty || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Location</dt>
              <dd className="font-medium text-foreground">{sub.location || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Bar number</dt>
              <dd className="font-medium text-foreground">{sub.barNumber || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Submitted</dt>
              <dd className="font-medium text-foreground">{formatDate(sub.submittedAt)}</dd>
            </div>
          </dl>
          {sub.bio && (
            <div className="mt-3">
              <dt className="text-muted-foreground text-sm">Bio</dt>
              <dd className="mt-1 text-sm text-foreground whitespace-pre-wrap">{sub.bio}</dd>
            </div>
          )}
        </div>
      )}

      {/* Quick actions (admin-style) */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-foreground">Quick actions</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Jump to a section or use the sidebar to navigate.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          <li>
            <Link
              href="/my-clients"
              className="flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-primary/5"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <span className="font-medium">My Clients</span>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </Link>
          </li>
          <li>
            <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4 opacity-75">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <span className="font-medium">Profile & documents</span>
                  <p className="text-xs text-muted-foreground">Update via onboarding; contact support to resubmit.</p>
                </div>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </div>
  );
}
