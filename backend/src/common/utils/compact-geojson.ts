/** Reduz payload JSON das geometrias (~1 m de precisão). */
export function compactLineStringGeojson(geojson: unknown): unknown {
  if (!geojson || typeof geojson !== 'object') return geojson;
  const g = geojson as GeoJSON.LineString;
  if (g.type !== 'LineString' || !Array.isArray(g.coordinates)) return geojson;
  return {
    type: 'LineString',
    coordinates: g.coordinates.map((c) => {
      const [lng, lat] = c as [number, number];
      return [Math.round(lng * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5];
    }),
  };
}
