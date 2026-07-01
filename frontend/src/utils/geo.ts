export function lineStringCentroid(geojson: GeoJSON.LineString): { lat: number; lng: number } | null {
  const coords = geojson?.coordinates;
  if (!coords?.length) return null;

  let latSum = 0;
  let lngSum = 0;
  for (const [lng, lat] of coords) {
    lngSum += lng;
    latSum += lat;
  }
  return { lat: latSum / coords.length, lng: lngSum / coords.length };
}
