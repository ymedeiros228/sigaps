import {
  Box,
  Paper,
  IconButton,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
  Button,
  Chip,
  FormControlLabel,
  Switch,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Fullscreen,
  MyLocation,
  Satellite,
  Terrain,
  Map as MapIcon,
  Download,
} from '@mui/icons-material';
import { useAppStore, useMapStore, useAuthStore } from '../../store';
import { MapExportMenu } from './MapExportMenu';
import { StreetSearchBar, type StreetSearchOption } from './StreetSearchBar';
import { canImportStreets } from '../../utils/permissions';
import type { RefObject } from 'react';
import type { Microarea } from '../../services/api';

interface MapToolbarProps {
  onImport: () => void;
  importing: boolean;
  streetCount: number;
  selectedCount?: number;
  mapContainerRef: RefObject<HTMLElement | null>;
  microareas: Microarea[];
  streets: Array<{ id: string; name: string; streetType?: string; geojson: GeoJSON.LineString }>;
  onLocateStreet: (streetId: string, geojson?: GeoJSON.LineString) => void;
}

const panelSx = {
  position: 'absolute' as const,
  top: 16,
  left: 16,
  right: 16,
  zIndex: 1000,
  p: 1.5,
  borderRadius: 3,
};

export function MapToolbar({
  onImport,
  importing,
  streetCount,
  selectedCount = 0,
  mapContainerRef,
  microareas,
  streets,
  onLocateStreet,
}: MapToolbarProps) {
  const theme = useTheme();
  const municipalityId = useAppStore((s) => s.municipalityId);
  const paintMode = useMapStore((s) => s.paintMode);
  const setSelectedMicroarea = useMapStore((s) => s.setSelectedMicroarea);
  const setPaintMode = useMapStore((s) => s.setPaintMode);
  const baseLayer = useMapStore((s) => s.baseLayer);
  const setBaseLayer = useMapStore((s) => s.setBaseLayer);
  const showEnvelopes = useMapStore((s) => s.showEnvelopes);
  const setShowEnvelopes = useMapStore((s) => s.setShowEnvelopes);
  const flyTo = useMapStore((s) => s.flyTo);
  const user = useAuthStore((s) => s.user);
  const canImport = canImportStreets(user?.role);

  const handleSearchSelect = (option: StreetSearchOption) => {
    if (option.kind === 'street') {
      onLocateStreet(option.id, option.geojson);
    }
    if (option.kind === 'microarea') {
      setSelectedMicroarea(option.id);
      setPaintMode(true);
    }
    if (option.kind === 'ubs' && option.lat && option.lng) flyTo(option.lat, option.lng);
  };

  const glassBg = theme.palette.mode === 'dark'
    ? alpha(theme.palette.background.paper, 0.88)
    : alpha('#fff', 0.92);

  return (
    <Paper
      className="map-float-panel"
      elevation={0}
      sx={{
        ...panelSx,
        bgcolor: glassBg,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 1,
        alignItems: 'center',
      }}
    >
      <StreetSearchBar
        municipalityId={municipalityId}
        streets={streets}
        onSelect={handleSearchSelect}
      />

      <ToggleButtonGroup
        size="small"
        exclusive
        value={baseLayer}
        onChange={(_, v) => v && setBaseLayer(v)}
        sx={{ bgcolor: alpha(theme.palette.action.hover, 0.5) }}
      >
        <ToggleButton value="map">
          <Tooltip title="Mapa padrão"><MapIcon fontSize="small" /></Tooltip>
        </ToggleButton>
        <ToggleButton value="satellite">
          <Tooltip title="Satélite"><Satellite fontSize="small" /></Tooltip>
        </ToggleButton>
        <ToggleButton value="terrain">
          <Tooltip title="Relevo"><Terrain fontSize="small" /></Tooltip>
        </ToggleButton>
      </ToggleButtonGroup>

      {!paintMode && streetCount > 0 && (
        <Chip
          label="Clique na rua para selecionar"
          size="small"
          variant="outlined"
          sx={{ fontWeight: 600, display: { xs: 'none', md: 'flex' } }}
        />
      )}

      {paintMode && (
        <Chip label="Pintando" color="primary" size="small" sx={{ fontWeight: 700 }} />
      )}

      {canImport && (streetCount > 0 || importing) && (
        <Button
          size="small"
          variant="outlined"
          onClick={onImport}
          disabled={importing}
          startIcon={<Download fontSize="small" />}
        >
          {importing ? 'Atualizando...' : 'Atualizar ruas'}
        </Button>
      )}

      {selectedCount > 0 && (
        <Chip
          size="small"
          label={`${selectedCount} selecionada(s)`}
          color="info"
          variant="outlined"
        />
      )}

      <FormControlLabel
        control={
          <Switch
            size="small"
            checked={showEnvelopes}
            onChange={(e) => setShowEnvelopes(e.target.checked)}
          />
        }
        label="Microáreas"
        sx={{ mr: 0 }}
      />

      <MapExportMenu mapContainerRef={mapContainerRef} microareas={microareas} />

      <Box sx={{ display: 'flex', gap: 0.5, ml: { md: 'auto' } }}>
        <Tooltip title="Tela cheia">
          <IconButton size="small" onClick={() => document.documentElement.requestFullscreen()}>
            <Fullscreen fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Centralizar município">
          <IconButton size="small" onClick={() => flyTo(-6.1828, -43.7869, 14)}>
            <MyLocation fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Paper>
  );
}
