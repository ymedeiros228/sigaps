import type { QueryClient } from '@tanstack/react-query';
import type { Microarea, Street, StreetPaintSegment, StreetPaintSide } from '../services/api';
import { queryKeys } from './queryKeys';
import { isDualSideStreet } from './streetPaintSegments';

type StreetsMapData = {
  items: Street[];
  total?: number;
};

type MicroareaRef = Pick<Microarea, 'id' | 'name' | 'number' | 'color'>;

/** Mescla ruas por id — preserva pinturas fora do viewport atual. */
export function mergeStreetsById(existing: Street[] | undefined, incoming: Street[]): Street[] {
  if (!existing?.length) return incoming;
  if (!incoming.length) return existing;
  const byId = new Map(existing.map((s) => [s.id, s]));
  for (const street of incoming) {
    byId.set(street.id, street);
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
  };
}

export function patchStreetInMapCache(
  queryClient: QueryClient,
  municipalityId: string,
  street: Street,
) {
  updateStreetsMapCache(queryClient, municipalityId, (items) => patchStreetList(items, street));
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
        return { ...s, microareaId: undefined, microarea: undefined, paintSegments: [] };
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
        };
      }
      return { ...s, paintSegments: segments };
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
        ? { ...s, microareaId: undefined, microarea: undefined, paintSegments: [] }
        : s,
    ),
  );
}
