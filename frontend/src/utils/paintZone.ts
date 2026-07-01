import distance from '@turf/distance';
import { point } from '@turf/helpers';
import type { Street } from '../services/api';
import { lineStringCentroid } from './geo';

export function streetsInsideCircle(
  streets: Street[],
  centerLat: number,
  centerLng: number,
  radiusMeters: number,
): Street[] {
  const center = point([centerLng, centerLat]);
  return streets.filter((street) => {
    const c = lineStringCentroid(street.geojson);
    if (!c) return false;
    const d = distance(center, point([c.lng, c.lat]), { units: 'meters' });
    return d <= radiusMeters;
  });
}
