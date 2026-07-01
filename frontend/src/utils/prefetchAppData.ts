import type { QueryClient } from '@tanstack/react-query';
import { microareasApi, neighborhoodsApi, paintZonesApi, streetsApi } from '../services/api';
import { CACHE, queryKeys } from './queryKeys';

export async function prefetchMapData(queryClient: QueryClient, municipalityId: string) {
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: queryKeys.microareas(municipalityId),
      queryFn: () => microareasApi.list(municipalityId).then((r) => r.data),
      staleTime: CACHE.microareas,
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.streetsMap(municipalityId),
      queryFn: () =>
        streetsApi.list(municipalityId, { limit: 2000, mapOnly: true }).then((r) => r.data),
      staleTime: CACHE.streets,
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.paintZones(municipalityId),
      queryFn: () => paintZonesApi.list(municipalityId).then((r) => r.data),
      staleTime: CACHE.paintZones,
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.neighborhoods(municipalityId),
      queryFn: () => neighborhoodsApi.list(municipalityId).then((r) => r.data),
      staleTime: CACHE.neighborhoods,
    }),
  ]);
}

/** Invalida dashboard com debounce durante pintura rápida */
let dashboardInvalidateTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleDashboardInvalidate(queryClient: QueryClient, municipalityId?: string) {
  if (dashboardInvalidateTimer) clearTimeout(dashboardInvalidateTimer);
  dashboardInvalidateTimer = setTimeout(() => {
    if (municipalityId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(municipalityId) });
    } else {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
    dashboardInvalidateTimer = null;
  }, 3000);
}
