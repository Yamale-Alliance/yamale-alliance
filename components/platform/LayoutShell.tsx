import { Suspense } from "react";
import { Header } from "@/components/layout/Header";
import { ConditionalFooter } from "@/components/layout/ConditionalFooter";
import { ScrollToTopOnNavigate } from "@/components/navigation/ScrollToTopOnNavigate";
import { OfflineProvider } from "@/components/offline/OfflineProvider";
import { SubscriptionRenewalReminder } from "@/components/subscription/SubscriptionRenewalReminder";
import { FoundersNoteGate } from "@/components/founders-note/FoundersNoteGate";

export function LayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ScrollToTopOnNavigate />
      <div className="flex min-h-screen flex-col">
        <Header />
        <SubscriptionRenewalReminder />
        <FoundersNoteGate />
        <div className="flex-1 min-w-0">
          <Suspense fallback={null}>{children}</Suspense>
        </div>
        <ConditionalFooter />
      </div>
      <OfflineProvider />
    </>
  );
}
