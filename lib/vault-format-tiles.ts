import type { VaultTile } from "@/components/marketplace/VaultTiles";
import { VAULT_BROWSE_FREE } from "@/lib/marketplace-vault-categories";

type FormatParam = "all" | "book" | "course" | "template" | "guide" | typeof VAULT_BROWSE_FREE;

const FORMAT_DEFS: {
  param: FormatParam;
  label: string;
  sub: string;
  iconClass: string;
  tag: string;
  title: string;
  description: string;
  image: string;
}[] = [
  {
    param: "all",
    label: "All resources",
    sub: "Everything in the vault",
    iconClass: "ti ti-layout-grid",
    tag: "Browse",
    title: "All resources",
    description:
      "Browse the full Yamalé Vault — books, courses, templates, guides, and complimentary resources for African legal practice.",
    image: vaultTileSvgImage(["#0D1B2A", "#1E3148"]),
  },
  {
    param: VAULT_BROWSE_FREE,
    label: "Free",
    sub: "Complimentary resources",
    iconClass: "ti ti-gift",
    tag: "Free",
    title: "Free collection",
    description:
      "Downloadable guides, templates, and introductory materials at no cost — including the At a Glance series.",
    image: vaultTileSvgImage(["#1a4d2e", "#2d6a4f"]),
  },
  {
    param: "book",
    label: "Books",
    sub: "Treatises & references",
    iconClass: "ti ti-book",
    tag: "Books",
    title: "Books",
    description: "In-depth treatises and reference works for practitioners, in-house teams, and students.",
    image: vaultTileSvgImage(["#3d2914", "#603b1c"]),
  },
  {
    param: "course",
    label: "Courses",
    sub: "Structured learning",
    iconClass: "ti ti-school",
    tag: "Courses",
    title: "Courses",
    description: "Structured programmes and webinars built for African legal and compliance professionals.",
    image: vaultTileSvgImage(["#1e3a5f", "#2a5080"]),
  },
  {
    param: "template",
    label: "Templates",
    sub: "Ready-to-use documents",
    iconClass: "ti ti-file-text",
    tag: "Templates",
    title: "Templates",
    description: "Draft-ready clauses, agreements, and checklists — review with your counsel before use.",
    image: vaultTileSvgImage(["#4a3728", "#6b4f3a"]),
  },
  {
    param: "guide",
    label: "Guides",
    sub: "Practical walkthroughs",
    iconClass: "ti ti-compass",
    tag: "Guides",
    title: "Guides",
    description: "Step-by-step walkthroughs for common transactions, compliance tasks, and cross-border work.",
    image: vaultTileSvgImage(["#2c1810", "#4a2c1a"]),
  },
];

function vaultTileSvgImage(stops: [string, string]): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="533" viewBox="0 0 400 533"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${stops[0]}"/><stop offset="100%" stop-color="${stops[1]}"/></linearGradient></defs><rect width="400" height="533" fill="url(#g)"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function buildVaultFormatTiles(
  countFor: (param: FormatParam) => number,
  activeParam: FormatParam | null
): VaultTile[] {
  return FORMAT_DEFS.map((def) => {
    const count = countFor(def.param);
    return {
      id: def.param,
      label: def.label,
      sub: def.sub,
      iconClass: def.iconClass,
      iconBg: "rgba(200, 146, 42, 0.14)",
      iconColor: "#C8922A",
      tag: def.tag,
      tagBg: "rgba(255, 255, 255, 0.18)",
      tagColor: "#fff",
      title: def.title,
      description: def.description,
      meta: count > 0 ? `${count.toLocaleString()} resource${count === 1 ? "" : "s"}` : "Browse collection",
      overlayGradient:
        "linear-gradient(180deg, rgba(13,27,42,0.15) 0%, rgba(13,27,42,0.55) 45%, rgba(13,27,42,0.92) 100%)",
      image: def.image,
      href: `/marketplace?category=${encodeURIComponent(def.param)}`,
      active: activeParam === def.param,
    };
  });
}

export type { FormatParam };
