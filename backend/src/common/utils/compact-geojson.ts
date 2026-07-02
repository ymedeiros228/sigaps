/** Reduz payload JSON das geometrias. precision: casas decimais (5 ≈ 1 m). */
export function compactLineStringGeojson(geojson: unknown, precision = 5): unknown {
  if (!geojson || typeof geojson !== 'object') return geojson;
  const g = geojson as GeoJSON.LineString;
  if (g.type !== 'LineString' || !Array.isArray(g.coordinates)) return geojson;
  const factor = 10 ** precision;
  const coords = g.coordinates.map((c) => {
    const [lng, lat] = c as [number, number];
    return [Math.round(lng * factor) / factor, Math.round(lat * factor) / factor];
  });
  const step = precision <= 4 ? 2 : 1;
  const thinned =
    step <= 1 || coords.length <= 2
      ? coords
      : coords.filter((_, i) => i === 0 || i === coords.length - 1 || i % step === 0);
  return { type: 'LineString', coordinates: thinned };
}
