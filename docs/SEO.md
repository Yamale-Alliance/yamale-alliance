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
| LLM site guide | `/llms.txt` |
| Open Graph image | `/opengraph-image` (auto-generated) |
| Favicon (browser + Google) | Static `public/favicon.ico` (48×48+) + optional admin branding; declared in `<head>` |
| JSON-LD | Organization, WebSite, WebApplication, ItemList in `<head>` (`components/seo/SiteJsonLd.tsx`) |

## Audience keywords

Copy and metadata target:

- **Law students** — revision, exam prep, finding statutes, AI Q&A on primary sources
- **Lawyers** — research, AfCFTA, directory, Vault templates
- **Business / trade** — compliance check, tariff schedule, cross-border tools

Global keywords live in `lib/site-seo.ts` (`SITE.keywords`). Per-route extras pass `keywords` into `createPageMetadata()`.

## AI crawlers and chatbots

**Public pages are open** to search engines and major AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, etc.) on the same paths as Google.

**Blocked paths** (all bots): `/api/`, `/account/`, `/admin-panel/`, `/dashboard`.

Configuration:

- `app/robots.ts` — allow `/`, disallow private prefixes
- `lib/seo-crawlers.ts` — shared disallow list and AI user-agent list
- `app/llms.txt/route.ts` — machine-readable summary and public URLs for LLMs

After deploy, verify:

```bash
curl -s https://www.yamalelegal.com/robots.txt | head -20
curl -s https://www.yamalelegal.com/llms.txt | head -30
```

## Favicon (admin + Google)

Static defaults in `public/` meet Google’s **≥48×48** requirement: `/favicon.ico` (48×48 ICO), `/favicon-192.png`, `/apple-touch-icon.png` (180×180). Regenerate: `npm run favicons:generate`.

1. Optional: upload a square **≥48×48** **`.ico`** or PNG in **Admin → Settings → Branding → Favicon** (Cloudinary / `platform_settings.favicon_url`).
2. After deploy, confirm in **View Source**:
   - `<link rel="icon" href="/favicon.ico" sizes="48x48" …>`
   - `<link rel="icon" … href="/favicon-192.png" sizes="192x192" …>`
   - `<link rel="apple-touch-icon" … href="/apple-touch-icon.png" sizes="180x180" …>`
3. Test: `https://www.yamalelegal.com/favicon.ico` and `/favicon-192.png`
4. **Google Search** can take **days to weeks** to refresh the favicon. Use Search Console → URL inspection → Request indexing on the homepage.

## Verify JSON-LD

After deploy, **View Source** (not DevTools Elements) should show four `application/ld+json` blocks (Organization, WebSite, WebApplication, ItemList).

Or run:

```bash
curl -s https://www.yamalelegal.com | grep -c 'application/ld+json'
```

Expect `4`. If counts differ, confirm the latest SEO deploy is live on Vercel.

The Rich Results Test **screenshot** can show a Clerk error modal even when JSON-LD is present in HTML; use the tool’s **raw HTML / detected items** panel, or re-test after a hard refresh.

## Google Search Console — “Page with redirect”

This is **expected** for alias URLs that intentionally redirect (e.g. `/sign-up` → `/signup`). Do **not** put redirect-only URLs in `sitemap.xml`.

| URL | Behavior |
|-----|----------|
| `/signup` | Canonical sign-up page (in sitemap) |
| `/sign-up` | Permanent redirect to `/signup` (Clerk alias; **not** in sitemap) |
| `yamalelegal.com` vs `www` | Pick one in Vercel + Search Console; the other should 301 to the preferred host |

After deploy, open **Indexing → Pages** in Search Console, filter by “Page with redirect”, and confirm listed URLs are only aliases or www/http variants—not `/library`, `/pricing`, etc.

If a main marketing URL shows as redirect, check Clerk middleware (`proxy.ts`) and that the URL is in `isPublicRoute`.

## After deploy

1. [Google Search Console](https://search.google.com/search-console) — add property `https://www.yamalelegal.com`
2. Submit sitemap: `https://www.yamalelegal.com/sitemap.xml`
3. Set **preferred domain** to `www` (or bare domain) and redirect the other in DNS/Vercel
4. Validate with [Rich Results Test](https://search.google.com/test/rich-results) and [Meta Tags](https://developers.facebook.com/tools/debug/)
5. Share `/llms.txt` with teams wiring Yamalé into AI assistants or internal bots

## Optional next steps

- Update `ORGANIZATION_SAME_AS` in `components/seo/SiteJsonLd.tsx` when social profiles change
- Per-law or per-vault-product metadata via `generateMetadata` on dynamic routes (`/library/[id]`, `/marketplace/[id]`)
- `hreflang` if French UI ships later
