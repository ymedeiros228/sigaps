import type { QueryClient } from '@tanstack/react-query';
import {
  cadastrosApi,
  microareasApi,
  neighborhoodsApi,
  paintZonesApi,
  dashboardApi,
} from '../services/api';
import { fetchAllMapStreets } from './fetchAllStreets';
import { hydrateCadastrosCache } from './hydrateCadastrosCache';
import { CACHE, queryKeys } from './queryKeys';

/** Prefetch bundle de cadastros (1 request). */
export function prefetchCadastrosData(queryClient: QueryClient, municipalityId: string) {
  if (!municipalityId) return;
  void queryClient.prefetchQuery({
    queryKey: queryKeys.cadastrosBundle(municipalityId),
    queryFn: () =>
      cadastrosApi.getBundle(municipalityId).then((r) => {
        hydrateCadastrosCache(queryClient, municipalityId, r.data);
        return r.data;
      }),
    staleTime: CACHE.default,
  });
}

/** Prefetch leve: dashboard e mapa; cadastros em bundle separado. */
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
      queryClient.invalidateQueries({ queryKey: queryKeys.operationalChecklist(municipalityId) });
    } else {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
    dashboardInvalidateTimer = null;
  }, 3000);
}
