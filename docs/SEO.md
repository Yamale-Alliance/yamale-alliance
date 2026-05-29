# SEO — yamalelegal.com

## Required production env

```env
NEXT_PUBLIC_APP_URL=https://www.yamalelegal.com
```

This sets `metadataBase`, canonical URLs, `robots.txt` host, and `sitemap.xml` entries.

## What ships in the app

| Asset | URL |
|-------|-----|
| Sitemap | `/sitemap.xml` |
| Robots | `/robots.txt` |
| Open Graph image | `/opengraph-image` (auto-generated) |
| JSON-LD | Organization + WebSite in `<head>` on every page (`components/seo/SiteJsonLd.tsx`) |

## Verify JSON-LD

After deploy, **View Source** (not DevTools Elements) should show two tags:

```html
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization",…}</script>
```

Or run:

```bash
curl -s https://www.yamalelegal.com | grep -c 'application/ld+json'
```

Expect `2`. If you still see the old homepage title (`Law Without Barriers…` only, no `African Legal Research`), the SEO commit is not deployed yet — push `main` and redeploy on Vercel.

The Rich Results Test **screenshot** can show a Clerk error modal even when JSON-LD is present in HTML; use the tool’s **raw HTML / detected items** panel, or re-test after a hard refresh.

## After deploy

1. [Google Search Console](https://search.google.com/search-console) — add property `https://www.yamalelegal.com`
2. Submit sitemap: `https://www.yamalelegal.com/sitemap.xml`
3. Set **preferred domain** to `www` (or bare domain) and redirect the other in DNS/Vercel
4. Validate with [Rich Results Test](https://search.google.com/test/rich-results) and [Meta Tags](https://developers.facebook.com/tools/debug/)

## Optional next steps

- Update `ORGANIZATION_SAME_AS` in `components/seo/SiteJsonLd.tsx` when social profiles change
- Upload a dedicated 512×512 PWA icon in admin branding (manifest currently references OG image)
- Per-law or per-vault-product metadata via `generateMetadata` on dynamic routes
- `hreflang` if French UI ships later
