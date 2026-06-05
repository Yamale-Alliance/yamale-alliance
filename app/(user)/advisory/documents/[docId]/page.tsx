import { AdvisoryDocumentPageClientFromParams } from "@/components/law-firm-development/AdvisoryDocumentPageClient";

type Props = { params: Promise<{ docId: string }> };

export default function AdvisoryDocumentPage({ params }: Props) {
  return <AdvisoryDocumentPageClientFromParams params={params} />;
}
