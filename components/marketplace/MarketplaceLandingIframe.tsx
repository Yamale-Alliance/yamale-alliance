"use client";

import { useMemo } from "react";
import { prepareMarketplaceLandingSrcDoc } from "@/lib/marketplace-landing-page";

/**
 * Renders trusted admin HTML as a full landing page. Sandboxed (no scripts) with same-origin
 * so external stylesheets (e.g. Google Fonts) can load. `/pricing`, `https://…/pricing`, and
 * `//…/pricing` are rewritten to `#pricing` so the iframe does not load the full Next.js app.
 * Top-level navigation is omitted from the sandbox.
 */
export function MarketplaceLandingIframe({ html, title }: { html: string; title: string }) {
  const srcDoc = useMemo(() => prepareMarketplaceLandingSrcDoc(html), [html]);

  return (
    <section className="w-full overflow-hidden border-b border-border bg-muted/30" aria-label="Product landing">
      <iframe
        title={title}
        srcDoc={srcDoc}
        className="block h-[calc(100dvh-8rem)] min-h-[520px] w-full border-0 sm:h-[calc(100dvh-7rem)] sm:min-h-[560px]"
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-downloads"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </section>
  );
}
