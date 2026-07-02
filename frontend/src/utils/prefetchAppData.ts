import type { QueryClient } from '@tanstack/react-query';
import { microareasApi, neighborhoodsApi, paintZonesApi, dashboardApi } from '../services/api';
import { fetchAllMapStreets } from './fetchAllStreets';
import { CACHE, queryKeys } from './queryKeys';

/** Prefetch leve: dashboard e cadastros primeiro; malha de ruas em idle. */
export function prefetchMapData(queryClient: QueryClient, municipalityId: string) {
  void Promise.all([
    queryClient.prefetchQuery({
      queryKey: queryKeys.dashboard(municipalityId),
      queryFn: () => dashboardApi.indicators(municipalityId).then((r) => r.data),
      staleTime: CACHE.dashboard,
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.microareas(municipalityId),
      queryFn: () => microareasApi.list(municipalityId).then((r) => r.data),
      staleTime: CACHE.microareas,
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

  const loadStreets = () => {
    void queryClient.prefetchQuery({
      queryKey: queryKeys.streetsMap(municipalityId),
      queryFn: () => fetchAllMapStreets(municipalityId),
      staleTime: CACHE.streets,
    });
  };

  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(loadStreets, { timeout: 8000 });
  } else {
    setTimeout(loadStreets, 2500);
  }
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
