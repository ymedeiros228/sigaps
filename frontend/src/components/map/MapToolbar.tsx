import {
  Box,
  Paper,
  IconButton,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
  Button,
  Chip,
  Divider,
  Popover,
  Switch,
  Typography,
  useMediaQuery,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Fullscreen,
  FullscreenExit,
  MyLocation,
  Satellite,
  Terrain,
  Map as MapIcon,
  Download,
  AutoFixOff,
  FormatPaint,
  Layers,
} from '@mui/icons-material';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAppStore, useMapStore, useAuthStore } from '../../store';
import { MapExportMenu } from './MapExportMenu';
import { StreetSearchBar, type StreetSearchOption } from './StreetSearchBar';
import { canImportStreets } from '../../utils/permissions';
import { countPaintedStreets, countStreetsWithFamilyData, sumFamiliesOnStreets } from '../../utils/streetPaintStats';
import type { RefObject } from 'react';
import type { Microarea, Street } from '../../services/api';
import type { MapBaseLayerId } from '../../constants/mapTiles';

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
}

const BASE_LAYERS: { id: MapBaseLayerId; label: string; hint: string; icon: ReactNode }[] = [
  { id: 'map', label: 'Ruas', hint: 'Mapa de ruas (OpenStreetMap)', icon: <MapIcon fontSize="small" /> },
  {
    id: 'satellite',
    label: 'Satélite',
    hint: 'Satélite — se o fundo ficar preto, volte em Ruas',
    icon: <Satellite fontSize="small" />,
  },
  { id: 'terrain', label: 'Relevo', hint: 'Relevo', icon: <Terrain fontSize="small" /> },
];

