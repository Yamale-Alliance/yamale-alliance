"use client";

import { useMemo } from "react";
import { prepareMarketplaceLandingSrcDoc } from "@/lib/marketplace-landing-page";

type MarketplaceLandingIframeProps = {
  html: string;
  title: string;
  /** Scroll parent checkout when user clicks #pricing or purchase mailto links (ZIP package page). */
  bridgeParentCheckout?: boolean;
  className?: string;
  iframeClassName?: string;
};

/**
 * Renders trusted admin HTML as a full landing page. Sandboxed with same-origin so external
 * stylesheets (e.g. Google Fonts) can load. `/pricing`, `https://…/pricing`, and `//…/pricing`
 * are rewritten to `#pricing` so the iframe does not load the full Next.js app.
 */
export function MarketplaceLandingIframe({
  html,
  title,
  bridgeParentCheckout = false,
  className = "w-full overflow-hidden border-b border-border bg-muted/30",
  iframeClassName = "block h-[calc(100dvh-8rem)] min-h-[520px] w-full border-0 sm:h-[calc(100dvh-7rem)] sm:min-h-[560px]",
}: MarketplaceLandingIframeProps) {
  const srcDoc = useMemo(
    () => prepareMarketplaceLandingSrcDoc(html, { bridgeParentCheckout }),
    [html, bridgeParentCheckout]
  );

  const sandbox = bridgeParentCheckout
    ? "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-downloads"
    : "allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-downloads";

  return (
    <section className={className} aria-label="Product landing">
      <iframe
        title={title}
        srcDoc={srcDoc}
        className={iframeClassName}
        sandbox={sandbox}
        referrerPolicy="no-referrer-when-downgrade"
      />
    </section>
  );
}
