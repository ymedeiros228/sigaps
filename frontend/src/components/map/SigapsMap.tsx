import { useEffect, useRef, useState, useCallback, useMemo, useDeferredValue } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ScaleControl, ZoomControl } from 'react-leaflet';
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
  LinearProgress,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  microareasApi,
  neighborhoodsApi,
  osmApi,
  paintZonesApi,
  streetsApi,
  ubsApi,
  placesApi,
  type Street,
} from '../../services/api';
import { useMunicipalityId } from '../../hooks/useMunicipalityId';
import { useAppStore, useMapStore, useAuthStore } from '../../store';
import { StreetsLayer, MapCenterController } from './StreetsLayer';
import { MapInteractionController } from './MapInteractionController';
import { MapToolbar } from './MapToolbar';
import type { StreetSearchOption } from './StreetSearchBar';
import { StreetPanel } from './StreetPanel';
import { MapLegend } from './MapLegend';
import { MicroareaEnvelopesLayer } from './MicroareaEnvelopesLayer';
import { PaintGuidePanel } from './PaintGuidePanel';
import { MapDivisionsPanel } from './MapDivisionsPanel';
import { PaintZonesLayer } from './PaintZonesLayer';
import { DivisionMapClickHandler } from './DivisionMapClickHandler';
import { MapEmptyState } from './MapEmptyState';
import { SelectionBar } from './SelectionBar';
import { UbsMarkersLayer } from './UbsMarkersLayer';
import { PlacesMarkersLayer } from './PlacesMarkersLayer';
import { FamilyBulkImportDialog } from './FamilyBulkImportDialog';
import { getApiErrorMessage, isConflictError, getConflictMessage } from '../../utils/apiError';
import { canImportStreets, isAcsUser } from '../../utils/permissions';
import { lineStringCentroid } from '../../utils/geo';
import { fixLineString, prepareStreetsForMap } from '../../utils/streetSearch';
import { MapBoundsReporter, useMapViewportStreets, VIEWPORT_STREETS_THRESHOLD } from '../../hooks/useMapViewportStreets';
import { CACHE, queryKeys } from '../../utils/queryKeys';
import { scheduleDashboardInvalidate } from '../../utils/prefetchAppData';
import { patchStreetsMicroarea, clearAllStreetsMicroarea } from '../../utils/streetsCache';
import { LeafletMap } from './LeafletMap';
import { MapTileLayerController } from './MapTileLayerController';

