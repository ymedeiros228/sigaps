import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, LayersControl, ScaleControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Box, CircularProgress } from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  microareasApi,
  municipalitiesApi,
  osmApi,
  streetsApi,
  type Street,
} from '../../services/api';
import { useAppStore, useMapStore } from '../../store';
import { StreetsLayer, MapCenterController } from './StreetsLayer';
import { MapToolbar } from './MapToolbar';
import { StreetPanel } from './StreetPanel';
import { MapLegend } from './MapLegend';
import { MicroareaEnvelopesLayer } from './MicroareaEnvelopesLayer';

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
  const municipalityId = useAppStore((s) => s.municipalityId);
  const setMunicipalityId = useAppStore((s) => s.setMunicipalityId);
  const setMicroareas = useAppStore((s) => s.setMicroareas);
  const baseLayer = useMapStore((s) => s.baseLayer);
  const paintMode = useMapStore((s) => s.paintMode);
  const selectedMicroareaId = useMapStore((s) => s.selectedMicroareaId);
  const selectedStreetIds = useMapStore((s) => s.selectedStreetIds);
  const toggleStreetSelection = useMapStore((s) => s.toggleStreetSelection);
  const clearSelection = useMapStore((s) => s.clearSelection);
  const setHighlightedStreet = useMapStore((s) => s.setHighlightedStreet);
  const [selectedStreet, setSelectedStreet] = useState<Street | null>(null);
  const [conflictMsg, setConflictMsg] = useState<string | null>(null);

  useEffect(() => {
    municipalitiesApi.list().then((res) => {
      const muni = res.data[0];
      if (muni) setMunicipalityId(muni.id);
    });
  }, [setMunicipalityId]);

  const { data: microareas = [] } = useQuery({
    queryKey: ['microareas', municipalityId],
    queryFn: () =>
      microareasApi.list(municipalityId!).then((r) => r.data),
    enabled: !!municipalityId,
  });

  useEffect(() => {
    setMicroareas(microareas);
  }, [microareas, setMicroareas]);

  const { data: streetsData, isLoading } = useQuery({
    queryKey: ['streets', municipalityId],
    queryFn: () =>
      streetsApi.list(municipalityId!, { limit: 2000 }).then((r) => r.data),
    enabled: !!municipalityId,
  });

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['streets'] });
      setConflictMsg(null);
    },
    onError: (err: { response?: { data?: { message?: string; code?: string } } }) => {
      const data = err.response?.data;
      if (data?.code === 'STREET_ALREADY_ASSIGNED') {
        setConflictMsg(data.message ?? 'Rua já pertence a outra microárea');
      }
    },
  });

  const importMutation = useMutation({
    mutationFn: () => osmApi.import(municipalityId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['streets'] });
    },
  });

  const handleStreetClick = async (street: Street, multiSelect = false) => {
    if (multiSelect && !paintMode) {
      toggleStreetSelection(street.id);
      return;
    }

    setHighlightedStreet(street.id);
    setSelectedStreet(street);

    if (paintMode && selectedMicroareaId) {
      assignMutation.mutate({
        streetIds: [street.id],
        microareaId: selectedMicroareaId,
      });
    }
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

  const handleAssign = (microareaId: string, forceTransfer = false) => {
    handleBulkAssign(microareaId, forceTransfer);
  };

  const tile = TILE_LAYERS[baseLayer];

  return (
    <Box sx={{ position: 'relative', height: 'calc(100vh - 64px)', width: '100%' }}>
      <MapToolbar
        onImport={() => importMutation.mutate()}
        importing={importMutation.isPending}
        conflictMsg={conflictMsg}
        onForceTransfer={() => {
          if (selectedMicroareaId) {
            handleBulkAssign(selectedMicroareaId, true);
          }
        }}
        selectedCount={selectedStreetIds.size}
      />

      <MapLegend microareas={microareas} />

      {isLoading && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            zIndex: 1000,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <CircularProgress />
        </Box>
      )}

      <MapContainer
        center={[PASSAGEM_FRANCA.lat, PASSAGEM_FRANCA.lng]}
        zoom={PASSAGEM_FRANCA.zoom}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <MapCenterController
          lat={PASSAGEM_FRANCA.lat}
          lng={PASSAGEM_FRANCA.lng}
          zoom={PASSAGEM_FRANCA.zoom}
        />
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked={baseLayer === 'map'} name="Mapa">
            <TileLayer url={TILE_LAYERS.map.url} attribution={TILE_LAYERS.map.attribution} />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer checked={baseLayer === 'satellite'} name="Satélite">
            <TileLayer url={TILE_LAYERS.satellite.url} attribution={TILE_LAYERS.satellite.attribution} />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer checked={baseLayer === 'terrain'} name="Relevo">
            <TileLayer url={TILE_LAYERS.terrain.url} attribution={TILE_LAYERS.terrain.attribution} />
          </LayersControl.BaseLayer>
        </LayersControl>
        {!['map', 'satellite', 'terrain'].includes(baseLayer) && (
          <TileLayer url={tile.url} attribution={tile.attribution} />
        )}
        <ScaleControl imperial={false} />
        <MicroareaEnvelopesLayer microareas={microareas} />
        {streetsData?.items && (
          <StreetsLayer
            streets={streetsData.items}
            onStreetClick={handleStreetClick}
          />
        )}
      </MapContainer>

      {selectedStreet && (
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
    </Box>
  );
}