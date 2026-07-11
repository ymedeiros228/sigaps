-- Trechos de pintura por microárea (ruas longas com mais de uma cor)
CREATE TABLE "street_paint_segments" (
    "id" TEXT NOT NULL,
    "street_id" TEXT NOT NULL,
    "microarea_id" TEXT NOT NULL,
    "start_index" INTEGER NOT NULL,
    "end_index" INTEGER NOT NULL,
    "geojson" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "street_paint_segments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "street_paint_segments_street_id_idx" ON "street_paint_segments"("street_id");
CREATE INDEX "street_paint_segments_microarea_id_idx" ON "street_paint_segments"("microarea_id");
CREATE INDEX "street_paint_segments_street_id_start_index_idx" ON "street_paint_segments"("street_id", "start_index");

ALTER TABLE "street_paint_segments" ADD CONSTRAINT "street_paint_segments_street_id_fkey" FOREIGN KEY ("street_id") REFERENCES "streets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "street_paint_segments" ADD CONSTRAINT "street_paint_segments_microarea_id_fkey" FOREIGN KEY ("microarea_id") REFERENCES "microareas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrar pinturas existentes (rua inteira → um trecho)
INSERT INTO "street_paint_segments" ("id", "street_id", "microarea_id", "start_index", "end_index", "geojson", "created_at", "updated_at")
SELECT
    gen_random_uuid()::text,
    s.id,
    s.microarea_id,
    0,
    GREATEST(0, jsonb_array_length(s.geojson->'coordinates') - 1),
    s.geojson,
    NOW(),
    NOW()
FROM "streets" s
WHERE s.microarea_id IS NOT NULL
  AND jsonb_typeof(s.geojson->'coordinates') = 'array'
  AND jsonb_array_length(s.geojson->'coordinates') >= 2;

-- Envelope das microáreas passa a considerar trechos pintados
CREATE OR REPLACE FUNCTION update_microarea_envelope(p_microarea_id uuid)
RETURNS void AS $$
DECLARE
  v_geom geometry;
BEGIN
  SELECT ST_ConvexHull(ST_Collect(g.geom))
  INTO v_geom
  FROM (
    SELECT s.geom AS geom
    FROM streets s
    WHERE s.microarea_id = p_microarea_id
      AND s.geom IS NOT NULL
    UNION ALL
    SELECT ST_SetSRID(ST_GeomFromGeoJSON(sps.geojson::text), 4326) AS geom
    FROM street_paint_segments sps
    WHERE sps.microarea_id = p_microarea_id
  ) g
  WHERE g.geom IS NOT NULL;

  IF v_geom IS NULL THEN
    UPDATE microareas SET envelope_geom = NULL WHERE id = p_microarea_id;
    RETURN;
  END IF;

  IF GeometryType(v_geom) = 'POLYGON' THEN
    UPDATE microareas SET envelope_geom = v_geom WHERE id = p_microarea_id;
  ELSIF GeometryType(v_geom) = 'MULTIPOLYGON' THEN
    UPDATE microareas
    SET envelope_geom = ST_GeometryN(v_geom, 1)::geometry(Polygon, 4326)
    WHERE id = p_microarea_id;
  ELSE
    UPDATE microareas
    SET envelope_geom = ST_Buffer(v_geom, 0.00005)::geometry(Polygon, 4326)
    WHERE id = p_microarea_id;
  END IF;
END;
$$ LANGUAGE plpgsql;
