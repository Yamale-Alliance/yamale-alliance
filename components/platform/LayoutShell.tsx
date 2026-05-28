import { Header } from "@/components/layout/Header";
import { ConditionalFooter } from "@/components/layout/ConditionalFooter";
import { DynamicFavicon } from "@/components/platform/DynamicFavicon";
import { OfflineProvider } from "@/components/offline/OfflineProvider";
import { SubscriptionRenewalReminder } from "@/components/subscription/SubscriptionRenewalReminder";
import { FoundersNoteGate } from "@/components/founders-note/FoundersNoteGate";

export function LayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DynamicFavicon />
      <div className="flex min-h-screen flex-col">
        <Header />
        <SubscriptionRenewalReminder />
        <FoundersNoteGate />
        <div className="flex-1">{children}</div>
        <ConditionalFooter />
      </div>
      <OfflineProvider />
    </>
  );
}
