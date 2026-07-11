import type { QueryClient } from '@tanstack/react-query';
import type { Microarea, Street } from '../services/api';
import { queryKeys } from './queryKeys';

type StreetsMapData = {
  items: Street[];
  total?: number;
};

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

export function patchStreetInMapCache(
  queryClient: QueryClient,
  municipalityId: string,
  street: Street,
) {
  const key = queryKeys.streetsMap(municipalityId);
  queryClient.setQueryData<StreetsMapData>(key, (old) => {
    if (!old?.items) return old;
    return {
      ...old,
      items: patchStreetList(old.items, street),
    };
  });

  // Mantém caches por viewport sincronizados (modo malha grande).
  queryClient.setQueriesData<StreetsMapData>(
    { queryKey: ['streets-viewport', municipalityId] },
    (old) => {
      if (!old?.items) return old;
      return {
        ...old,
        items: patchStreetList(old.items, street),
      };
    },
  );
}

export function patchStreetsMicroarea(
  queryClient: QueryClient,
  municipalityId: string,
  streetIds: string[],
  microarea: Pick<Microarea, 'id' | 'name' | 'number' | 'color'> | null,
) {
  const key = queryKeys.streetsMap(municipalityId);
  queryClient.setQueryData<StreetsMapData>(key, (old) => {
    if (!old?.items) return old;
    return {
      ...old,
      items: old.items.map((s) => {
        if (!streetIds.includes(s.id)) return s;
        if (!microarea) {
          return { ...s, microareaId: undefined, microarea: undefined, paintSegments: [] };
        }
        return {
          ...s,
          microareaId: microarea.id,
          microarea: {
            id: microarea.id,
            name: microarea.name,
            number: microarea.number,
            color: microarea.color,
          },
          paintSegments: [],
        };
      }),
    };
  });
}

export function clearMicroareaStreets(
  queryClient: QueryClient,
  municipalityId: string,
  microareaId: string,
) {
  const key = queryKeys.streetsMap(municipalityId);
  queryClient.setQueryData<StreetsMapData>(key, (old) => {
    if (!old?.items) return old;
    return {
      ...old,
      items: old.items.map((s) => {
        const segments = (s.paintSegments ?? []).filter((seg) => seg.microareaId !== microareaId);
        const clearedWhole = s.microareaId === microareaId;
        if (!clearedWhole && segments.length === (s.paintSegments?.length ?? 0)) return s;
        return {
          ...s,
          microareaId: clearedWhole ? undefined : s.microareaId,
          microarea: clearedWhole ? undefined : s.microarea,
          paintSegments: segments,
        };
      }),
    };
  });
}

export function clearAllStreetsMicroarea(
  queryClient: QueryClient,
  municipalityId: string,
) {
  const key = queryKeys.streetsMap(municipalityId);
  queryClient.setQueryData<StreetsMapData>(key, (old) => {
    if (!old?.items) return old;
    return {
      ...old,
      items: old.items.map((s) =>
        s.microareaId || s.paintSegments?.length
          ? { ...s, microareaId: undefined, microarea: undefined, paintSegments: [] }
          : s,
      ),
    };
  });
}
