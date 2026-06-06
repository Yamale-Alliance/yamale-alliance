import {
  lawFirmAdvisoryMailto,
  lawFirmTierEnrollmentMailto,
  type LawFirmEnrollmentTier,
} from "@/lib/law-firm-enrollment-contact";

const MAX_LANDING_HTML_CHARS = 500_000;

/** Injected into iframe documents so hash links land below sticky bars and paths like /pricing scroll in-doc. */
const LANDING_BASE_STYLE_MARK = "data-yamale-landing-base";

const LANDING_BASE_CSS =
  "html{scroll-behavior:smooth}[id]{scroll-margin-top:min(5.5rem,14vh)}body{margin:0}";

/** Fallback tokens + CTA styles when :root/body rules do not apply inside shadow DOM. */
const LANDING_SHADOW_ROOT_DEFAULTS = `
.yamale-landing-root{
  --gold:var(--primary,#c8922a);
  --pale-gold:var(--primary,#c8922a);
  --ebony:var(--foreground,#0d1b2a);
  --ebony-deep:var(--accent,#162436);
  --white:var(--card,#ffffff);
  --off-white:var(--foreground,#0d1b2a);
  color:var(--foreground,#0d1b2a);
  background:var(--background,#fafaf7);
  font-family:'DM Sans',sans-serif;
}
.yamale-landing-root .btn-primary{
  background:var(--primary,#c8922a)!important;
  color:var(--primary-foreground,#fff)!important;
  font-family:'DM Sans',sans-serif!important;
  font-size:0.875rem!important;
  font-weight:600!important;
  letter-spacing:0.06em!important;
  text-transform:uppercase!important;
  padding:16px 36px!important;
  border:none!important;
  cursor:pointer!important;
  text-decoration:none!important;
  display:inline-block!important;
  transition:all 0.25s!important;
  position:relative!important;
  overflow:hidden!important;
}
.yamale-landing-root .btn-primary:hover{
  transform:translateY(-2px)!important;
  opacity:0.92!important;
  box-shadow:0 8px 32px color-mix(in srgb,var(--primary,#c8922a) 30%,transparent)!important;
}
.yamale-landing-root .btn-secondary{
  color:var(--primary,#c8922a)!important;
  font-family:'DM Sans',sans-serif!important;
  font-size:0.875rem!important;
  font-weight:400!important;
  text-decoration:none!important;
  border-bottom:1px solid color-mix(in srgb,var(--primary,#c8922a) 40%,transparent)!important;
  padding-bottom:2px!important;
}
.yamale-landing-root .btn-secondary:hover{
  opacity:0.85!important;
}
`;

