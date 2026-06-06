"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useTheme } from "@/components/theme/ThemeProvider";
import {
  applyLandingLanguage,
  detectCheckoutTierFromAnchor,
  detectCheckoutTierFromCtaText,
  isLandingInPageSectionAnchor,
  landingHashFromAnchor,
  landingLanguageFromButton,
  LANDING_EMBED_HOST_DARK_CLASS,
  LANDING_EMBED_HOST_LIGHT_CLASS,
  LANDING_EMBED_THEME_VARS,
  prepareMarketplaceLandingEmbedHtml,
  readSavedLandingLanguage,
  saveLandingLanguage,
  shouldInterceptVaultCheckoutAnchor,
  type LandingPageLanguage,
  type PackageOfferTier,
} from "@/lib/marketplace-landing-page";

type MarketplaceLandingEmbedProps = {
  html: string;
  className?: string;
  onCheckoutClick?: (tier: PackageOfferTier | null) => void;
};

function findClickTargetInComposedPath(
  path: EventTarget[],
  selector: string
): Element | null {
  for (const node of path) {
    if (!(node instanceof Element)) continue;
    if (node.matches(selector)) return node;
    const nested = node.closest(selector);
    if (nested) return nested;
  }
  return null;
}

function scrollShadowHash(host: HTMLElement, hash: string) {
  const id = hash.replace(/^#/, "").trim();
  if (!id) return;
  const shadow = host.shadowRoot;
  if (!shadow) return;
  const target = shadow.getElementById(id);
  if (target) {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function syncLandingEmbedHostTheme(host: HTMLElement, theme: "light" | "dark") {
  host.classList.remove(LANDING_EMBED_HOST_LIGHT_CLASS, LANDING_EMBED_HOST_DARK_CLASS);
  host.classList.add(theme === "dark" ? LANDING_EMBED_HOST_DARK_CLASS : LANDING_EMBED_HOST_LIGHT_CLASS);

  const source = getComputedStyle(document.documentElement);
  for (const name of LANDING_EMBED_THEME_VARS) {
    host.style.setProperty(name, source.getPropertyValue(name).trim());
  }
}

/**
 * Renders admin landing HTML in a shadow root so its CSS cannot affect Yamalé site chrome.
 */
export function MarketplaceLandingEmbed({
  html,
  className = "w-full bg-background",
  onCheckoutClick,
}: MarketplaceLandingEmbedProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  const embedHtml = useMemo(() => prepareMarketplaceLandingEmbedHtml(html), [html]);

  const handleShadowClick = useCallback(
    (event: Event) => {
      if (!(event instanceof MouseEvent)) return;
      const host = hostRef.current;
      if (!host) return;
      const path = event.composedPath();

      const langBtn = findClickTargetInComposedPath(path, ".lang-btn[data-select-lang]");
      if (langBtn) {
        const lang = landingLanguageFromButton(langBtn);
        if (lang) {
          event.preventDefault();
          event.stopPropagation();
          const shadow = host.shadowRoot;
          if (shadow) {
            applyLandingLanguage(shadow, lang);
            saveLandingLanguage(lang);
          }
          return;
        }
      }

      const anchor = findClickTargetInComposedPath(path, "a");
      if (anchor) {
        if (isLandingInPageSectionAnchor(anchor)) {
          event.preventDefault();
          event.stopPropagation();
          scrollShadowHash(host, landingHashFromAnchor(anchor));
          return;
        }

        if (onCheckoutClick && shouldInterceptVaultCheckoutAnchor(anchor)) {
          event.preventDefault();
          event.stopPropagation();
          onCheckoutClick(detectCheckoutTierFromAnchor(anchor));
          return;
        }
      }

      if (!onCheckoutClick) return;

      const button = findClickTargetInComposedPath(path, "button");
      if (!button) return;
      const inCheckoutCta =
        button.closest(".hero-cta, .cta-buttons, .cta-section, .pricing-section, .pricing-cards") !=
          null ||
        button.classList.contains("btn-primary") ||
        button.classList.contains("btn-bundle");
      if (!inCheckoutCta) return;
      event.preventDefault();
      event.stopPropagation();
      onCheckoutClick(
        detectCheckoutTierFromCtaText(button.textContent) ??
          (button.classList.contains("btn-bundle") ? "bundle" : null)
      );
    },
    [onCheckoutClick]
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let shadow = host.shadowRoot;
    if (!shadow) {
      shadow = host.attachShadow({ mode: "open" });
    }
    shadow.innerHTML = embedHtml;

    syncLandingEmbedHostTheme(host, theme);

    const initialLang: LandingPageLanguage = readSavedLandingLanguage();
    applyLandingLanguage(shadow, initialLang);

    shadow.addEventListener("click", handleShadowClick, true);
    return () => shadow.removeEventListener("click", handleShadowClick, true);
  }, [embedHtml, handleShadowClick]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    syncLandingEmbedHostTheme(host, theme);
  }, [theme]);

  return (
    <section
      className={`marketplace-landing-zone relative z-0 w-full max-w-full overflow-x-clip border-t-4 border-primary/45 ${className}`}
      aria-label="Product landing"
    >
      <div ref={hostRef} className="marketplace-landing-embed-host block w-full min-h-[1px] max-w-full" />
    </section>
  );
}
