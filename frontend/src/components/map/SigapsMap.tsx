import { useEffect, useRef, useState, useCallback, useMemo, useDeferredValue } from 'react';
import { TileLayer, ScaleControl, ZoomControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Box,
  CircularProgress,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  microareasApi,
  osmApi,
  paintZonesApi,
  streetsApi,
  type Street,
} from '../../services/api';
import { useMunicipalityId } from '../../hooks/useMunicipalityId';
import { useAppStore, useMapStore, useAuthStore } from '../../store';
import { StreetsLayer, MapCenterController } from './StreetsLayer';
import { MapInteractionController } from './MapInteractionController';
import { MapToolbar } from './MapToolbar';
import { StreetPanel } from './StreetPanel';
import { MapLegend } from './MapLegend';
import { MicroareaPolygonsLayer } from './MicroareaPolygonsLayer';
import { PaintGuidePanel } from './PaintGuidePanel';
import { MapDivisionsPanel } from './MapDivisionsPanel';
import { PaintZonesLayer } from './PaintZonesLayer';
import { DivisionMapClickHandler } from './DivisionMapClickHandler';
import { MapEmptyState } from './MapEmptyState';
import { SelectionBar } from './SelectionBar';
import { getApiErrorMessage, isConflictError, getConflictMessage } from '../../utils/apiError';
import { canImportStreets } from '../../utils/permissions';
import { lineStringCentroid } from '../../utils/geo';
import { fixLineString, prepareStreetsForMap } from '../../utils/streetSearch';
import { CACHE, queryKeys } from '../../utils/queryKeys';
import { scheduleDashboardInvalidate } from '../../utils/prefetchAppData';
import { patchStreetsMicroarea, clearAllStreetsMicroarea } from '../../utils/streetsCache';
import { cloudQueryRetryDelay, shouldRetryCloudQuery } from '../../utils/queryRetry';
import { LeafletMap } from './LeafletMap';

const PASSAGEM_FRANCA = { lat: -6.1828, lng: -43.7869, zoom: 14 };

const TILE_LAYERS = {
  map: {
    name: 'Mapa',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap',
  },
  satellite: {
    name: 'Satélite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri',
  },
  terrain: {
    name: 'Relevo',
    url: 'https://tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenTopoMap',
  },
  hybrid: {
    name: 'Híbrido',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri + OSM',
  },
};

