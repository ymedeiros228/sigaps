export function isValidLineString(
  geojson: GeoJSON.LineString | null | undefined,
): geojson is GeoJSON.LineString {
  if (!geojson || geojson.type !== 'LineString') return false;
  const coords = geojson.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return false;
  return coords.every(
    (c) =>
      Array.isArray(c) &&
      c.length >= 2 &&
      Number.isFinite(c[0]) &&
      Number.isFinite(c[1]),
  );
}
