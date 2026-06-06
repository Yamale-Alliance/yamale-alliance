import { Suspense, type ReactNode } from "react";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { createPageMetadata } from "@/lib/site-seo";
import { AdvisoryAccessGateClient } from "@/components/law-firm-development/AdvisoryAccessGateClient";
import { AdvisoryCatalogProvider } from "@/components/law-firm-development/AdvisoryCatalogContext";
import { AdvisoryWorkspaceShell } from "@/components/law-firm-development/AdvisoryWorkspaceShell";
import "@/styles/advisory-workspace.css";

const lfpSerif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-lfp-serif",
  display: "swap",
});

const lfpSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-lfp-sans",
  display: "swap",
});

export const metadata = createPageMetadata({
  title: "Law Firm Development Workspace",
  description:
    "Yamalé Advisory implementation workspace: track progress across eight phases, browse 124+ documents, and use interactive firm development tools.",
  path: "/advisory",
  noIndex: true,
});

export default async function AdvisoryLayout({ children }: { children: ReactNode }) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in?redirect_url=/advisory");
  }

  return (
    <div
      className={`${lfpSerif.variable} ${lfpSans.variable} advisory-workspace-root min-w-0 max-w-full overflow-x-clip [--site-nav-h:4.5rem] sm:[--site-nav-h:5.5rem]`}
    >
      <Suspense fallback={<div className="px-6 py-20 text-center text-muted-foreground">Loading workspace…</div>}>
        <AdvisoryAccessGateClient>
          <AdvisoryCatalogProvider>
            <AdvisoryWorkspaceShell>{children}</AdvisoryWorkspaceShell>
          </AdvisoryCatalogProvider>
        </AdvisoryAccessGateClient>
      </Suspense>
    </div>
  );
}
