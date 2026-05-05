"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { SupportComingSoon } from "@/components/support/SupportComingSoon";

const SUPPORT_LIVE = process.env.NEXT_PUBLIC_SUPPORT_CENTER_ENABLED === "1";

export default function NewSupportTicketPage() {
  const router = useRouter();
  const { user } = useUser();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [contactName, setContactName] = useState(user?.fullName ?? "");
  const [contactEmail, setContactEmail] = useState(user?.primaryEmailAddress?.emailAddress ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title, description, contactName, contactEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not submit");
        return;
      }
      if (data.id) router.push(`/account/support/${data.id}`);
      else router.push("/account/support");
    } catch {
      setError("Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!SUPPORT_LIVE) {
    return (
      <div>
        <Link href="/account/support" className="text-sm font-medium text-primary hover:underline">
          ← Back to support
        </Link>
        <div className="mt-4">
          <SupportComingSoon />
        </div>
      </div>
    );
  }

  return (
    <div>
      <Link href="/account/support" className="text-sm font-medium text-primary hover:underline">
        ← Back to support
      </Link>
      <h1 className="heading mt-4 text-2xl font-bold text-foreground">New support request</h1>
      <p className="mt-2 text-muted-foreground">
        We’ll email you when our team replies. You can also track the conversation on this page.
      </p>

      <form onSubmit={submit} className="mt-8 max-w-xl space-y-5">
        <div>
          <label htmlFor="contactName" className="block text-sm font-medium">
            Your name
          </label>
          <input
            id="contactName"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            required
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="contactEmail" className="block text-sm font-medium">
            Email
          </label>
          <input
            id="contactEmail"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            required
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="title" className="block text-sm font-medium">
            Title / subject
          </label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            minLength={3}
            placeholder="Short summary of the problem"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="description" className="block text-sm font-medium">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            minLength={10}
            rows={6}
            placeholder="What happened? What did you expect?"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-primary px-6 py-2.5 font-semibold text-primary-foreground disabled:opacity-60"
        >
          {submitting ? "Sending…" : "Submit request"}
        </button>
      </form>
    </div>
  );
}
