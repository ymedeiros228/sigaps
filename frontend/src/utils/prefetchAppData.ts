import type { QueryClient } from '@tanstack/react-query';
import {
  microareasApi,
  neighborhoodsApi,
  paintZonesApi,
  dashboardApi,
  placesApi,
  streetsApi,
} from '../services/api';
import { fetchCadastrosBundle } from './fetchCadastrosData';
import { hydrateCadastrosCache } from './hydrateCadastrosCache';
import { fetchAllMapStreets } from './fetchAllStreets';
import { CACHE, queryKeys } from './queryKeys';
import { VIEWPORT_STREETS_THRESHOLD } from '../hooks/useMapViewportStreets';

/** Prefetch cadastros com bundle + fallback (compatível com API antiga). */
export function prefetchCadastrosData(queryClient: QueryClient, municipalityId: string) {
  if (!municipalityId) return;
  void queryClient.prefetchQuery({
    queryKey: queryKeys.cadastrosBundle(municipalityId),
    queryFn: async () => {
      const bundle = await fetchCadastrosBundle(municipalityId);
      hydrateCadastrosCache(queryClient, municipalityId, bundle);
      return bundle;
    },
    staleTime: CACHE.default,
  });
}

/** Prefetch leve: dashboard e mapa. */
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
    queryClient.prefetchQuery({
      queryKey: queryKeys.places(municipalityId),
      queryFn: () => placesApi.list(municipalityId).then((r) => r.data),
      staleTime: CACHE.places,
    }),
  ]);

  const loadStreets = () => {
    void (async () => {
      try {
        const probe = await streetsApi.list(municipalityId, {
          limit: 1,
          mapOnly: true,
          page: 1,
        });
        const total = probe.data.total;
        void queryClient.prefetchQuery({
          queryKey: ['streets-probe', municipalityId],
          queryFn: () => Promise.resolve({ items: [], total }),
          staleTime: CACHE.streets,
        });
        if (total > VIEWPORT_STREETS_THRESHOLD) return;
        void queryClient.prefetchQuery({
          queryKey: queryKeys.streetsMap(municipalityId),
          queryFn: () => fetchAllMapStreets(municipalityId),
          staleTime: CACHE.streets,
        });
      } catch {
        /* prefetch opcional */
      }
    })();
  };

  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(loadStreets, { timeout: 8000 });
  } else {
    setTimeout(loadStreets, 2500);
  }
}

let dashboardInvalidateTimer: ReturnType<typeof setTimeout> | null = null;
let microareasInvalidateTimer: ReturnType<typeof setTimeout> | null = null;

/** Após pintar: refetch leve e espaçado — envelopes ficam no scheduleEnvelopeRefresh (12s). */
export function scheduleMicroareasInvalidate(queryClient: QueryClient, municipalityId: string) {
  if (microareasInvalidateTimer) clearTimeout(microareasInvalidateTimer);
  microareasInvalidateTimer = setTimeout(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.microareas(municipalityId) });
    microareasInvalidateTimer = null;
  }, 30_000);
}

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
  }, 30_000);
}
