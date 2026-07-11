import type { PaintScope, PaintStreetSide, Street, StreetPaintSegment, StreetPaintSide, ApiPaintSide } from '../services/api';

type Coord = [number, number];

const SIDE_OFFSET_METERS = 5;

export function streetCoords(geojson: GeoJSON.LineString): Coord[] {
  return (geojson?.coordinates ?? []) as Coord[];
}

export function isDualSideStreet(street: Street): boolean {
  const type = (street.streetType ?? '').toLowerCase();
  if (
    type.includes('terra') ||
    type.includes('estrada de terra') ||
    type.includes('caminho') ||
    type.includes('trilha')
  ) {
    return false;
  }
  return !!street.osmId;
}

function bearingDegrees(from: Coord, to: Coord): number {
  const [lng1, lat1] = from;
  const [lng2, lat2] = to;
  const y = Math.sin(((lng2 - lng1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(((lng2 - lng1) * Math.PI) / 180);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function movePerpendicular(lat: number, lng: number, bearingDeg: number, meters: number, left: boolean): Coord {
  const perp = bearingDeg + (left ? -90 : 90);
  const rad = (perp * Math.PI) / 180;
  const dLat = (meters / 111320) * Math.cos(rad);
  const dLng = (meters / (111320 * Math.cos((lat * Math.PI) / 180))) * Math.sin(rad);
  return [lng + dLng, lat + dLat];
}

export function offsetLineForSide(
  line: GeoJSON.LineString,
  side: StreetPaintSide,
  meters = SIDE_OFFSET_METERS,
): GeoJSON.LineString {
  if (side === 'FULL') return line;
  const coords = streetCoords(line);
  if (coords.length < 2) return line;
  const left = side === 'LEFT';
  const out: Coord[] = [];
  for (let i = 0; i < coords.length; i++) {
    const [lng, lat] = coords[i];
    let bearing: number;
    if (i === 0) bearing = bearingDegrees(coords[0], coords[1]);
    else if (i === coords.length - 1) bearing = bearingDegrees(coords[i - 1], coords[i]);
    else {
      const b1 = bearingDegrees(coords[i - 1], coords[i]);
      const b2 = bearingDegrees(coords[i], coords[i + 1]);
      bearing = (b1 + b2) / 2;
    }
    out.push(movePerpendicular(lat, lng, bearing, meters, left));
  }
  return { type: 'LineString', coordinates: out };
}

export function closestVertexIndex(coords: Coord[], latitude: number, longitude: number) {
  if (coords.length === 0) return 0;
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const [lng, lat] = coords[i];
    const d = (lat - latitude) ** 2 + (lng - longitude) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

export function computeUnpaintedRanges(
  segments: Array<{ startIndex: number; endIndex: number }>,
  maxIndex: number,
): Array<{ start: number; end: number }> {
  if (maxIndex < 1) return [];
  const sorted = [...segments].sort((a, b) => a.startIndex - b.startIndex);
  const ranges: Array<{ start: number; end: number }> = [];
  let cursor = 0;
  for (const seg of sorted) {
    if (seg.startIndex > cursor) {
      ranges.push({ start: cursor, end: seg.startIndex });
    }
    cursor = Math.max(cursor, seg.endIndex);
  }
  if (cursor < maxIndex) {
    ranges.push({ start: cursor, end: maxIndex });
  }
  return ranges.filter((r) => r.end - r.start >= 1);
}

function segmentsCoveringSide(segments: StreetPaintSegment[], side: StreetPaintSide): StreetPaintSegment[] {
  if (side === 'FULL') return segments.filter((s) => s.side === 'FULL');
  return segments.filter((s) => s.side === side || s.side === 'FULL');
}

export function sliceStreetGeojson(coords: Coord[], startIndex: number, endIndex: number): GeoJSON.LineString | null {
  const start = Math.max(0, Math.min(startIndex, endIndex));
  const end = Math.min(coords.length - 1, Math.max(startIndex, endIndex));
  if (end - start < 1) return null;
  return {
    type: 'LineString',
    coordinates: coords.slice(start, end + 1),
  };
}

export function streetHasPaint(street: Street): boolean {
  return !!(street.paintSegments?.length || street.microareaId);
}

export function sideLabel(side: StreetPaintSide): string {
  if (side === 'LEFT') return 'Lado esquerdo';
  if (side === 'RIGHT') return 'Lado direito';
  return 'Rua inteira';
}

export function segmentLengthPercent(street: Street, seg: StreetPaintSegment): number {
  const maxIndex = Math.max(1, streetCoords(street.geojson).length - 1);
  return Math.round(((seg.endIndex - seg.startIndex) / maxIndex) * 100);
}

export function uniqueMicroareasOnStreet(street: Street): Array<{
  microareaId: string;
  name: string;
  color: string;
  segmentCount: number;
}> {
  const byId = new Map<string, { microareaId: string; name: string; color: string; segmentCount: number }>();
  for (const seg of street.paintSegments ?? []) {
    const existing = byId.get(seg.microareaId);
    if (existing) {
      existing.segmentCount += 1;
    } else {
      byId.set(seg.microareaId, {
        microareaId: seg.microareaId,
        name: seg.microarea?.name ?? 'Microárea',
        color: seg.microarea?.color ?? '#888',
        segmentCount: 1,
      });
    }
  }
  if (street.microareaId && street.microarea && !byId.has(street.microareaId)) {
    byId.set(street.microareaId, {
      microareaId: street.microareaId,
      name: street.microarea.name,
      color: street.microarea.color,
      segmentCount: 1,
    });
  }
  return Array.from(byId.values());
}

export function segmentAtPoint(
  street: Street,
  latitude: number,
  longitude: number,
  activeSide?: ApiPaintSide | StreetPaintSide,
): StreetPaintSegment | null {
  const segments = street.paintSegments;
  if (!segments?.length) return null;
  const coords = streetCoords(street.geojson);
  const vertexIndex = closestVertexIndex(coords, latitude, longitude);

  if (isDualSideStreet(street) && activeSide && activeSide !== 'BOTH' && activeSide !== 'FULL') {
    const side = activeSide as StreetPaintSide;
    return (
      segmentsCoveringSide(segments, side).find(
        (s) => s.startIndex <= vertexIndex && s.endIndex >= vertexIndex,
      ) ?? null
    );
  }

  return segments.find((s) => s.startIndex <= vertexIndex && s.endIndex >= vertexIndex) ?? null;
}

export function paintStateAtPoint(
  street: Street,
  latitude: number,
  longitude: number,
  activeSide?: ApiPaintSide | StreetPaintSide,
): { microareaId: string | null; segment: StreetPaintSegment | null } {
  const segment = segmentAtPoint(street, latitude, longitude, activeSide);
  if (segment) {
    return { microareaId: segment.microareaId, segment };
  }
  if (street.paintSegments?.length) {
    return { microareaId: null, segment: null };
  }
  return { microareaId: street.microareaId ?? null, segment: null };
}

export type StreetMapFeature = {
  type: 'Feature';
  properties: {
    id: string;
    streetId: string;
    segmentId?: string;
    side?: StreetPaintSide;
    name: string;
    streetType: string;
    isDirtRoad: boolean;
    color: string;
    microareaName?: string;
    hasMicroarea: boolean;
    highlighted: boolean;
    selected: boolean;
    dragPending: boolean;
    familyCount: number;
    isPartial: boolean;
  };
  geometry: GeoJSON.LineString;
};

function displayGeometry(
  street: Street,
  geometry: GeoJSON.LineString,
  side: StreetPaintSide,
): GeoJSON.LineString {
  if (!isDualSideStreet(street) || side === 'FULL') return geometry;
  return offsetLineForSide(geometry, side);
}

export function buildStreetMapFeatures(
  street: Street,
  ctx: {
    highlightedId: string | null;
    selectedIds: Set<string>;
    dragPaintIds: Set<string>;
    activeColor: string;
    paintStreetSide?: PaintStreetSide;
    paintMode?: boolean;
  },
): { painted: StreetMapFeature[]; unpainted: StreetMapFeature[]; dragPreview: StreetMapFeature[] } {
  const painted: StreetMapFeature[] = [];
  const unpainted: StreetMapFeature[] = [];
  const dragPreview: StreetMapFeature[] = [];

  const dual = isDualSideStreet(street);
  const baseProps = {
    streetId: street.id,
    name: street.name,
    streetType: street.streetType ?? 'Rua',
    isDirtRoad: (street.streetType ?? '').toLowerCase().includes('terra'),
    highlighted: street.id === ctx.highlightedId,
    selected: ctx.selectedIds.has(street.id),
    dragPending: ctx.dragPaintIds.has(street.id),
    familyCount: street.familyCount ?? 0,
  };

  const segments = street.paintSegments ?? [];
  const coords = streetCoords(street.geojson);
  const maxIndex = coords.length - 1;

  const pushUnpaintedGap = (
    gap: { start: number; end: number },
    side: StreetPaintSide,
    keySuffix: string,
  ) => {
    const geometry = sliceStreetGeojson(coords, gap.start, gap.end);
    if (!geometry) return;
    const feature: StreetMapFeature = {
      type: 'Feature',
      properties: {
        ...baseProps,
        id: `${street.id}:gap:${keySuffix}:${gap.start}`,
        side,
        color: ctx.activeColor,
        hasMicroarea: false,
        isPartial: true,
      },
      geometry: displayGeometry(street, geometry, side),
    };
    if (baseProps.dragPending) dragPreview.push(feature);
    else unpainted.push(feature);
  };

  if (segments.length > 0) {
    for (const seg of segments) {
      painted.push({
        type: 'Feature',
        properties: {
          ...baseProps,
          id: `${street.id}:${seg.id}`,
          segmentId: seg.id,
          side: seg.side,
          color: seg.microarea?.color ?? ctx.activeColor,
          microareaName: seg.microarea?.name,
          hasMicroarea: true,
          isPartial: true,
        },
        geometry: displayGeometry(street, seg.geojson, seg.side),
      });
    }

    if (dual) {
      for (const side of ['LEFT', 'RIGHT'] as StreetPaintSide[]) {
        const sideSegs = segmentsCoveringSide(segments, side);
        const gaps = computeUnpaintedRanges(sideSegs, maxIndex);
        for (const gap of gaps) {
          pushUnpaintedGap(gap, side, side);
        }
      }
    } else {
      const gaps = computeUnpaintedRanges(segments, maxIndex);
      for (const gap of gaps) {
        pushUnpaintedGap(gap, 'FULL', 'full');
      }
    }
    return { painted, unpainted, dragPreview };
  }

  const feature: StreetMapFeature = {
    type: 'Feature',
    properties: {
      ...baseProps,
      id: street.id,
      side: 'FULL',
      color: street.microarea?.color ?? ctx.activeColor,
      microareaName: street.microarea?.name,
      hasMicroarea: !!street.microareaId,
      isPartial: false,
    },
    geometry: street.geojson,
  };

  if (feature.properties.hasMicroarea) {
    if (dual) {
      for (const side of ['LEFT', 'RIGHT'] as StreetPaintSide[]) {
        painted.push({
          ...feature,
          properties: { ...feature.properties, id: `${street.id}:${side}`, side },
          geometry: displayGeometry(street, street.geojson, side),
        });
      }
    } else {
      painted.push(feature);
    }
  } else if (feature.properties.dragPending) {
    dragPreview.push(feature);
  } else if (dual && ctx.paintMode) {
    for (const side of ['LEFT', 'RIGHT'] as StreetPaintSide[]) {
      unpainted.push({
        ...feature,
        properties: { ...feature.properties, id: `${street.id}:unpainted:${side}`, side, isPartial: true },
        geometry: displayGeometry(street, street.geojson, side),
      });
    }
  } else {
    unpainted.push(feature);
  }

  return { painted, unpainted, dragPreview };
}

export type StreetSideAssignment = {
  mode: 'NONE' | 'FULL' | 'SPLIT';
  fullMicroareaId?: string;
  leftMicroareaId?: string;
  rightMicroareaId?: string;
};

export function getStreetSideAssignment(street: Street): StreetSideAssignment {
  const segments = street.paintSegments ?? [];
  const coords = streetCoords(street.geojson);
  const maxIndex = coords.length - 1;

  if (segments.length === 0) {
    if (street.microareaId) return { mode: 'FULL', fullMicroareaId: street.microareaId };
    return { mode: 'NONE' };
  }

  const fullSegs = segments.filter((s) => s.side === 'FULL');
  if (fullSegs.length > 0 && !isDualSideStreet(street)) {
    const unique = new Set(fullSegs.map((s) => s.microareaId));
    if (unique.size === 1 && fullSegs.length === 1) {
      return { mode: 'FULL', fullMicroareaId: fullSegs[0].microareaId };
    }
  }

  const leftSeg = segments.find(
    (s) => s.side === 'LEFT' && s.startIndex === 0 && s.endIndex === maxIndex,
  );
  const rightSeg = segments.find(
    (s) => s.side === 'RIGHT' && s.startIndex === 0 && s.endIndex === maxIndex,
  );

  if (leftSeg && rightSeg) {
    if (leftSeg.microareaId === rightSeg.microareaId) {
      return { mode: 'FULL', fullMicroareaId: leftSeg.microareaId };
    }
    return {
      mode: 'SPLIT',
      leftMicroareaId: leftSeg.microareaId,
      rightMicroareaId: rightSeg.microareaId,
    };
  }

  if (leftSeg || rightSeg) {
    return {
      mode: 'SPLIT',
      leftMicroareaId: leftSeg?.microareaId,
      rightMicroareaId: rightSeg?.microareaId,
    };
  }

  return { mode: 'NONE' };
}

export function resolveApiPaintSide(
  street: Street,
  paintStreetSide: PaintStreetSide,
  paintScope: PaintScope,
  latitude: number,
  longitude: number,
): ApiPaintSide | StreetPaintSide {
  if (paintScope === 'whole') {
    if (isDualSideStreet(street)) return 'BOTH';
    return 'FULL';
  }
  if (paintStreetSide === 'LEFT') return 'LEFT';
  if (paintStreetSide === 'RIGHT') return 'RIGHT';
  if (isDualSideStreet(street)) {
    return detectClickSide(street, latitude, longitude);
  }
  return 'FULL';
}

export function detectClickSide(street: Street, latitude: number, longitude: number): StreetPaintSide {
  if (!isDualSideStreet(street)) return 'FULL';
  const coords = streetCoords(street.geojson);
  if (coords.length < 2) return 'LEFT';
  const vi = closestVertexIndex(coords, latitude, longitude);
  const i0 = Math.max(0, vi - 1);
  const i1 = Math.min(coords.length - 1, vi + 1);
  const [x1, y1] = coords[i0];
  const [x2, y2] = coords[i1];
  const cross = (x2 - x1) * (latitude - y1) - (y2 - y1) * (longitude - x1);
  return cross > 0 ? 'LEFT' : 'RIGHT';
}

export function effectivePaintSide(
  street: Street,
  latitude: number,
  longitude: number,
  paintStreetSide: PaintStreetSide,
  paintScope: PaintScope,
  eraserMode: boolean,
): ApiPaintSide | StreetPaintSide {
  if (!isDualSideStreet(street)) return 'FULL';
  if (eraserMode && paintStreetSide === 'FULL' && paintScope === 'segment') {
    return detectClickSide(street, latitude, longitude);
  }
  if (paintScope === 'whole') return 'BOTH';
  if (paintStreetSide === 'LEFT') return 'LEFT';
  if (paintStreetSide === 'RIGHT') return 'RIGHT';
  return detectClickSide(street, latitude, longitude);
}
