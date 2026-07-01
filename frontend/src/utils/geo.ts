import { fixCoordPair } from './streetSearch';

export function lineStringCentroid(geojson: GeoJSON.LineString): { lat: number; lng: number } | null {
  const coords = geojson?.coordinates;
  if (!coords?.length) return null;

  let latSum = 0;
  let lngSum = 0;
  for (const raw of coords) {
    const [lng, lat] = fixCoordPair(raw as [number, number]);
    lngSum += lng;
    latSum += lat;
  }
  return { lat: latSum / coords.length, lng: lngSum / coords.length };
}

/** Limites [sul-oeste, nordeste] para fitBounds do Leaflet. */
export function lineStringBounds(
  geojson: GeoJSON.LineString,
): [[number, number], [number, number]] | null {
  const coords = geojson?.coordinates;
  if (!coords?.length) return null;

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (const raw of coords) {
    const [lng, lat] = fixCoordPair(raw as [number, number]);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
  }

  if (!Number.isFinite(minLat)) return null;
  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
}
