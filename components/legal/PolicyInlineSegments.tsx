import {
  PolicyInlineLink,
  PolicyMailLink,
} from "@/components/legal/policy-document-primitives";
import type { PolicyInlineSegment } from "@/lib/legal-content/types";

export function PolicyInlineSegments({ segments }: { segments: PolicyInlineSegment[] }) {
  return (
    <>
      {segments.map((segment, index) => {
        switch (segment.kind) {
          case "text":
            return <span key={index}>{segment.value}</span>;
          case "strong":
            return (
              <strong key={index} className="text-[#603b1c] dark:text-[#e3ba65]">
                {segment.value}
              </strong>
            );
          case "link":
            return (
              <PolicyInlineLink key={index} href={segment.href}>
                {segment.label}
              </PolicyInlineLink>
            );
          case "email":
            return <PolicyMailLink key={index} email={segment.address} />;
          default:
            return null;
        }
      })}
    </>
  );
}
