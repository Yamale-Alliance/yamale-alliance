import { auth } from "@clerk/nextjs/server";
import { getDocumentExportUnlockLawIdsForUser } from "@/lib/library-document-export-unlocks";
import { PurchasedLawsClient } from "./PurchasedLawsClient";

export default async function LibraryPurchasedLawsPage() {
  let initialLawIds: string[] = [];
  try {
    const { userId } = await auth();
    initialLawIds = userId ? await getDocumentExportUnlockLawIdsForUser(userId) : [];
  } catch (err) {
    console.error("LibraryPurchasedLawsPage:", err);
  }

  return <PurchasedLawsClient initialLawIds={initialLawIds} />;
}
