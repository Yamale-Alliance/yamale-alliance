# Quick Investment Guide — Vault artwork

Drop your final images here (same filenames). The Vault reads them as public URLs.

| File | Used for |
|------|----------|
| `cover.jpg` | **Series collection card** when users browse The Yamalé Vault |
| `countries/bj.jpg` | **Benin** guide product card |
| `countries/{iso}.jpg` | Other countries (`ke.jpg` = Kenya, `ng.jpg` = Nigeria, etc.) |

ISO codes match `lib/marketplace-vault-country.ts` (e.g. Benin → `bj`).

Recommended size: **800×1000** or similar portrait ratio for covers; JPEG or PNG (use `.jpg` paths as above).

Optional placeholders: `node scripts/generate-quick-investment-guide-assets.mjs`

Create each country guide in **Admin → Marketplace** (type Guide, series **Quick Investment Guide**, focus country, **$19**).
