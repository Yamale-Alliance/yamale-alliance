"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Loader2, Mail, Phone } from "lucide-react";

type UnlockedLawyer = {
  id: string;
  name: string;
  country: string;
  expertise: string;
  linkedinUrl: string | null;
  imageUrl: string | null;
  email: string | null;
  phone: string | null;
  contacts: string | null;
};

export function AccountUnlockedLawyers() {
  const [loading, setLoading] = useState(true);
  const [lawyers, setLawyers] = useState<UnlockedLawyer[]>([]);

  useEffect(() => {
    fetch("/api/lawyers/unlocked-list", { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Failed");
        return res.json();
      })
      .then((data: { lawyers?: UnlockedLawyer[] }) => {
        setLawyers(Array.isArray(data.lawyers) ? data.lawyers : []);
      })
      .catch(() => setLawyers([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (lawyers.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
        <p className="text-sm text-muted-foreground">
          No unlocked lawyers yet. Unlock a profile from the{" "}
          <Link href="/lawyers" className="font-medium text-primary underline-offset-4 hover:underline">
            lawyers directory
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {lawyers.map((lawyer) => (
        <li key={lawyer.id} className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-bold text-foreground">
              {lawyer.imageUrl ? (
                <Image src={lawyer.imageUrl} alt="" width={56} height={56} className="h-full w-full object-cover" />
              ) : (
                lawyer.name
                  .split(" ")
                  .map((n) => n[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join("")
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-foreground">{lawyer.name}</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">{lawyer.expertise}</p>
              <p className="mt-1 text-xs text-muted-foreground">{lawyer.country || "Country not specified"}</p>
            </div>
          </div>
          <div className="mt-4 space-y-2 text-sm">
            {lawyer.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                <a href={`mailto:${lawyer.email}`} className="font-medium text-primary underline-offset-4 hover:underline">
                  {lawyer.email}
                </a>
              </div>
            )}
            {lawyer.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                <a href={`tel:${lawyer.phone}`} className="font-medium text-primary underline-offset-4 hover:underline">
                  {lawyer.phone}
                </a>
              </div>
            )}
            {lawyer.contacts && (
              <p className="text-foreground">
                <span className="font-medium">Other contacts: </span>
                <span className="whitespace-pre-wrap text-muted-foreground">{lawyer.contacts}</span>
              </p>
            )}
            {lawyer.linkedinUrl && (
              <a
                href={lawyer.linkedinUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                LinkedIn profile
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
