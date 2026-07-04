-- Envelope territorial das microáreas (convex hull das ruas pintadas)
ALTER TABLE "microareas" ADD COLUMN IF NOT EXISTS "envelope_geom" geometry(Polygon, 4326);

CREATE OR REPLACE FUNCTION update_microarea_envelope(p_microarea_id uuid)
RETURNS void AS $$
DECLARE
  v_geom geometry;
BEGIN
  SELECT ST_ConvexHull(ST_Collect(s.geom))
  INTO v_geom
  FROM streets s
  WHERE s.microarea_id = p_microarea_id
    AND s.geom IS NOT NULL;

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

-- Limpa envelopes órfãos (microárea sem ruas pintadas)
UPDATE microareas m
SET envelope_geom = NULL
WHERE envelope_geom IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM streets s WHERE s.microarea_id = m.id
  );
