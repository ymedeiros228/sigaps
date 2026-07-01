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

/** União de limites de várias LineStrings para fitBounds. */
export function boundsFromLineStrings(
  geojsons: GeoJSON.LineString[],
): [[number, number], [number, number]] | null {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (const geojson of geojsons) {
    const b = lineStringBounds(geojson);
    if (!b) continue;
    minLat = Math.min(minLat, b[0][0], b[1][0]);
    maxLat = Math.max(maxLat, b[0][0], b[1][0]);
    minLng = Math.min(minLng, b[0][1], b[1][1]);
    maxLng = Math.max(maxLng, b[0][1], b[1][1]);
  }

  if (!Number.isFinite(minLat)) return null;
  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
}

/** Cor de calor para contagem de famílias (amarelo → vermelho). */
export function familyHeatColor(count: number, max: number): string {
  if (count <= 0 || max <= 0) return '#9E9E9E';
  const t = Math.min(1, count / max);
  const hue = 45 - t * 45;
  return `hsl(${hue}, 85%, ${48 - t * 12}%)`;
}
