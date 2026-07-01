CREATE TABLE IF NOT EXISTS "microarea_paint_zones" (
  "id" TEXT NOT NULL,
  "microarea_id" TEXT NOT NULL,
  "municipality_id" TEXT NOT NULL,
  "center_lat" DOUBLE PRECISION NOT NULL,
  "center_lng" DOUBLE PRECISION NOT NULL,
  "radius_meters" DOUBLE PRECISION NOT NULL,
  "geojson" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "microarea_paint_zones_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "microarea_paint_zones_microarea_id_idx" ON "microarea_paint_zones"("microarea_id");
CREATE INDEX IF NOT EXISTS "microarea_paint_zones_municipality_id_idx" ON "microarea_paint_zones"("municipality_id");

ALTER TABLE "microarea_paint_zones"
  ADD CONSTRAINT "microarea_paint_zones_microarea_id_fkey"
  FOREIGN KEY ("microarea_id") REFERENCES "microareas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
