-- PostGIS geom column on streets for viewport bbox queries
ALTER TABLE "streets" ADD COLUMN IF NOT EXISTS "geom" geometry(LineString, 4326);

UPDATE "streets"
SET "geom" = ST_SetSRID(ST_GeomFromGeoJSON("geojson"::text), 4326)
WHERE "geom" IS NULL AND "geojson" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "streets_geom_gist_idx" ON "streets" USING GIST ("geom");

CREATE OR REPLACE FUNCTION sync_street_geom()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.geojson IS NOT NULL THEN
    NEW.geom := ST_SetSRID(ST_GeomFromGeoJSON(NEW.geojson::text), 4326);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS streets_geom_sync ON "streets";
CREATE TRIGGER streets_geom_sync
  BEFORE INSERT OR UPDATE OF geojson ON "streets"
  FOR EACH ROW EXECUTE FUNCTION sync_street_geom();

-- e-SUS sync pilot: store last import for re-sync
ALTER TABLE "municipalities" ADD COLUMN IF NOT EXISTS "esus_last_sync_at" TIMESTAMP(3);
ALTER TABLE "municipalities" ADD COLUMN IF NOT EXISTS "esus_import_csv" TEXT;
