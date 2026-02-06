-- Run this in Supabase Dashboard → SQL Editor to add Ghana laws.
-- Copy and edit the INSERT below for each law (change title, source_url, category name, year, etc.).

-- Single law example:
INSERT INTO laws (country_id, category_id, title, source_url, source_name, year, status)
SELECT
  (SELECT id FROM countries WHERE name = 'Ghana' LIMIT 1),
  (SELECT id FROM categories WHERE name = 'Corporate Law' LIMIT 1),
  'Companies Act, 2019 (Act 992)',
  'https://example.com/companies-act-992',
  'Ghana Gazette',
  2019,
  'In force';

-- Add more laws by copying the block above and changing:
--   - title
--   - source_url, source_name
--   - category: use one of: 'Corporate Law', 'Tax Law', 'Labor/Employment Law',
--     'Intellectual Property Law', 'Data Protection and Privacy Law',
--     'International Trade Laws', 'Anti-Bribery and Corruption Law',
--     'Dispute Resolution', 'Environmental'
--   - year, status ('In force', 'Amended', 'Repealed')
-- Optional: add content or content_plain for full text (for search/AI).
