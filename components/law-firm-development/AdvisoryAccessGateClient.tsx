"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { AdvisoryAccessResult } from "@/lib/law-firm-development/access-server";
import { marketplaceItemDetailHref } from "@/lib/marketplace-public-url";

type Props = {
  children: ReactNode;
};

export function AdvisoryAccessGateClient({ children }: Props) {
  const searchParams = useSearchParams();
  const courseKey = searchParams.get("course");
  const [access, setAccess] = useState<AdvisoryAccessResult | null>(null);

  useEffect(() => {
    const qs = courseKey ? `?course=${encodeURIComponent(courseKey)}` : "";
    fetch(`/api/advisory/access${qs}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data: { access?: AdvisoryAccessResult }) => {
        setAccess(data.access ?? null);
      })
      .catch(() => {
        setAccess({
          signedIn: true,
          hasPackage: false,
          marketplaceItemId: null,
          marketplaceSlug: null,
          courseTitle: null,
        });
      });
  }, [courseKey]);

  if (!access) {
    return (
      <div className="mx-auto max-w-lg px-6 py-20 text-center text-white">
        <p className="text-white/55">Loading workspace…</p>
      </div>
    );
  }

  if (!access.signedIn) {
    const redirect = courseKey ? `/advisory?course=${encodeURIComponent(courseKey)}` : "/advisory";
    return (
      <div className="mx-auto max-w-lg px-6 py-20 text-center text-white">
        <h1 className="[font-family:var(--font-lfp-serif),Georgia,serif] text-2xl font-semibold text-[#C18C43]">
          Sign in to open your workspace
        </h1>
        <p className="mt-4 text-white/55">
          The implementation workspace is available after you purchase a course package.
        </p>
        <Link
          href={`/sign-in?redirect_url=${encodeURIComponent(redirect)}`}
          className="mt-8 inline-block rounded-[2px] bg-[#C18C43] px-6 py-3 text-sm font-semibold text-[#221913]"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (!access.hasPackage) {
    const packageHref = access.marketplaceItemId
      ? marketplaceItemDetailHref({
          id: access.marketplaceItemId,
          slug: access.marketplaceSlug,
          packagePage: true,
        })
      : "/marketplace";

    return (
      <div className="mx-auto max-w-lg px-6 py-20 text-center text-white">
        <h1 className="[font-family:var(--font-lfp-serif),Georgia,serif] text-2xl font-semibold text-[#C18C43]">
          Unlock the implementation workspace
        </h1>
        <p className="mt-4 text-white/55">
          {access.courseTitle
            ? `Purchase “${access.courseTitle}” to access the dashboard, document library, progress tracker, and tools online.`
            : "Purchase a course package from the Vault to access the online implementation workspace."}
        </p>
        <Link
          href={packageHref}
          className="mt-8 inline-block rounded-[2px] bg-[#C18C43] px-6 py-3 text-sm font-semibold text-[#221913]"
        >
          View package in the Vault
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