/** Light/dark remaps for vault HTML authored with white-on-brown colors (injected last in shadow root). */
const LANDING_THEME_MODE_OVERRIDES = `
:host(.yamale-landing-light) .yamale-landing-root{
  --gold:var(--primary,#c8922a)!important;
  --pale-gold:var(--primary,#c8922a)!important;
  --ebony:var(--foreground,#0d1b2a)!important;
  --ebony-deep:var(--muted,#f4f1eb)!important;
  --warm-gray:var(--muted,#f4f1eb)!important;
  --warm-gray-2:color-mix(in srgb,var(--foreground,#0d1b2a) 10%,var(--border,#e2ddd5))!important;
  --off-white:var(--foreground,#0d1b2a)!important;
  --white:var(--card,#ffffff)!important;
  --text-dark:var(--foreground,#0d1b2a)!important;
  --saddlewood:var(--accent,#162436)!important;
  --copper:var(--primary,#c8922a)!important;
  color:var(--foreground,#0d1b2a)!important;
  background:var(--background,#fafaf7)!important;
}
:host(.yamale-landing-dark) .yamale-landing-root{
  --gold:var(--primary,#e8b84b)!important;
  --pale-gold:var(--primary,#e8b84b)!important;
  --ebony:var(--foreground,#f4f1eb)!important;
  --ebony-deep:var(--muted,#162436)!important;
  --warm-gray:var(--muted,#162436)!important;
  --warm-gray-2:var(--border,#2a3f56)!important;
  --off-white:var(--foreground,#f4f1eb)!important;
  --white:var(--card,#162436)!important;
  --text-dark:var(--foreground,#f4f1eb)!important;
  --saddlewood:var(--primary,#e8b84b)!important;
  --copper:var(--primary,#e8b84b)!important;
  color:var(--foreground,#f4f1eb)!important;
  background:var(--background,#0d1b2a)!important;
}
/* Hero */
:host(.yamale-landing-light) .yamale-landing-root .hero::after{
  inset:0!important;
  width:100%!important;
  height:100%!important;
  bottom:auto!important;
  right:auto!important;
  background:radial-gradient(ellipse 75% 60% at 72% 28%,color-mix(in srgb,var(--primary,#c8922a) 8%,transparent) 0%,transparent 62%)!important;
}
:host(.yamale-landing-dark) .yamale-landing-root .hero::after{
  inset:0!important;
  width:100%!important;
  height:100%!important;
  bottom:auto!important;
  right:auto!important;
  background:radial-gradient(ellipse 75% 60% at 72% 28%,color-mix(in srgb,var(--primary,#e8b84b) 10%,transparent) 0%,transparent 62%)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .hero-eyebrow,
:host(.yamale-landing-light) .yamale-landing-root .section-label,
:host(.yamale-landing-light) .yamale-landing-root .hero-headline em{
  color:var(--primary,#c8922a)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .hero-headline,
:host(.yamale-landing-dark) .yamale-landing-root .hero-headline,
:host(.yamale-landing-light) .yamale-landing-root .problem-heading,
:host(.yamale-landing-light) .yamale-landing-root .kit-heading,
:host(.yamale-landing-light) .yamale-landing-root .pricing-heading,
:host(.yamale-landing-light) .yamale-landing-root .about-heading,
:host(.yamale-landing-light) .yamale-landing-root .who-heading,
:host(.yamale-landing-light) .yamale-landing-root .section-heading,
:host(.yamale-landing-light) .yamale-landing-root .kit-card-title,
:host(.yamale-landing-light) .yamale-landing-root .who-card-role,
:host(.yamale-landing-light) .yamale-landing-root .pricing-tier-name{
  color:var(--foreground)!important;
}
:host(.yamale-landing-dark) .yamale-landing-root .hero-headline em,
:host(.yamale-landing-dark) .yamale-landing-root .hero-eyebrow,
:host(.yamale-landing-dark) .yamale-landing-root .section-label{
  color:var(--primary)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .hero-sub,
:host(.yamale-landing-light) .yamale-landing-root .hero-content p,
:host(.yamale-landing-light) .yamale-landing-root .hero p,
:host(.yamale-landing-dark) .yamale-landing-root .hero-sub,
:host(.yamale-landing-dark) .yamale-landing-root .hero-content p,
:host(.yamale-landing-dark) .yamale-landing-root .hero p,
:host(.yamale-landing-light) .yamale-landing-root .problem-text,
:host(.yamale-landing-light) .yamale-landing-root .kit-desc,
:host(.yamale-landing-light) .yamale-landing-root .kit-card-desc,
:host(.yamale-landing-light) .yamale-landing-root .law-callout-text,
:host(.yamale-landing-light) .yamale-landing-root .who-card-desc,
:host(.yamale-landing-light) .yamale-landing-root .pricing-sub,
:host(.yamale-landing-light) .yamale-landing-root .pricing-list li,
:host(.yamale-landing-light) .yamale-landing-root .pricing-period,
:host(.yamale-landing-light) .yamale-landing-root .pricing-includes,
:host(.yamale-landing-light) .yamale-landing-root .pricing-note,
:host(.yamale-landing-light) .yamale-landing-root .about-text,
:host(.yamale-landing-light) .yamale-landing-root .footer-text,
:host(.yamale-landing-light) .yamale-landing-root .stat-label,
:host(.yamale-landing-light) .yamale-landing-root .price-label,
:host(.yamale-landing-light) .yamale-landing-root .pain-text,
:host(.yamale-landing-light) .yamale-landing-root .pain-desc,
:host(.yamale-landing-light) .yamale-landing-root .challenge-text,
:host(.yamale-landing-light) .yamale-landing-root .grid-card-desc,
:host(.yamale-landing-light) .yamale-landing-root .card-body,
:host(.yamale-landing-light) .yamale-landing-root .card-desc,
:host(.yamale-landing-light) .yamale-landing-root section p,
:host(.yamale-landing-light) .yamale-landing-root .lead,
:host(.yamale-landing-light) .yamale-landing-root .intro,
:host(.yamale-landing-light) .yamale-landing-root .subtitle,
:host(.yamale-landing-dark) .yamale-landing-root .problem-text,
:host(.yamale-landing-dark) .yamale-landing-root .kit-card-desc,
:host(.yamale-landing-dark) .yamale-landing-root .pricing-list li,
:host(.yamale-landing-dark) .yamale-landing-root .pricing-sub,
:host(.yamale-landing-dark) .yamale-landing-root section p{
  color:var(--muted-foreground)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .hero-sub strong,
:host(.yamale-landing-light) .yamale-landing-root .hero p strong,
:host(.yamale-landing-light) .yamale-landing-root .problem-text strong,
:host(.yamale-landing-light) .yamale-landing-root .law-callout-text strong,
:host(.yamale-landing-dark) .yamale-landing-root .hero-sub strong,
:host(.yamale-landing-dark) .yamale-landing-root .hero p strong{
  color:var(--foreground)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .price-amount,
:host(.yamale-landing-light) .yamale-landing-root .price-currency,
:host(.yamale-landing-dark) .yamale-landing-root .price-amount,
:host(.yamale-landing-dark) .yamale-landing-root .price-currency,
:host(.yamale-landing-light) .yamale-landing-root .pricing-price .currency{
  color:var(--primary)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .pricing-price,
:host(.yamale-landing-dark) .yamale-landing-root .pricing-price{
  color:var(--foreground)!important;
}
/* Cities strip — high-contrast band (DRC uses .cities; Zambia uses .cities-strip) */
:host(.yamale-landing-light) .yamale-landing-root .cities-strip,
:host(.yamale-landing-light) .yamale-landing-root .cities{
  background:var(--accent,#162436)!important;
}
:host(.yamale-landing-dark) .yamale-landing-root .cities-strip,
:host(.yamale-landing-dark) .yamale-landing-root .cities{
  background:color-mix(in srgb,var(--primary) 88%,var(--background))!important;
}
:host(.yamale-landing-light) .yamale-landing-root .cities-label,
:host(.yamale-landing-light) .yamale-landing-root .city-item,
:host(.yamale-landing-light) .yamale-landing-root .cities span,
:host(.yamale-landing-dark) .yamale-landing-root .cities-label,
:host(.yamale-landing-dark) .yamale-landing-root .city-item{
  color:color-mix(in srgb,#fff 88%,var(--primary))!important;
}
:host(.yamale-landing-dark) .yamale-landing-root .cities span{
  color:color-mix(in srgb,var(--background) 88%,var(--foreground))!important;
}
:host(.yamale-landing-light) .yamale-landing-root .cities .dot,
:host(.yamale-landing-dark) .yamale-landing-root .cities .dot{
  background:color-mix(in srgb,currentColor 50%,transparent)!important;
}
/* Language toggle */
:host(.yamale-landing-light) .yamale-landing-root .lang-btn,
:host(.yamale-landing-dark) .yamale-landing-root .lang-btn{
  color:var(--muted-foreground)!important;
  border:1px solid var(--border)!important;
  background:var(--card)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .lang-btn.active,
:host(.yamale-landing-dark) .yamale-landing-root .lang-btn.active{
  color:var(--primary-foreground)!important;
  background:var(--primary)!important;
  border-color:var(--primary)!important;
}
/* Secondary / bundle CTAs */
:host(.yamale-landing-light) .yamale-landing-root .btn-secondary{
  color:var(--primary)!important;
  border-bottom-color:color-mix(in srgb,var(--primary) 45%,transparent)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .btn-primary[style*="rgba(193,140,67"],
:host(.yamale-landing-light) .yamale-landing-root a.btn-primary[style*="--pale-gold"],
:host(.yamale-landing-light) .yamale-landing-root .btn-bundle,
:host(.yamale-landing-light) .yamale-landing-root a[href="#pricing-bundle"]:not(.pricing-card a){
  background:color-mix(in srgb,var(--primary) 12%,var(--card))!important;
  color:var(--primary)!important;
  border:1px solid color-mix(in srgb,var(--primary) 45%,var(--border))!important;
}
:host(.yamale-landing-dark) .yamale-landing-root .btn-primary[style*="rgba(193,140,67"],
:host(.yamale-landing-dark) .yamale-landing-root a.btn-primary[style*="--pale-gold"]{
  background:color-mix(in srgb,var(--primary) 18%,transparent)!important;
  color:var(--primary)!important;
  border:1px solid color-mix(in srgb,var(--primary) 50%,transparent)!important;
}
/* Sections */
:host(.yamale-landing-light) .yamale-landing-root .problem-section,
:host(.yamale-landing-light) .yamale-landing-root .kit-section,
:host(.yamale-landing-light) .yamale-landing-root .pricing-section,
:host(.yamale-landing-light) .yamale-landing-root .about-section,
:host(.yamale-landing-light) .yamale-landing-root .footer-section,
:host(.yamale-landing-light) .yamale-landing-root .context-section{
  background:var(--background,#fafaf7)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .kit-section{
  background:linear-gradient(180deg,var(--muted,#f4f1eb) 0%,var(--background,#fafaf7) 100%)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .who-section{
  background:var(--muted,#f4f1eb)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .stats-strip{
  background:var(--accent,#162436)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .stats-strip .stat-label,
:host(.yamale-landing-dark) .yamale-landing-root .stats-strip .stat-label{
  color:color-mix(in srgb,#fff 78%,var(--primary))!important;
}
:host(.yamale-landing-dark) .yamale-landing-root .problem-section,
:host(.yamale-landing-dark) .yamale-landing-root .kit-section,
:host(.yamale-landing-dark) .yamale-landing-root .pricing-section,
:host(.yamale-landing-dark) .yamale-landing-root .about-section,
:host(.yamale-landing-dark) .yamale-landing-root .context-section{
  background:var(--card,#162436)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .kit-card,
:host(.yamale-landing-light) .yamale-landing-root .pricing-card.standard{
  background:var(--card,#fff)!important;
  border-color:color-mix(in srgb,var(--foreground,#0d1b2a) 14%,var(--border,#e2ddd5))!important;
}
:host(.yamale-landing-light) .yamale-landing-root .kit-card:hover{
  background:color-mix(in srgb,var(--primary,#c8922a) 6%,var(--card,#fff))!important;
  border-color:color-mix(in srgb,var(--primary,#c8922a) 35%,var(--border,#e2ddd5))!important;
}
:host(.yamale-landing-dark) .yamale-landing-root .kit-card{
  background:color-mix(in srgb,var(--foreground,#f4f1eb) 4%,var(--card,#162436))!important;
  border-color:var(--border,#334155)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .pricing-card.bundle{
  background:color-mix(in srgb,var(--primary,#c8922a) 10%,var(--card,#fff))!important;
  border-color:var(--primary,#c8922a)!important;
}
:host(.yamale-landing-dark) .yamale-landing-root .pricing-card.bundle{
  background:color-mix(in srgb,var(--primary) 12%,var(--card))!important;
  border-color:var(--primary)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .btn-primary{
  color:var(--primary-foreground,#fff)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .context-quote{
  color:var(--foreground)!important;
}
:host(.yamale-landing-dark) .yamale-landing-root .context-quote{
  color:color-mix(in srgb,var(--foreground) 88%,transparent)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .gold-bar,
:host(.yamale-landing-light) .yamale-landing-root hr,
:host(.yamale-landing-light) .yamale-landing-root .section-divider{
  opacity:0.85!important;
}
:host(.yamale-landing-light) .yamale-landing-root .problem-item,
:host(.yamale-landing-light) .yamale-landing-root .kit-grid,
:host(.yamale-landing-light) .yamale-landing-root section{
  border-color:color-mix(in srgb,var(--foreground,#0d1b2a) 12%,var(--border,#e2ddd5))!important;
}
:host(.yamale-landing-light) .yamale-landing-root .hero-eyebrow::before,
:host(.yamale-landing-light) .yamale-landing-root .section-label::before{
  background:var(--primary)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .hero-desc,
:host(.yamale-landing-light) .yamale-landing-root .hero-body,
:host(.yamale-landing-light) .yamale-landing-root .hero-text,
:host(.yamale-landing-light) .yamale-landing-root .hero-lead{
  color:var(--muted-foreground)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .hero-desc strong,
:host(.yamale-landing-light) .yamale-landing-root .hero-body strong{
  color:var(--foreground)!important;
}
/* DRC / CMS mining kit (.prob-item, .sec.dark, .hero-h1) */
:host(.yamale-landing-light) .yamale-landing-root .sec.dark,
:host(.yamale-landing-light) .yamale-landing-root .bi-note{
  background:var(--muted)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .hero{
  background:var(--background)!important;
}
:host(.yamale-landing-dark) .yamale-landing-root .sec.dark,
:host(.yamale-landing-dark) .yamale-landing-root .hero,
:host(.yamale-landing-dark) .yamale-landing-root .bi-note{
  background:var(--card)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .hero-h1,
:host(.yamale-landing-dark) .yamale-landing-root .hero-h1,
:host(.yamale-landing-light) .yamale-landing-root .hdg,
:host(.yamale-landing-dark) .yamale-landing-root .hdg.white{
  color:var(--foreground)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .hero-h1 em,
:host(.yamale-landing-dark) .yamale-landing-root .hero-h1 em,
:host(.yamale-landing-light) .yamale-landing-root .hdg em,
:host(.yamale-landing-dark) .yamale-landing-root .hdg em{
  color:var(--primary)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .hero-sub,
:host(.yamale-landing-dark) .yamale-landing-root .hero-sub,
:host(.yamale-landing-light) .yamale-landing-root .sec.dark .prob-item p,
:host(.yamale-landing-light) .yamale-landing-root .sec.dark .prob-item strong,
:host(.yamale-landing-light) .yamale-landing-root .prob-item p,
:host(.yamale-landing-dark) .yamale-landing-root .prob-item p,
:host(.yamale-landing-light) .yamale-landing-root .lead.white,
:host(.yamale-landing-dark) .yamale-landing-root .lead.white,
:host(.yamale-landing-light) .yamale-landing-root .bi-note p,
:host(.yamale-landing-dark) .yamale-landing-root .bi-note p,
:host(.yamale-landing-light) .yamale-landing-root .p-desc,
:host(.yamale-landing-dark) .yamale-landing-root .p-desc,
:host(.yamale-landing-light) .yamale-landing-root .p-list li,
:host(.yamale-landing-dark) .yamale-landing-root .p-list li,
:host(.yamale-landing-light) .yamale-landing-root .p-note,
:host(.yamale-landing-dark) .yamale-landing-root .p-note,
:host(.yamale-landing-light) .yamale-landing-root .foot-l,
:host(.yamale-landing-dark) .yamale-landing-root .foot-l,
:host(.yamale-landing-light) .yamale-landing-root .stat-l,
:host(.yamale-landing-dark) .yamale-landing-root .stat-l{
  color:var(--muted-foreground)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .hero-sub strong,
:host(.yamale-landing-dark) .yamale-landing-root .hero-sub strong,
:host(.yamale-landing-light) .yamale-landing-root .sec.dark .prob-item strong,
:host(.yamale-landing-light) .yamale-landing-root .prob-item strong,
:host(.yamale-landing-dark) .yamale-landing-root .prob-item strong,
:host(.yamale-landing-light) .yamale-landing-root .bi-note strong,
:host(.yamale-landing-dark) .yamale-landing-root .bi-note strong{
  color:var(--foreground)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .prob-item h3,
:host(.yamale-landing-dark) .yamale-landing-root .prob-item h3{
  color:var(--primary)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .prob-n,
:host(.yamale-landing-dark) .yamale-landing-root .prob-n{
  color:color-mix(in srgb,var(--primary) 22%,transparent)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .p-price,
:host(.yamale-landing-dark) .yamale-landing-root .p-price{
  color:var(--foreground)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .hero-doc-count .big,
:host(.yamale-landing-dark) .yamale-landing-root .hero-doc-count .big{
  color:color-mix(in srgb,var(--primary) 16%,transparent)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .hero-doc-count .small,
:host(.yamale-landing-dark) .yamale-landing-root .hero-doc-count .small{
  color:var(--muted-foreground)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .sec.gray{
  background:var(--muted)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .stats-bar,
:host(.yamale-landing-dark) .yamale-landing-root .stats-bar{
  background:var(--accent)!important;
}
:host(.yamale-landing-dark) .yamale-landing-root .stats-bar{
  background:color-mix(in srgb,var(--primary) 88%,var(--background))!important;
}
:host(.yamale-landing-light) .yamale-landing-root .stat-n,
:host(.yamale-landing-dark) .yamale-landing-root .stat-n{
  color:var(--primary)!important;
}
:host(.yamale-landing-dark) .yamale-landing-root .stats-bar .stat-n{
  color:var(--background)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .stats-bar .stat-l{
  color:color-mix(in srgb,#fff 88%,var(--primary))!important;
}
:host(.yamale-landing-dark) .yamale-landing-root .stats-bar .stat-l{
  color:color-mix(in srgb,var(--background) 82%,var(--foreground))!important;
}
:host(.yamale-landing-light) .yamale-landing-root footer,
:host(.yamale-landing-dark) .yamale-landing-root footer{
  background:var(--muted)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .foot-r,
:host(.yamale-landing-dark) .yamale-landing-root .foot-r{
  color:var(--primary)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .btn-secondary{
  background:color-mix(in srgb,var(--primary) 10%,var(--card))!important;
  color:var(--primary)!important;
  border-color:color-mix(in srgb,var(--primary) 40%,var(--border))!important;
}
/* DRC sec variants + legal framework document */
:host(.yamale-landing-light) .yamale-landing-root .sec.white,
:host(.yamale-landing-light) .yamale-landing-root .sec.gray,
:host(.yamale-landing-light) .yamale-landing-root .sec.dark{
  background:var(--background)!important;
  color:var(--foreground)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .sec.gray{
  background:var(--muted)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .sec.dark{
  background:color-mix(in srgb,var(--foreground) 4%,var(--muted))!important;
}
:host(.yamale-landing-light) .yamale-landing-root nav,
:host(.yamale-landing-light) .yamale-landing-root footer{
  background:var(--card)!important;
  border-color:var(--border)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .nav-brand,
:host(.yamale-landing-light) .yamale-landing-root .nav-price{
  color:var(--primary)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .nav-series{
  color:var(--muted-foreground)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .hdg.dark,
:host(.yamale-landing-dark) .yamale-landing-root .hdg.dark,
:host(.yamale-landing-light) .yamale-landing-root .hdg.xl,
:host(.yamale-landing-dark) .yamale-landing-root .hdg.xl{
  color:var(--foreground)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .lead.dark,
:host(.yamale-landing-dark) .yamale-landing-root .lead.dark{
  color:var(--muted-foreground)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .eyebrow,
:host(.yamale-landing-dark) .yamale-landing-root .eyebrow{
  color:var(--primary)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .auth-box{
  background:var(--muted)!important;
  border-left-color:var(--primary)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .auth-label,
:host(.yamale-landing-dark) .yamale-landing-root .auth-label{
  color:var(--primary)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .auth-list li,
:host(.yamale-landing-dark) .yamale-landing-root .auth-list li{
  color:var(--foreground)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .auth-list li::before,
:host(.yamale-landing-dark) .yamale-landing-root .auth-list li::before{
  color:var(--primary)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .dcard,
:host(.yamale-landing-light) .yamale-landing-root .acard{
  background:var(--card)!important;
  border-color:var(--border)!important;
}
:host(.yamale-landing-dark) .yamale-landing-root .dcard,
:host(.yamale-landing-dark) .yamale-landing-root .acard{
  background:var(--card)!important;
  border-color:var(--border)!important;
}
:host(.yamale-landing-dark) .yamale-landing-root .dcard-foot{
  background:color-mix(in srgb,var(--foreground) 5%,var(--card))!important;
  border-top:1px solid var(--border)!important;
}
:host(.yamale-landing-dark) .yamale-landing-root .duse,
:host(.yamale-landing-light) .yamale-landing-root .duse{
  color:var(--muted-foreground)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .dcard h3,
:host(.yamale-landing-light) .yamale-landing-root .acard h3,
:host(.yamale-landing-dark) .yamale-landing-root .dcard h3,
:host(.yamale-landing-dark) .yamale-landing-root .acard h3{
  color:var(--foreground)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .dcard p,
:host(.yamale-landing-light) .yamale-landing-root .acard p,
:host(.yamale-landing-dark) .yamale-landing-root .dcard p,
:host(.yamale-landing-dark) .yamale-landing-root .acard p{
  color:var(--muted-foreground)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .pcard.std,
:host(.yamale-landing-light) .yamale-landing-root .pcard.bndl{
  background:var(--card)!important;
  border-color:color-mix(in srgb,var(--primary) 35%,var(--border))!important;
}
:host(.yamale-landing-dark) .yamale-landing-root .pcard.std,
:host(.yamale-landing-dark) .yamale-landing-root .pcard.bndl{
  background:color-mix(in srgb,var(--foreground) 4%,var(--card))!important;
  border-color:color-mix(in srgb,var(--primary) 40%,var(--border))!important;
}
:host(.yamale-landing-dark) .yamale-landing-root .auth-box{
  background:color-mix(in srgb,var(--foreground) 4%,var(--muted))!important;
  border-left-color:var(--primary)!important;
}
:host(.yamale-landing-dark) .yamale-landing-root .foot-l{
  color:var(--muted-foreground)!important;
}
:host(.yamale-landing-dark) .yamale-landing-root .nav-brand,
:host(.yamale-landing-dark) .yamale-landing-root .nav-price{
  color:var(--primary)!important;
}
:host(.yamale-landing-dark) .yamale-landing-root .nav-series{
  color:var(--muted-foreground)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .ctx-stat,
:host(.yamale-landing-light) .yamale-landing-root .ctx-quote,
:host(.yamale-landing-dark) .yamale-landing-root .ctx-stat,
:host(.yamale-landing-dark) .yamale-landing-root .ctx-quote{
  color:var(--foreground)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .ctx-lbl,
:host(.yamale-landing-dark) .yamale-landing-root .ctx-lbl,
:host(.yamale-landing-light) .yamale-landing-root .ctx-body h2,
:host(.yamale-landing-dark) .yamale-landing-root .ctx-body h2{
  color:var(--foreground)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .ctx-body p,
:host(.yamale-landing-dark) .yamale-landing-root .ctx-body p{
  color:var(--muted-foreground)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .ctx-big,
:host(.yamale-landing-dark) .yamale-landing-root .ctx-big{
  color:var(--primary)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .ctx-src,
:host(.yamale-landing-dark) .yamale-landing-root .ctx-src{
  color:var(--muted-foreground)!important;
}
:host(.yamale-landing-light) .yamale-landing-root .cta-h,
:host(.yamale-landing-dark) .yamale-landing-root .cta-h{
  color:var(--foreground)!important;
}
:host(.yamale-landing-dark) .yamale-landing-root .sec.white{
  background:var(--card)!important;
}
:host(.yamale-landing-dark) .yamale-landing-root .sec.gray{
  background:var(--muted)!important;
}
:host(.yamale-landing-dark) .yamale-landing-root .sec.dark{
  background:var(--background)!important;
}
:host(.yamale-landing-dark) .yamale-landing-root nav{
  background:var(--card)!important;
  border-color:var(--border)!important;
}
:host(.yamale-landing-dark) .yamale-landing-root .btn-secondary{
  color:var(--primary)!important;
  border-bottom-color:color-mix(in srgb,var(--primary) 45%,transparent)!important;
}
`;

