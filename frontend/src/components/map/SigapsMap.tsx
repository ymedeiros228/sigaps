import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
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
import { prepareStreetsForMap } from '../../utils/streetSearch';
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
  const pendingPaintRef = useRef<Set<string>>(new Set());
  const lastAssignIdsRef = useRef<string[]>([]);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const autoImportAttempted = useRef(false);
  const setSelectedMicroarea = useMapStore((s) => s.setSelectedMicroarea);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && paintMode) {
        setPaintMode(false);
        setSnackbar({ message: 'Modo pintar desativado', severity: 'info' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paintMode, setPaintMode]);

  const { data: microareasData = [] } = useQuery({
    queryKey: ['microareas', municipalityId],
    queryFn: () =>
      microareasApi.list(municipalityId!).then((r) => r.data),
    enabled: !!municipalityId,
    staleTime: 5 * 60_000,
  });

  const { data: paintZones = [] } = useQuery({
    queryKey: ['paint-zones', municipalityId],
    queryFn: () => paintZonesApi.list(municipalityId!).then((r) => r.data),
    enabled: !!municipalityId,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (microareasData.length > 0) {
      setMicroareas(microareasData);
    }
  }, [microareasData, setMicroareas]);

  const { data: streetsData, isLoading } = useQuery({
    queryKey: ['streets', municipalityId],
    queryFn: () =>
      streetsApi.list(municipalityId!, { limit: 2000, mapOnly: true }).then((r) => r.data),
    enabled: !!municipalityId,
    staleTime: 60_000,
  });

  const streetCount = streetsData?.items?.length ?? 0;
  const streetsTotal = streetsData?.total ?? streetCount;
  const streets = useMemo(
    () => prepareStreetsForMap(streetsData?.items ?? []),
    [streetsData?.items],
  );

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
      await queryClient.cancelQueries({ queryKey: ['streets', municipalityId] });
      const previous = queryClient.getQueryData(['streets', municipalityId]);
      const ma = getMicroarea(variables.microareaId);

      queryClient.setQueryData(['streets', municipalityId], (old: typeof streetsData) => {
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
      queryClient.invalidateQueries({ queryKey: ['streets', municipalityId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
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
      if (context?.previous) {
        queryClient.setQueryData(['streets', municipalityId], context.previous);
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

      queryClient.invalidateQueries({ queryKey: ['streets', municipalityId] });
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
      queryClient.invalidateQueries({ queryKey: ['streets', municipalityId] });
    }, 6000);
    return () => window.clearInterval(timer);
  }, [importMutation.isPending, streetCount, municipalityId, queryClient]);

  useEffect(() => {
    if (!municipalityId || !canImport || isLoading || importMutation.isPending) return;
    if (streetCount > 0) return;
    if (autoImportAttempted.current) return;
    autoImportAttempted.current = true;
    importMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dispara importação automática uma vez
  }, [municipalityId, canImport, isLoading, streetCount, importMutation.isPending]);

  const paintStreet = useCallback((street: Street) => {
    if (!paintMode || !selectedMicroareaId) return;
    if (pendingPaintRef.current.has(street.id)) return;
    pendingPaintRef.current.add(street.id);
    addDragPaintId(street.id);
  }, [paintMode, selectedMicroareaId, addDragPaintId]);

  const handleDragPaintEnd = useCallback(() => {
    const dragIds = clearDragPaintIds();
    const allIds = new Set([...dragIds, ...pendingPaintRef.current]);
    pendingPaintRef.current.clear();

    if (!selectedMicroareaId || allIds.size === 0) return;

    const streetIds = Array.from(allIds);
    lastAssignIdsRef.current = streetIds;
    assignMutation.mutate({
      streetIds,
      microareaId: selectedMicroareaId,
    });
  }, [clearDragPaintIds, selectedMicroareaId, assignMutation]);

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
      setPaintMode(false);
      setHighlightedStreet(streetId);
      setSelectedStreet(street);
      clearSelection();
      const geom = geojson ? prepareStreetsForMap([{ ...street, geojson }])[0]?.geojson : street.geojson;
      const center = lineStringCentroid(geom);
      if (center) useMapStore.getState().flyTo(center.lat, center.lng, 18);
    },
    [streets, setPaintMode, setHighlightedStreet, clearSelection],
  );

  const handleAssign = (microareaId: string, forceTransfer = false) => {
    handleBulkAssign(microareaId, forceTransfer);
  };

  const clearPaintMutation = useMutation({
    mutationFn: () => streetsApi.clearAssignments(municipalityId!),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['streets', municipalityId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setSelectedStreet(null);
      setHighlightedStreet(null);
      clearSelection();
      setSnackbar({
        message: `${res.data.cleared} rua(s) removidas. Mapa limpo.`,
        severity: 'success',
      });
    },
    onError: (err) => {
      setSnackbar({
        message: getApiErrorMessage(err, 'Não foi possível limpar as pinturas.'),
        severity: 'warning',
      });
    },
  });

  const tile = TILE_LAYERS[baseLayer];
  const importing = importMutation.isPending;
  const showEmptyOverlay = importFailed && !importing && streetCount === 0;

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
      className={paintMode ? 'sigaps-map-painting' : undefined}
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

      <MapLegend microareas={microareas} />

      <SelectionBar
        microareas={microareas}
        count={selectedStreetIds.size}
        onAssign={(id) => handleBulkAssign(id)}
        assigning={assignMutation.isPending}
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
        onClearAllPaint={() => {
          if (
            window.confirm(
              'Isso remove TODAS as ruas pintadas de todas as microáreas. Você poderá pintar novamente rua por rua. Continuar?',
            )
          ) {
            clearPaintMutation.mutate();
          }
        }}
        clearingPaint={clearPaintMutation.isPending}
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

      {importing && streetCount === 0 && (
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
          Preparando ruas do município (dados locais, alguns segundos)...
        </Alert>
      )}

      {showEmptyOverlay && (
        <MapEmptyState
          canImport={canImport}
          onImport={() => {
            setImportFailed(false);
            importMutation.mutate();
          }}
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
            streets={streets}
          />
          {streets.length > 0 && (
            <StreetsLayer
              streets={streets}
              onStreetClick={handleStreetClick}
              onStreetPaint={paintStreet}
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
          assigning={assignMutation.isPending}
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
