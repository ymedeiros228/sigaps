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
  Typography,
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
import { countPaintedStreets, countStreetsWithFamilyData, sumFamiliesOnStreets } from '../../utils/streetPaintStats';
import type { RefObject } from 'react';
import type { Microarea, Street } from '../../services/api';

interface MapToolbarProps {
  onImport: () => void;
  importing: boolean;
  streetCount: number;
  selectedCount?: number;
  mapContainerRef: RefObject<HTMLElement | null>;
  microareas: Microarea[];
  streets: Street[];
  onSearchSelect: (option: StreetSearchOption) => void;
  onImportFamilies?: () => void;
  readOnly?: boolean;
  cursorLatitude?: number | null;
  cursorLongitude?: number | null;
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
  readOnly = false,
  cursorLatitude = null,
  cursorLongitude = null,
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
  const showPlacesMarkers = useMapStore((s) => s.showPlacesMarkers);
  const setShowPlacesMarkers = useMapStore((s) => s.setShowPlacesMarkers);
  const flyTo = useMapStore((s) => s.flyTo);
  const user = useAuthStore((s) => s.user);
  const canImport = canImportStreets(user?.role);

  const coverage = useMemo(() => {
    if (streetCount === 0) return 0;
    const painted = countPaintedStreets(streets);
    return Math.round((painted / streetCount) * 100);
  }, [streets, streetCount]);

  const familyStats = useMemo(
    () => ({
      total: sumFamiliesOnStreets(streets),
      streetsWithData: countStreetsWithFamilyData(streets),
    }),
    [streets],
  );

  const handleSearchSelect = (option: StreetSearchOption) => {
    onSearchSelect(option);
  };

  const glassBg = theme.palette.mode === 'dark'
    ? alpha(theme.palette.background.paper, 0.88)
    : alpha('#fff', 0.92);

  const hasCursorCoords =
    cursorLatitude != null && cursorLongitude != null && Number.isFinite(cursorLatitude) && Number.isFinite(cursorLongitude);

  return (
    <Paper
      className={`map-float-panel map-toolbar-root${paintMode ? ' map-toolbar-root--paint' : ''}`}
      elevation={0}
      sx={{
        ...panelSx,
        bgcolor: glassBg,
        display: 'flex',
        flexWrap: 'wrap',
        gap: paintMode ? 0.75 : 1,
        alignItems: 'center',
        py: paintMode ? 1 : 1.5,
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
          <Tooltip title="Mapa de ruas OpenStreetMap"><MapIcon fontSize="small" /></Tooltip>
        </ToggleButton>
        <ToggleButton value="satellite">
          <Tooltip title="Satélite — se o fundo ficar preto, volte em Mapa"><Satellite fontSize="small" /></Tooltip>
        </ToggleButton>
        <ToggleButton value="terrain">
          <Tooltip title="Relevo"><Terrain fontSize="small" /></Tooltip>
        </ToggleButton>
      </ToggleButtonGroup>

      {paintMode && (
        <Chip
          icon={eraserMode ? <AutoFixOff fontSize="small" /> : <FormatPaint fontSize="small" />}
          label={eraserMode ? 'Apagando' : 'Pintando'}
          color={eraserMode ? 'error' : 'primary'}
          size="small"
          sx={{ fontWeight: 700 }}
        />
      )}

      {streetCount > 0 && (
        <Chip
          label={`${coverage}%`}
          size="small"
          color={coverage >= 80 ? 'success' : coverage >= 40 ? 'warning' : 'default'}
          variant="outlined"
          sx={{ fontWeight: 700, display: { xs: 'none', sm: 'flex' }, minWidth: 52 }}
        />
      )}

      {!paintMode && readOnly && (
        <Chip label="Consulta — sua microárea" size="small" color="primary" variant="outlined" />
      )}

      {!readOnly && canImport && (streetCount > 0 || importing) && (
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

      {!paintMode && streetCount > 0 && (
        <Chip
          label="Toque na rua para detalhes"
          size="small"
          variant="outlined"
          sx={{ fontWeight: 600, display: { xs: 'none', lg: 'flex' } }}
        />
      )}

      {!paintMode && (
      <>
      <FormControlLabel
        control={
          <Switch
            size="small"
            checked={showEnvelopes}
            onChange={(e) => setShowEnvelopes(e.target.checked)}
          />
        }
        label="Áreas (polígonos)"
        sx={{ mr: 0 }}
      />

      <Tooltip
        title={
          familyStats.streetsWithData === 0
            ? 'Importe dados e-SUS para ver o mapa de calor'
            : 'Sobrepõe calor de famílias sobre as cores das microáreas'
        }
      >
        <FormControlLabel
          data-testid="toggle-heatmap"
          control={
            <Switch
              size="small"
              checked={showHeatmap}
              onChange={(e) => setShowHeatmap(e.target.checked)}
              disabled={familyStats.streetsWithData === 0}
            />
          }
          label={
            familyStats.total > 0
              ? `Famílias (${familyStats.total})`
              : 'Famílias'
          }
          sx={{ mr: 0, display: { xs: 'none', md: 'flex' } }}
        />
      </Tooltip>

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

      <FormControlLabel
        control={
          <Switch
            size="small"
            checked={showPlacesMarkers}
            onChange={(e) => setShowPlacesMarkers(e.target.checked)}
          />
        }
        label="Povoados"
        sx={{ mr: 0, display: { xs: 'none', lg: 'flex' } }}
      />

      <MapExportMenu
        mapContainerRef={mapContainerRef}
        microareas={microareas}
        onImportFamilies={onImportFamilies}
      />
      </>
      )}

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

      {!paintMode && (
      <Box
        sx={{
          flexBasis: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          pt: 0.75,
          mt: 0.25,
          borderTop: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
        }}
      >
        <MyLocation fontSize="small" color="action" sx={{ flexShrink: 0 }} />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>
            Coordenadas do cursor
          </Typography>
          <Typography
            variant="caption"
            component="span"
            sx={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: 0.2 }}
          >
            {hasCursorCoords
              ? `${cursorLatitude!.toFixed(5)}, ${cursorLongitude!.toFixed(5)}`
              : 'Passe o mouse no mapa'}
          </Typography>
        </Box>
      </Box>
      )}
    </Paper>
  );
}
