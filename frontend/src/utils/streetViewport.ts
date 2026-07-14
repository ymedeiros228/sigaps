import type { LatLngBounds } from 'leaflet';

type LineCoords = [number, number][];

function lineCoordinates(geojson: unknown): LineCoords | null {
  if (!geojson || typeof geojson !== 'object') return null;
  const g = geojson as { type?: string; coordinates?: unknown };
  if (g.type !== 'LineString' || !Array.isArray(g.coordinates)) return null;
  return g.coordinates as LineCoords;
}

export function lineIntersectsBounds(geojson: unknown, bounds: LatLngBounds, padding = 0.02): boolean {
  const coords = lineCoordinates(geojson);
  if (!coords?.length) return false;

  const south = bounds.getSouth() - padding;
  const north = bounds.getNorth() + padding;
  const west = bounds.getWest() - padding;
  const east = bounds.getEast() + padding;

  for (const [lng, lat] of coords) {
    if (lat >= south && lat <= north && lng >= west && lng <= east) return true;
  }
  return false;
}

function zoomBucket(zoom: number): number {
  if (zoom < 13) return 12;
  if (zoom < 15) return 14;
  return 16;
}

/** Cache por array de coords + faixa de zoom (evita re-simplificar a cada paint). */
const simplifyCache = new WeakMap<object, Map<number, unknown>>();

/** Reduz pontos da linha em zoom baixo para aliviar o render. */
export function simplifyLineGeojson(geojson: unknown, zoom: number): unknown {
  const coords = lineCoordinates(geojson);
  if (!coords || coords.length <= 2) return geojson;

  const bucket = zoomBucket(zoom);
  let byZoom = simplifyCache.get(coords as object);
  if (!byZoom) {
    byZoom = new Map();
    simplifyCache.set(coords as object, byZoom);
  }
  const cached = byZoom.get(bucket);
  if (cached) return cached;

  let step = 1;
  if (bucket < 13) step = 4;
  else if (bucket < 15) step = 2;

  if (step === 1) {
    byZoom.set(bucket, geojson);
    return geojson;
  }

  const simplified: LineCoords = [];
  for (let i = 0; i < coords.length; i += step) {
    simplified.push(coords[i]);
  }
  const last = coords[coords.length - 1];
  if (simplified[simplified.length - 1] !== last) simplified.push(last);

  const result = { type: 'LineString', coordinates: simplified };
  byZoom.set(bucket, result);
  return result;
}
