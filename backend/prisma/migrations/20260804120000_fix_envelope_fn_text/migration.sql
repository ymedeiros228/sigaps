-- IDs em microareas/streets são TEXT (Prisma String), não uuid nativo.
-- A função com parâmetro uuid quebrava o e2e: "operator does not exist: text = uuid".
DROP FUNCTION IF EXISTS update_microarea_envelope(uuid);

CREATE OR REPLACE FUNCTION update_microarea_envelope(p_microarea_id text)
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
