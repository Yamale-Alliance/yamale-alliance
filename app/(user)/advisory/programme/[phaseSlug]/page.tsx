import { AdvisoryPhasePageClientFromParams } from "@/components/law-firm-development/AdvisoryPhasePageClient";

type Props = { params: Promise<{ phaseSlug: string }> };

export default function AdvisoryPhasePage({ params }: Props) {
  return <AdvisoryPhasePageClientFromParams params={params} />;
}
