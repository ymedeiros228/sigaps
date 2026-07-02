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
  AutoFixOff,
  FormatPaint,
} from '@mui/icons-material';
import { useMemo } from 'react';
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
  streets: Array<{ id: string; name: string; streetType?: string; geojson: GeoJSON.LineString; microareaId?: string | null }>;
  onSearchSelect: (option: StreetSearchOption) => void;
  onImportFamilies?: () => void;
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
  onSearchSelect,
  onImportFamilies,
}: MapToolbarProps) {
  const theme = useTheme();
  const municipalityId = useAppStore((s) => s.municipalityId);
  const paintMode = useMapStore((s) => s.paintMode);
  const eraserMode = useMapStore((s) => s.eraserMode);
  const baseLayer = useMapStore((s) => s.baseLayer);
  const setBaseLayer = useMapStore((s) => s.setBaseLayer);
  const showEnvelopes = useMapStore((s) => s.showEnvelopes);
  const setShowEnvelopes = useMapStore((s) => s.setShowEnvelopes);
  const showHeatmap = useMapStore((s) => s.showHeatmap);
  const setShowHeatmap = useMapStore((s) => s.setShowHeatmap);
  const showUbsMarkers = useMapStore((s) => s.showUbsMarkers);
  const setShowUbsMarkers = useMapStore((s) => s.setShowUbsMarkers);
  const flyTo = useMapStore((s) => s.flyTo);
  const user = useAuthStore((s) => s.user);
  const canImport = canImportStreets(user?.role);

  const coverage = useMemo(() => {
    if (streetCount === 0) return 0;
    const painted = streets.filter((s) => s.microareaId).length;
    return Math.round((painted / streetCount) * 100);
  }, [streets, streetCount]);

  const handleSearchSelect = (option: StreetSearchOption) => {
    onSearchSelect(option);
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

      {paintMode && eraserMode && (
        <Chip
          icon={<AutoFixOff fontSize="small" />}
          label="Apagando"
          color="error"
          size="small"
          sx={{ fontWeight: 700 }}
        />
      )}

      {paintMode && !eraserMode && (
        <Chip
          icon={<FormatPaint fontSize="small" />}
          label="Pintando"
          color="primary"
          size="small"
          sx={{ fontWeight: 700 }}
        />
      )}

      {streetCount > 0 && (
        <Chip
          label={`${coverage}% cobertura`}
          size="small"
          color={coverage >= 80 ? 'success' : coverage >= 40 ? 'warning' : 'default'}
          variant="outlined"
          sx={{ fontWeight: 700, display: { xs: 'none', sm: 'flex' } }}
        />
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

      <FormControlLabel
        control={
          <Switch
            size="small"
            checked={showHeatmap}
            onChange={(e) => setShowHeatmap(e.target.checked)}
          />
        }
        label="Famílias"
        sx={{ mr: 0, display: { xs: 'none', md: 'flex' } }}
      />

      <FormControlLabel
        control={
          <Switch
            size="small"
            checked={showUbsMarkers}
            onChange={(e) => setShowUbsMarkers(e.target.checked)}
          />
        }
        label="UBS"
        sx={{ mr: 0, display: { xs: 'none', lg: 'flex' } }}
      />

      <MapExportMenu
        mapContainerRef={mapContainerRef}
        microareas={microareas}
        onImportFamilies={onImportFamilies}
      />

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