/** Mobile layout — vault landing HTML assumes desktop padding and large type. */
const LANDING_MOBILE_RESPONSIVE_CSS = `
.yamale-landing-root{
  max-width:100%!important;
  overflow-x:hidden!important;
  box-sizing:border-box!important;
}
.yamale-landing-root *,.yamale-landing-root *::before,.yamale-landing-root *::after{
  box-sizing:border-box!important;
}
.yamale-landing-root .hero{
  min-height:auto!important;
  padding:1.5rem 1rem 2.5rem!important;
  overflow-x:hidden!important;
}
.yamale-landing-root .hero-content{
  max-width:100%!important;
  min-width:0!important;
}
.yamale-landing-root .hero-headline{
  font-size:clamp(1.65rem,7.5vw,5.5rem)!important;
  overflow-wrap:break-word!important;
  word-break:break-word!important;
  hyphens:auto!important;
}
.yamale-landing-root .hero-h1{
  font-size:clamp(1.75rem,7vw,4.2rem)!important;
  overflow-wrap:break-word!important;
  word-break:break-word!important;
  hyphens:auto!important;
}
.yamale-landing-root .prob-grid{
  grid-template-columns:1fr!important;
}
.yamale-landing-root .hero-btns{
  flex-direction:column!important;
  align-items:stretch!important;
  gap:0.75rem!important;
}
.yamale-landing-root .hero-btns .btn-primary,
.yamale-landing-root .hero-btns .btn-secondary,
.yamale-landing-root .hero-btns a{
  width:100%!important;
  text-align:center!important;
}
.yamale-landing-root .sec{
  padding:3.5rem 1rem!important;
}
.yamale-landing-root .inner,
.yamale-landing-root .ctx-inner,
.yamale-landing-root .cta-inner{
  max-width:100%!important;
  min-width:0!important;
  width:100%!important;
}
.yamale-landing-root .auth-box{
  max-width:100%!important;
  padding:1.25rem 1rem!important;
  box-sizing:border-box!important;
}
.yamale-landing-root .ctx-inner{
  grid-template-columns:1fr!important;
  gap:2rem!important;
}
.yamale-landing-root .cities{
  max-width:100%!important;
  padding:0.875rem 1rem!important;
  box-sizing:border-box!important;
}
.yamale-landing-root .hero-inner{
  max-width:100%!important;
  min-width:0!important;
}
.yamale-landing-root .hero-doc-count{
  display:none!important;
}
.yamale-landing-root img,
.yamale-landing-root video,
.yamale-landing-root table{
  max-width:100%!important;
  height:auto!important;
}
.yamale-landing-root .hero-sub{
  max-width:100%!important;
  font-size:clamp(0.9rem,3.8vw,1.05rem)!important;
}
.yamale-landing-root .hero-actions{
  flex-direction:column!important;
  align-items:stretch!important;
  gap:0.75rem!important;
}
.yamale-landing-root .hero-actions .btn-primary,
.yamale-landing-root .hero-actions .btn-secondary,
.yamale-landing-root .hero-actions a{
  width:100%!important;
  text-align:center!important;
}
.yamale-landing-root .hero-price-tag{
  position:relative!important;
  top:auto!important;
  right:auto!important;
  text-align:left!important;
  margin-bottom:1.25rem!important;
}
.yamale-landing-root .cities-strip{
  flex-wrap:wrap!important;
  gap:0.75rem 1rem!important;
  padding:0.875rem 1rem!important;
}
.yamale-landing-root .cities-list{
  flex-wrap:wrap!important;
  gap:0.5rem 0.75rem!important;
}
.yamale-landing-root .problem-section,
.yamale-landing-root .kit-section,
.yamale-landing-root .who-section,
.yamale-landing-root .pricing-section,
.yamale-landing-root .about-section,
.yamale-landing-root .context-section,
.yamale-landing-root .cta-section{
  padding:3.5rem 1rem!important;
}
.yamale-landing-root .problem-inner,
.yamale-landing-root .kit-header,
.yamale-landing-root .about-inner,
.yamale-landing-root .kit-grid,
.yamale-landing-root .who-grid,
.yamale-landing-root .pricing-cards,
.yamale-landing-root .stats-inner{
  grid-template-columns:1fr!important;
}
.yamale-landing-root .pricing-cards{
  gap:1rem!important;
}
.yamale-landing-root .auth-list{
  grid-template-columns:1fr!important;
}
.yamale-landing-root .docs-grid,
.yamale-landing-root .aud-grid{
  grid-template-columns:1fr!important;
}
@media (min-width:640px){
  .yamale-landing-root .hero-doc-count{
    display:block!important;
  }
  .yamale-landing-root .hero{
    padding:2rem 2rem 3rem!important;
  }
  .yamale-landing-root .hero-actions{
    flex-direction:row!important;
    align-items:center!important;
  }
  .yamale-landing-root .hero-actions .btn-primary,
  .yamale-landing-root .hero-actions .btn-secondary,
  .yamale-landing-root .hero-actions a{
    width:auto!important;
  }
  .yamale-landing-root .kit-grid{
    grid-template-columns:repeat(2,minmax(0,1fr))!important;
  }
  .yamale-landing-root .problem-section,
  .yamale-landing-root .kit-section,
  .yamale-landing-root .who-section,
  .yamale-landing-root .pricing-section,
  .yamale-landing-root .about-section,
  .yamale-landing-root .context-section,
  .yamale-landing-root .cta-section{
    padding:4rem 2rem!important;
  }
}
@media (min-width:1024px){
  .yamale-landing-root .hero{
    min-height:min(70vh,720px)!important;
    padding:2rem 3rem 5rem!important;
  }
  .yamale-landing-root .hero-price-tag{
    position:absolute!important;
    top:1rem!important;
    right:1.5rem!important;
    margin-bottom:0!important;
    text-align:right!important;
  }
  .yamale-landing-root .problem-inner,
  .yamale-landing-root .kit-header,
  .yamale-landing-root .about-inner{
    grid-template-columns:1fr 1fr!important;
  }
  .yamale-landing-root .kit-grid{
    grid-template-columns:repeat(3,minmax(0,1fr))!important;
  }
  .yamale-landing-root .pricing-cards{
    grid-template-columns:1fr 1fr!important;
  }
}
`;

