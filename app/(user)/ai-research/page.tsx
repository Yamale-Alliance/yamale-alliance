import { auth } from "@clerk/nextjs/server";
import AIResearchClient from "./AIResearchClient";
import { AiResearchMarketingSection } from "@/components/seo/AiResearchMarketingSection";

export default async function AIResearchPage() {
  const { userId } = await auth();

  return (
    <>
      <AIResearchClient />
      {/* SSR landing for crawlers and signed-out users; subscribers only see the chat shell */}
      {!userId ? <AiResearchMarketingSection /> : null}
    </>
  );
}
