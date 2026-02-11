"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle } from "lucide-react";

export default function JoinLawyersPage() {
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [expertise, setExpertise] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [primaryLanguage, setPrimaryLanguage] = useState("");
  const [otherLanguages, setOtherLanguages] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) {
      setError("Please agree to be listed on the directory before submitting.");
      return;
    }
    if (!email.trim() && !phone.trim()) {
      setError("Please provide at least an email or phone number.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/lawyers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          country: country.trim() || undefined,
          expertise: expertise.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          primary_language: primaryLanguage.trim() || undefined,
          other_languages: otherLanguages.trim() || undefined,
          linkedin_url: linkedinUrl.trim() || undefined,
          image_url: imageUrl.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }
      setDone(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-500/15">
            <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="mt-6 text-xl font-semibold">Thank you</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your details have been submitted. We&apos;ll add you to the directory and users will be able to find you on the Find a Lawyer page.
          </p>
          <Link
            href="/lawyers"
            className="mt-6 inline-block text-sm font-medium text-primary underline underline-offset-2 hover:no-underline"
          >
            View the directory
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Join the lawyer directory</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Fill in your details to be listed on our Find a Lawyer page. Users can then discover and contact you.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-foreground">
            Name <span className="text-destructive">*</span>
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={200}
            className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Full name"
          />
        </div>
        <div>
          <label htmlFor="country" className="block text-sm font-medium text-foreground">
            Country
          </label>
          <input
            id="country"
            type="text"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            maxLength={100}
            className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="e.g. Ghana, Kenya"
          />
        </div>
        <div>
          <label htmlFor="expertise" className="block text-sm font-medium text-foreground">
            Expertise <span className="text-destructive">*</span>
          </label>
          <input
            id="expertise"
            type="text"
            value={expertise}
            onChange={(e) => setExpertise(e.target.value)}
            required
            maxLength={500}
            className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="e.g. Corporate law, Tax, Employment"
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-foreground">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={255}
            className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="your@email.com"
          />
        </div>
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-foreground">
            Phone
          </label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={50}
            className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="e.g. +233 00 000 0000"
          />
        </div>
        <div>
          <label htmlFor="primary-language" className="block text-sm font-medium text-foreground">
            Primary language
          </label>
          <input
            id="primary-language"
            type="text"
            value={primaryLanguage}
            onChange={(e) => setPrimaryLanguage(e.target.value)}
            maxLength={100}
            className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="e.g. English"
          />
        </div>
        <div>
          <label htmlFor="other-languages" className="block text-sm font-medium text-foreground">
            Other languages
          </label>
          <input
            id="other-languages"
            type="text"
            value={otherLanguages}
            onChange={(e) => setOtherLanguages(e.target.value)}
            maxLength={500}
            className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="e.g. French, Swahili"
          />
        </div>
        <div>
          <label htmlFor="linkedin" className="block text-sm font-medium text-foreground">
            LinkedIn profile <span className="text-muted-foreground">(optional)</span>
          </label>
          <input
            id="linkedin"
            type="url"
            value={linkedinUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
            maxLength={500}
            className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="https://linkedin.com/in/..."
          />
        </div>
        <div>
          <label htmlFor="image-url" className="block text-sm font-medium text-foreground">
            Photo URL <span className="text-muted-foreground">(optional)</span>
          </label>
          <input
            id="image-url"
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            maxLength={2048}
            className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="https://... (link to your profile photo)"
          />
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/30 p-4 hover:bg-muted/50">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => {
              setAgreed(e.target.checked);
              setError(null);
            }}
            className="mt-0.5 h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-primary/30"
          />
          <span className="text-sm text-foreground">
            I agree to have my name and contact details listed on the Find a Lawyer directory so users can discover and contact me. We may contact you to verify details.
          </span>
        </label>
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        <div className="flex gap-3 pt-2">
          <Link
            href="/lawyers"
            className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading || !agreed}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Submitting…" : "Submit"}
          </button>
        </div>
      </form>
    </div>
  );
}