/** Injected inside shadow root only — must not use html/body selectors (would leak in light DOM). */
const LANDING_SHADOW_OVERRIDES_CSS = `
${LANDING_SHADOW_ROOT_DEFAULTS}
nav,.navbar,.site-nav,.top-nav{display:none!important}
nav:has(.lang-selector){
  display:flex!important;
  justify-content:flex-end!important;
  align-items:center!important;
  position:relative!important;
  top:auto!important;
  padding:.75rem 5%!important;
  background:var(--muted,#f4f1eb)!important;
  border-bottom:1px solid color-mix(in srgb,var(--foreground,#0d1b2a) 12%,var(--border,#e2ddd5))!important;
  z-index:10!important;
}
:host(.yamale-landing-dark) nav:has(.lang-selector){
  border-bottom-color:var(--border,#334155)!important;
}
nav:has(.lang-selector) .nav-brand,
nav:has(.lang-selector) .nav-price,
nav:has(.lang-selector) .nav-cta{display:none!important}
nav:has(.lang-selector) .nav-right{display:flex!important;align-items:center!important;gap:1rem!important}
.hero{position:relative!important;top:auto!important;min-height:min(70vh,720px)!important;padding-top:2rem!important;padding-bottom:3rem!important;margin-top:0!important}
.hero::before,.hero::after{position:absolute!important}
.hero-price-tag{position:absolute!important;top:1rem!important;right:1.5rem!important}
#contents,.kit-section[id="contents"]{scroll-margin-top:1.5rem}
.lang-hidden,[data-lang].lang-hidden{display:none!important}
.yamale-landing-root .dtype.guide{color:var(--accent,#162436)!important}
.yamale-landing-root .dtype.checklist{color:var(--primary,#c8922a)!important}
${LANDING_THEME_MODE_OVERRIDES}
${LANDING_MOBILE_RESPONSIVE_CSS}
`;

