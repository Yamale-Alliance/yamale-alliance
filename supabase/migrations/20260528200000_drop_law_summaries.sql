-- Remove law document summaries (feature retired).

DROP TABLE IF EXISTS law_summaries;

-- Remove pricing bullets that mention law summaries (jsonb array of strings on pricing_plans).
UPDATE pricing_plans
SET
  features = (
    SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
    FROM jsonb_array_elements_text(features::jsonb) AS elem
    WHERE elem !~* '(^|[^a-z])(law\s+)?summar(y|ies)([^a-z]|$)'
      AND elem !~* 'ai\s+summar'
  ),
  updated_at = NOW()
WHERE features::text ~* 'summar';