const PASSAGEM_FRANCA = { lat: -6.1828, lng: -43.7869, zoom: 14 };

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
  const setSelectedMicroarea = useMapStore((s) => s.setSelectedMicroarea);
  const user = useAuthStore((s) => s.user);
  const acsReadOnly = isAcsUser(user?.role);
  const lockedMicroareaId = user?.acsProfile?.microarea?.id;
  const canImport = canImportStreets(user?.role) && !acsReadOnly;
  const [selectedStreet, setSelectedStreet] = useState<Street | null>(null);
  const [conflictMsg, setConflictMsg] = useState<string | null>(null);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{ message: string; severity: 'success' | 'info' | 'warning' } | null>(null);
  const [familyImportOpen, setFamilyImportOpen] = useState(false);
  const [lastPaintAction, setLastPaintAction] = useState<string | null>(null);
  const [importFailed, setImportFailed] = useState(false);
  const [streetsAutoRetrying, setStreetsAutoRetrying] = useState(false);
  const streetsAutoRetryCount = useRef(0);
  const pendingPaintRef = useRef<Set<string>>(new Set());
  const pendingUnpaintRef = useRef<Set<string>>(new Set());
  const lastAssignIdsRef = useRef<string[]>([]);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const autoImportAttempted = useRef(false);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const latRaw = searchParams.get('lat');
    const lngRaw = searchParams.get('lng');
    // Sem parâmetros na URL não há para onde voar (Number(null) seria 0,0 — oceano).
    if (latRaw === null || lngRaw === null) return;
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const zoom = Number(searchParams.get('zoom')) || 17;
    const tipo = searchParams.get('tipo');
    const mapState = useMapStore.getState();
    mapState.flyTo(lat, lng, zoom);
    if (tipo === 'povoado') mapState.setShowPlacesMarkers(true);
    else mapState.setShowUbsMarkers(true);
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!acsReadOnly || !lockedMicroareaId) return;
    setSelectedMicroarea(lockedMicroareaId);
    setPaintMode(false);
  }, [acsReadOnly, lockedMicroareaId, setSelectedMicroarea, setPaintMode]);

  useEffect(() => {
    if (paintMode) return;
    useMapStore.getState().setDivisionDraft(null);
    useMapStore.getState().setDivisionMode(false);
  }, [paintMode]);

  const { data: microareasData = [] } = useQuery({
    queryKey: queryKeys.microareas(municipalityId!),
    queryFn: () =>
      microareasApi.list(municipalityId!).then((r) => r.data),
    enabled: !!municipalityId,
    staleTime: CACHE.microareas,
  });

  const { data: neighborhoods = [] } = useQuery({
    queryKey: queryKeys.neighborhoods(municipalityId!),
    queryFn: () => neighborhoodsApi.list(municipalityId!).then((r) => r.data),
    enabled: !!municipalityId,
    staleTime: CACHE.neighborhoods,
  });

  const { data: paintZones = [] } = useQuery({
    queryKey: queryKeys.paintZones(municipalityId!),
    queryFn: () => paintZonesApi.list(municipalityId!).then((r) => r.data),
    enabled: !!municipalityId,
    staleTime: CACHE.paintZones,
  });

  const { data: ubsList = [] } = useQuery({
    queryKey: queryKeys.ubs(municipalityId!),
    queryFn: () => ubsApi.list(municipalityId!).then((r) => r.data),
    enabled: !!municipalityId,
    staleTime: CACHE.default,
  });

  const { data: placesList = [] } = useQuery({
    queryKey: queryKeys.places(municipalityId!),
    queryFn: () => placesApi.list(municipalityId!).then((r) => r.data),
    enabled: !!municipalityId,
    staleTime: CACHE.places,
  });

  useEffect(() => {
    if (microareasData.length > 0) {
      setMicroareas(microareasData);
    }
  }, [microareasData, setMicroareas]);

  const {
    streetsData,
    streetsTotal,
    useViewport,
    isLoading,
    isFetching: streetsFetching,
    isError: streetsLoadError,
    refetch: refetchStreets,
    onBounds,
  } = useMapViewportStreets(municipalityId);

  const streetCount = streetsData?.items?.length ?? 0;
  const streets = useMemo(
    () => prepareStreetsForMap(streetsData?.items ?? []),
    [streetsData?.items],
  );
  const deferredStreets = useDeferredValue(streets);
  const mapStreets = paintMode ? streets : deferredStreets;

  const refreshMapPaintState = useCallback(() => {
    if (!municipalityId) return;
    void queryClient.invalidateQueries({ queryKey: queryKeys.streetsMap(municipalityId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.microareas(municipalityId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.microareaEnvelopes(municipalityId) });
    void queryClient.refetchQueries({
      queryKey: queryKeys.microareaEnvelopes(municipalityId),
      type: 'active',
    });
  }, [municipalityId, queryClient]);

  const lastFocusedMicroareaRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedMicroareaId || streets.length === 0) return;
    if (lastFocusedMicroareaRef.current === selectedMicroareaId) return;
    const ma = microareasData.find((m) => m.id === selectedMicroareaId);
    if (!ma?.neighborhoodId) return;
    const hoodStreets = streets.filter((s) => s.neighborhood?.id === ma.neighborhoodId);
    if (hoodStreets.length === 0) return;
    lastFocusedMicroareaRef.current = selectedMicroareaId;
    useMapStore.getState().focusOnLines(
      hoodStreets.map((s) => s.geojson),
      15,
    );
  }, [selectedMicroareaId, microareasData, streets]);

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
        refreshMapPaintState();
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
      useMapStore.getState().setPaintGuideCollapsed(true);
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

  const assignNeighborhoodMutation = useMutation({
    mutationFn: ({
      streetIds,
      neighborhoodId,
    }: {
      streetIds: string[];
      neighborhoodId: string | null;
    }) => streetsApi.assignNeighborhood(streetIds, neighborhoodId),
    onSuccess: (_data, variables) => {
      if (!municipalityId) return;
      const hood = neighborhoods.find((n) => n.id === variables.neighborhoodId);
      queryClient.setQueryData(queryKeys.streetsMap(municipalityId), (old: typeof streetsData) => {
        if (!old?.items) return old;
        return {
          ...old,
          items: old.items.map((s) =>
            variables.streetIds.includes(s.id)
              ? {
                  ...s,
                  neighborhoodId: variables.neighborhoodId ?? undefined,
                  neighborhood: hood ? { id: hood.id, name: hood.name } : undefined,
                }
              : s,
          ),
        };
      });
      if (selectedStreet && variables.streetIds.includes(selectedStreet.id)) {
        setSelectedStreet((prev) =>
          prev
            ? {
                ...prev,
                neighborhoodId: variables.neighborhoodId ?? undefined,
                neighborhood: hood ? { id: hood.id, name: hood.name } : undefined,
              }
            : null,
        );
      }
      scheduleDashboardInvalidate(queryClient, municipalityId);
      setSnackbar({ message: 'Bairro atualizado na(s) rua(s).', severity: 'success' });
      clearSelection();
    },
    onError: (err) =>
      setSnackbar({
        message: getApiErrorMessage(err, 'Não foi possível vincular o bairro.'),
        severity: 'warning',
      }),
  });

  const updateDemographicsMutation = useMutation({
    mutationFn: ({
      streetId,
      data,
    }: {
      streetId: string;
      data: { familyCount: number; inhabitantCount: number; propertyCount: number };
    }) => streetsApi.updateDemographics(streetId, data),
    onSuccess: (res, variables) => {
      if (!municipalityId) return;
      const updated = res.data;
      queryClient.setQueryData(queryKeys.streetsMap(municipalityId), (old: typeof streetsData) => {
        if (!old?.items) return old;
        return {
          ...old,
          items: old.items.map((s) =>
            s.id === variables.streetId
              ? {
                  ...s,
                  familyCount: updated.familyCount,
                  inhabitantCount: updated.inhabitantCount,
                  propertyCount: updated.propertyCount,
                }
              : s,
          ),
        };
      });
      if (selectedStreet?.id === variables.streetId) {
        setSelectedStreet((prev) =>
          prev
            ? {
                ...prev,
                familyCount: updated.familyCount,
                inhabitantCount: updated.inhabitantCount,
                propertyCount: updated.propertyCount,
              }
            : null,
        );
      }
      scheduleDashboardInvalidate(queryClient, municipalityId);
      setSnackbar({ message: 'Dados de famílias/habitantes salvos.', severity: 'success' });
    },
    onError: (err) =>
      setSnackbar({
        message: getApiErrorMessage(err, 'Não foi possível salvar os dados.'),
        severity: 'warning',
      }),
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
    pendingUnpaintRef.current.delete(street.id);
    pendingPaintRef.current.add(street.id);
    addDragPaintId(street.id);
  }, [paintMode, eraserMode, selectedMicroareaId, addDragPaintId]);

  const unpaintStreet = useCallback((street: Street) => {
    if (!paintMode || !street.microareaId) return;
    if (pendingUnpaintRef.current.has(street.id)) return;
    pendingPaintRef.current.delete(street.id);
    pendingUnpaintRef.current.add(street.id);
    addDragPaintId(street.id);
  }, [paintMode, addDragPaintId]);

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
        refreshMapPaintState();
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
    clearDragPaintIds();
    const unpaintIds = Array.from(pendingUnpaintRef.current);
    const paintIds = Array.from(pendingPaintRef.current).filter(
      (id) => !pendingUnpaintRef.current.has(id),
    );
    pendingUnpaintRef.current.clear();
    pendingPaintRef.current.clear();

    if (eraserMode) {
      if (unpaintIds.length === 0) return;
      unassignMutation.mutate(unpaintIds);
      return;
    }

    if (unpaintIds.length > 0) {
      unassignMutation.mutate(unpaintIds);
    }

    if (!selectedMicroareaId || paintIds.length === 0) return;

    lastAssignIdsRef.current = paintIds;
    assignMutation.mutate({
      streetIds: paintIds,
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

  const handleBulkAssignNeighborhood = (neighborhoodId: string | null) => {
    const ids =
      selectedStreetIds.size > 0
        ? Array.from(selectedStreetIds)
        : selectedStreet
          ? [selectedStreet.id]
          : [];
    if (ids.length === 0) return;
    assignNeighborhoodMutation.mutate({ streetIds: ids, neighborhoodId });
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
        if (center) useMapStore.getState().flyTo(center.lat, center.lng, 17);
      }
    },
    [streets, setHighlightedStreet, clearSelection],
  );

  const handleSearchSelect = useCallback(
    async (option: StreetSearchOption) => {
      if (option.kind === 'street') {
        await handleLocateStreet(option.id, option.geojson);
        return;
      }

      const mapState = useMapStore.getState();
      mapState.setPaintMode(false);
      mapState.setEraserMode(false);

      if (option.kind === 'ubs' && option.lat != null && option.lng != null) {
        mapState.flyTo(option.lat, option.lng, 17);
        setSnackbar({ message: option.label, severity: 'info' });
        return;
      }

      if (option.kind === 'place' && option.lat != null && option.lng != null) {
        mapState.flyTo(option.lat, option.lng, 16);
        setSnackbar({ message: option.label, severity: 'info' });
        return;
      }

      if (option.kind === 'neighborhood' && municipalityId) {
        try {
          const res = await streetsApi.list(municipalityId, {
            neighborhoodId: option.id,
            limit: 200,
            mapOnly: true,
          });
          const items = prepareStreetsForMap(res.data.items ?? []);
          if (items.length > 0) {
            mapState.focusOnLines(items.map((s) => s.geojson), 16);
            setSnackbar({ message: `${option.label} — ${items.length} rua(s)`, severity: 'info' });
          } else {
            setSnackbar({ message: 'Nenhuma rua vinculada a este bairro.', severity: 'info' });
          }
        } catch {
          setSnackbar({ message: 'Não foi possível localizar o bairro.', severity: 'warning' });
        }
        return;
      }

      const microareaId =
        option.kind === 'microarea' ? option.id : option.microareaId;

      if (microareaId) {
        let geoms = streets.filter((s) => s.microareaId === microareaId).map((s) => s.geojson);
        if (geoms.length === 0 && municipalityId) {
          try {
            const res = await streetsApi.list(municipalityId, {
              microareaId,
              limit: 200,
              mapOnly: true,
            });
            geoms = prepareStreetsForMap(res.data.items ?? []).map((s) => s.geojson);
          } catch {
            /* ignora */
          }
        }
        if (geoms.length > 0) {
          mapState.focusOnLines(geoms, 16);
        }
        if (option.kind === 'microarea') {
          mapState.setSelectedMicroarea(option.id);
          mapState.setPaintMode(true);
          setSnackbar({ message: `Microárea: ${option.label}`, severity: 'info' });
        } else {
          setSnackbar({ message: `ACS ${option.label}`, severity: 'info' });
        }
        return;
      }

      if (option.kind === 'acs') {
        setSnackbar({ message: 'ACS sem microárea vinculada.', severity: 'info' });
      }
    },
    [handleLocateStreet, municipalityId, streets],
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
        refreshMapPaintState();
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

  const clearPaintZonesMutation = useMutation({
    mutationFn: () => paintZonesApi.clearAll(municipalityId!),
    onSuccess: (res) => {
      if (municipalityId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.paintZones(municipalityId) });
      }
      useMapStore.getState().setDivisionDraft(null);
      useMapStore.getState().setDivisionMode(false);
      setSnackbar({
        message: `${res.data.count} círculo(s) removido(s) do mapa.`,
        severity: 'success',
      });
    },
    onError: (err) =>
      setSnackbar({
        message: getApiErrorMessage(err, 'Não foi possível remover os círculos do mapa.'),
        severity: 'warning',
      }),
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
        onSearchSelect={handleSearchSelect}
        onImport={() => importMutation.mutate()}
        importing={importMutation.isPending}
        selectedCount={selectedStreetIds.size}
        onImportFamilies={acsReadOnly ? undefined : () => setFamilyImportOpen(true)}
        readOnly={acsReadOnly}
      />

      <MapLegend
        microareas={microareas}
        streets={streets}
        ubsList={ubsList}
        placesList={placesList}
        loading={streetsFetching && streetCount === 0}
      />

      <SelectionBar
        microareas={microareas}
        neighborhoods={neighborhoods}
        count={selectedStreetIds.size}
        onAssign={(id) => handleBulkAssign(id)}
        onAssignNeighborhood={handleBulkAssignNeighborhood}
        onUnassign={handleUnassignSelected}
        assigning={assignMutation.isPending}
        assigningNeighborhood={assignNeighborhoodMutation.isPending}
        unassigning={unassignMutation.isPending}
        hasPaintedSelection={Array.from(selectedStreetIds).some((id) =>
          streets.find((s) => s.id === id)?.microareaId,
        )}
      />

      {!acsReadOnly && (
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
        paintZoneCount={paintZones.length}
        onClearPaintZones={() => clearPaintZonesMutation.mutate()}
        clearingPaintZones={clearPaintZonesMutation.isPending}
        clearingPaint={clearPaintMutation.isPending || unassignMutation.isPending}
        importing={importMutation.isPending}
        lastAction={lastPaintAction}
        onMicroareaCreated={() => {
          queryClient.invalidateQueries({ queryKey: ['microareas', municipalityId] });
        }}
        onMinimized={() =>
          setSnackbar({ message: 'Mapa guardado — ruas salvas. Toque na barra inferior para pintar de novo.', severity: 'success' })
        }
      />
      )}

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

      {useViewport && streetsFetching && (
        <LinearProgress
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1100,
            height: 3,
          }}
        />
      )}

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
      {streetsTotal > VIEWPORT_STREETS_THRESHOLD && (
        <Alert
          severity="info"
          sx={{
            position: 'absolute',
            top: 80,
            right: 16,
            zIndex: 1000,
            maxWidth: 320,
            borderRadius: 2,
          }}
        >
          Malha grande ({streetsTotal} ruas). O mapa simplifica geometrias e carrega por área visível
          para manter a performance.
        </Alert>
      )}

      {useViewport && streetCount === 0 && !streetsFetching && !isLoading && !showEmptyOverlay && (
        <Alert
          severity="info"
          variant="outlined"
          sx={{
            position: 'absolute',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            borderRadius: 2,
            maxWidth: 360,
            bgcolor: 'background.paper',
          }}
        >
          Mova o mapa para carregar mais ruas
        </Alert>
      )}

      <LeafletMap
          className="sigaps-leaflet-map"
          center={[PASSAGEM_FRANCA.lat, PASSAGEM_FRANCA.lng]}
          zoom={PASSAGEM_FRANCA.zoom}
          style={{ height: '100%', width: '100%', minHeight: 320 }}
          zoomControl={false}
          doubleClickZoom={false}
          boxZoom={false}
          maxZoom={19}
        >
          <MapInteractionController />
          {useViewport && <MapBoundsReporter onBounds={onBounds} />}
          <DivisionMapClickHandler />
          <ZoomControl position="bottomright" />
          <MapCenterController />
          <MapTileLayerController layerId={baseLayer} />
          <ScaleControl imperial={false} />
          {(paintZones.length > 0 || divisionDraft) && <PaintZonesLayer zones={paintZones} />}
          <MicroareaEnvelopesLayer municipalityId={municipalityId!} />
          {streets.length > 0 && (
            <StreetsLayer
              streets={mapStreets}
              onStreetClick={handleStreetClick}
              onStreetPaint={paintStreet}
              onStreetUnpaint={unpaintStreet}
              onDragPaintEnd={handleDragPaintEnd}
            />
          )}
          <UbsMarkersLayer ubsList={ubsList} />
          <PlacesMarkersLayer places={placesList} />
        </LeafletMap>

      {selectedStreet && !paintMode && (
        <StreetPanel
          street={selectedStreet}
          microareas={microareas}
          neighborhoods={neighborhoods}
          onClose={() => {
            setSelectedStreet(null);
            setHighlightedStreet(null);
          }}
          onAssign={handleAssign}
          onAssignNeighborhood={(neighborhoodId) =>
            assignNeighborhoodMutation.mutate({
              streetIds: [selectedStreet.id],
              neighborhoodId,
            })
          }
          onUnassign={() => {
            if (selectedStreet?.microareaId) {
              unassignMutation.mutate([selectedStreet.id]);
            }
          }}
          onUpdateDemographics={(data) =>
            updateDemographicsMutation.mutate({ streetId: selectedStreet.id, data })
          }
          assigning={assignMutation.isPending}
          assigningNeighborhood={assignNeighborhoodMutation.isPending}
          unassigning={unassignMutation.isPending}
          savingDemographics={updateDemographicsMutation.isPending}
        />
      )}

      <FamilyBulkImportDialog
        open={familyImportOpen}
        municipalityId={municipalityId!}
        onClose={() => setFamilyImportOpen(false)}
        onSuccess={(message) => {
          if (municipalityId) {
            queryClient.invalidateQueries({ queryKey: queryKeys.streetsMap(municipalityId) });
            scheduleDashboardInvalidate(queryClient, municipalityId);
          }
          setSnackbar({ message, severity: 'success' });
        }}
        onError={(err) =>
          setSnackbar({
            message: getApiErrorMessage(err, 'Não foi possível importar a planilha.'),
            severity: 'warning',
          })
        }
      />

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