const LANDING_SHADOW_ROOT_CLASS = "yamale-landing-root";

export const LANDING_EMBED_HOST_LIGHT_CLASS = "yamale-landing-light";
export const LANDING_EMBED_HOST_DARK_CLASS = "yamale-landing-dark";

/** Copied onto the shadow host so embedded CSS can resolve platform tokens inside the shadow tree. */
export const LANDING_EMBED_THEME_VARS = [
  "--background",
  "--foreground",
  "--muted",
  "--muted-foreground",
  "--card",
  "--card-foreground",
  "--border",
  "--primary",
  "--primary-foreground",
  "--accent",
] as const;

/** Strip inline light-on-dark text colors so theme overrides can apply. */
function stripVaultLandingInlineTextColors(html: string): string {
  return html.replace(/\bstyle=(["'])([\s\S]*?)\1/gi, (_m, quote: string, styles: string) => {
    const cleaned = styles
      .replace(/color\s*:\s*var\(--(?:white|off-white|pale-gold)\)/gi, "")
      .replace(/color\s*:\s*rgba\(\s*250\s*,\s*248\s*,\s*245[^)]*\)/gi, "")
      .replace(/color\s*:\s*rgba\(\s*255\s*,\s*255\s*,\s*255[^)]*\)/gi, "")
      .replace(/color\s*:\s*rgba\(\s*227\s*,\s*186\s*,\s*101[^)]*\)/gi, "")
      .replace(/color\s*:\s*#(?:faf8f5|ffffff|fff)\b/gi, "")
      .replace(/;\s*;/g, ";")
      .replace(/^\s*;\s*|\s*;\s*$/g, "")
      .trim();
    if (!cleaned) return "";
    return `style=${quote}${cleaned}${quote}`;
  });
}

/** Rewrite hardcoded off-white rgba text in admin CSS so it follows --foreground in light/dark mode. */
function remapVaultLandingTextColors(css: string): string {
  let out = css;
  out = out.replace(
    /rgba\(\s*250\s*,\s*248\s*,\s*245\s*,\s*([\d.]+)\s*\)/gi,
    (_match, alpha: string) => {
      const pct = Math.min(100, Math.max(0, Math.round(parseFloat(alpha) * 100)));
      return `color-mix(in srgb, var(--foreground, #0d1b2a) ${pct}%, transparent)`;
    }
  );
  out = out.replace(
    /rgba\(\s*227\s*,\s*186\s*,\s*101\s*,\s*([\d.]+)\s*\)/gi,
    (_match, alpha: string) => {
      const pct = Math.min(100, Math.max(0, Math.round(parseFloat(alpha) * 100)));
      return `color-mix(in srgb, var(--primary, #c8922a) ${pct}%, transparent)`;
    }
  );
  out = out.replace(
    /color\s*:\s*rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*([\d.]+)\s*\)/gi,
    (_match, alpha: string) => {
      const pct = Math.min(100, Math.max(0, Math.round(parseFloat(alpha) * 100)));
      return `color: color-mix(in srgb, var(--foreground, #0d1b2a) ${pct}%, transparent)`;
    }
  );
  return out;
}

