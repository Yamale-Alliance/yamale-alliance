-- Add countries for legal library + import-pdf-law.mjs
INSERT INTO countries (name, region) VALUES
  ('Mauritius', 'Eastern Africa'),
  ('Mozambique', 'Southern Africa'),
  ('Namibia', 'Southern Africa'),
  ('Zimbabwe', 'Southern Africa'),
  ('Cameroon', 'Central Africa'),
  ('Central African Republic', 'Central Africa'),
  ('Chad', 'Central Africa'),
  ('Democratic Republic of Congo', 'Central Africa'),
  ('Equatorial Guinea', 'Central Africa'),
  ('Gabon', 'Central Africa')
ON CONFLICT (name) DO NOTHING;

