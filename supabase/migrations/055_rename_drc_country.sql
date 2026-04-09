-- Rename country to preferred canonical form (remove "the")
UPDATE countries
SET name = 'Democratic Republic of Congo'
WHERE name = 'Democratic Republic of the Congo';

