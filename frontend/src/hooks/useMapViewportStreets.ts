import { useCallback, useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import type { LatLngBounds } from 'leaflet';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { streetsApi, type Street } from '../services/api';
import { fetchAllMapStreets } from '../utils/fetchAllStreets';
import { mergeStreetsById } from '../utils/streetsCache';
import { useDebouncedValue } from './useDebouncedValue';
import { CACHE, queryKeys } from '../utils/queryKeys';
import { cloudQueryRetryDelay, shouldRetryCloudQuery } from '../utils/queryRetry';

/** Acima disso o FE considera “mapa grande” (UI/probe). */
export const VIEWPORT_STREETS_THRESHOLD = 800;
/** Só ativa carregamento por bbox acima deste total — evita quebrar municípios ~800–1200 ruas. */
export const VIEWPORT_LOAD_ACTIVATE_ABOVE = 1200;

type StreetsMapData = { items: Street[]; total: number };

function boundsKey(bounds: LatLngBounds): string {
  const pad = 0.02;
  return [
    (bounds.getWest() - pad).toFixed(4),
    (bounds.getSouth() - pad).toFixed(4),
    (bounds.getEast() + pad).toFixed(4),
    (bounds.getNorth() + pad).toFixed(4),
  ].join(',');
}

function mergeViewportStreets(existing: Street[] | undefined, incoming: Street[]): Street[] {
  return mergeStreetsById(existing, incoming);
}

async function fetchViewportStreets(
  municipalityId: string,
  bounds: LatLngBounds,
): Promise<StreetsMapData> {
  const pad = 0.02;
  const res = await streetsApi.list(municipalityId, {
    limit: 5000,
    mapOnly: true,
    page: 1,
    geoPrecision: 5,
    bbox: [
      bounds.getWest() - pad,
      bounds.getSouth() - pad,
      bounds.getEast() + pad,
      bounds.getNorth() + pad,
    ].join(','),
  });
  return { items: res.data.items, total: res.data.total };
}

/** Reporta bounds do mapa Leaflet para carregamento por viewport. */
export function MapBoundsReporter({
  onBounds,
}: {
  onBounds: (bounds: LatLngBounds) => void;
}) {
  const map = useMap();
  const onBoundsRef = useRef(onBounds);
  onBoundsRef.current = onBounds;

  useEffect(() => {
    const report = () => onBoundsRef.current(map.getBounds());
    report();
    map.on('moveend', report);
    map.on('zoomend', report);
    return () => {
      map.off('moveend', report);
      map.off('zoomend', report);
    };
  }, [map]);

  return null;
}

export function useMapViewportStreets(municipalityId: string | null) {
  const queryClient = useQueryClient();
  const [mapBounds, setMapBounds] = useState<LatLngBounds | null>(null);
  const debouncedBounds = useDebouncedValue(mapBounds, 300);
  const boundsStable = debouncedBounds ? boundsKey(debouncedBounds) : null;

  const probeQuery = useQuery({
    queryKey: ['streets-probe', municipalityId],
    queryFn: () =>
      streetsApi
        .list(municipalityId!, { limit: 1, mapOnly: true, page: 1 })
        .then((r) => r.data),
    enabled: !!municipalityId,
    staleTime: CACHE.streets,
  });

  const streetsTotal = probeQuery.data?.total ?? 0;
  const useViewport =
    streetsTotal > VIEWPORT_STREETS_THRESHOLD &&
    streetsTotal > VIEWPORT_LOAD_ACTIVATE_ABOVE;
  const [viewportFallback, setViewportFallback] = useState(false);

  useEffect(() => {
    setViewportFallback(false);
  }, [municipalityId]);

  const effectiveUseViewport = useViewport && !viewportFallback;

  useEffect(() => {
    if (!municipalityId) return;
    queryClient.removeQueries({ queryKey: queryKeys.streetsMap(municipalityId) });
  }, [municipalityId, queryClient]);

  const fullQuery = useQuery({
    queryKey: queryKeys.streetsMap(municipalityId!),
    queryFn: () => fetchAllMapStreets(municipalityId!),
    enabled: !!municipalityId && probeQuery.isSuccess && !effectiveUseViewport,
    staleTime: CACHE.streets,
    gcTime: 15 * 60_000,
    retry: (count, err) => shouldRetryCloudQuery(count, err),
    retryDelay: cloudQueryRetryDelay,
  });

  const viewportCacheQuery = useQuery({
    queryKey: queryKeys.streetsMap(municipalityId!),
    queryFn: async () => {
      const existing = queryClient.getQueryData<StreetsMapData>(
        queryKeys.streetsMap(municipalityId!),
      );
      return existing ?? { items: [] as Street[], total: streetsTotal };
    },
    enabled: !!municipalityId && probeQuery.isSuccess && effectiveUseViewport,
    staleTime: Infinity,
    gcTime: 15 * 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const viewportQuery = useQuery({
    queryKey: ['streets-viewport', municipalityId, boundsStable],
    queryFn: () => fetchViewportStreets(municipalityId!, debouncedBounds!),
    enabled: !!municipalityId && effectiveUseViewport && !!debouncedBounds,
    staleTime: 5_000,
    gcTime: 5 * 60_000,
    retry: (count, err) => shouldRetryCloudQuery(count, err),
    retryDelay: cloudQueryRetryDelay,
  });

  useEffect(() => {
    if (viewportQuery.isError && useViewport && !viewportFallback) {
      setViewportFallback(true);
    }
  }, [viewportQuery.isError, useViewport, viewportFallback]);

  useEffect(() => {
    if (!municipalityId || !effectiveUseViewport || !viewportQuery.data) return;
    const key = queryKeys.streetsMap(municipalityId);
    queryClient.setQueryData<StreetsMapData>(key, (old) => ({
      total: streetsTotal,
      items: mergeViewportStreets(old?.items, viewportQuery.data.items),
    }));
  }, [municipalityId, effectiveUseViewport, viewportQuery.data, streetsTotal, queryClient]);

  const streetsData = effectiveUseViewport ? viewportCacheQuery.data : fullQuery.data;
  const isLoading =
    probeQuery.isLoading ||
    (effectiveUseViewport
      ? viewportCacheQuery.isLoading && !(viewportCacheQuery.data as StreetsMapData | undefined)?.items?.length
      : fullQuery.isLoading);
  const isFetching = effectiveUseViewport ? viewportQuery.isFetching : fullQuery.isFetching;
  const isError = effectiveUseViewport ? viewportQuery.isError && !viewportFallback : fullQuery.isError;
  const refetch = effectiveUseViewport ? viewportQuery.refetch : fullQuery.refetch;

  const onBounds = useCallback((bounds: LatLngBounds) => {
    setMapBounds(bounds);
  }, []);

  return {
    streetsData,
    streetsTotal,
    useViewport: effectiveUseViewport,
    isLoading,
    isFetching,
    isError,
    refetch,
    onBounds,
  };
}
