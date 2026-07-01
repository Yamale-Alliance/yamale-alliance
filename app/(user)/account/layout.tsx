import { createPageMetadata } from "@/lib/site-seo";
import { currentUser } from "@clerk/nextjs/server";
import { isSupportCenterLive } from "@/lib/support-center-enabled";
import { AccountNav } from "@/components/account/AccountNav";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  title: "Account",
  description: "Manage your Yamalé subscription, purchases, and profile.",
  path: "/account",
  noIndex: true,
});

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const supportLive = isSupportCenterLive();
  const user = await currentUser();
  const role = user?.publicMetadata?.role as string | undefined;
  const showAdminPanel = role === "admin" || role === "legal_admin";
  const adminPanelHref = role === "legal_admin" ? "/admin-panel/laws" : "/admin-panel";

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 md:flex-row md:gap-10 md:py-10">
      <aside className="shrink-0 md:w-52">
        <AccountNav
          supportLive={supportLive}
          showAdminPanel={showAdminPanel}
          adminPanelHref={adminPanelHref}
        />
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
