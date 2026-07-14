import type { PaintScope, PaintStreetSide, Street, StreetPaintSegment, StreetPaintSide, ApiPaintSide } from '../services/api';

type Coord = [number, number];

const SIDE_OFFSET_METERS = 5;

export function streetCoords(geojson: GeoJSON.LineString): Coord[] {
  return (geojson?.coordinates ?? []) as Coord[];
}

/** Ponto mais próximo na polilinha da rua (para o pincel seguir o traço ao arrastar). */
export function closestPointOnStreet(
  street: Street,
  latitude: number,
  longitude: number,
): { lat: number; lng: number } {
  const coords = streetCoords(street.geojson);
  if (coords.length === 0) return { lat: latitude, lng: longitude };
  if (coords.length === 1) return { lat: coords[0][1], lng: coords[0][0] };

  let bestLat = coords[0][1];
  let bestLng = coords[0][0];
  let bestDist = Infinity;

  for (let i = 0; i < coords.length - 1; i++) {
    const [lng1, lat1] = coords[i];
    const [lng2, lat2] = coords[i + 1];
    const dx = lng2 - lng1;
    const dy = lat2 - lat1;
    const lenSq = dx * dx + dy * dy;
    let t = 0;
    if (lenSq > 0) {
      t = ((longitude - lng1) * dx + (latitude - lat1) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
    }
    const lat = lat1 + t * dy;
    const lng = lng1 + t * dx;
    const d = (lat - latitude) ** 2 + (lng - longitude) ** 2;
    if (d < bestDist) {
      bestDist = d;
      bestLat = lat;
      bestLng = lng;
    }
  }
  return { lat: bestLat, lng: bestLng };
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

const PAINT_HIT_METERS = 28;

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function distancePointToSegmentMeters(
  plat: number,
  plng: number,
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const cos = Math.cos((plat * Math.PI) / 180);
  const ax = aLng * cos;
  const ay = aLat;
  const bx = bLng * cos;
  const by = bLat;
  const px = plng * cos;
  const py = plat;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return haversineMeters(plat, plng, aLat, aLng);
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const projLat = ay + t * dy;
  const projLng = (ax + t * dx) / cos;
  return haversineMeters(plat, plng, projLat, projLng);
}

export function distanceToLineStringMeters(
  latitude: number,
  longitude: number,
  geojson: GeoJSON.LineString,
): number {
  const coords = streetCoords(geojson);
  if (coords.length < 2) return Infinity;
  let best = Infinity;
  for (let i = 0; i < coords.length - 1; i++) {
    const [lng1, lat1] = coords[i];
    const [lng2, lat2] = coords[i + 1];
    best = Math.min(
      best,
      distancePointToSegmentMeters(latitude, longitude, lat1, lng1, lat2, lng2),
    );
  }
  return best;
}

function segmentAtPointByGeometry(
  street: Street,
  latitude: number,
  longitude: number,
  activeSide?: ApiPaintSide | StreetPaintSide,
): StreetPaintSegment | null {
  const segments = street.paintSegments ?? [];
  if (!segments.length) return null;
  let best: StreetPaintSegment | null = null;
  let bestDist = Infinity;
  for (const seg of segments) {
    if (isDualSideStreet(street) && activeSide && activeSide !== 'BOTH' && activeSide !== 'FULL') {
      const side = activeSide as StreetPaintSide;
      if (seg.side !== side && seg.side !== 'FULL') continue;
    }
    const geom =
      seg.geojson?.type === 'LineString' && (seg.geojson.coordinates?.length ?? 0) >= 2
        ? seg.geojson
        : street.geojson;
    const d = distanceToLineStringMeters(latitude, longitude, geom);
    if (d < bestDist) {
      bestDist = d;
      best = seg;
    }
  }
  return best && bestDist <= PAINT_HIT_METERS ? best : null;
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
    const bySide =
      segmentsCoveringSide(segments, side).find(
        (s) => s.startIndex <= vertexIndex && s.endIndex >= vertexIndex,
      ) ?? null;
    if (bySide) return bySide;
    return segmentAtPointByGeometry(street, latitude, longitude, activeSide);
  }

  const byIndex =
    segments.find((s) => s.startIndex <= vertexIndex && s.endIndex >= vertexIndex) ?? null;
  if (byIndex) return byIndex;
  return segmentAtPointByGeometry(street, latitude, longitude, activeSide);
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
    if (
      street.microareaId &&
      distanceToLineStringMeters(latitude, longitude, street.geojson) <= PAINT_HIT_METERS
    ) {
      return { microareaId: street.microareaId, segment: null };
    }
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
        color: '#888888',
        hasMicroarea: false,
        isPartial: true,
      },
      // Gaps/unpainted: centerline (offset só nos trechos pintados e no preview).
      geometry,
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
      const seenGaps = new Set<string>();
      for (const side of ['LEFT', 'RIGHT'] as StreetPaintSide[]) {
        const sideSegs = segmentsCoveringSide(segments, side);
        const gaps = computeUnpaintedRanges(sideSegs, maxIndex);
        for (const gap of gaps) {
          const key = `${gap.start}:${gap.end}`;
          if (seenGaps.has(key)) continue;
          seenGaps.add(key);
          pushUnpaintedGap(gap, 'FULL', key);
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
    dragPreview.push({
      ...feature,
      properties: { ...feature.properties, color: ctx.activeColor },
    });
  } else {
    // Dual sem pintura: uma centerline (evita 2× offset trig em ~todas as ruas OSM).
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
  if (eraserMode) {
    return detectClickSide(street, latitude, longitude);
  }
  if (paintScope === 'whole') return 'BOTH';
  if (paintStreetSide === 'LEFT') return 'LEFT';
  if (paintStreetSide === 'RIGHT') return 'RIGHT';
  return detectClickSide(street, latitude, longitude);
}

// --- Paint-at-point simulation (mirrors backend street-paint-segment.util) ---

type SegmentRange = {
  startIndex: number;
  endIndex: number;
  microareaId: string;
  side: StreetPaintSide;
};

function streetToRanges(street: Street): SegmentRange[] {
  return (street.paintSegments ?? []).map((s) => ({
    startIndex: s.startIndex,
    endIndex: s.endIndex,
    microareaId: s.microareaId,
    side: s.side,
  }));
}

function mergeAdjacentSegments(segments: SegmentRange[]): SegmentRange[] {
  if (segments.length === 0) return [];
  const sorted = [...segments].sort((a, b) => {
    if (a.side !== b.side) return a.side.localeCompare(b.side);
    return a.startIndex - b.startIndex;
  });
  const merged: SegmentRange[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const prev = merged[merged.length - 1];
    const cur = sorted[i];
    if (
      cur.side === prev.side &&
      cur.microareaId === prev.microareaId &&
      cur.startIndex <= prev.endIndex
    ) {
      prev.endIndex = Math.max(prev.endIndex, cur.endIndex);
    } else {
      merged.push({ ...cur });
    }
  }
  return merged.filter((s) => s.endIndex - s.startIndex >= 1);
}

function expandFullSegmentsForDualSide(ranges: SegmentRange[]): SegmentRange[] {
  const out: SegmentRange[] = [];
  for (const range of ranges) {
    if (range.side === 'FULL') {
      out.push({ ...range, side: 'LEFT' });
      out.push({ ...range, side: 'RIGHT' });
    } else {
      out.push({ ...range });
    }
  }
  return mergeAdjacentSegments(out);
}

function applyFullSidePaint(
  allRanges: SegmentRange[],
  microareaId: string,
  side: StreetPaintSide,
  maxIndex: number,
): SegmentRange[] {
  const other = allRanges.filter((r) => r.side !== side);
  return mergeAdjacentSegments([
    ...other,
    { startIndex: 0, endIndex: maxIndex, microareaId, side },
  ]);
}

function applyPaintRange(
  allRanges: SegmentRange[],
  startIndex: number,
  endIndex: number,
  microareaId: string,
  side: StreetPaintSide,
  maxIndex: number,
): SegmentRange[] {
  let lo = Math.max(0, Math.min(startIndex, endIndex));
  let hi = Math.min(maxIndex, Math.max(startIndex, endIndex));
  if (hi - lo < 1) {
    if (hi < maxIndex) hi += 1;
    else if (lo > 0) lo -= 1;
  }
  if (hi - lo < 1) return allRanges;

  const other = allRanges.filter((r) => r.side !== side);
  const sideRanges = allRanges.filter((r) => r.side === side);
  const trimmed: SegmentRange[] = [];

  for (const seg of sideRanges) {
    if (seg.endIndex <= lo || seg.startIndex >= hi) {
      trimmed.push({ ...seg });
      continue;
    }
    if (seg.startIndex < lo) {
      trimmed.push({ ...seg, endIndex: lo });
    }
    if (seg.endIndex > hi) {
      trimmed.push({ ...seg, startIndex: hi });
    }
  }

  trimmed.push({ startIndex: lo, endIndex: hi, microareaId, side });
  return mergeAdjacentSegments([...other, ...trimmed]);
}

function applyUnpaintRange(
  allRanges: SegmentRange[],
  startIndex: number,
  endIndex: number,
  unpaintSide: StreetPaintSide,
): { ranges: SegmentRange[]; removed: SegmentRange[] } {
  let lo = Math.max(0, Math.min(startIndex, endIndex));
  let hi = Math.max(startIndex, endIndex);
  if (hi - lo < 1) {
    if (hi < allRanges.reduce((m, r) => Math.max(m, r.endIndex), 0)) hi += 1;
    else if (lo > 0) lo -= 1;
  }

  const removed: SegmentRange[] = [];
  const kept: SegmentRange[] = [];

  for (const seg of allRanges) {
    if (seg.side !== unpaintSide) {
      kept.push({ ...seg });
      continue;
    }
    if (seg.endIndex <= lo || seg.startIndex >= hi) {
      kept.push({ ...seg });
      continue;
    }
    removed.push({ ...seg });
    if (seg.startIndex < lo) {
      kept.push({ ...seg, endIndex: lo });
    }
    if (seg.endIndex > hi) {
      kept.push({ ...seg, startIndex: hi });
    }
  }

  return { ranges: mergeAdjacentSegments(kept), removed };
}

function applyPaintOnSide(
  allRanges: SegmentRange[],
  vertexIndex: number,
  microareaId: string,
  side: StreetPaintSide,
  maxIndex: number,
): SegmentRange[] {
  const other = allRanges.filter((r) => r.side !== side);
  let sideRanges = allRanges.filter((r) => r.side === side);

  if (sideRanges.length === 0) {
    const gaps = computeUnpaintedRanges([], maxIndex);
    const gap = gaps.find((g) => g.start <= vertexIndex && g.end >= vertexIndex);
    if (gap && gap.end - Math.max(gap.start, vertexIndex) >= 1) {
      sideRanges.push({
        startIndex: Math.max(gap.start, vertexIndex),
        endIndex: gap.end,
        microareaId,
        side,
      });
    }
  } else {
    const containing = sideRanges.find(
      (s) => s.startIndex <= vertexIndex && s.endIndex >= vertexIndex,
    );

    if (containing?.microareaId === microareaId) {
      return allRanges;
    }

    if (!containing) {
      const gaps = computeUnpaintedRanges(sideRanges, maxIndex);
      const gap = gaps.find((g) => g.start <= vertexIndex && g.end >= vertexIndex);
      if (gap && gap.end - Math.max(gap.start, vertexIndex) >= 1) {
        sideRanges.push({
          startIndex: Math.max(gap.start, vertexIndex),
          endIndex: gap.end,
          microareaId,
          side,
        });
      }
    } else {
      const oldMicroareaId = containing.microareaId;
      sideRanges = sideRanges.filter((s) => s !== containing);
      if (vertexIndex > containing.startIndex) {
        sideRanges.push({
          startIndex: containing.startIndex,
          endIndex: vertexIndex,
          microareaId: oldMicroareaId,
          side,
        });
      }
      if (vertexIndex < containing.endIndex) {
        sideRanges.push({
          startIndex: vertexIndex,
          endIndex: containing.endIndex,
          microareaId,
          side,
        });
      }
    }
  }

  return mergeAdjacentSegments([...other, ...sideRanges]);
}

function normalizePaintSide(
  street: Street,
  requested?: ApiPaintSide | StreetPaintSide,
): StreetPaintSide | 'BOTH' {
  if (!isDualSideStreet(street)) return 'FULL';
  if (requested === 'BOTH') return 'BOTH';
  if (requested === 'FULL') return 'BOTH';
  if (requested === 'LEFT') return 'LEFT';
  if (requested === 'RIGHT') return 'RIGHT';
  return 'LEFT';
}

function rangesToPaintSegments(
  street: Street,
  ranges: SegmentRange[],
  microareaLookup: Map<string, { id: string; name: string; number: number; color: string }>,
): StreetPaintSegment[] {
  const coords = streetCoords(street.geojson);
  return ranges.map((r, i) => {
    const ma = microareaLookup.get(r.microareaId);
    const geojson = sliceStreetGeojson(coords, r.startIndex, r.endIndex) ?? street.geojson;
    return {
      id: `sim:${street.id}:${i}:${r.side}:${r.startIndex}`,
      startIndex: r.startIndex,
      endIndex: r.endIndex,
      side: r.side,
      microareaId: r.microareaId,
      geojson,
      microarea: ma ?? { id: r.microareaId, name: 'Microárea', number: 0, color: '#888' },
    };
  });
}

function syncStreetMicroareaId(ranges: SegmentRange[], maxIndex: number): string | null {
  if (ranges.length === 0) return null;
  const fullOnly = ranges.every((s) => s.side === 'FULL');
  if (fullOnly) {
    const unique = new Set(ranges.map((s) => s.microareaId));
    if (ranges.length === 1 && ranges[0].startIndex === 0 && ranges[0].endIndex === maxIndex) {
      return ranges[0].microareaId;
    }
    if (unique.size === 1 && ranges[0].startIndex === 0 && ranges[0].endIndex === maxIndex) {
      return ranges[0].microareaId;
    }
    return null;
  }
  const left = ranges.filter((s) => s.side === 'LEFT');
  const right = ranges.filter((s) => s.side === 'RIGHT');
  if (left.length === 0 || right.length === 0) return null;
  const covers = (list: SegmentRange[]) =>
    list.length === 1 && list[0].startIndex === 0 && list[0].endIndex === maxIndex;
  if (!covers(left) || !covers(right)) return null;
  if (left[0].microareaId !== right[0].microareaId) return null;
  return left[0].microareaId;
}

export function simulatePaintAtPoint(
  street: Street,
  microarea: { id: string; name: string; number: number; color: string },
  latitude: number,
  longitude: number,
  requestedSide: ApiPaintSide | StreetPaintSide,
  scope: PaintScope,
  microareaLookup?: Map<string, { id: string; name: string; number: number; color: string }>,
): Street | null {
  const coords = streetCoords(street.geojson);
  const maxIndex = coords.length - 1;
  if (maxIndex < 1) return null;

  const vertexIndex = closestVertexIndex(coords, latitude, longitude);
  let ranges = streetToRanges(street);
  const paintMode = normalizePaintSide(street, requestedSide);

  if (isDualSideStreet(street) && ranges.some((r) => r.side === 'FULL')) {
    ranges = expandFullSegmentsForDualSide(ranges);
  }

  const sidesToPaint: StreetPaintSide[] =
    paintMode === 'BOTH'
      ? ['LEFT', 'RIGHT']
      : paintMode === 'FULL' && isDualSideStreet(street)
        ? ['LEFT', 'RIGHT']
        : [paintMode as StreetPaintSide];

  const wantsFullLengthPaint =
    scope === 'whole' ||
    paintMode === 'BOTH' ||
    (paintMode === 'FULL' && isDualSideStreet(street));

  const before = JSON.stringify(ranges);
  for (const side of sidesToPaint) {
    if (wantsFullLengthPaint) {
      ranges = applyFullSidePaint(ranges, microarea.id, side, maxIndex);
    } else {
      ranges = applyPaintOnSide(ranges, vertexIndex, microarea.id, side, maxIndex);
    }
  }
  ranges = mergeAdjacentSegments(ranges);
  if (JSON.stringify(ranges) === before) return null;

  const lookup = microareaLookup ?? new Map([[microarea.id, microarea]]);
  for (const seg of street.paintSegments ?? []) {
    if (seg.microarea && !lookup.has(seg.microareaId)) {
      lookup.set(seg.microareaId, seg.microarea);
    }
  }
  if (street.microarea && street.microareaId) {
    lookup.set(street.microareaId, street.microarea);
  }

  const paintSegments = rangesToPaintSegments(street, ranges, lookup);
  const microareaIdSynced = syncStreetMicroareaId(ranges, maxIndex);
  const primaryMa = microareaIdSynced ? lookup.get(microareaIdSynced) : microarea;

  return {
    ...street,
    microareaId: microareaIdSynced ?? undefined,
    microarea: primaryMa
      ? { id: primaryMa.id, name: primaryMa.name, number: primaryMa.number, color: primaryMa.color }
      : undefined,
    paintSegments,
  };
}

export function simulateUnpaintAtPoint(
  street: Street,
  latitude: number,
  longitude: number,
  requestedSide: ApiPaintSide | StreetPaintSide,
  microareaLookup?: Map<string, { id: string; name: string; number: number; color: string }>,
): Street | null {
  const coords = streetCoords(street.geojson);
  const maxIndex = coords.length - 1;
  if (maxIndex < 1) return null;

  let ranges = streetToRanges(street);
  const unpaintSide = normalizePaintSide(street, requestedSide);
  if (unpaintSide === 'BOTH') return null;

  if (isDualSideStreet(street) && ranges.some((r) => r.side === 'FULL')) {
    ranges = expandFullSegmentsForDualSide(ranges);
  }

  const vertexIndex = closestVertexIndex(coords, latitude, longitude);
  const containing = ranges.find(
    (s) =>
      s.side === unpaintSide &&
      s.startIndex <= vertexIndex &&
      s.endIndex >= vertexIndex,
  );
  if (!containing) {
    const geoSeg = segmentAtPointByGeometry(street, latitude, longitude, requestedSide);
    if (!geoSeg) return null;
    ranges = ranges.filter(
      (r) =>
        !(
          r.microareaId === geoSeg.microareaId &&
          r.side === geoSeg.side &&
          r.startIndex === geoSeg.startIndex &&
          r.endIndex === geoSeg.endIndex
        ),
    );
  } else {
    ranges = mergeAdjacentSegments(ranges.filter((s) => s !== containing));
  }

  const lookup = microareaLookup ?? new Map<string, { id: string; name: string; number: number; color: string }>();
  for (const seg of street.paintSegments ?? []) {
    if (seg.microarea && !lookup.has(seg.microareaId)) {
      lookup.set(seg.microareaId, seg.microarea);
    }
  }
  if (street.microarea && street.microareaId) {
    lookup.set(street.microareaId, street.microarea);
  }

  const paintSegments = rangesToPaintSegments(street, ranges, lookup);
  const microareaIdSynced = syncStreetMicroareaId(ranges, maxIndex);
  const primaryMa = microareaIdSynced ? lookup.get(microareaIdSynced) : undefined;

  return {
    ...street,
    microareaId: microareaIdSynced ?? undefined,
    microarea: primaryMa
      ? { id: primaryMa.id, name: primaryMa.name, number: primaryMa.number, color: primaryMa.color }
      : undefined,
    paintSegments,
  };
}

/** Geometria que será pintada/apagada no hover (preview antes do clique). */
export function computePaintPreviewGeometry(
  street: Street,
  latitude: number,
  longitude: number,
  microareaId: string | null,
  requestedSide: ApiPaintSide | StreetPaintSide,
  scope: PaintScope,
  eraserMode: boolean,
): GeoJSON.LineString | null {
  const coords = streetCoords(street.geojson);
  const maxIndex = coords.length - 1;
  if (maxIndex < 1) return null;

  const vertexIndex = closestVertexIndex(coords, latitude, longitude);
  const side = normalizePaintSide(street, requestedSide);
  const paintSide = side === 'BOTH' ? detectClickSide(street, latitude, longitude) : (side as StreetPaintSide);

  if (eraserMode) {
    const segments = street.paintSegments ?? [];
    const covering = segmentsCoveringSide(segments, paintSide).find(
      (s) => s.startIndex <= vertexIndex && s.endIndex >= vertexIndex,
    );
    if (!covering) return null;
    const geom = sliceStreetGeojson(coords, covering.startIndex, covering.endIndex);
    return geom ? offsetLineForSide(geom, paintSide) : null;
  }

  if (!microareaId) return null;

  if (scope === 'whole' || side === 'BOTH') {
    return isDualSideStreet(street) ? offsetLineForSide(street.geojson, paintSide) : street.geojson;
  }

  if (scope === 'brush') {
    const lo = Math.max(0, vertexIndex - 1);
    const hi = Math.min(maxIndex, vertexIndex + 1);
    const geom = sliceStreetGeojson(coords, lo, hi);
    return geom ? offsetLineForSide(geom, paintSide) : null;
  }

  let ranges = streetToRanges(street);
  if (isDualSideStreet(street) && ranges.some((r) => r.side === 'FULL')) {
    ranges = expandFullSegmentsForDualSide(ranges);
  }

  const sideRanges = ranges.filter((r) => r.side === paintSide);
  const containing = sideRanges.find(
    (s) => s.startIndex <= vertexIndex && s.endIndex >= vertexIndex,
  );

  if (containing?.microareaId === microareaId) return null;

  if (!containing) {
    const gaps = computeUnpaintedRanges(sideRanges, maxIndex);
    const gap = gaps.find((g) => g.start <= vertexIndex && g.end >= vertexIndex);
    if (!gap || gap.end - Math.max(gap.start, vertexIndex) < 1) return null;
    const geom = sliceStreetGeojson(coords, Math.max(gap.start, vertexIndex), gap.end);
    return geom ? offsetLineForSide(geom, paintSide) : null;
  }

  if (vertexIndex < containing.endIndex) {
    const geom = sliceStreetGeojson(coords, vertexIndex, containing.endIndex);
    return geom ? offsetLineForSide(geom, paintSide) : null;
  }
  return null;
}

/** Preview do traço enquanto arrasta no modo brush. */
export function computeBrushPreviewGeometry(
  street: Street,
  startLatitude: number,
  startLongitude: number,
  endLatitude: number,
  endLongitude: number,
  requestedSide: ApiPaintSide | StreetPaintSide,
  eraserMode: boolean,
): GeoJSON.LineString | null {
  const coords = streetCoords(street.geojson);
  const maxIndex = coords.length - 1;
  if (maxIndex < 1) return null;

  const side = normalizePaintSide(street, requestedSide);
  const paintSide = side === 'BOTH' ? detectClickSide(street, endLatitude, endLongitude) : (side as StreetPaintSide);

  let lo = closestVertexIndex(coords, startLatitude, startLongitude);
  let hi = closestVertexIndex(coords, endLatitude, endLongitude);
  if (lo === hi) {
    if (hi < maxIndex) hi += 1;
    else if (lo > 0) lo -= 1;
  }
  lo = Math.min(lo, hi);
  hi = Math.max(lo, hi);
  if (hi - lo < 1) return null;

  if (eraserMode) {
    const segments = street.paintSegments ?? [];
    const covering = segmentsCoveringSide(segments, paintSide).find(
      (s) => s.startIndex <= lo && s.endIndex >= hi,
    );
    if (!covering && !segments.some((s) => s.startIndex <= hi && s.endIndex >= lo && s.side === paintSide)) {
      return null;
    }
  }

  const geom = sliceStreetGeojson(coords, lo, hi);
  return geom ? offsetLineForSide(geom, paintSide) : null;
}

function normalizeBrushIndices(
  coords: Coord[],
  startLatitude: number,
  startLongitude: number,
  endLatitude: number,
  endLongitude: number,
): { lo: number; hi: number } | null {
  const maxIndex = coords.length - 1;
  if (maxIndex < 1) return null;
  let lo = closestVertexIndex(coords, startLatitude, startLongitude);
  let hi = closestVertexIndex(coords, endLatitude, endLongitude);
  if (lo === hi) {
    if (hi < maxIndex) hi += 1;
    else if (lo > 0) lo -= 1;
  }
  lo = Math.min(lo, hi);
  hi = Math.max(lo, hi);
  if (hi - lo < 1) return null;
  return { lo, hi };
}

export function simulatePaintRange(
  street: Street,
  microarea: { id: string; name: string; number: number; color: string },
  startLatitude: number,
  startLongitude: number,
  endLatitude: number,
  endLongitude: number,
  requestedSide: ApiPaintSide | StreetPaintSide,
  microareaLookup?: Map<string, { id: string; name: string; number: number; color: string }>,
): Street | null {
  const coords = streetCoords(street.geojson);
  const indices = normalizeBrushIndices(coords, startLatitude, startLongitude, endLatitude, endLongitude);
  if (!indices) return null;
  const maxIndex = coords.length - 1;

  let ranges = streetToRanges(street);
  const paintMode = normalizePaintSide(street, requestedSide);

  if (isDualSideStreet(street) && ranges.some((r) => r.side === 'FULL')) {
    ranges = expandFullSegmentsForDualSide(ranges);
  }

  const sidesToPaint: StreetPaintSide[] =
    paintMode === 'BOTH'
      ? ['LEFT', 'RIGHT']
      : paintMode === 'FULL' && isDualSideStreet(street)
        ? ['LEFT', 'RIGHT']
        : [paintMode as StreetPaintSide];

  const before = JSON.stringify(ranges);
  for (const side of sidesToPaint) {
    ranges = applyPaintRange(ranges, indices.lo, indices.hi, microarea.id, side, maxIndex);
  }
  ranges = mergeAdjacentSegments(ranges);
  if (JSON.stringify(ranges) === before) return null;

  const lookup = microareaLookup ?? new Map([[microarea.id, microarea]]);
  for (const seg of street.paintSegments ?? []) {
    if (seg.microarea && !lookup.has(seg.microareaId)) {
      lookup.set(seg.microareaId, seg.microarea);
    }
  }
  if (street.microarea && street.microareaId) {
    lookup.set(street.microareaId, street.microarea);
  }

  const paintSegments = rangesToPaintSegments(street, ranges, lookup);
  const microareaIdSynced = syncStreetMicroareaId(ranges, maxIndex);
  const primaryMa = microareaIdSynced ? lookup.get(microareaIdSynced) : microarea;

  return {
    ...street,
    microareaId: microareaIdSynced ?? undefined,
    microarea: primaryMa
      ? { id: primaryMa.id, name: primaryMa.name, number: primaryMa.number, color: primaryMa.color }
      : undefined,
    paintSegments,
  };
}

export function simulateUnpaintRange(
  street: Street,
  startLatitude: number,
  startLongitude: number,
  endLatitude: number,
  endLongitude: number,
  requestedSide: ApiPaintSide | StreetPaintSide,
  microareaLookup?: Map<string, { id: string; name: string; number: number; color: string }>,
): Street | null {
  const coords = streetCoords(street.geojson);
  const indices = normalizeBrushIndices(coords, startLatitude, startLongitude, endLatitude, endLongitude);
  if (!indices) return null;
  const maxIndex = coords.length - 1;

  let ranges = streetToRanges(street);
  const unpaintSide = normalizePaintSide(street, requestedSide);
  if (unpaintSide === 'BOTH') return null;

  if (isDualSideStreet(street) && ranges.some((r) => r.side === 'FULL')) {
    ranges = expandFullSegmentsForDualSide(ranges);
  }

  const { ranges: nextRanges, removed } = applyUnpaintRange(
    ranges,
    indices.lo,
    indices.hi,
    unpaintSide as StreetPaintSide,
  );
  if (removed.length === 0) return null;
  ranges = nextRanges;

  const lookup = microareaLookup ?? new Map<string, { id: string; name: string; number: number; color: string }>();
  for (const seg of street.paintSegments ?? []) {
    if (seg.microarea && !lookup.has(seg.microareaId)) {
      lookup.set(seg.microareaId, seg.microarea);
    }
  }
  if (street.microarea && street.microareaId) {
    lookup.set(street.microareaId, street.microarea);
  }

  const paintSegments = rangesToPaintSegments(street, ranges, lookup);
  const microareaIdSynced = syncStreetMicroareaId(ranges, maxIndex);
  const primaryMa = microareaIdSynced ? lookup.get(microareaIdSynced) : undefined;

  return {
    ...street,
    microareaId: microareaIdSynced ?? undefined,
    microarea: primaryMa
      ? { id: primaryMa.id, name: primaryMa.name, number: primaryMa.number, color: primaryMa.color }
      : undefined,
    paintSegments,
  };
}
