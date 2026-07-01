import type { QueryClient } from '@tanstack/react-query';
import type { Microarea } from '../services/api';
import { queryKeys } from './queryKeys';

type StreetsMapData = {
  items: Array<{
    id: string;
    microareaId?: string | null;
    microarea?: { id: string; name: string; number: number; color: string };
    [key: string]: unknown;
  }>;
  total?: number;
};

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
          return { ...s, microareaId: null, microarea: undefined };
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
        s.microareaId ? { ...s, microareaId: null, microarea: undefined } : s,
      ),
    };
  });
}
