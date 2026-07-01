-- Limite administrativo OSM (relation) por município — ex.: Passagem Franca = 332931
ALTER TABLE "municipalities" ADD COLUMN IF NOT EXISTS "osm_relation_id" INTEGER;

UPDATE "municipalities"
SET "osm_relation_id" = 332931
WHERE "name" = 'Passagem Franca' AND "state" = 'MA' AND "osm_relation_id" IS NULL;
