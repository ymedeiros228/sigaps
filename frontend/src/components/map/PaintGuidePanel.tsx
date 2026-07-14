import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
  Alert,
  alpha,
  useTheme,
  IconButton,
  Collapse,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from '@mui/material';
import {
  Brush,
  ExpandLess,
  ExpandMore,
  CheckCircle,
  PanTool,
  Add,
  FormatPaint,
  AutoFixOff,
  DeleteSweep,
  UnfoldLess,
  ContentCut,
} from '@mui/icons-material';
import { useState, useMemo, type MouseEvent } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import type { Microarea, Street } from '../../services/api';
import { useMapStore } from '../../store';
import { useQuery } from '@tanstack/react-query';
import { neighborhoodsApi } from '../../services/api';
import { CACHE, queryKeys } from '../../utils/queryKeys';
import { canCreateMicroarea } from '../../utils/permissions';
import { useAuthStore } from '../../store';
import { AddMicroareaDialog } from './AddMicroareaDialog';
import { ClearPaintDialog } from './ClearPaintDialog';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { sortMicroareas } from '../../utils/sortMicroareas';
import { countPaintedStreets, countStreetsForMicroarea } from '../../utils/streetPaintStats';
import { streetHasPaint } from '../../utils/streetPaintSegments';

interface PaintGuidePanelProps {
  microareas: Microarea[];
  streets: Street[];
  streetCount: number;
  municipalityId: string;
  onPaintStreets: (streetIds: string[]) => void;
  onClearAllPaint: () => void;
  onClearMicroareaPaint: (microareaId: string) => void;
  paintZoneCount?: number;
  onClearPaintZones?: () => void;
  clearingPaintZones?: boolean;
  clearingPaint: boolean;
  importing: boolean;
  lastAction?: string | null;
  onMicroareaCreated?: (id: string) => void;
  onMinimized?: () => void;
  cursorLatitude?: number | null;
  cursorLongitude?: number | null;
  undoCount?: number;
  onUndo?: () => void;
}

