import type { QueryClient } from '@tanstack/react-query';
import type { Microarea, Street, StreetPaintSegment, StreetPaintSide } from '../services/api';
import { queryKeys } from './queryKeys';
import { isDualSideStreet, streetCoords } from './streetPaintSegments';

type StreetsMapData = {
  items: Street[];
  total?: number;
};

type MicroareaRef = Pick<Microarea, 'id' | 'name' | 'number' | 'color'>;

export type StreetWithLocalRev = Street & { _localRev?: number };

function paintScore(street: Street): number {
  return (street.paintSegments?.length ?? 0) * 10 + (street.microareaId ? 1 : 0);
}

function mergeStreetRecord(existing: Street, incoming: Street): Street {
  const prev = existing as StreetWithLocalRev;
  const next = incoming as StreetWithLocalRev;
  const existingRev = prev._localRev ?? 0;
  const incomingRev = next._localRev ?? 0;

  if (existingRev > incomingRev) return existing;
  if (incomingRev > existingRev) return incoming;

  const existingScore = paintScore(existing);
  const incomingScore = paintScore(incoming);
  if (existingScore > incomingScore) {
    const merged: StreetWithLocalRev = {
      ...incoming,
      microareaId: existing.microareaId ?? incoming.microareaId,
      microarea: existing.microarea ?? incoming.microarea,
      paintSegments:
        (existing.paintSegments?.length ?? 0) >= (incoming.paintSegments?.length ?? 0)
          ? existing.paintSegments
          : incoming.paintSegments,
      geojson:
        streetCoords(existing.geojson).length >= streetCoords(incoming.geojson).length
          ? existing.geojson
          : incoming.geojson,
      _localRev: existingRev,
    };
    return merged;
  }
  return incoming;
}

/** Mescla ruas por id — preserva pinturas locais mais recentes ou mais completas. */
export function mergeStreetsById(existing: Street[] | undefined, incoming: Street[]): Street[] {
  if (!existing?.length) return incoming;
  if (!incoming.length) return existing;
  const byId = new Map(existing.map((s) => [s.id, s]));
  for (const street of incoming) {
    const prev = byId.get(street.id);
    byId.set(street.id, prev ? mergeStreetRecord(prev, street) : street);
  }
  return Array.from(byId.values());
}

function patchStreetList(items: Street[], street: Street): Street[] {
  const idx = items.findIndex((s) => s.id === street.id);
  if (idx < 0) return [...items, street];
  return items.map((s) => (s.id === street.id ? { ...s, ...street } : s));
}

function updateStreetsMapCache(
  queryClient: QueryClient,
  municipalityId: string,
  updater: (items: Street[]) => Street[],
) {
  const apply = (old: StreetsMapData | undefined): StreetsMapData | undefined => {
    if (!old?.items) return old;
    return { ...old, items: updater(old.items) };
  };

  queryClient.setQueryData<StreetsMapData>(queryKeys.streetsMap(municipalityId), apply);
  queryClient.setQueriesData<StreetsMapData>(
    { queryKey: ['streets-viewport', municipalityId] },
    apply,
  );
}

export async function cancelStreetMapQueries(
  queryClient: QueryClient,
  municipalityId: string,
) {
  await queryClient.cancelQueries({ queryKey: queryKeys.streetsMap(municipalityId) });
  await queryClient.cancelQueries({ queryKey: ['streets-viewport', municipalityId] });
}

function buildOptimisticPaintSegments(
  street: Street,
  microarea: MicroareaRef,
): StreetPaintSegment[] {
  const coords = street.geojson?.coordinates ?? [];
  const maxIndex = Math.max(0, coords.length - 1);
  const microareaRef = {
    id: microarea.id,
    name: microarea.name,
    number: microarea.number,
    color: microarea.color,
  };

  const makeSeg = (side: StreetPaintSide, suffix: string): StreetPaintSegment => ({
    id: `optimistic:${street.id}:${suffix}`,
    startIndex: 0,
    endIndex: maxIndex,
    side,
    microareaId: microarea.id,
    geojson: street.geojson,
    microarea: microareaRef,
  });

  if (isDualSideStreet(street)) {
    return [makeSeg('LEFT', 'left'), makeSeg('RIGHT', 'right')];
  }
  return [makeSeg('FULL', 'full')];
}

export function buildOptimisticAssignStreet(street: Street, microarea: MicroareaRef): Street {
  return {
    ...street,
    microareaId: microarea.id,
    microarea: {
      id: microarea.id,
      name: microarea.name,
      number: microarea.number,
      color: microarea.color,
    },
    paintSegments: buildOptimisticPaintSegments(street, microarea),
    _localRev: Date.now(),
  } as StreetWithLocalRev;
}

export function patchStreetInMapCache(
  queryClient: QueryClient,
  municipalityId: string,
  street: Street,
) {
  const stamped: StreetWithLocalRev = { ...street, _localRev: Date.now() };
  updateStreetsMapCache(queryClient, municipalityId, (items) => patchStreetList(items, stamped));
}

export function patchStreetsMicroarea(
  queryClient: QueryClient,
  municipalityId: string,
  streetIds: string[],
  microarea: MicroareaRef | null,
) {
  updateStreetsMapCache(queryClient, municipalityId, (items) =>
    items.map((s) => {
      if (!streetIds.includes(s.id)) return s;
      if (!microarea) {
        return {
          ...s,
          microareaId: undefined,
          microarea: undefined,
          paintSegments: [],
          _localRev: Date.now(),
        } as StreetWithLocalRev;
      }
      return buildOptimisticAssignStreet(s, microarea);
    }),
  );
}

export function clearMicroareaStreets(
  queryClient: QueryClient,
  municipalityId: string,
  microareaId: string,
) {
  updateStreetsMapCache(queryClient, municipalityId, (items) =>
    items.map((s) => {
      const hadAssignment =
        s.microareaId === microareaId ||
        (s.paintSegments ?? []).some((seg) => seg.microareaId === microareaId);
      if (!hadAssignment) return s;

      const segments = (s.paintSegments ?? []).filter((seg) => seg.microareaId !== microareaId);
      if (s.microareaId === microareaId) {
        return {
          ...s,
          microareaId: segments[0]?.microareaId,
          microarea: segments[0]?.microarea,
          paintSegments: segments,
          _localRev: Date.now(),
        } as StreetWithLocalRev;
      }
      return { ...s, paintSegments: segments, _localRev: Date.now() } as StreetWithLocalRev;
    }),
  );
}

export function clearAllStreetsMicroarea(
  queryClient: QueryClient,
  municipalityId: string,
) {
  updateStreetsMapCache(queryClient, municipalityId, (items) =>
    items.map((s) =>
      s.microareaId || s.paintSegments?.length
        ? ({
            ...s,
            microareaId: undefined,
            microarea: undefined,
            paintSegments: [],
            _localRev: Date.now(),
          } as StreetWithLocalRev)
        : s,
    ),
  );
}
