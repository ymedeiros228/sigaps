import { StreetPaintSide } from '@prisma/client';

type Coord = [number, number];

export type SegmentRange = {
  startIndex: number;
  endIndex: number;
  microareaId: string;
  side: StreetPaintSide;
};

export { StreetPaintSide };

export function streetCoords(geojson: unknown): Coord[] {
  const g = geojson as { type?: string; coordinates?: unknown };
  if (g?.type !== 'LineString' || !Array.isArray(g.coordinates)) return [];
  return g.coordinates as Coord[];
}

export function isDualSideStreet(street: {
  streetType?: string | null;
  osmId?: bigint | string | null;
}): boolean {
  const type = (street.streetType ?? '').toLowerCase();
  if (
    type.includes('terra') ||
    type.includes('estrada de terra') ||
    type.includes('caminho') ||
    type.includes('trilha')
  ) {
    return false;
  }
  return street.osmId != null;
}

export function sliceStreetGeojson(coords: Coord[], startIndex: number, endIndex: number) {
  const start = Math.max(0, Math.min(startIndex, endIndex));
  const end = Math.min(coords.length - 1, Math.max(startIndex, endIndex));
  if (end - start < 1) return null;
  return {
    type: 'LineString' as const,
    coordinates: coords.slice(start, end + 1),
  };
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

export function expandFullSegmentsForDualSide(ranges: SegmentRange[]): SegmentRange[] {
  const out: SegmentRange[] = [];
  for (const range of ranges) {
    if (range.side === StreetPaintSide.FULL) {
      out.push({ ...range, side: StreetPaintSide.LEFT });
      out.push({ ...range, side: StreetPaintSide.RIGHT });
    } else {
      out.push({ ...range });
    }
  }
  return mergeAdjacentSegments(out);
}

export function segmentsForSide(
  segments: SegmentRange[],
  side: StreetPaintSide,
): SegmentRange[] {
  if (side === StreetPaintSide.FULL) {
    return segments.filter((s) => s.side === StreetPaintSide.FULL);
  }
  return segments.filter(
    (s) => s.side === side || s.side === StreetPaintSide.FULL,
  );
}

export function applyFullSidePaint(
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

/** Pinta só o intervalo [startIndex, endIndex] no lado indicado (modo arrastar). */
export function applyPaintRange(
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

/** Remove pintura no intervalo [startIndex, endIndex] (borracha arrastando). */
export function applyUnpaintRange(
  allRanges: SegmentRange[],
  startIndex: number,
  endIndex: number,
  unpaintSide: StreetPaintSide,
  filterMicroareaId?: string,
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
    if (filterMicroareaId && seg.microareaId !== filterMicroareaId) {
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

export function applyPaintOnSide(
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

/** Remove o trecho pintado que contém o vértice (borracha). */
export function applyUnpaintOnSide(
  allRanges: SegmentRange[],
  vertexIndex: number,
  unpaintSide: StreetPaintSide,
  filterMicroareaId?: string,
): { ranges: SegmentRange[]; removed: SegmentRange | null } {
  const containing = allRanges.find(
    (s) =>
      s.side === unpaintSide &&
      s.startIndex <= vertexIndex &&
      s.endIndex >= vertexIndex &&
      (!filterMicroareaId || s.microareaId === filterMicroareaId),
  );
  if (!containing) {
    return { ranges: allRanges, removed: null };
  }
  return {
    ranges: mergeAdjacentSegments(allRanges.filter((s) => s !== containing)),
    removed: containing,
  };
}

export function mergeAdjacentSegments(segments: SegmentRange[]): SegmentRange[] {
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

export function syncStreetMicroareaId(
  segments: SegmentRange[],
  maxIndex: number,
): string | null {
  if (segments.length === 0) return null;

  const fullOnly = segments.every((s) => s.side === StreetPaintSide.FULL);
  if (fullOnly) {
    const unique = new Set(segments.map((s) => s.microareaId));
    if (
      segments.length === 1 &&
      segments[0].startIndex === 0 &&
      segments[0].endIndex === maxIndex
    ) {
      return segments[0].microareaId;
    }
    if (
      unique.size === 1 &&
      segments[0].startIndex === 0 &&
      segments[0].endIndex === maxIndex
    ) {
      return segments[0].microareaId;
    }
    return null;
  }

  const left = segments.filter((s) => s.side === StreetPaintSide.LEFT);
  const right = segments.filter((s) => s.side === StreetPaintSide.RIGHT);
  if (left.length === 0 || right.length === 0) return null;

  const covers = (list: SegmentRange[]) => {
    if (list.length !== 1) return false;
    return list[0].startIndex === 0 && list[0].endIndex === maxIndex;
  };

  if (!covers(left) || !covers(right)) return null;
  if (left[0].microareaId !== right[0].microareaId) return null;
  return left[0].microareaId;
}

export function normalizePaintSide(
  street: { streetType?: string | null; osmId?: bigint | string | null },
  requested?: string,
): StreetPaintSide | 'BOTH' {
  if (!isDualSideStreet(street)) return StreetPaintSide.FULL;
  if (requested === 'BOTH') return 'BOTH';
  if (requested === 'FULL') return isDualSideStreet(street) ? 'BOTH' : StreetPaintSide.FULL;
  if (requested === 'LEFT') return StreetPaintSide.LEFT;
  if (requested === 'RIGHT') return StreetPaintSide.RIGHT;
  return StreetPaintSide.LEFT;
}