export function PaintGuidePanel({
  microareas,
  streets,
  streetCount,
  municipalityId,
  onPaintStreets,
  onClearAllPaint,
  onClearMicroareaPaint,
  paintZoneCount = 0,
  onClearPaintZones,
  clearingPaintZones = false,
  clearingPaint,
  importing,
  lastAction,
  onMicroareaCreated,
  onMinimized,
  cursorLatitude = null,
  cursorLongitude = null,
  undoCount = 0,
  onUndo,
}: PaintGuidePanelProps) {
  const theme = useTheme();
  const user = useAuthStore((s) => s.user);
  const canAddMicroarea = canCreateMicroarea(user?.role);
  const [addOpen, setAddOpen] = useState(false);
  const [clearDialog, setClearDialog] = useState<'all' | 'microarea' | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [neighborhoodConfirm, setNeighborhoodConfirm] = useState<{ id: string; name: string; count: number } | null>(null);
  const [dirtRoadConfirm, setDirtRoadConfirm] = useState<{ count: number } | null>(null);
  const paintMode = useMapStore((s) => s.paintMode);
  const eraserMode = useMapStore((s) => s.eraserMode);
  const setPaintMode = useMapStore((s) => s.setPaintMode);
  const setEraserMode = useMapStore((s) => s.setEraserMode);
  const mapPanEnabled = useMapStore((s) => s.mapPanEnabled);
  const setMapPanEnabled = useMapStore((s) => s.setMapPanEnabled);
  const selectedMicroareaId = useMapStore((s) => s.selectedMicroareaId);
  const setSelectedMicroarea = useMapStore((s) => s.setSelectedMicroarea);
  const paintStreetSide = useMapStore((s) => s.paintStreetSide);
  const setPaintStreetSide = useMapStore((s) => s.setPaintStreetSide);
  const paintScope = useMapStore((s) => s.paintScope);
  const setPaintScope = useMapStore((s) => s.setPaintScope);
  const collapsed = useMapStore((s) => s.paintGuideCollapsed);
  const setPaintGuideCollapsed = useMapStore((s) => s.setPaintGuideCollapsed);

  const sortedMicroareas = useMemo(() => sortMicroareas(microareas), [microareas]);

  const selectedMicroarea = microareas.find((m) => m.id === selectedMicroareaId);
  const paintedCount = useMemo(() => countPaintedStreets(streets), [streets]);
  const selectedMicroareaPaintedCount = selectedMicroareaId
    ? countStreetsForMicroarea(streets, selectedMicroareaId)
    : 0;
  const unpaintedDirtRoadIds = streets
    .filter(
      (s) =>
        !streetHasPaint(s) &&
        (s.streetType ?? '').toLowerCase().includes('terra'),
    )
    .map((s) => s.id);

  const glassBg = theme.palette.mode === 'dark'
    ? alpha(theme.palette.background.paper, 0.94)
    : alpha('#fff', 0.96);

  const canPaint = streetCount > 0 && !!selectedMicroareaId && !eraserMode;

  const hasCursorCoords =
    cursorLatitude != null &&
    cursorLongitude != null &&
    Number.isFinite(cursorLatitude) &&
    Number.isFinite(cursorLongitude);

  const { data: neighborhoods = [] } = useQuery({
    queryKey: queryKeys.neighborhoods(municipalityId),
    queryFn: () => neighborhoodsApi.list(municipalityId).then((r) => r.data),
    enabled: !!municipalityId,
    staleTime: CACHE.neighborhoods,
  });

  const handlePaintNeighborhood = (neighborhoodId: string, neighborhoodName: string) => {
    if (!selectedMicroareaId || eraserMode) return;
    const ids = streets
      .filter((s) => s.neighborhood?.id === neighborhoodId)
      .map((s) => s.id);
    if (ids.length === 0) return;
    setNeighborhoodConfirm({ id: neighborhoodId, name: neighborhoodName, count: ids.length });
  };

  const handleStartPaint = () => {
    if (!selectedMicroareaId && microareas.length > 0) {
      setSelectedMicroarea(microareas[0].id);
    }
    setEraserMode(false);
    setMapPanEnabled(false);
    setPaintMode(true);
    setPaintGuideCollapsed(false);
  };

  const handleStartEraser = () => {
    setPaintMode(true);
    setEraserMode(true);
    setMapPanEnabled(false);
    setPaintGuideCollapsed(false);
  };

  const handleMinimize = (e?: MouseEvent) => {
    e?.stopPropagation();
    setPaintGuideCollapsed(true);
    setPaintMode(false);
    setEraserMode(false);
    onMinimized?.();
  };

  const handleToggleMicroarea = (microareaId: string) => {
    const isSelected = microareaId === selectedMicroareaId && !eraserMode;
    if (isSelected) {
      setSelectedMicroarea(null);
      return;
    }
    setSelectedMicroarea(microareaId);
    setEraserMode(false);
    setMapPanEnabled(false);
    setPaintMode(true);
  };

  const paintStatus = eraserMode
    ? 'Clique na rua colorida para apagar o trecho'
    : mapPanEnabled
      ? 'Arraste o mapa — desative Mover para pintar'
      : paintScope === 'whole'
        ? 'Um clique pinta a rua inteira'
        : paintScope === 'brush'
          ? selectedMicroarea
            ? `Arraste na rua · ${selectedMicroarea.name}`
            : 'Escolha uma cor abaixo'
          : selectedMicroarea
            ? `Clique na rua para cortar e pintar · ${selectedMicroarea.name}`
            : 'Escolha uma cor abaixo';

  const brushMode =
    paintScope === 'whole' ? 'whole' : paintScope === 'brush' ? 'brush' : 'segment';

  const handleBrushMode = (mode: 'brush' | 'segment' | 'whole') => {
    if (mode === 'whole') {
      setPaintScope('whole');
      setPaintStreetSide('FULL');
      return;
    }
    if (mode === 'segment') {
      setPaintScope('segment');
      setPaintStreetSide('FULL');
      return;
    }
    setPaintScope('brush');
    setPaintStreetSide('FULL');
  };

  return (
    <>
      <Paper
        data-testid="paint-guide"
        className={`map-float-panel map-paint-panel${collapsed ? ' map-paint-panel--collapsed' : ''}`}
        elevation={0}
        sx={{
          position: 'absolute',
          top: { xs: 'auto', sm: 'var(--map-toolbar-offset, 120px)' },
          bottom: { xs: 12, sm: 16 },
          right: { xs: 8, sm: 16 },
          left: { xs: 8, sm: 'auto' },
          zIndex: 1001,
          width: collapsed
            ? { xs: 'auto', sm: 220 }
            : { xs: 'auto', sm: 300, md: 320 },
          maxWidth: { xs: 'calc(100% - 16px)', sm: 320 },
          maxHeight: {
            xs: collapsed ? 'auto' : 'min(52vh, 420px)',
            sm: 'calc(100% - var(--map-toolbar-offset, 120px) - 24px)',
          },
          display: 'flex',
          flexDirection: 'column',
          bgcolor: glassBg,
          borderRadius: 3,
          overflow: 'hidden',
          border: '1px solid',
          borderColor: alpha(theme.palette.divider, 0.16),
        }}
      >
        <Box
          data-testid="paint-guide-header"
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 1.5,
            py: collapsed ? 1 : 1.1,
            flexShrink: 0,
            borderBottom: collapsed ? 'none' : `1px solid ${alpha(theme.palette.divider, 0.12)}`,
            cursor: 'pointer',
            gap: 1,
          }}
          onClick={() => setPaintGuideCollapsed(!collapsed)}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0, flex: 1 }}>
            {collapsed ? (
              <CheckCircle color="success" fontSize="small" />
            ) : eraserMode ? (
              <AutoFixOff color="error" fontSize="small" />
            ) : (
              <Brush color={paintMode ? 'primary' : 'action'} fontSize="small" />
            )}
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                {collapsed
                  ? 'Pintura'
                  : eraserMode
                    ? 'Apagar'
                    : paintMode
                      ? 'Pintar'
                      : 'Pintar microáreas'}
              </Typography>
              {!collapsed && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', lineHeight: 1.3, mt: 0.15 }}
                >
                  {paintMode ? paintStatus : 'Escolha a cor e toque na rua'}
                </Typography>
              )}
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
            {!collapsed && selectedMicroarea && !eraserMode && (
              <Chip
                size="small"
                label={selectedMicroarea.name.replace(/^Microárea\s*/i, 'M')}
                sx={{
                  bgcolor: selectedMicroarea.color,
                  color: '#fff',
                  fontWeight: 700,
                  height: 22,
                  fontSize: '0.7rem',
                }}
              />
            )}
            {!collapsed && (
              <Tooltip title="Guardar e ver o mapa">
                <Button
                  size="small"
                  variant="text"
                  color="inherit"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMinimize(e);
                  }}
                  sx={{ fontWeight: 700, minWidth: 0, px: 0.75, fontSize: '0.75rem' }}
                >
                  Guardar
                </Button>
              </Tooltip>
            )}
            <Tooltip title={collapsed ? 'Abrir painel' : 'Recolher'}>
              <IconButton
                size="small"
                aria-label={collapsed ? 'Abrir painel' : 'Recolher painel'}
                onClick={(e) => {
                  e.stopPropagation();
                  if (collapsed) setPaintGuideCollapsed(false);
                  else handleMinimize(e);
                }}
              >
                {collapsed ? <ExpandLess fontSize="small" /> : <UnfoldLess fontSize="small" />}
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {!collapsed && (
          <Collapse in={!collapsed} timeout={280}>
          <Box
            sx={{
              p: 1.5,
              pt: 1.25,
              overflowY: 'auto',
              flex: 1,
              minHeight: 0,
            }}
          >
            {microareas.length === 0 ? (
              <Alert severity="warning" sx={{ borderRadius: 2 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                  Nenhuma microárea cadastrada
                </Typography>
                Antes de pintar, cadastre as microáreas do município.
                {canAddMicroarea ? (
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => setAddOpen(true)}
                    sx={{ mt: 1, display: 'block' }}
                  >
                    Adicionar microárea
                  </Button>
                ) : (
                  <Button
                    component={RouterLink}
                    to="/cadastros"
                    size="small"
                    sx={{ mt: 1, display: 'block' }}
                  >
                    Ir para Cadastros → Microáreas
                  </Button>
                )}
              </Alert>
            ) : streetCount === 0 ? (
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                Carregando ruas do município. Aguarde alguns segundos.
              </Alert>
            ) : paintedCount === 0 ? (
              <Alert severity="success" data-testid="paint-guide-empty-map" sx={{ borderRadius: 2, mb: 1, py: 0.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }}>
                  Mapa zerado — escolha a cor e pinte
                </Typography>
              </Alert>
            ) : null}
            {streetCount > 0 && (
              <>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.75, display: 'block' }}>
                  Cores do ACS
                </Typography>
                <Box
                  className="map-microarea-chips"
                  sx={{
                    display: 'flex',
                    gap: 0.5,
                    pb: 0.25,
                    mb: 1,
                    flexWrap: 'wrap',
                  }}
                >
                  {sortedMicroareas.map((m) => {
                    const selected = m.id === selectedMicroareaId;
                    const count = m._count?.streets ?? countStreetsForMicroarea(streets, m.id);
                    const tip = m.acs?.name ? `${m.name} — ACS ${m.acs.name}` : m.name;
                    return (
                      <Tooltip key={m.id} title={tip} arrow placement="top">
                        <Button
                          className="map-microarea-chip"
                          data-testid={`paint-chip-${m.number}`}
                          variant={selected && !eraserMode ? 'contained' : 'outlined'}
                          size="small"
                          onClick={() => handleToggleMicroarea(m.id)}
                          sx={{
                            fontSize: '0.72rem',
                            py: 0.4,
                            px: 1,
                            gap: 0.5,
                            borderColor: m.color,
                            borderWidth: 1.5,
                            fontWeight: 700,
                            borderRadius: 999,
                            minWidth: 0,
                            ...(selected && !eraserMode && {
                              bgcolor: m.color,
                              color: '#fff',
                              boxShadow: `0 2px 8px ${alpha(m.color, 0.35)}`,
                              '&:hover': { bgcolor: m.color, filter: 'brightness(0.95)' },
                            }),
                          }}
                        >
                          <Box
                            component="span"
                            sx={{
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              bgcolor: selected && !eraserMode ? '#fff' : m.color,
                              flexShrink: 0,
                            }}
                          />
                          <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {m.name}
                          </Box>
                          {count > 0 && (
                            <Typography component="span" variant="caption" sx={{ opacity: 0.85, ml: 0.25, flexShrink: 0 }}>
                              {count}
                            </Typography>
                          )}
                        </Button>
                      </Tooltip>
                    );
                  })}
                  {canAddMicroarea && (
                    <IconButton
                      size="small"
                      onClick={() => setAddOpen(true)}
                      sx={{ border: '1px dashed', borderColor: 'divider', flexShrink: 0 }}
                      aria-label="Adicionar microárea"
                    >
                      <Add fontSize="small" />
                    </IconButton>
                  )}
                </Box>

                <AddMicroareaDialog
                  open={addOpen}
                  onClose={() => setAddOpen(false)}
                  municipalityId={municipalityId}
                  existingCount={microareas.length}
                  onCreated={(ma) => {
                    setSelectedMicroarea(ma.id);
                    setEraserMode(false);
                    onMicroareaCreated?.(ma.id);
                  }}
                />

                {paintMode && !eraserMode && (
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, mb: 0.5, display: 'block' }}>
                      Modo
                    </Typography>
                    <ToggleButtonGroup
                      exclusive
                      size="small"
                      fullWidth
                      value={brushMode}
                      onChange={(_e, value) => value && handleBrushMode(value)}
                      sx={{ mb: 0.5 }}
                    >
                      <ToggleButton
                        value="segment"
                        data-testid="paint-mode-segment"
                        sx={{ py: 0.5, gap: 0.35, fontWeight: 700, flex: 1, fontSize: '0.7rem' }}
                      >
                        <ContentCut sx={{ fontSize: 14 }} />
                        Cortar
                      </ToggleButton>
                      <ToggleButton
                        value="whole"
                        data-testid="paint-mode-whole"
                        sx={{ py: 0.5, fontWeight: 700, flex: 1, fontSize: '0.7rem' }}
                      >
                        Inteira
                      </ToggleButton>
                      <ToggleButton
                        value="brush"
                        data-testid="paint-mode-brush"
                        sx={{ py: 0.5, gap: 0.35, fontWeight: 700, flex: 1, fontSize: '0.7rem' }}
                      >
                        <Brush sx={{ fontSize: 14 }} />
                        Arrastar
                      </ToggleButton>
                    </ToggleButtonGroup>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.35, fontSize: '0.68rem' }}>
                      {brushMode === 'segment'
                        ? 'Clique no ponto de corte. Troque a cor e clique de novo.'
                        : brushMode === 'whole'
                          ? 'Um clique pinta a rua toda.'
                          : 'Arraste na rua, ou clique para cortar.'}
                    </Typography>
                    {advancedOpen && (
                      <Box sx={{ mt: 0.75 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>
                          Lado da avenida
                        </Typography>
                        <ToggleButtonGroup
                          exclusive
                          size="small"
                          fullWidth
                          value={paintStreetSide === 'LEFT' ? 'left' : paintStreetSide === 'RIGHT' ? 'right' : 'full'}
                          onChange={(_e, value) => {
                            if (!value) return;
                            if (value === 'left') setPaintStreetSide('LEFT');
                            else if (value === 'right') setPaintStreetSide('RIGHT');
                            else setPaintStreetSide('FULL');
                          }}
                        >
                          <ToggleButton value="full" sx={{ py: 0.4, fontWeight: 600, flex: 1, fontSize: '0.7rem' }}>
                            Ambos
                          </ToggleButton>
                          <ToggleButton value="left" sx={{ py: 0.4, fontWeight: 600, flex: 1, fontSize: '0.7rem' }}>
                            Esq.
                          </ToggleButton>
                          <ToggleButton value="right" sx={{ py: 0.4, fontWeight: 600, flex: 1, fontSize: '0.7rem' }}>
                            Dir.
                          </ToggleButton>
                        </ToggleButtonGroup>
                      </Box>
                    )}
                    <Button
                      size="small"
                      onClick={() => setAdvancedOpen((v) => !v)}
                      sx={{ mt: 0.25, textTransform: 'none', fontWeight: 600, px: 0.5, fontSize: '0.7rem' }}
                    >
                      {advancedOpen ? 'Ocultar lados' : 'Lados…'}
                    </Button>
                  </Box>
                )}

                {paintMode && eraserMode && paintedCount === 0 && (
                  <Alert severity="warning" sx={{ borderRadius: 2, mb: 1.25 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Nenhuma rua pintada para apagar
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Ruas cinza no mapa ainda não têm microárea. Use <strong>Pintar</strong> primeiro.
                    </Typography>
                  </Alert>
                )}

                {streetCount > 0 && (
                  <Box sx={{ display: 'flex', gap: 0.75, mb: paintMode ? 0 : 1.5, flexWrap: 'wrap' }}>
                    <ToggleButtonGroup
                      exclusive
                      size="small"
                      value={eraserMode ? 'eraser' : paintMode ? 'paint' : 'idle'}
                      sx={{ flex: 1, minWidth: 180 }}
                    >
                      <ToggleButton
                        value="paint"
                        data-testid="paint-mode-start"
                        onClick={handleStartPaint}
                        disabled={importing || microareas.length === 0}
                        sx={{ py: 0.75, gap: 0.5, fontWeight: 700, flex: 1 }}
                      >
                        <FormatPaint fontSize="small" />
                        Pintar
                      </ToggleButton>
                      <ToggleButton
                        value="eraser"
                        data-testid="paint-mode-eraser"
                        onClick={handleStartEraser}
                        disabled={importing || paintedCount === 0}
                        sx={{
                          py: 0.75,
                          gap: 0.5,
                          fontWeight: 700,
                          flex: 1,
                          '&.Mui-selected': {
                            bgcolor: alpha(theme.palette.error.main, 0.15),
                            color: 'error.main',
                            borderColor: alpha(theme.palette.error.main, 0.5),
                          },
                        }}
                      >
                        <AutoFixOff fontSize="small" />
                        Apagar
                      </ToggleButton>
                    </ToggleButtonGroup>
                    {paintMode && canPaint && (
                      <Button
                        variant={mapPanEnabled ? 'contained' : 'outlined'}
                        size="small"
                        startIcon={<PanTool />}
                        onClick={() => setMapPanEnabled(!mapPanEnabled)}
                        sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}
                      >
                        Mover
                      </Button>
                    )}
                    {paintMode && undoCount > 0 && onUndo && (
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={onUndo}
                        sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}
                      >
                        Desfazer ({undoCount})
                      </Button>
                    )}
                  </Box>
                )}

                {paintedCount > 0 && (
                  <Box
                    sx={{
                      mt: paintMode ? 1.25 : 2,
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: alpha(theme.palette.warning.main, 0.06),
                      border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`,
                    }}
                    data-testid="paint-clear-batch"
                  >
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, mb: 1, display: 'block' }}>
                      Limpar pinturas em lote
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {selectedMicroarea && selectedMicroareaPaintedCount > 0 && (
                        <Button
                          fullWidth
                          variant="outlined"
                          color="warning"
                          size="small"
                          startIcon={<DeleteSweep />}
                          disabled={clearingPaint}
                          onClick={() => setClearDialog('microarea')}
                          sx={{ justifyContent: 'flex-start', fontWeight: 600 }}
                        >
                          Limpar {selectedMicroarea.name} ({selectedMicroareaPaintedCount})
                        </Button>
                      )}
                      <Button
                        fullWidth
                        variant="outlined"
                        color="error"
                        size="small"
                        startIcon={<DeleteSweep />}
                        disabled={clearingPaint}
                        data-testid="paint-clear-all"
                        onClick={() => setClearDialog('all')}
                        sx={{ justifyContent: 'flex-start', fontWeight: 700 }}
                      >
                        Limpar todas ({paintedCount})
                      </Button>
                      {paintZoneCount > 0 && onClearPaintZones && (
                        <Button
                          fullWidth
                          variant="outlined"
                          color="warning"
                          size="small"
                          startIcon={<DeleteSweep />}
                          disabled={clearingPaintZones}
                          onClick={onClearPaintZones}
                          sx={{ justifyContent: 'flex-start', fontWeight: 600 }}
                        >
                          Remover círculos ({paintZoneCount})
                        </Button>
                      )}
                    </Box>
                    {paintMode && (neighborhoods.length > 0 || unpaintedDirtRoadIds.length > 0) && (
                      <>
                        <Button
                          fullWidth
                          size="small"
                          color="inherit"
                          onClick={() => setAdvancedOpen((open) => !open)}
                          endIcon={advancedOpen ? <ExpandLess /> : <ExpandMore />}
                          sx={{ justifyContent: 'space-between', fontWeight: 700, mt: 1.25 }}
                        >
                          Mais opções de pintura
                        </Button>
                        <Collapse in={advancedOpen}>
                          <Box sx={{ mt: 1 }}>
                            {canPaint && neighborhoods.length > 0 && (
                              <Box sx={{ mb: 1.5 }}>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.75, display: 'block' }}>
                                  Pintar bairro inteiro
                                </Typography>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                                  {neighborhoods.map((n) => {
                                    const count = streets.filter((s) => s.neighborhood?.id === n.id).length;
                                    if (count === 0) return null;
                                    return (
                                      <Button
                                        key={n.id}
                                        size="small"
                                        variant="outlined"
                                        onClick={() => handlePaintNeighborhood(n.id, n.name)}
                                      >
                                        {n.name} ({count})
                                      </Button>
                                    );
                                  })}
                                </Box>
                              </Box>
                            )}
                            {canPaint && unpaintedDirtRoadIds.length > 0 && (
                              <Button
                                fullWidth
                                size="small"
                                variant="outlined"
                                color="warning"
                                onClick={() => setDirtRoadConfirm({ count: unpaintedDirtRoadIds.length })}
                              >
                                Marcar estradas de terra ({unpaintedDirtRoadIds.length})
                              </Button>
                            )}
                          </Box>
                        </Collapse>
                      </>
                    )}
                    {paintMode && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                        Use <strong>Apagar</strong> para corrigir trecho a trecho.
                      </Typography>
                    )}
                  </Box>
                )}

                {lastAction && (
                  <Typography
                    variant="caption"
                    color="success.main"
                    sx={{ mt: 1, fontWeight: 600, display: 'block', textAlign: 'center' }}
                  >
                    {lastAction}
                  </Typography>
                )}

                {paintMode && hasCursorCoords && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      display: 'block',
                      mt: 1,
                      textAlign: 'center',
                      fontFamily: 'monospace',
                      fontWeight: 600,
                      letterSpacing: 0.2,
                    }}
                  >
                    {cursorLatitude!.toFixed(5)}, {cursorLongitude!.toFixed(5)}
                  </Typography>
                )}

                {streetCount > 0 && (
                  <Typography
                    variant="caption"
                    color="text.disabled"
                    sx={{ display: 'block', mt: 1.25, textAlign: 'center' }}
                  >
                    {paintMode
                      ? 'S sair do modo pintar'
                      : 'P pintar · E apagar · S sair'}
                  </Typography>
                )}
              </>
            )}
          </Box>
          </Collapse>
        )}
      </Paper>

      <ConfirmDialog
        open={!!neighborhoodConfirm}
        title={`Pintar bairro ${neighborhoodConfirm?.name ?? ''}?`}
        message={
          neighborhoodConfirm
            ? `Isso pinta ${neighborhoodConfirm.count} ruas de uma vez. Recomendamos pintar rua por rua para maior precisão. Deseja continuar?`
            : ''
        }
        confirmLabel="Pintar bairro"
        confirmColor="primary"
        onClose={() => setNeighborhoodConfirm(null)}
        onConfirm={() => {
          if (!neighborhoodConfirm) return;
          const ids = streets
            .filter((s) => s.neighborhood?.id === neighborhoodConfirm.id)
            .map((s) => s.id);
          onPaintStreets(ids);
          setNeighborhoodConfirm(null);
        }}
      />
      <ConfirmDialog
        open={!!dirtRoadConfirm}
        title="Marcar estradas de terra?"
        message={
          dirtRoadConfirm
            ? `Isso vincula ${dirtRoadConfirm.count} estrada(s) de terra carregadas no mapa à microárea ${selectedMicroarea?.name ?? 'selecionada'}. Deseja continuar?`
            : ''
        }
        confirmLabel="Marcar estradas"
        confirmColor="warning"
        onClose={() => setDirtRoadConfirm(null)}
        onConfirm={() => {
          onPaintStreets(unpaintedDirtRoadIds);
          setDirtRoadConfirm(null);
        }}
      />

      <ClearPaintDialog
        open={clearDialog === 'all'}
        scope="all"
        paintedCount={paintedCount}
        loading={clearingPaint}
        onClose={() => setClearDialog(null)}
        onConfirm={() => {
          onClearAllPaint();
          setClearDialog(null);
        }}
      />
      <ClearPaintDialog
        open={clearDialog === 'microarea'}
        scope="microarea"
        microareaName={selectedMicroarea?.name}
        paintedCount={selectedMicroareaPaintedCount}
        loading={clearingPaint}
        onClose={() => setClearDialog(null)}
        onConfirm={() => {
          if (selectedMicroareaId) onClearMicroareaPaint(selectedMicroareaId);
          setClearDialog(null);
        }}
      />
    </>
  );
}
