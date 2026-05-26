# Zambia Extractive Industry Subcontractor Pack (vault)

**Marketplace title:** Zambia Extractive Industry Subcontractor Pack  
**Landing:** `landing.html` (Zambia Mining Subcontractor Legal Kit — 9 ZMS documents)  
**ZIP:** must contain **9** `.docx` files (ZMS-01 … ZMS-09)

## Apply landing page to production

From repo root (`.env` needs Supabase service role):

```bash
node scripts/update-marketplace-landing.mjs \
  --title "Zambia Extractive Industry Subcontractor Pack" \
  --html data/marketplace/zambia-extractive-industry-subcontractor-pack/landing.html \
  --description data/marketplace/zambia-extractive-industry-subcontractor-pack/description.txt \
  --verify-zip
```

Dry run:

```bash
node scripts/update-marketplace-landing.mjs --title "Zambia Extractive Industry Subcontractor Pack" --html data/marketplace/zambia-extractive-industry-subcontractor-pack/landing.html --dry-run
```

## Admin (alternative)

1. **Admin → Marketplace** → edit **Zambia Extractive Industry Subcontractor Pack**
2. Paste `landing.html` into **Landing page HTML** (or use “Load from .html file”)
3. Re-upload the ZIP if `--verify-zip` reports fewer than 9 `.docx` files
4. Open `/marketplace/{id}/package` to preview

## Pricing (three vault SKUs)

| Tier | Price | Item |
|------|-------|------|
| Standalone | $199 | This pack (all 9 documents) |
| Bundle add-on | $129 | This pack when bought with Law Firm Development Package |
| Bundle base | $499 | African Law Firm Development Package |

Configure `package_offers` on the **$129** listing or rely on auto-detection from catalog prices + landing mailto subjects.
