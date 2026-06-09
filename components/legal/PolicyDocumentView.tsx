import {
  PolicyBulletList,
  PolicyCallout,
  PolicyContactBlock,
  PolicyFooterNav,
  PolicyHero,
  PolicyLabelBlock,
  PolicyP,
  PolicySectionHeading,
  PolicySubHeading,
  PolicyUpdatedBanner,
} from "@/components/legal/policy-document-primitives";
import { PolicyInlineSegments } from "@/components/legal/PolicyInlineSegments";
import type { PolicyBlock, PolicyDocument, PolicyInlineSegment } from "@/lib/legal-content/types";

function renderBlocks(blocks: PolicyBlock[]) {
  return blocks.map((block, index) => {
    switch (block.type) {
      case "p":
        return (
          <PolicyP key={index}>
            <PolicyInlineSegments segments={block.segments} />
          </PolicyP>
        );
      case "bullets":
        return (
          <PolicyBulletList
            key={index}
            items={block.items.map((item) =>
              typeof item === "string" ? (
                item
              ) : (
                <>
                  <strong className="text-[#603b1c] dark:text-[#e3ba65]">{item.label}</strong> {item.text}
                </>
              )
            )}
          />
        );
      case "callout":
        return (
          <PolicyCallout key={index} label={block.label}>
            <PolicyInlineSegments segments={block.segments} />
          </PolicyCallout>
        );
      case "label":
        return (
          <PolicyLabelBlock key={index} label={block.label}>
            {renderBlocks(block.blocks)}
          </PolicyLabelBlock>
        );
      default:
        return null;
    }
  });
}

type Props = {
  document: PolicyDocument;
  contactBlock?: React.ReactNode;
};

export function PolicyDocumentView({ document, contactBlock }: Props) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background">
      <PolicyHero
        title={document.meta.heroTitle}
        subtitle={document.meta.heroSubtitle}
        dateLine={document.meta.dateLine}
      />

      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="rounded-xl border border-border bg-white p-8 shadow-md dark:bg-card sm:p-10">
          {document.sections.map((section) => {
            if (section.kind === "section") {
              return (
                <div key={`${section.number}-${section.title}`}>
                  <PolicySectionHeading id={section.id} number={section.number} title={section.title} />
                  {renderBlocks(section.blocks)}
                </div>
              );
            }

            return (
              <div key={`${section.number}-${section.title}`}>
                <PolicySubHeading number={section.number} title={section.title} />
                {renderBlocks(section.blocks)}
              </div>
            );
          })}

          {contactBlock}

          <PolicyUpdatedBanner>
            <PolicyInlineSegments segments={document.updatedBanner} />
          </PolicyUpdatedBanner>
        </div>

        <PolicyFooterNav links={document.footerLinks} />
      </div>
    </div>
  );
}

export function PolicyContactSection({ segments }: { segments: PolicyInlineSegment[] }) {
  return (
    <PolicyContactBlock>
      <p>
        <PolicyInlineSegments segments={segments} />
      </p>
    </PolicyContactBlock>
  );
}