/** Tela cheia só onde o navegador deixa (o iPhone, por exemplo, não deixa). */
const fullscreenSupported = () =>
  typeof document !== 'undefined' && !!document.documentElement.requestFullscreen;

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
}: MapToolbarProps) {
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down('md'));
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
  const [layersAnchor, setLayersAnchor] = useState<HTMLElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(() => !!document.fullscreenElement);

  useEffect(() => {
    const sync = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

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

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  };

  const glassBg = theme.palette.mode === 'dark'
    ? alpha(theme.palette.background.paper, 0.9)
    : alpha('#fff', 0.94);

  const showImport = !readOnly && canImport && (streetCount > 0 || importing);
  // Camadas extras só fazem sentido fora do modo pintar (lá o painel de baixo manda).
  const activeOverlays = [showEnvelopes, showHeatmap, showUbsMarkers, showPlacesMarkers].filter(Boolean).length;

  const baseLayerToggle = (fullWidth: boolean) => (
    <ToggleButtonGroup
      size="small"
      exclusive
      fullWidth={fullWidth}
      value={baseLayer}
      onChange={(_, v) => v && setBaseLayer(v)}
      aria-label="Fundo do mapa"
      sx={{ bgcolor: alpha(theme.palette.action.hover, 0.5), flexShrink: 0 }}
    >
      {BASE_LAYERS.map((layer) => (
        <Tooltip key={layer.id} title={fullWidth ? '' : layer.hint}>
          <ToggleButton value={layer.id} aria-label={layer.label} sx={{ gap: 0.75, px: fullWidth ? 1 : 1.25, textTransform: 'none' }}>
            {layer.icon}
            {fullWidth && (
              <Typography component="span" variant="body2" sx={{ fontWeight: 600 }}>
                {layer.label}
              </Typography>
            )}
          </ToggleButton>
        </Tooltip>
      ))}
    </ToggleButtonGroup>
  );

  const layerSwitch = (
    label: string,
    checked: boolean,
    onChange: (value: boolean) => void,
    options: { hint?: string; disabled?: boolean; testId?: string } = {},
  ) => (
    <Box
      component="label"
      data-testid={options.testId}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        minHeight: 44,
        px: 1,
        mx: -1,
        borderRadius: 2,
        cursor: options.disabled ? 'default' : 'pointer',
        '&:hover': options.disabled ? undefined : { bgcolor: 'action.hover' },
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }} color={options.disabled ? 'text.disabled' : 'text.primary'}>
          {label}
        </Typography>
        {options.hint && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.3 }}>
            {options.hint}
          </Typography>
        )}
      </Box>
      <Switch
        size="small"
        checked={checked}
        disabled={options.disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </Box>
  );

  return (
    <Paper
      className={`map-float-panel map-toolbar-root${paintMode ? ' map-toolbar-root--paint' : ''}`}
      elevation={0}
      sx={{
        position: 'absolute',
        top: { xs: 8, sm: 12 },
        left: { xs: 8, sm: 12 },
        right: { xs: 8, sm: 12 },
        zIndex: 1000,
        px: { xs: 1, sm: 1.25 },
        py: 1,
        borderRadius: 3,
        bgcolor: glassBg,
        display: 'flex',
        flexWrap: 'nowrap',
        gap: 1,
        alignItems: 'center',
      }}
    >
      <Box sx={{ flex: '1 1 0', minWidth: 0, maxWidth: { md: 440 } }}>
        <StreetSearchBar municipalityId={municipalityId} streets={streets} onSelect={onSearchSelect} />
      </Box>

      {!compact && baseLayerToggle(false)}

      {paintMode && (
        <Chip
          icon={eraserMode ? <AutoFixOff fontSize="small" /> : <FormatPaint fontSize="small" />}
          label={eraserMode ? 'Apagando' : 'Pintando'}
          color={eraserMode ? 'error' : 'primary'}
          size="small"
          sx={{ fontWeight: 700 }}
        />
      )}

      {!paintMode && readOnly && (
        <Chip label="Consulta — sua microárea" size="small" color="primary" variant="outlined" />
      )}

      {selectedCount > 0 && (
        <Chip size="small" label={`${selectedCount} selecionada(s)`} color="info" variant="outlined" />
      )}

      {streetCount > 0 && !compact && (
        <Tooltip title="Ruas com microárea na área carregada">
          <Chip
            label={`${coverage}% pintado`}
            size="small"
            color={coverage >= 80 ? 'success' : coverage >= 40 ? 'warning' : 'default'}
            variant="outlined"
            sx={{ fontWeight: 700 }}
          />
        </Tooltip>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 'auto', flexShrink: 0 }}>
        {showImport && !compact && (
          <Button
            size="small"
            variant="text"
            onClick={onImport}
            disabled={importing}
            startIcon={<Download fontSize="small" />}
          >
            {importing ? 'Atualizando…' : 'Atualizar ruas'}
          </Button>
        )}

        {!paintMode && (
          <MapExportMenu
            mapContainerRef={mapContainerRef}
            microareas={microareas}
            onImportFamilies={onImportFamilies}
          />
        )}

        <Tooltip title="Camadas e fundo do mapa">
          <Button
            size="small"
            variant={layersAnchor ? 'contained' : 'outlined'}
            color="inherit"
            onClick={(e) => setLayersAnchor(e.currentTarget)}
            aria-label="Camadas"
            aria-haspopup="dialog"
            startIcon={<Layers fontSize="small" />}
            sx={{
              minWidth: 0,
              borderColor: 'divider',
              px: 1.25,
              '& .MuiButton-startIcon': { mr: { xs: 0, md: 0.75 } },
            }}
          >
            <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>
              Camadas
            </Box>
            {!paintMode && activeOverlays > 0 && (
              <Box
                component="span"
                sx={{
                  ml: 0.75,
                  minWidth: 18,
                  height: 18,
                  px: 0.5,
                  borderRadius: 9,
                  fontSize: 11,
                  fontWeight: 700,
                  lineHeight: '18px',
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                }}
              >
                {activeOverlays}
              </Box>
            )}
          </Button>
        </Tooltip>

        {!compact && fullscreenSupported() && (
          <Tooltip title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}>
            <IconButton size="small" onClick={toggleFullscreen} aria-label={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}>
              {isFullscreen ? <FullscreenExit fontSize="small" /> : <Fullscreen fontSize="small" />}
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title="Centralizar município">
          <IconButton size="small" onClick={() => flyTo(-6.1828, -43.7869, 14)} aria-label="Centralizar município">
            <MyLocation fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Popover
        open={!!layersAnchor}
        anchorEl={layersAnchor}
        onClose={() => setLayersAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: { mt: 1, p: 2, width: 300, maxWidth: 'calc(100vw - 16px)', borderRadius: 3 },
          },
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
          Fundo do mapa
        </Typography>
        {baseLayerToggle(true)}

        {!paintMode && (
          <>
            <Divider sx={{ my: 1.5 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
              Mostrar no mapa
            </Typography>
            {layerSwitch('Áreas das microáreas', showEnvelopes, setShowEnvelopes, {
              hint: 'Contorno de cada microárea',
            })}
            {layerSwitch(
              familyStats.total > 0 ? `Calor de famílias (${familyStats.total})` : 'Calor de famílias',
              showHeatmap,
              setShowHeatmap,
              {
                hint:
                  familyStats.streetsWithData === 0
                    ? 'Importe os dados do e-SUS para ativar'
                    : 'Onde há mais famílias por rua',
                disabled: familyStats.streetsWithData === 0,
                testId: 'toggle-heatmap',
              },
            )}
            {layerSwitch('UBS', showUbsMarkers, setShowUbsMarkers)}
            {layerSwitch('Povoados e localidades', showPlacesMarkers, setShowPlacesMarkers)}
          </>
        )}

        {(compact && (showImport || streetCount > 0 || fullscreenSupported())) && (
          <>
            <Divider sx={{ my: 1.5 }} />
            {streetCount > 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>
                  {coverage}%
                </Box>{' '}
                das ruas carregadas já têm microárea
              </Typography>
            )}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {showImport && (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    setLayersAnchor(null);
                    onImport();
                  }}
                  disabled={importing}
                  startIcon={<Download fontSize="small" />}
                >
                  {importing ? 'Atualizando…' : 'Atualizar ruas'}
                </Button>
              )}
              {fullscreenSupported() && (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    setLayersAnchor(null);
                    toggleFullscreen();
                  }}
                  startIcon={isFullscreen ? <FullscreenExit fontSize="small" /> : <Fullscreen fontSize="small" />}
                >
                  {isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
                </Button>
              )}
            </Box>
          </>
        )}
      </Popover>
    </Paper>
  );
}
