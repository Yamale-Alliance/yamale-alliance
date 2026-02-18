-- Pricing plans (editable by admin)
CREATE TABLE IF NOT EXISTS pricing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  price_monthly INT NOT NULL DEFAULT 0,
  price_annual_per_month INT NOT NULL DEFAULT 0,
  price_annual_total INT NOT NULL DEFAULT 0,
  description TEXT,
  subtitle TEXT,
  features JSONB NOT NULL DEFAULT '[]',
  cta TEXT NOT NULL DEFAULT 'Get Started',
  highlighted BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed current tiers (from app/pricing/page.tsx)
INSERT INTO pricing_plans (slug, name, price_monthly, price_annual_per_month, price_annual_total, description, subtitle, features, cta, highlighted, sort_order) VALUES
  ('free', 'Free', 0, 0, 0, 'Explore and browse African law', NULL, '["Unlimited browsing","View document summaries","Save up to 10 documents","Browse lawyer directory","Browse marketplace"]', 'Get Started Free', false, 0),
  ('basic', 'Basic', 5, 4, 50, NULL, 'or $50/year (save $10)', '["<strong>Read full documents</strong> online","<strong>5 document downloads/month</strong>","<strong>10 AI queries/month</strong>","<strong>1 AfCFTA report/month</strong>","Unlimited saved documents"]', 'Start 10-Day Trial', true, 1),
  ('pro', 'Pro', 15, 12, 150, NULL, 'or $150/year (save $30)', '["<strong>20 document downloads/month</strong>","<strong>50 AI queries/month</strong>","<strong>5 AfCFTA reports/month</strong>","<strong>3 lawyer contacts/month</strong>","Share documents via email","Download AI conversations"]', 'Start 10-Day Trial', false, 2),
  ('team', 'Team', 40, 33, 400, NULL, 'or $400/year (save $80)', '["<strong>5 user seats included</strong>","<strong>250 downloads/month</strong> (50/user)","<strong>Unlimited AI queries</strong>","<strong>Unlimited AfCFTA reports</strong>","<strong>10 lawyer contacts/month</strong>","Additional seats: $6/month each"]', 'Start 10-Day Trial', false, 3)
ON CONFLICT (slug) DO NOTHING;
