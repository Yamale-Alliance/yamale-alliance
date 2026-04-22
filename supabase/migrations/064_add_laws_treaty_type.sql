BEGIN;

ALTER TABLE public.laws
  ADD COLUMN IF NOT EXISTS treaty_type text;

UPDATE public.laws
SET treaty_type = 'Not a treaty'
WHERE treaty_type IS NULL;

ALTER TABLE public.laws
  ALTER COLUMN treaty_type SET DEFAULT 'Not a treaty';

ALTER TABLE public.laws
  ALTER COLUMN treaty_type SET NOT NULL;

ALTER TABLE public.laws
  DROP CONSTRAINT IF EXISTS laws_treaty_type_check;

ALTER TABLE public.laws
  ADD CONSTRAINT laws_treaty_type_check
  CHECK (treaty_type IN ('Bilateral', 'Multilateral', 'Not a treaty'));

COMMIT;