export function SigapsMap() {
  const queryClient = useQueryClient();
  const municipalityId = useMunicipalityId();
  const setMicroareas = useAppStore((s) => s.setMicroareas);
  const microareas = useAppStore((s) => s.microareas);
  const baseLayer = useMapStore((s) => s.baseLayer);
  const paintMode = useMapStore((s) => s.paintMode);
  const eraserMode = useMapStore((s) => s.eraserMode);
  const divisionDraft = useMapStore((s) => s.divisionDraft);
  const selectedMicroareaId = useMapStore((s) => s.selectedMicroareaId);
  const selectedStreetIds = useMapStore((s) => s.selectedStreetIds);
  const toggleStreetSelection = useMapStore((s) => s.toggleStreetSelection);
  const clearSelection = useMapStore((s) => s.clearSelection);
  const setHighlightedStreet = useMapStore((s) => s.setHighlightedStreet);
  const addDragPaintId = useMapStore((s) => s.addDragPaintId);
  const clearDragPaintIds = useMapStore((s) => s.clearDragPaintIds);
  const setPaintMode = useMapStore((s) => s.setPaintMode);
  const user = useAuthStore((s) => s.user);
  const canImport = canImportStreets(user?.role);
  const [selectedStreet, setSelectedStreet] = useState<Street | null>(null);
  const [conflictMsg, setConflictMsg] = useState<string | null>(null);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{ message: string; severity: 'success' | 'info' | 'warning' } | null>(null);
  const [lastPaintAction, setLastPaintAction] = useState<string | null>(null);
  const [importFailed, setImportFailed] = useState(false);
  const [streetsAutoRetrying, setStreetsAutoRetrying] = useState(false);
  const streetsAutoRetryCount = useRef(0);
  const pendingPaintRef = useRef<Set<string>>(new Set());
  const pendingUnpaintRef = useRef<Set<string>>(new Set());
  const lastAssignIdsRef = useRef<string[]>([]);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const autoImportAttempted = useRef(false);
  const setSelectedMicroarea = useMapStore((s) => s.setSelectedMicroarea);

  const { data: microareasData = [] } = useQuery({
    queryKey: queryKeys.microareas(municipalityId!),
    queryFn: () =>
      microareasApi.list(municipalityId!).then((r) => r.data),
    enabled: !!municipalityId,
    staleTime: CACHE.microareas,
  });

  const { data: paintZones = [] } = useQuery({
    queryKey: queryKeys.paintZones(municipalityId!),
    queryFn: () => paintZonesApi.list(municipalityId!).then((r) => r.data),
    enabled: !!municipalityId,
    staleTime: CACHE.paintZones,
  });

  useEffect(() => {
    if (microareasData.length > 0) {
      setMicroareas(microareasData);
    }
  }, [microareasData, setMicroareas]);

  const { data: streetsData, isLoading, isError: streetsLoadError, isFetching: streetsFetching, refetch: refetchStreets } = useQuery({
    queryKey: queryKeys.streetsMap(municipalityId!),
    queryFn: () =>
      streetsApi.list(municipalityId!, { limit: 2000, mapOnly: true }).then((r) => r.data),
    enabled: !!municipalityId,
    staleTime: CACHE.streets,
    gcTime: 15 * 60_000,
    retry: (count, err) => shouldRetryCloudQuery(count, err),
    retryDelay: cloudQueryRetryDelay,
  });

  const streetCount = streetsData?.items?.length ?? 0;
  const streetsTotal = streetsData?.total ?? streetCount;
  const streets = useMemo(
    () => prepareStreetsForMap(streetsData?.items ?? []),
    [streetsData?.items],
  );
  const deferredStreets = useDeferredValue(streets);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'Escape' && paintMode) {
        setPaintMode(false);
        setSnackbar({ message: 'Modo pintar desativado', severity: 'info' });
        return;
      }
      if (e.key === 'p' || e.key === 'P') {
        if (microareas.length === 0 || streetCount === 0) return;
        useMapStore.getState().setEraserMode(false);
        if (!selectedMicroareaId && microareas.length > 0) {
          setSelectedMicroarea(microareas[0].id);
        }
        setPaintMode(true);
        setSnackbar({ message: 'Modo pintar (P)', severity: 'info' });
      }
      if (e.key === 'e' || e.key === 'E') {
        const painted = streets.some((s) => s.microareaId);
        if (!painted) return;
        useMapStore.getState().setEraserMode(true);
        setSnackbar({ message: 'Modo apagar (E)', severity: 'info' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paintMode, setPaintMode, microareas, streetCount, selectedMicroareaId, setSelectedMicroarea, streets]);

  const getMicroarea = useCallback(
    (id: string) => microareas.find((m) => m.id === id),
    [microareas],
  );

  const assignMutation = useMutation({
    mutationFn: ({
      streetIds,
      microareaId,
      forceTransfer,
    }: {
      streetIds: string[];
      microareaId: string;
      forceTransfer?: boolean;
    }) => streetsApi.assign(streetIds, microareaId, forceTransfer),
    onMutate: async (variables) => {
      if (!municipalityId) return;
      const streetsKey = queryKeys.streetsMap(municipalityId);
      await queryClient.cancelQueries({ queryKey: streetsKey });
      const previous = queryClient.getQueryData(streetsKey);
      const ma = getMicroarea(variables.microareaId);

      queryClient.setQueryData(streetsKey, (old: typeof streetsData) => {
        if (!old?.items || !ma) return old;
        return {
          ...old,
          items: old.items.map((s) =>
            variables.streetIds.includes(s.id)
              ? {
                  ...s,
                  microareaId: ma.id,
                  microarea: { id: ma.id, name: ma.name, number: ma.number, color: ma.color },
                }
              : s,
          ),
        };
      });

      return { previous };
    },
    onSuccess: (_data, variables) => {
      if (municipalityId) {
        scheduleDashboardInvalidate(queryClient, municipalityId);
      }
      setConflictMsg(null);
      setConflictOpen(false);

      const ma = getMicroarea(variables.microareaId);
      const count = variables.streetIds.length;
      const msg = count === 1
        ? `Rua vinculada à ${ma?.name ?? 'microárea'}!`
        : `${count} ruas vinculadas à ${ma?.name ?? 'microárea'}!`;
      setLastPaintAction(msg);
      setSnackbar({ message: msg, severity: 'success' });
    },
    onError: (err, _vars, context) => {
      if (context?.previous && municipalityId) {
        queryClient.setQueryData(queryKeys.streetsMap(municipalityId), context.previous);
      }
      if (isConflictError(err)) {
        setConflictMsg(getConflictMessage(err));
        setConflictOpen(true);
      } else {
        setSnackbar({ message: getApiErrorMessage(err, 'Não foi possível vincular a rua.'), severity: 'warning' });
      }
    },
  });

  const importMutation = useMutation({
    mutationFn: () => osmApi.import(municipalityId!),
    onMutate: () => {
      setImportFailed(false);
    },
    onSuccess: (res) => {
      const status = res.data?.status;
      if (status === 'in_progress') return;

      queryClient.invalidateQueries({ queryKey: queryKeys.streetsMap(municipalityId!) });
      const imported = res.data?.imported ?? 0;
      const source = res.data?.source;

      if (microareas.length > 0 && !selectedMicroareaId) {
        setSelectedMicroarea(microareas[0].id);
      }
      if (imported > 0 || (res.data?.total ?? 0) > 0) {
        setPaintMode(true);
        setSnackbar({
          message:
            source === 'bundled'
              ? `${imported} vias de Passagem Franca (inclui estradas de terra). Pode pintar!`
              : `${imported || res.data?.total} ruas prontas! Escolha a microárea e clique nas ruas.`,
          severity: 'success',
        });
      }
    },
    onError: (err) => {
      setImportFailed(true);
      setSnackbar({
        message: getApiErrorMessage(
          err,
          'Não foi possível carregar as ruas. Rode: npx prisma db seed no backend.',
        ),
        severity: 'warning',
      });
    },
  });

  useEffect(() => {
    if (!importMutation.isPending || streetCount > 0) return;
    const timer = window.setInterval(() => {
      if (municipalityId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.streetsMap(municipalityId) });
      }
    }, 20000);
    return () => window.clearInterval(timer);
  }, [importMutation.isPending, streetCount, municipalityId, queryClient]);

  useEffect(() => {
    if (!municipalityId || streetCount > 0 || streetsFetching || importMutation.isPending) return;
    if (!streetsLoadError) {
      streetsAutoRetryCount.current = 0;
      setStreetsAutoRetrying(false);
      return;
    }
    if (streetsAutoRetryCount.current >= 4) {
      setStreetsAutoRetrying(false);
      return;
    }

    const delay = 3_000 * 2 ** streetsAutoRetryCount.current;
    setStreetsAutoRetrying(true);
    const timer = window.setTimeout(() => {
      streetsAutoRetryCount.current += 1;
      void refetchStreets();
    }, delay);

    return () => window.clearTimeout(timer);
  }, [municipalityId, streetCount, streetsFetching, streetsLoadError, importMutation.isPending, refetchStreets]);

  useEffect(() => {
    if (!municipalityId || !canImport || isLoading || streetsFetching || importMutation.isPending) return;
    if (streetsLoadError || !streetsData) return;
    if (streetCount > 0 || streetsTotal > 0) return;
    if (autoImportAttempted.current) return;
    autoImportAttempted.current = true;
    importMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dispara importação automática uma vez
  }, [municipalityId, canImport, isLoading, streetsFetching, streetsLoadError, streetsData, streetCount, streetsTotal, importMutation.isPending]);

  const paintStreet = useCallback((street: Street) => {
    if (!paintMode || eraserMode || !selectedMicroareaId) return;
    if (pendingPaintRef.current.has(street.id)) return;
    pendingPaintRef.current.add(street.id);
    addDragPaintId(street.id);
  }, [paintMode, eraserMode, selectedMicroareaId, addDragPaintId]);

  const unpaintStreet = useCallback((street: Street) => {
    if (!paintMode || !eraserMode || !street.microareaId) return;
    if (pendingUnpaintRef.current.has(street.id)) return;
    pendingUnpaintRef.current.add(street.id);
    addDragPaintId(street.id);
  }, [paintMode, eraserMode, addDragPaintId]);

  const unassignMutation = useMutation({
    mutationFn: (streetIds: string[]) => streetsApi.unassign(streetIds),
    onMutate: async (streetIds) => {
      if (!municipalityId) return;
      const streetsKey = queryKeys.streetsMap(municipalityId);
      await queryClient.cancelQueries({ queryKey: streetsKey });
      const previous = queryClient.getQueryData(streetsKey);
      patchStreetsMicroarea(queryClient, municipalityId, streetIds, null);
      return { previous };
    },
    onSuccess: (res, streetIds) => {
      if (municipalityId) {
        scheduleDashboardInvalidate(queryClient, municipalityId);
        void queryClient.refetchQueries({ queryKey: queryKeys.streetsMap(municipalityId) });
      }
      if (selectedStreet && streetIds.includes(selectedStreet.id)) {
        setSelectedStreet({ ...selectedStreet, microareaId: undefined, microarea: undefined });
      }
      const count = res.data.cleared;
      if (count > 0) {
        const msg = count === 1 ? 'Pintura removida da rua.' : `${count} ruas desvinculadas.`;
        setLastPaintAction(msg);
        setSnackbar({ message: msg, severity: 'success' });
      }
    },
    onError: (err, _vars, context) => {
      if (context?.previous && municipalityId) {
        queryClient.setQueryData(queryKeys.streetsMap(municipalityId), context.previous);
      }
      setSnackbar({
        message: getApiErrorMessage(err, 'Não foi possível remover a pintura.'),
        severity: 'warning',
      });
    },
  });

  const handleDragPaintEnd = useCallback(() => {
    const dragIds = clearDragPaintIds();
    if (eraserMode) {
      const allIds = new Set([...dragIds, ...pendingUnpaintRef.current]);
      pendingUnpaintRef.current.clear();
      if (allIds.size === 0) return;
      unassignMutation.mutate(Array.from(allIds));
      return;
    }

    const allIds = new Set([...dragIds, ...pendingPaintRef.current]);
    pendingPaintRef.current.clear();

    if (!selectedMicroareaId || allIds.size === 0) return;

    const streetIds = Array.from(allIds);
    lastAssignIdsRef.current = streetIds;
    assignMutation.mutate({
      streetIds,
      microareaId: selectedMicroareaId,
    });
  }, [clearDragPaintIds, selectedMicroareaId, assignMutation, eraserMode, unassignMutation]);

  const handleStreetClick = (street: Street, multiSelect = false) => {
    if (paintMode) return;

    if (multiSelect) {
      toggleStreetSelection(street.id);
      return;
    }

    setHighlightedStreet(street.id);
    setSelectedStreet(street);
  };

  const handleBulkAssign = (microareaId: string, forceTransfer = false) => {
    const ids = selectedStreetIds.size > 0
      ? Array.from(selectedStreetIds)
      : selectedStreet
        ? [selectedStreet.id]
        : [];
    if (ids.length === 0) return;
    assignMutation.mutate({ streetIds: ids, microareaId, forceTransfer });
    clearSelection();
  };

  const handleLocateStreet = useCallback(
    async (streetId: string, geojson?: GeoJSON.LineString) => {
      const mapState = useMapStore.getState();
      mapState.setPaintMode(false);
      mapState.setEraserMode(false);

      let street = streets.find((s) => s.id === streetId);
      if (!street) {
        try {
          const res = await streetsApi.get(streetId);
          street = prepareStreetsForMap([res.data])[0];
        } catch {
          setSnackbar({ message: 'Rua não encontrada no mapa.', severity: 'warning' });
          return;
        }
      }
      if (!street) return;

      setHighlightedStreet(streetId);
      setSelectedStreet(street);
      clearSelection();

      const rawGeom = geojson ?? street.geojson;
      const fixed = fixLineString(rawGeom);
      const prepared = prepareStreetsForMap([{ ...street, geojson: fixed }])[0];
      const geom = prepared?.geojson ?? fixed;

      if (geom?.coordinates?.length) {
        useMapStore.getState().focusOnLine(geom, 18);
      } else {
        const center = lineStringCentroid(fixed);
        if (center) useMapStore.getState().flyTo(center.lat, center.lng, 18);
      }
    },
    [streets, setHighlightedStreet, clearSelection],
  );

  const handleAssign = (microareaId: string, forceTransfer = false) => {
    handleBulkAssign(microareaId, forceTransfer);
  };

  const clearPaintMutation = useMutation({
    mutationFn: () => streetsApi.clearAssignments(municipalityId!),
    onMutate: async () => {
      if (!municipalityId) return;
      const streetsKey = queryKeys.streetsMap(municipalityId);
      await queryClient.cancelQueries({ queryKey: streetsKey });
      const previous = queryClient.getQueryData(streetsKey);
      clearAllStreetsMicroarea(queryClient, municipalityId);
      return { previous };
    },
    onSuccess: (res) => {
      if (municipalityId) {
        scheduleDashboardInvalidate(queryClient, municipalityId);
        void queryClient.refetchQueries({ queryKey: queryKeys.streetsMap(municipalityId) });
      }
      setSelectedStreet(null);
      setHighlightedStreet(null);
      clearSelection();
      setSnackbar({
        message: `${res.data.cleared} rua(s) removidas. Mapa limpo.`,
        severity: 'success',
      });
    },
    onError: (err, _vars, context) => {
      if (context?.previous && municipalityId) {
        queryClient.setQueryData(queryKeys.streetsMap(municipalityId), context.previous);
      }
      setSnackbar({
        message: getApiErrorMessage(err, 'Não foi possível limpar as pinturas.'),
        severity: 'warning',
      });
    },
  });

  const handleUnassignSelected = useCallback(() => {
    const ids = selectedStreetIds.size > 0
      ? Array.from(selectedStreetIds)
      : selectedStreet?.microareaId
        ? [selectedStreet.id]
        : [];
    const paintedIds = ids.filter((id) => streets.find((s) => s.id === id)?.microareaId);
    if (paintedIds.length === 0) {
      setSnackbar({ message: 'Nenhuma rua pintada selecionada.', severity: 'info' });
      return;
    }
    unassignMutation.mutate(paintedIds);
    clearSelection();
  }, [selectedStreetIds, selectedStreet, streets, unassignMutation, clearSelection]);

  const handleUnassignMicroarea = useCallback((microareaId: string) => {
    const ids = streets.filter((s) => s.microareaId === microareaId).map((s) => s.id);
    if (ids.length === 0) return;
    unassignMutation.mutate(ids);
  }, [streets, unassignMutation]);

  const handleRetryLoadStreets = useCallback(async () => {
    setImportFailed(false);
    const result = await refetchStreets();
    if ((result.data?.items?.length ?? 0) > 0 || (result.data?.total ?? 0) > 0) {
      setSnackbar({ message: 'Ruas carregadas com sucesso!', severity: 'success' });
      return;
    }
    if (!result.isError && canImport) {
      autoImportAttempted.current = false;
      importMutation.mutate();
    }
  }, [refetchStreets, canImport, importMutation]);

  const tile = TILE_LAYERS[baseLayer];
  const importing = importMutation.isPending;
  const showEmptyOverlay =
    !importing &&
    !streetsFetching &&
    !streetsAutoRetrying &&
    streetCount === 0 &&
    (importFailed || streetsLoadError);

  if (!municipalityId) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 64px)' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      ref={mapContainerRef}
      className={paintMode ? (eraserMode ? 'sigaps-map-painting sigaps-map-eraser' : 'sigaps-map-painting') : undefined}
      sx={{ position: 'relative', height: 'calc(100vh - 64px)', width: '100%' }}
    >
      <MapToolbar
        mapContainerRef={mapContainerRef}
        streetCount={streetCount}
        microareas={microareas}
        streets={streets}
        onLocateStreet={handleLocateStreet}
        onImport={() => importMutation.mutate()}
        importing={importMutation.isPending}
        selectedCount={selectedStreetIds.size}
      />

      <MapLegend microareas={microareas} streets={streets} loading={streetsFetching && streetCount === 0} />

      <SelectionBar
        microareas={microareas}
        count={selectedStreetIds.size}
        onAssign={(id) => handleBulkAssign(id)}
        onUnassign={handleUnassignSelected}
        assigning={assignMutation.isPending}
        unassigning={unassignMutation.isPending}
        hasPaintedSelection={Array.from(selectedStreetIds).some((id) =>
          streets.find((s) => s.id === id)?.microareaId,
        )}
      />

      <PaintGuidePanel
        microareas={microareas}
        streets={streets}
        streetCount={streetCount}
        municipalityId={municipalityId!}
        onPaintStreets={(ids) => {
          if (!selectedMicroareaId) return;
          lastAssignIdsRef.current = ids;
          assignMutation.mutate({ streetIds: ids, microareaId: selectedMicroareaId });
        }}
        onClearAllPaint={() => clearPaintMutation.mutate()}
        onClearMicroareaPaint={handleUnassignMicroarea}
        clearingPaint={clearPaintMutation.isPending || unassignMutation.isPending}
        importing={importMutation.isPending}
        lastAction={lastPaintAction}
        onMicroareaCreated={() => {
          queryClient.invalidateQueries({ queryKey: ['microareas', municipalityId] });
        }}
      />

      <MapDivisionsPanel
        municipalityId={municipalityId!}
        microareas={microareas}
        streets={streets}
        onAssignStreets={(streetIds, microareaId) => {
          lastAssignIdsRef.current = streetIds;
          assignMutation.mutate({ streetIds, microareaId });
        }}
        onMessage={(message) => setSnackbar({ message, severity: 'success' })}
      />

      {streetsFetching && streetCount === 0 && !showEmptyOverlay && (
        <Alert
          severity="info"
          sx={{
            position: 'absolute',
            top: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            borderRadius: 2,
            maxWidth: 420,
          }}
        >
          {importing
            ? 'Preparando ruas do município (dados locais, alguns segundos)...'
            : 'Carregando ruas do município…'}
        </Alert>
      )}

      {streetsAutoRetrying && streetCount === 0 && (
        <Alert
          severity="info"
          sx={{
            position: 'absolute',
            top: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            borderRadius: 2,
            maxWidth: 420,
          }}
        >
          Reconectando ao servidor… (tentativa {streetsAutoRetryCount.current + 1})
        </Alert>
      )}

      {showEmptyOverlay && (
        <MapEmptyState
          canImport={canImport}
          loadError={streetsLoadError || importFailed}
          autoRetrying={false}
          onImport={() => void handleRetryLoadStreets()}
        />
      )}
      {streetsTotal > streetCount && (
        <Alert
          severity="warning"
          sx={{
            position: 'absolute',
            top: 80,
            right: 16,
            zIndex: 1000,
            maxWidth: 320,
            borderRadius: 2,
          }}
        >
          Mostrando {streetCount} de {streetsTotal} ruas. Use a busca para localizar ruas específicas.
        </Alert>
      )}

      <LeafletMap
          center={[PASSAGEM_FRANCA.lat, PASSAGEM_FRANCA.lng]}
          zoom={PASSAGEM_FRANCA.zoom}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          doubleClickZoom={false}
          boxZoom={false}
          preferCanvas
        >
          <MapInteractionController />
          <DivisionMapClickHandler />
          <ZoomControl position="bottomright" />
          <MapCenterController />
          <TileLayer
            key={baseLayer}
            url={tile.url}
            attribution={tile.attribution}
          />
          <ScaleControl imperial={false} />
          {(paintZones.length > 0 || divisionDraft) && <PaintZonesLayer zones={paintZones} />}
          <MicroareaPolygonsLayer
            microareas={microareas}
            streets={deferredStreets}
          />
          {streets.length > 0 && (
            <StreetsLayer
              streets={streets}
              onStreetClick={handleStreetClick}
              onStreetPaint={paintStreet}
              onStreetUnpaint={unpaintStreet}
              onDragPaintEnd={handleDragPaintEnd}
            />
          )}
        </LeafletMap>

      {selectedStreet && !paintMode && (
        <StreetPanel
          street={selectedStreet}
          microareas={microareas}
          onClose={() => {
            setSelectedStreet(null);
            setHighlightedStreet(null);
          }}
          onAssign={handleAssign}
          onUnassign={() => {
            if (selectedStreet?.microareaId) {
              unassignMutation.mutate([selectedStreet.id]);
            }
          }}
          assigning={assignMutation.isPending}
          unassigning={unassignMutation.isPending}
        />
      )}

      <Dialog open={conflictOpen} onClose={() => setConflictOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Rua já vinculada</DialogTitle>
        <DialogContent>
          <Typography variant="body2">{conflictMsg}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConflictOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={() => {
              if (selectedMicroareaId && lastAssignIdsRef.current.length > 0) {
                assignMutation.mutate({
                  streetIds: lastAssignIdsRef.current,
                  microareaId: selectedMicroareaId,
                  forceTransfer: true,
                });
              }
            }}
          >
            Sim, transferir
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!snackbar}
        autoHideDuration={3500}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{ mt: 8 }}
      >
        {snackbar ? (
          <Alert severity={snackbar.severity} onClose={() => setSnackbar(null)} sx={{ borderRadius: 2, width: '100%' }}>
            {snackbar.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}
