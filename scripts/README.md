# Adding Ghana laws

## Option 1: Import from a PDF (best for large documents)

Use this when you have a PDF (e.g. “Corporate Laws” or a single Act) and want to store its full text in the library.

From the **project root**:

```bash
node --env-file=.env scripts/import-pdf-law.mjs "/path/to/your/file.pdf" [options]
```

**Options:**

- `--title "Display title"` — Title in the library (default: filename without `.pdf`)
- `--category "Corporate Law"` — One of the 9 categories (default: Corporate Law)
- `--year 2019` — Optional year
- `--status "In force"` — Default: In force
- `--update` — Update an existing law (matched by title + category) instead of inserting; use when re-importing with a better OCR PDF (e.g. from iLovePDF)

**Example with your corporate laws PDF:**

```bash
node --env-file=.env scripts/import-pdf-law.mjs "/Users/fahimrashid/Library/Application Support/Cursor/User/workspaceStorage/e9225c360fe298a68cbb184186d59281/pdfs/572cd424-88d3-4c30-8195-5c856398eafa/corporate-laws.pdf" --title "Ghana Corporate Laws" --category "Corporate Law"
```

The script extracts all text from the PDF and inserts one law row with that content (searchable in the Library and usable for AI later). Large PDFs may take a minute.

**Replacing content with a better OCR PDF:** If you already added a law and later get a cleaner PDF (e.g. OCR’d with iLovePDF), run the same command with `--update` so it updates the existing row instead of creating a duplicate:

```bash
node --env-file=.env scripts/import-pdf-law.mjs "/path/to/labor-employment-law.pdf" --title "Ghana Labor and Employment Law" --category "Labor/Employment Law" --update
```

---

## Option 2: Supabase SQL Editor (quick for a few laws)

1. Open [Supabase](https://supabase.com/dashboard) → your project → **SQL Editor**.
2. Open `scripts/insert-ghana-law-example.sql` and copy its contents.
3. Edit the `INSERT` with your law’s **title**, **source_url**, **source_name**, **category**, **year**, **status**.
4. Use one of these categories exactly:  
   `Corporate Law`, `Tax Law`, `Labor/Employment Law`, `Intellectual Property Law`, `Data Protection and Privacy Law`, `International Trade Laws`, `Anti-Bribery and Corruption Law`, `Dispute Resolution`, `Environmental`.
5. Run the query. Repeat for more laws.

## Option 3: Bulk import from JSON

1. Copy the example file:
   ```bash
   cp scripts/ghana-laws.example.json scripts/ghana-laws.json
   ```
2. Edit `scripts/ghana-laws.json`: add one object per law with `title`, `category`, and optionally `source_url`, `source_name`, `year`, `status`, `content`, `content_plain`.
3. From the project root, run:
   ```bash
   node --env-file=.env scripts/seed-ghana-laws.mjs
   ```
   Or with a custom file:
   ```bash
   node --env-file=.env scripts/seed-ghana-laws.mjs path/to/my-laws.json
   ```

After adding laws, the Library page will show them (filter by country Ghana and category as needed).