/** Map :root/body/html rules onto the shadow wrapper so variables and base styles apply. */
export function adaptLandingCssForShadow(css: string): string {
  let out = remapVaultLandingTextColors(css);
  out = out.replace(/\b:root\s*\{/gi, `.${LANDING_SHADOW_ROOT_CLASS}{`);
  out = out.replace(/\bhtml\s*\{/gi, `.${LANDING_SHADOW_ROOT_CLASS}{`);
  out = out.replace(/\bbody\s*\{/gi, `.${LANDING_SHADOW_ROOT_CLASS}{`);
  out = out.replace(/\bbody::before\b/gi, `.${LANDING_SHADOW_ROOT_CLASS}::before`);
  out = out.replace(/\bbody::after\b/gi, `.${LANDING_SHADOW_ROOT_CLASS}::after`);
  out = out.replace(/position\s*:\s*fixed/gi, "position:relative");
  out = out.replace(/position\s*:\s*sticky/gi, "position:relative");
  return out;
}

/** Rewrites global body/html rules from admin HTML so they do not bleed under the site nav. */
export function scopeLandingCssForEmbed(css: string): string {
  return adaptLandingCssForShadow(css);
}

/** Inline styles from admin HTML must not pin nav to the viewport over Yamalé site chrome. */
function stripViewportFixedInlineStyles(html: string): string {
  return html.replace(/\bstyle=(["'])([\s\S]*?)\1/gi, (_m, quote: string, styles: string) => {
    const cleaned = styles
      .replace(/position\s*:\s*fixed/gi, "position:relative")
      .replace(/top\s*:\s*0(?:px|rem|em|%)?\s*;?/gi, "");
    return `style=${quote}${cleaned}${quote}`;
  });
}

function scopeStyleBlocksInHtml(html: string): string {
  return html.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (_match, attrs, inner) => {
    return `<style${attrs}>${scopeLandingCssForEmbed(inner)}</style>`;
  });
}

/**
 * Turns pricing links into same-document anchors so nav stays inside the landing iframe.
 * Root-relative `/pricing` and absolute `https://host/.../pricing` would otherwise load the full Next.js
 * app inside the iframe (“replica” of the site with a loading spinner).
 */
export function rewriteLandingNavAnchors(html: string): string {
  let out = html;
  out = out.replace(
    /\bhref=(["'])https?:\/\/[^"']*?\/pricing\/?(#(?:[^"']*))?(?:\?[^"']*)?\1/gi,
    (_m, q: string, frag?: string) => (frag ? `href=${q}${frag}${q}` : `href=${q}#pricing${q}`)
  );
  out = out.replace(
    /\bhref=(["'])\/\/[^"']*?\/pricing\/?(#(?:[^"']*))?(?:\?[^"']*)?\1/gi,
    (_m, q: string, frag?: string) => (frag ? `href=${q}${frag}${q}` : `href=${q}#pricing${q}`)
  );
  out = out.replace(/\bhref=(["'])\/#pricing\1/gi, "href=$1#pricing$1");
  out = out.replace(
    /\bhref=(["'])\/pricing\/?(#(?:[^"']*))?(?:\?[^"']*)?\1/gi,
    (_m, q: string, frag?: string) => (frag ? `href=${q}${frag}${q}` : `href=${q}#pricing${q}`)
  );
  return out;
}

function injectIntoHead(doc: string, snippet: string): string {
  if (/<head[^>]*>/i.test(doc)) {
    return doc.replace(/<head[^>]*>/i, (open) => `${open}${snippet}`);
  }
  return snippet + doc;
}

const CHECKOUT_BRIDGE_SCRIPT = `<script>
(function(){
  var checkoutSel='a[href="#pricing"],a[href="#pricing-standalone"],a[href="#pricing-bundle"],a[href="#lfp-purchase"],a[href="#package-checkout"],a[data-yamale-tier]';
  function detectTier(a){
    if(!a)return null;
    var explicit=a.getAttribute("data-yamale-tier");
    if(explicit==="standalone"||explicit==="bundle")return explicit;
    var card=a.closest&&a.closest(".pricing-card");
    if(card){
      if(card.classList.contains("bundle"))return "bundle";
      if(card.classList.contains("standard"))return "standalone";
    }
    var href=(a.getAttribute("href")||"").toLowerCase();
    if(href.indexOf("#pricing-bundle")>=0||href.indexOf("tier=bundle")>=0)return "bundle";
    if(href.indexOf("#pricing-standalone")>=0||href.indexOf("tier=standalone")>=0)return "standalone";
    if(href.indexOf("mailto:")===0){
      var subject=(href.match(/[?&]subject=([^&]*)/)||[])[1]||"";
      try{subject=decodeURIComponent(subject.replace(/\\+/g," "));}catch(_){}
      if(/bundle|law firm package \\+ zms/i.test(subject))return "bundle";
      if(/zms kit purchase|standalone kit/i.test(subject))return "standalone";
    }
    if(href==="#pricing"||href.indexOf("#pricing")===0){
      var text=(a.textContent||"").toLowerCase();
      if(/bundle|\\$129|law firm package/i.test(text))return "bundle";
      if(/\\$199|standalone|get the kit/i.test(text))return "standalone";
    }
    return null;
  }
  function notifyParent(tier){
    try{window.parent.postMessage({type:"yamale-vault-scroll-checkout",tier:tier||null},"*");}catch(_){}
  }
  function onCheckoutClick(e){
    var a=e.target&&e.target.closest?e.target.closest(checkoutSel):null;
    if(!a)return;
    var tier=detectTier(a);
    var href=(a.getAttribute("href")||"").toLowerCase();
    if(href.indexOf("mailto:")===0){
      if(!tier&&!/purchase|kit|bundle|checkout/i.test(href))return;
      e.preventDefault();
      notifyParent(tier);
      return;
    }
    if(!tier&&href.indexOf("#")!==0)return;
    e.preventDefault();
    notifyParent(tier);
  }
  document.addEventListener("click",onCheckoutClick,true);
})();
</script>`;

function injectBeforeBodyClose(doc: string, snippet: string): string {
  if (/<\/body>/i.test(doc)) {
    return doc.replace(/<\/body>/i, `${snippet}</body>`);
  }
  return doc + snippet;
}

export type PrepareMarketplaceLandingSrcDocOptions = {
  /** When true, purchase CTAs in the iframe scroll the parent page to checkout (ZIP package route). */
  bridgeParentCheckout?: boolean;
};

/**
 * Builds `srcDoc` for the marketplace landing iframe: wraps fragments, ensures viewport meta,
 * adds smooth scrolling / scroll-margin for `#` links, and fixes common `/pricing` href mistakes.
 */
export function prepareMarketplaceLandingSrcDoc(
  raw: string,
  options?: PrepareMarketplaceLandingSrcDocOptions
): string {
  const trimmed = prepareLandingHtmlPipeline(raw);
  if (!trimmed) return trimmed;

  const styleTag = `<style ${LANDING_BASE_STYLE_MARK}>${LANDING_BASE_CSS}</style>`;
  const bridge = options?.bridgeParentCheckout ? CHECKOUT_BRIDGE_SCRIPT : "";

  if (/^<!doctype/i.test(trimmed)) {
    let doc = trimmed;
    if (!/<meta[^>]*name=["']viewport["']/i.test(doc)) {
      doc = injectIntoHead(
        doc,
        `<meta name="viewport" content="width=device-width, initial-scale=1">`
      );
    }
    if (!new RegExp(LANDING_BASE_STYLE_MARK).test(doc)) {
      doc = injectIntoHead(doc, styleTag);
    }
    if (bridge) {
      doc = injectBeforeBodyClose(doc, bridge);
    }
    return doc;
  }

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${styleTag}</head><body>${trimmed}${bridge}</body></html>`;
}

import type { PackageOfferTier } from "@/lib/marketplace-package-offers";

export type { PackageOfferTier };

/** Detect standalone vs bundle from a landing-page CTA anchor (shared by iframe bridge and embed). */
export function detectCheckoutTierFromAnchor(anchor: {
  getAttribute(name: string): string | null;
  closest?(selector: string): Element | null;
  textContent?: string | null;
}): PackageOfferTier | null {
  const explicit = anchor.getAttribute("data-yamale-tier");
  if (explicit === "standalone" || explicit === "bundle") return explicit;

  const card = anchor.closest?.(".pricing-card");
  if (card) {
    if (card.classList.contains("bundle")) return "bundle";
    if (card.classList.contains("standard")) return "standalone";
  }

  const href = (anchor.getAttribute("href") || "").toLowerCase();
  if (href.includes("#pricing-bundle") || href.includes("tier=bundle")) return "bundle";
  if (href.includes("#pricing-standalone") || href.includes("tier=standalone")) return "standalone";

  if (href.startsWith("mailto:")) {
    const subjectMatch = href.match(/[?&]subject=([^&]*)/);
    let subject = subjectMatch?.[1] ?? "";
    try {
      subject = decodeURIComponent(subject.replace(/\+/g, " "));
    } catch {
      // keep raw
    }
    if (/bundle|law firm package \+ zms/i.test(subject)) return "bundle";
    if (/zms kit purchase|standalone kit/i.test(subject)) return "standalone";
  }

  if (href === "#pricing" || href.startsWith("#pricing") || href === "#yamale-checkout") {
    const text = (anchor.textContent || "").toLowerCase();
    if (/bundle|\$129|law firm package/i.test(text)) return "bundle";
    if (/\$199|standalone|get the kit/i.test(text)) return "standalone";
  }

  return null;
}

/** USD amount in CTA copy, e.g. "Get the Kit — $199" → 19900. */
export function parseUsdCentsFromCtaText(text: string | null | undefined): number | null {
  if (!text?.trim()) return null;
  const m = text.match(/\$\s*(\d+(?:[.,]\d{2})?)/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

/** Standalone vs bundle from button/link label (used when pricing cards are not in the DOM path). */
export function detectCheckoutTierFromCtaText(
  text: string | null | undefined
): PackageOfferTier | null {
  if (!text?.trim()) return null;
  const lower = text.toLowerCase();
  if (/\$129|bundle|law firm package \+ /i.test(text)) return "bundle";
  if (/\$199|get the kit|standalone/i.test(lower)) return "standalone";
  const cents = parseUsdCentsFromCtaText(text);
  if (cents === 19900) return "standalone";
  if (cents === 12900) return "bundle";
  return null;
}

/** Tier 2/3 advisory CTAs — must navigate or open mail, not vault checkout. */
export function isAdvisoryEnrollmentAnchor(anchor: {
  getAttribute(name: string): string | null;
  textContent?: string | null;
}): boolean {
  const href = (anchor.getAttribute("href") || "").trim();
  const hrefLower = href.toLowerCase();
  const text = (anchor.textContent || "").toLowerCase();

  if (
    hrefLower === "/contact" ||
    hrefLower.startsWith("/contact?") ||
    hrefLower === "contact" ||
    hrefLower.endsWith("/contact")
  ) {
    return true;
  }

  if (hrefLower.startsWith("mailto:")) {
    if (/purchase|kit|bundle|checkout/i.test(hrefLower)) return false;
    if (/enroll|enquire|tier\s*[23]|guided implementation|advisory/i.test(hrefLower + text)) {
      return true;
    }
  }

  return /contact us to enroll|enquire about tier|yamalé advisory to enroll|tier 2.*enquir|tier 3.*enquir/i.test(
    text
  );
}

function tierFromContactQuery(query: string | undefined): LawFirmEnrollmentTier | null {
  if (!query) return null;
  if (/[?&]tier=3(?:&|$)/i.test(query) || /tier\s*3/i.test(query)) return 3;
  if (/[?&]tier=2(?:&|$)/i.test(query) || /tier\s*2/i.test(query)) return 2;
  return null;
}

const DEV_ORIGIN_HOST = /^(?:localhost|127\.0\.0\.1)$/i;

/** Remove `<base>` and turn localhost absolute URLs into same-site paths (avoids iframe ERR_BLOCKED_BY_RESPONSE). */
export function stripDevOriginsFromLandingHtml(html: string): string {
  let out = html.replace(/<base\b[^>]*>/gi, "");

  const toSameSitePath = (url: string): string => {
    const trimmed = url.trim();
    if (!/^https?:\/\//i.test(trimmed)) return trimmed;
    try {
      const u = new URL(trimmed);
      if (!DEV_ORIGIN_HOST.test(u.hostname)) return trimmed;
      return `${u.pathname || "/"}${u.search}${u.hash}`;
    } catch {
      return trimmed;
    }
  };

  out = out.replace(/\b(href|src|action)=(["'])([^"']+)\2/gi, (full, attr, quote, value) => {
    const lower = value.toLowerCase();
    if (!lower.includes("localhost") && !lower.includes("127.0.0.1")) return full;
    return `${attr}=${quote}${toSameSitePath(value)}${quote}`;
  });

  return out;
}

function vaultCheckoutHashForTier(tier: "standalone" | "bundle"): string {
  return tier === "bundle" ? "#pricing-bundle" : "#pricing-standalone";
}

function ensureMailtoSubject(href: string, tier: LawFirmEnrollmentTier | null): string {
  if (tier === 2 || tier === 3) return lawFirmTierEnrollmentMailto(tier);
  if (!href.toLowerCase().startsWith("mailto:")) return href;
  if (/[?&]subject=/i.test(href)) return href;
  return lawFirmAdvisoryMailto();
}

/**
 * Vault kit purchase CTAs → in-page `#pricing-*` hashes (section exists in landing HTML).
 * Avoids mailto (CSP), localhost URLs (dev copy-paste), and loading /pricing in an iframe.
 */
export function rewriteVaultCheckoutAnchors(html: string): string {
  let out = html;

  const rewritePurchaseAnchor = (
    before: string,
    quote: string,
    tier: "standalone" | "bundle",
    after: string,
    inner: string
  ) => {
    const hash = vaultCheckoutHashForTier(tier);
    return `<a${before}href=${quote}${hash}${quote} data-yamale-tier="${tier}"${after}>${inner}</a>`;
  };

  out = out.replace(
    /<a\b([^>]*)\bhref=(["'])(mailto:[^"']+)\2([^>]*)>([\s\S]*?)<\/a>/gi,
    (full, before, quote, mailtoHref, after, inner) => {
      const lower = mailtoHref.toLowerCase();
      if (!/purchase|kit|bundle|checkout|zms/i.test(lower)) return full;
      const tier = /bundle|law firm package \+ zms/i.test(lower) ? "bundle" : "standalone";
      return rewritePurchaseAnchor(before, quote, tier, after, inner);
    }
  );

  out = out.replace(
    /<a\b([^>]*)\bhref=(["'])(https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?[^"']*)\2([^>]*)>([\s\S]*?)<\/a>/gi,
    (full, before, quote, href, after, inner) => {
      const blob = `${href} ${inner}`.toLowerCase();
      if (!/purchase|kit|bundle|checkout|zms|marketplace|package/i.test(blob)) return full;
      const tier = /bundle|law firm package \+ zms/i.test(blob) ? "bundle" : "standalone";
      return rewritePurchaseAnchor(before, quote, tier, after, inner);
    }
  );

  out = out.replace(
    /<a\b([^>]*)\bhref=(["'])#yamale-checkout\2([^>]*)>/gi,
    (full, before, quote, after) => {
      const tierMatch = full.match(/data-yamale-tier=(["'])(standalone|bundle)\1/i);
      const tier = tierMatch?.[2] === "bundle" ? "bundle" : "standalone";
      return `<a${before}href=${quote}${vaultCheckoutHashForTier(tier)}${quote}${after}>`;
    }
  );

  return out;
}

function prepareLandingHtmlPipeline(raw: string): string {
  return rewriteVaultCheckoutAnchors(
    rewriteEnrollmentContactAnchors(
      rewriteLandingNavAnchors(stripDevOriginsFromLandingHtml(raw.trim()))
    )
  );
}

/** Broken /contact links → mailto with subject; enrollment mailto opens in a new tab. */
export function rewriteEnrollmentContactAnchors(html: string): string {
  let out = html;

  out = out.replace(/\bhref=(["'])\/contact(\?[^"']*)?\1/gi, (_m, quote: string, query?: string) => {
    const tier = tierFromContactQuery(query);
    const mailto = tier ? lawFirmTierEnrollmentMailto(tier) : lawFirmAdvisoryMailto();
    return `href=${quote}${mailto}${quote}`;
  });
  out = out.replace(/\bhref=(["'])contact\1/gi, `href=$1${lawFirmAdvisoryMailto()}$1`);

  out = out.replace(
    /<a\b([^>]*)\bhref=(["'])mailto:(?:info@yamaleadvisory\.com|info@yamalealliance\.org)\/?\2([^>]*)>([\s\S]*?)<\/a>/gi,
    (full, before: string, quote: string, after: string, inner: string) => {
      const text = inner.replace(/<[^>]+>/g, " ").toLowerCase();
      let tier: LawFirmEnrollmentTier | null = null;
      if (/enquire about tier\s*3|tier\s*3.*enquir/i.test(text)) tier = 3;
      else if (/contact us to enroll|tier\s*2/i.test(text)) tier = 2;
      if (!tier) return full;

      const href = lawFirmTierEnrollmentMailto(tier);
      const attrs = `${before}href=${quote}${href}${quote}${after}`;
      if (/\btarget\s*=/i.test(attrs)) {
        return `<a${before}href=${quote}${href}${quote}${after}>${inner}</a>`;
      }
      return `<a${before}href=${quote}${href}${quote} target="_blank" rel="noopener noreferrer"${after}>${inner}</a>`;
    }
  );

  out = out.replace(
    /<a\b([^>]*)\bhref=(["'])(mailto:[^"']+)\2([^>]*)>/gi,
    (full, before: string, quote: string, mailtoHref: string, after: string) => {
      const lower = mailtoHref.toLowerCase();
      if (/purchase|kit|bundle|checkout/i.test(lower)) return full;
      if (!/enroll|enquire|tier|advisory|info@yamale/i.test(lower)) return full;

      let href = mailtoHref;
      const tier =
        /tier\s*3|tier3/i.test(lower) ? 3 : /tier\s*2|tier2/i.test(lower) ? 2 : null;
      href = ensureMailtoSubject(href, tier);

      const attrs = `${before}href=${quote}${href}${quote}${after}`;
      if (/\btarget\s*=/i.test(attrs)) {
        return `<a${before}href=${quote}${href}${quote}${after}>`;
      }
      return `<a${before}href=${quote}${href}${quote} target="_blank" rel="noopener noreferrer"${after}>`;
    }
  );

  return out;
}

/** True when this anchor should scroll the host page to Yamale checkout (not navigate). */
export function shouldInterceptVaultCheckoutAnchor(anchor: {
  getAttribute(name: string): string | null;
  classList?: { contains(name: string): boolean };
  closest?(selector: string): Element | null;
  textContent?: string | null;
}): boolean {
  if (isAdvisoryEnrollmentAnchor(anchor)) return false;

  const href = (anchor.getAttribute("href") || "").toLowerCase();
  if (href.startsWith("mailto:") && /purchase|kit|bundle|checkout/i.test(href)) return true;
  if (href === "#pricing" || href.startsWith("#pricing") || href === "#yamale-checkout") return true;
  if (href === "#pricing-standalone" || href === "#pricing-bundle") return true;
  if (href.includes("/pricing")) return true;
  if (anchor.classList?.contains("nav-cta")) return true;
  if (anchor.classList?.contains("btn-primary")) return true;
  if (anchor.closest?.(".cta-section, .pricing-section, .pricing-cards, .cta-buttons, .hero-actions")) {
    return true;
  }
  return false;
}

/** In-page section link inside the landing (e.g. #contents for “What's inside”). */
export function isLandingInPageSectionAnchor(anchor: {
  getAttribute(name: string): string | null;
  textContent?: string | null;
}): boolean {
  if (shouldInterceptVaultCheckoutAnchor(anchor)) return false;
  const href = (anchor.getAttribute("href") || "").trim();
  if (href.startsWith("#") && href.length > 1) return true;
  if (/what.?s inside|see what/i.test(anchor.textContent || "")) return true;
  return false;
}

export function landingHashFromAnchor(anchor: {
  getAttribute(name: string): string | null;
  textContent?: string | null;
}): string {
  const href = (anchor.getAttribute("href") || "").trim();
  if (href.startsWith("#") && href.length > 1) return href;
  if (/what.?s inside|see what/i.test(anchor.textContent || "")) return "#contents";
  return "";
}

function wrapLandingBodyMarkup(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return `<div class="${LANDING_SHADOW_ROOT_CLASS}"></div>`;
  if (new RegExp(`class=["'][^"']*\\b${LANDING_SHADOW_ROOT_CLASS}\\b`).test(trimmed)) {
    return trimmed;
  }
  return `<div class="${LANDING_SHADOW_ROOT_CLASS}">\n${trimmed}\n</div>`;
}

function adaptStyleBlocksInHtml(html: string): string {
  return html.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (_match, attrs, inner) => {
    return `<style${attrs}>${adaptLandingCssForShadow(inner)}</style>`;
  });
}

function extractBodyMarkup(doc: string): string {
  const bodyMatch = doc.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch?.[1]) return bodyMatch[1];
  return doc;
}

function extractHeadSnippets(doc: string): string {
  const headMatch = doc.match(/<head[^>]*>([\s\S]*)<\/head>/i);
  if (!headMatch?.[1]) return "";
  const snippets: string[] = [];
  const linkTags = headMatch[1].match(/<link\b[^>]*>/gi);
  if (linkTags) snippets.push(...linkTags);
  const styleBlocks = headMatch[1].match(/<style\b[^>]*>[\s\S]*?<\/style>/gi);
  if (styleBlocks) snippets.push(...styleBlocks);
  return snippets.join("\n");
}

/**
 * HTML fragment for in-page embed (no iframe). Strips scripts, rewrites /pricing links, keeps external CSS/fonts.
 */
export function prepareMarketplaceLandingEmbedHtml(raw: string): string {
  const trimmed = prepareLandingHtmlPipeline(raw);
  if (!trimmed) return trimmed;

  let doc = stripVaultLandingInlineTextColors(
    stripViewportFixedInlineStyles(
      trimmed
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, "")
        .replace(/<iframe\b[^>]*\/>/gi, "")
    )
  );
  const styleTag = `<style ${LANDING_BASE_STYLE_MARK}>${LANDING_SHADOW_OVERRIDES_CSS}</style>`;

  doc = adaptStyleBlocksInHtml(doc);

  if (/^<!doctype/i.test(doc)) {
    const headBits = adaptStyleBlocksInHtml(extractHeadSnippets(doc));
    const body = wrapLandingBodyMarkup(extractBodyMarkup(doc));
    return `${headBits}\n${body}\n${styleTag}`;
  }

  return `${wrapLandingBodyMarkup(doc)}\n${styleTag}`;
}

export type LandingPageLanguage = "fr" | "en";

const LANDING_LANG_STORAGE_KEY = "yamale-lang";

/** Bilingual landing pages use data-lang blocks + .lang-btn toggles (scripts are stripped in embed mode). */
export function readSavedLandingLanguage(): LandingPageLanguage {
  if (typeof window === "undefined") return "fr";
  try {
    const saved = window.localStorage.getItem(LANDING_LANG_STORAGE_KEY);
    return saved === "en" ? "en" : "fr";
  } catch {
    return "fr";
  }
}

export function saveLandingLanguage(lang: LandingPageLanguage): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LANDING_LANG_STORAGE_KEY, lang);
  } catch {
    // ignore quota / private mode
  }
}

/** Toggle [data-lang] sections and .lang-btn state inside a shadow root or document. */
export function applyLandingLanguage(root: ParentNode, lang: LandingPageLanguage): void {
  root.querySelectorAll("[data-lang]").forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    const blockLang = el.getAttribute("data-lang");
    el.classList.toggle("lang-hidden", blockLang !== lang);
  });

  root.querySelectorAll(".lang-btn[data-select-lang]").forEach((btn) => {
    if (!(btn instanceof HTMLElement)) return;
    btn.classList.toggle("active", btn.getAttribute("data-select-lang") === lang);
  });

  const cta = root.querySelector("#nav-cta-text");
  if (cta) cta.textContent = lang === "fr" ? "Obtenir le Kit" : "Get the Kit";

  const price = root.querySelector("#nav-price-text");
  if (price) price.textContent = lang === "fr" ? "199 USD" : "$199";
}

export function landingLanguageFromButton(button: Element): LandingPageLanguage | null {
  const lang = button.getAttribute("data-select-lang");
  return lang === "en" || lang === "fr" ? lang : null;
}

/** Validates admin-submitted HTML for marketplace landing pages. */
export function parseLandingPageHtmlInput(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw !== "string") {
    throw new Error("landing_page_html must be a string");
  }
  const t = raw.trim();
  if (!t) return null;
  if (t.length > MAX_LANDING_HTML_CHARS) {
    throw new Error(`Landing HTML must be under ${MAX_LANDING_HTML_CHARS.toLocaleString()} characters`);
  }
  return t;
}
