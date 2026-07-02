import type { QueryClient } from '@tanstack/react-query';
import { microareasApi, neighborhoodsApi, paintZonesApi, dashboardApi } from '../services/api';
import { fetchAllMapStreets } from './fetchAllStreets';
import { CACHE, queryKeys } from './queryKeys';

export async function prefetchMapData(queryClient: QueryClient, municipalityId: string) {
  // Carrega em etapas para não saturar o pooler do Supabase no cold start.
  await queryClient.prefetchQuery({
    queryKey: queryKeys.microareas(municipalityId),
    queryFn: () => microareasApi.list(municipalityId).then((r) => r.data),
    staleTime: CACHE.microareas,
  });
  await queryClient.prefetchQuery({
    queryKey: queryKeys.streetsMap(municipalityId),
    queryFn: () => fetchAllMapStreets(municipalityId),
    staleTime: CACHE.streets,
  });
  void Promise.all([
    queryClient.prefetchQuery({
      queryKey: queryKeys.dashboard(municipalityId),
      queryFn: () => dashboardApi.indicators(municipalityId).then((r) => r.data),
      staleTime: CACHE.dashboard,
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
