import type { ReactNode } from "react";
import Link from "next/link";
import type { AdvisoryAccessResult } from "@/lib/law-firm-development/access-server";
import { marketplaceItemDetailHref } from "@/lib/marketplace-public-url";

type Props = {
  access: AdvisoryAccessResult;
  children: ReactNode;
};

export function AdvisoryAccessGate({ access, children }: Props) {
  if (!access.signedIn) {
    return (
      <div className="mx-auto max-w-lg px-6 py-20 text-center text-white">
        <h1 className="[font-family:var(--font-lfp-serif),Georgia,serif] text-2xl font-semibold text-[#C18C43]">
          Sign in to open your workspace
        </h1>
        <p className="mt-4 text-white/55">
          The Law Firm Development implementation workspace is available to firms with the Tier 1 package.
        </p>
        <Link
          href="/sign-in?redirect_url=/advisory"
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
          Purchase the African Law Firm Development Package (Tier 1) to access the dashboard, document library,
          progress tracker, and interactive tools online.
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
