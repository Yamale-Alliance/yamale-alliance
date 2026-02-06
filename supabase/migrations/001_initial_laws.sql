-- Countries (start with one: Ghana)
CREATE TABLE IF NOT EXISTS countries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  region TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categories (from Database of Laws spreadsheet)
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Laws: one row per law; content = extracted PDF text for library + AI
CREATE TABLE IF NOT EXISTS laws (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id UUID NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source_url TEXT,
  source_name TEXT,
  year INT,
  status TEXT DEFAULT 'In force',
  content TEXT,
  content_plain TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Full-text search for library and AI
CREATE INDEX IF NOT EXISTS laws_content_fts ON laws
  USING GIN(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, '')));

-- Seed: one country (Ghana)
INSERT INTO countries (name, region) VALUES ('Ghana', 'West Africa')
ON CONFLICT (name) DO NOTHING;

-- Seed: categories
INSERT INTO categories (name, slug) VALUES
  ('Corporate Law', 'corporate-law'),
  ('Tax Law', 'tax-law'),
  ('Labor/Employment Law', 'labor-employment-law'),
  ('Intellectual Property Law', 'intellectual-property-law'),
  ('Data Protection and Privacy Law', 'data-protection-privacy-law'),
  ('International Trade Laws', 'international-trade-laws'),
  ('Anti-Bribery and Corruption Law', 'anti-bribery-corruption-law'),
  ('Dispute Resolution', 'dispute-resolution'),
  ('Environmental', 'environmental')
ON CONFLICT (name) DO NOTHING;
