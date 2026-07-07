import { Header } from "@/components/layout/Header";
import { ConditionalFooter } from "@/components/layout/ConditionalFooter";
import { MobileScrollLockCleanup } from "@/components/navigation/MobileScrollLockCleanup";
import { ScrollToTopOnNavigate } from "@/components/navigation/ScrollToTopOnNavigate";
import { OfflineProvider } from "@/components/offline/OfflineProvider";
import { SubscriptionRenewalReminder } from "@/components/subscription/SubscriptionRenewalReminder";
import { FoundersNoteGate } from "@/components/founders-note/FoundersNoteGate";
import { LayoutContentArea } from "@/components/platform/LayoutContentArea";

export function LayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ScrollToTopOnNavigate />
      <MobileScrollLockCleanup />
      <div className="flex min-h-screen flex-col">
        <Header />
        <SubscriptionRenewalReminder />
        <FoundersNoteGate />
        <LayoutContentArea>{children}</LayoutContentArea>
        <ConditionalFooter />
      </div>
      <OfflineProvider />
    </>
  );
}
