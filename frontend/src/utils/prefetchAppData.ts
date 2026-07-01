import type { QueryClient } from '@tanstack/react-query';
import { microareasApi, streetsApi } from '../services/api';

export async function prefetchMapData(queryClient: QueryClient, municipalityId: string) {
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ['microareas', municipalityId],
      queryFn: () => microareasApi.list(municipalityId).then((r) => r.data),
      staleTime: 5 * 60_000,
    }),
    queryClient.prefetchQuery({
      queryKey: ['streets', municipalityId],
      queryFn: () => streetsApi.list(municipalityId, { limit: 2000, mapOnly: true }).then((r) => r.data),
      staleTime: 60_000,
    }),
  ]);
}
