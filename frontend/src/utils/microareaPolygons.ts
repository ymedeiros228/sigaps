import buffer from '@turf/buffer';
import centroid from '@turf/centroid';
import { featureCollection, lineString, point } from '@turf/helpers';
import union from '@turf/union';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import type { Microarea, Street } from '../services/api';

export type MicroareaPolygon = {
  microareaId: string;
  name: string;
  color: string;
  number: number;
  acsName?: string;
  streetCount: number;
  /** Zona unificada da microárea (como mapa oficial Mutirão) */
  zone: GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
  labelPoint: GeoJSON.Point;
};

/** Largura do corredor para unir ruas vizinhas numa zona contínua */
const ZONE_BUFFER_METERS = 58;

function isPolygonGeometry(
  geom: GeoJSON.Geometry,
): geom is Polygon | MultiPolygon {
  return geom.type === 'Polygon' || geom.type === 'MultiPolygon';
}

/**
 * Une buffers das ruas pintadas numa zona semitransparente contínua
 * (estilo mapa oficial de microáreas).
 */
export function buildMicroareaPolygon(
  microarea: Microarea,
  streets: Street[],
): MicroareaPolygon | null {
  const assigned = streets.filter((s) => s.microareaId === microarea.id);
  if (assigned.length === 0) return null;

  const buffers: Feature<Polygon | MultiPolygon>[] = [];
  const labelPoints: [number, number][] = [];

  for (const street of assigned) {
    const coords = street.geojson?.coordinates;
    if (!coords || coords.length < 2) continue;

    let buffered: Feature<Polygon | MultiPolygon> | undefined;
    try {
      const result = buffer(lineString(coords), ZONE_BUFFER_METERS, { units: 'meters' });
      if (result && isPolygonGeometry(result.geometry)) {
        buffered = result as Feature<Polygon | MultiPolygon>;
      }
    } catch {
      continue;
    }
    if (!buffered) continue;

    buffers.push(buffered);
    for (const c of coords) {
      if (Array.isArray(c) && c.length >= 2) labelPoints.push([c[0], c[1]]);
    }
  }

  if (buffers.length === 0) return null;

  let zone: Polygon | MultiPolygon | null = null;
  if (buffers.length === 1) {
    zone = buffers[0].geometry;
  } else {
    try {
      const united = union(featureCollection(buffers));
      if (united && isPolygonGeometry(united.geometry)) {
        zone = united.geometry;
      }
    } catch {
      zone = buffers[0].geometry;
    }
  }

  const labelPoint =
    labelPoints.length > 0
      ? (centroid(featureCollection(labelPoints.map((p) => point(p)))).geometry as GeoJSON.Point)
      : (centroid(buffers[0]).geometry as GeoJSON.Point);

  return {
    microareaId: microarea.id,
    name: microarea.name,
    color: microarea.color,
    number: microarea.number,
    acsName: microarea.acs?.name,
    streetCount: assigned.length,
    zone,
    labelPoint,
  };
}

export function buildAllMicroareaPolygons(
  microareas: Microarea[],
  streets: Street[],
): MicroareaPolygon[] {
  return microareas
    .map((m) => buildMicroareaPolygon(m, streets))
    .filter((p): p is MicroareaPolygon => p !== null && p.zone !== null);
}

export function apiPolygonToFeature(
  geojson: GeoJSON.Polygon,
  microarea: Microarea,
  streetCount: number,
): MicroareaPolygon {
  const center = centroid({ type: 'Feature', properties: {}, geometry: geojson });
  return {
    microareaId: microarea.id,
    name: microarea.name,
    color: microarea.color,
    number: microarea.number,
    acsName: microarea.acs?.name,
    streetCount,
    zone: geojson,
    labelPoint: center.geometry as GeoJSON.Point,
  };
}
