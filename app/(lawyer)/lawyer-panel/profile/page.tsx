"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, User, Camera, Check } from "lucide-react";

const PRONOUN_OPTIONS = [
  "she/her",
  "he/him",
  "they/them",
  "she/they",
  "he/they",
  "any pronouns",
  "ze/zir",
  "ze/hir",
  "xe/xem",
  "fae/faer",
  "ey/em",
  "per/pers",
  "ve/ver",
  "ne/nem",
  "Prefer not to say",
] as const;

const OTHER = "other";

export default function LawyerProfilePage() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [practice, setPractice] = useState("");
  const [country, setCountry] = useState("");
  const [pronounsSelect, setPronounsSelect] = useState<string>(OTHER);
  const [pronounsCustom, setPronounsCustom] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/lawyer/profile", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setEmail(data.email ?? "");
        setPhone(data.phone ?? "");
        setPractice(data.practice ?? "");
        setCountry(data.country ?? "");
        const p = (data.pronouns ?? "").trim();
        if (!p) {
          setPronounsSelect("");
          setPronounsCustom("");
        } else if (PRONOUN_OPTIONS.includes(p as (typeof PRONOUN_OPTIONS)[number])) {
          setPronounsSelect(p);
          setPronounsCustom("");
        } else {
          setPronounsSelect(OTHER);
          setPronounsCustom(p);
        }
        setAvatarUrl(data.avatar_url ?? null);
      })
      .catch(() => setError("Failed to load profile"))
      .finally(() => setLoading(false));
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!practice.trim()) {
      setError("What you practice is required.");
      return;
    }
    setProfileSaving(true);
    setProfileSaved(false);
    try {
      const res = await fetch("/api/lawyer/profile", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim() || null,
          phone: phone.trim() || null,
          practice: practice.trim(),
          country: country.trim() || null,
          pronouns: (pronounsSelect === OTHER ? pronounsCustom.trim() : pronounsSelect) || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save profile");
        return;
      }
      setProfileSaved(true);
    } catch {
      setError("Network error");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose a JPEG, PNG, or WebP image.");
      return;
    }
    setAvatarUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const res = await fetch("/api/lawyer/profile/avatar", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to upload photo");
        return;
      }
      if (data.avatarUrl) {
        setAvatarUrl(data.avatarUrl);
      }
    } catch {
      setError("Network error");
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 md:p-8 flex justify-center items-center min-h-[280px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="rounded-2xl border border-border bg-card px-4 py-6 shadow-sm sm:px-6 sm:py-8 md:px-8 md:py-10">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
          <User className="h-7 w-7" />
          Profile
        </h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Edit your profile picture and contact details. This is what users see on Find a Lawyer.
        </p>
      </div>

      {error && (
        <div className="mt-4 rounded-md bg-destructive/10 text-destructive px-4 py-2 text-sm">
          {error}
        </div>
      )}

      {/* Profile picture */}
      <div className="mt-6 rounded-xl border border-border bg-card p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-foreground">Profile picture</h2>
        <p className="mt-1 text-sm text-muted-foreground">JPEG, PNG, or WebP. Max 2 MB.</p>
        <div className="mt-4 flex flex-wrap items-center gap-6">
          <div className="relative">
            <div className="h-24 w-24 rounded-full overflow-hidden border-2 border-border bg-muted flex items-center justify-center">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <User className="h-12 w-12 text-muted-foreground" />
              )}
            </div>
            {avatarUploading && (
              <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
              </div>
            )}
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAvatarChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarUploading}
              className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
            >
              <Camera className="h-4 w-4" />
              {avatarUrl ? "Change photo" : "Upload photo"}
            </button>
          </div>
        </div>
      </div>

      {/* Contact & practice */}
      <div className="mt-6 rounded-xl border border-border bg-card p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-foreground">Contact & practice</h2>
        <form onSubmit={handleSaveProfile} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Pronouns</label>
            <select
              value={pronounsSelect}
              onChange={(e) => setPronounsSelect(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {PRONOUN_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
              <option value={OTHER}>Other</option>
            </select>
            {pronounsSelect === OTHER && (
              <input
                type="text"
                value={pronounsCustom}
                onChange={(e) => setPronounsCustom(e.target.value)}
                placeholder="Enter your pronouns"
                className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+233 24 123 4567"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">What you practice <span className="text-destructive">*</span></label>
            <input
              type="text"
              value={practice}
              onChange={(e) => setPractice(e.target.value)}
              placeholder="e.g. Corporate Law, Commercial Law"
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Country</label>
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="e.g. Ghana"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={profileSaving}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {profileSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : profileSaved ? <Check className="h-4 w-4" /> : null}
            {profileSaving ? "Saving…" : profileSaved ? "Saved" : "Save profile"}
          </button>
        </form>
      </div>
    </div>
  );
}
