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
  TouchApp,
  Palette,
  ExpandLess,
  ExpandMore,
  CheckCircle,
  PanTool,
  Add,
  FormatPaint,
  AutoFixOff,
  DeleteSweep,
  UnfoldLess,
} from '@mui/icons-material';
import { useState, useMemo, type MouseEvent } from 'react';
import type { ReactNode } from 'react';
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
  const collapsed = useMapStore((s) => s.paintGuideCollapsed);
  const setPaintGuideCollapsed = useMapStore((s) => s.setPaintGuideCollapsed);

  const sortedMicroareas = useMemo(() => sortMicroareas(microareas), [microareas]);

  const selectedMicroarea = microareas.find((m) => m.id === selectedMicroareaId);
  const paintedCount = microareas.reduce((sum, m) => sum + (m._count?.streets ?? 0), 0);
  const selectedMicroareaPaintedCount = selectedMicroareaId
    ? (microareas.find((m) => m.id === selectedMicroareaId)?._count?.streets ??
      streets.filter((s) => s.microareaId === selectedMicroareaId).length)
    : 0;
  const unpaintedDirtRoadIds = streets
    .filter(
      (s) =>
        !s.microareaId &&
        (s.streetType ?? '').toLowerCase().includes('terra'),
    )
    .map((s) => s.id);

  const glassBg = theme.palette.mode === 'dark'
    ? alpha(theme.palette.background.paper, 0.94)
    : alpha('#fff', 0.96);

  const accentColor = eraserMode
    ? theme.palette.error.main
    : selectedMicroarea?.color ?? theme.palette.primary.main;

  const canPaint = streetCount > 0 && !!selectedMicroareaId && !eraserMode;

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
    setPaintMode(true);
    setPaintGuideCollapsed(false);
  };

  const handleStartEraser = () => {
    setPaintMode(true);
    setEraserMode(true);
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
      setPaintMode(false);
      setEraserMode(false);
      return;
    }
    setSelectedMicroarea(microareaId);
    setEraserMode(false);
  };

  return (
    <>
      <Paper
        className="map-float-panel"
        elevation={0}
        sx={{
          position: 'absolute',
          bottom: { xs: 12, sm: 20 },
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1001,
          width: collapsed
            ? { xs: 'calc(100% - 24px)', sm: 'auto' }
            : { xs: 'calc(100% - 16px)', sm: 520, md: 600 },
          maxWidth: collapsed ? { xs: '100%', sm: 520 } : undefined,
          display: 'flex',
          flexDirection: 'column',
          bgcolor: glassBg,
          borderRadius: collapsed ? 999 : 3,
          overflow: 'hidden',
          border: paintMode && !collapsed ? `2px solid ${accentColor}` : '1px solid',
          borderColor: paintMode && !collapsed ? accentColor : alpha(theme.palette.divider, 0.12),
          boxShadow: paintMode && !collapsed
            ? `0 8px 32px ${alpha(accentColor, 0.25)}`
            : '0 4px 20px rgba(0,0,0,0.2)',
          transition: 'border-radius 0.2s ease, width 0.2s ease',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: collapsed ? 1.5 : 2,
            py: collapsed ? 0.75 : 1.25,
            flexShrink: 0,
            bgcolor: collapsed
              ? alpha(theme.palette.success.main, 0.1)
              : paintMode
                ? alpha(accentColor, 0.12)
                : alpha(theme.palette.primary.main, 0.06),
            borderBottom: collapsed ? 'none' : `1px solid ${alpha(theme.palette.divider, 0.12)}`,
            cursor: 'pointer',
            gap: 1,
          }}
          onClick={() => setPaintGuideCollapsed(!collapsed)}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', minWidth: 0 }}>
            {collapsed ? (
              <CheckCircle color="success" fontSize="small" />
            ) : eraserMode ? (
              <AutoFixOff color="error" />
            ) : (
              <Brush color={paintMode ? 'primary' : 'action'} />
            )}
            <Typography variant={collapsed ? 'body2' : 'subtitle1'} sx={{ fontWeight: 700 }}>
              {collapsed
                ? 'Mapa guardado'
                : eraserMode
                  ? 'Modo apagar'
                  : paintMode
                    ? 'Pintando'
                    : 'Pintar microáreas'}
            </Typography>
            {collapsed && (
              <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                Toque para pintar de novo
              </Typography>
            )}
            {!collapsed && selectedMicroarea && (
              <Chip
                size="small"
                label={selectedMicroarea.name}
                sx={{ bgcolor: selectedMicroarea.color, color: '#fff', fontWeight: 700 }}
              />
            )}
            {paintedCount > 0 && (
              <Chip
                size="small"
                variant="outlined"
                color={collapsed ? 'success' : 'default'}
                label={`${paintedCount} pintada${paintedCount > 1 ? 's' : ''}`}
                sx={{ fontWeight: 600 }}
              />
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
            {!collapsed && (
              <Tooltip title="Guardar e ver o mapa (não apaga ruas)">
                <Button
                  size="small"
                  variant="contained"
                  color="success"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMinimize(e);
                  }}
                  sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}
                >
                  Guardar
                </Button>
              </Tooltip>
            )}
            <Tooltip title={collapsed ? 'Abrir painel' : 'Minimizar painel'}>
              <IconButton
                size="small"
                aria-label={collapsed ? 'Abrir painel' : 'Minimizar painel'}
                onClick={(e) => {
                  e.stopPropagation();
                  if (collapsed) setPaintGuideCollapsed(false);
                  else handleMinimize(e);
                }}
              >
                {collapsed ? <ExpandLess /> : <UnfoldLess />}
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {!collapsed && (
          <>
          <Box
            sx={{
              p: 2,
              pt: 1.5,
              overflowY: 'auto',
              maxHeight: { xs: 'min(48vh, 400px)', sm: 'min(54vh, 440px)' },
            }}
          >
            {microareas.length === 0 ? (
              <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
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
              <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
                Carregando ruas do município automaticamente. Aguarde alguns segundos.
              </Alert>
            ) : (
              <>
                {neighborhoods.length > 0 &&
                  streets.filter((s) => !s.neighborhood?.id).length > 0 && (
                    <Alert severity="warning" sx={{ borderRadius: 2, mb: 1.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {streets.filter((s) => !s.neighborhood?.id).length} rua(s) sem bairro
                      </Typography>
                      <Button
                        component={RouterLink}
                        to="/cadastros?secao=bairros"
                        size="small"
                        sx={{ mt: 0.5 }}
                      >
                        Ir para Bairros
                      </Button>
                    </Alert>
                  )}
                {!paintMode && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 1.5 }}>
                    <StepRow
                      number={1}
                      done={!!selectedMicroareaId}
                      icon={<Palette fontSize="small" />}
                      title="Escolha a microárea"
                      subtitle="Toque de novo para desmarcar"
                    />
                    <StepRow
                      number={2}
                      done={paintMode && !eraserMode}
                      icon={<TouchApp fontSize="small" />}
                      title="Clique em Pintar"
                      subtitle="Depois clique nas ruas no mapa"
                    />
                  </Box>
                )}
              </>
            )}

            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 1, display: 'block' }}>
              MICROÁREAS — {streetCount > 0 ? `${streetCount} ruas no mapa` : 'nenhuma rua carregada'}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2, alignItems: 'center' }}>
              {sortedMicroareas.map((m) => {
                const selected = m.id === selectedMicroareaId;
                const count = streets.filter((s) => s.microareaId === m.id).length;
                return (
                  <Button
                    key={m.id}
                    variant={selected && !eraserMode ? 'contained' : 'outlined'}
                    size="medium"
                    onClick={() => handleToggleMicroarea(m.id)}
                    sx={{
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      py: { xs: 0.5, sm: 0.75 },
                      px: { xs: 1, sm: 1.5 },
                      gap: 0.75,
                      borderColor: m.color,
                      borderWidth: 2,
                      fontWeight: 700,
                      ...(selected && !eraserMode && {
                        bgcolor: m.color,
                        color: '#fff',
                        '&:hover': { bgcolor: m.color, filter: 'brightness(0.92)' },
                      }),
                    }}
                  >
                    <Box
                      component="span"
                      sx={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        bgcolor: selected && !eraserMode ? '#fff' : m.color,
                        border: selected && !eraserMode ? '2px solid #fff' : 'none',
                        flexShrink: 0,
                      }}
                    />
                    {m.name}
                    {count > 0 && (
                      <Chip
                        size="small"
                        label={count}
                        sx={{
                          height: 20,
                          fontSize: 11,
                          ml: 0.25,
                          bgcolor: selected && !eraserMode ? alpha('#fff', 0.25) : alpha(m.color, 0.15),
                          color: selected && !eraserMode ? '#fff' : 'text.primary',
                        }}
                      />
                    )}
                  </Button>
                );
              })}
              {canAddMicroarea && (
                <Button
                  variant="outlined"
                  size="medium"
                  onClick={() => setAddOpen(true)}
                  sx={{ minWidth: 44, px: 1.5, borderStyle: 'dashed' }}
                  aria-label="Adicionar microárea"
                >
                  <Add />
                </Button>
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

            {streetCount > 0 && (
              <ToggleButtonGroup
                exclusive
                fullWidth
                size="small"
                value={eraserMode ? 'eraser' : paintMode ? 'paint' : 'idle'}
                sx={{ mb: 2 }}
              >
                <ToggleButton
                  value="paint"
                  onClick={handleStartPaint}
                  disabled={importing || microareas.length === 0}
                  sx={{ py: 1, gap: 0.75, fontWeight: 700 }}
                >
                  <FormatPaint fontSize="small" />
                  Pintar
                </ToggleButton>
                <ToggleButton
                  value="eraser"
                  onClick={handleStartEraser}
                  disabled={importing || paintedCount === 0}
                  sx={{
                    py: 1,
                    gap: 0.75,
                    fontWeight: 700,
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
            )}

            {paintMode && canPaint && neighborhoods.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.75, display: 'block' }}>
                  PINTAR BAIRRO INTEIRO
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

            {paintMode && canPaint && unpaintedDirtRoadIds.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.75, display: 'block' }}>
                  ESTRADAS DE TERRA
                </Typography>
                <Button
                  fullWidth
                  size="small"
                  variant="outlined"
                  color="warning"
                  onClick={() => setDirtRoadConfirm({ count: unpaintedDirtRoadIds.length })}
                >
                  Marcar estradas de terra ({unpaintedDirtRoadIds.length})
                </Button>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
                  Marca em lote as estradas de terra carregadas no mapa para a microárea selecionada.
                </Typography>
              </Box>
            )}

            {paintMode && (
              <>
                <Alert
                  severity={eraserMode ? 'warning' : canPaint ? 'success' : 'info'}
                  icon={eraserMode ? <AutoFixOff /> : <CheckCircle />}
                  sx={{ borderRadius: 2 }}
                >
                  {eraserMode
                    ? 'Clique na linha grossa colorida para apagar. Cinza tracejado = rua sem pintura. Ou clique na microárea na legenda (ex.: Microárea 05 · 1).'
                    : canPaint
                      ? mapPanEnabled
                        ? 'Modo mover mapa ativo — arraste o fundo para reposicionar. Desative para pintar ruas.'
                        : `Passe o mouse sobre as ruas e clique para pintar com ${selectedMicroarea?.name}. Segure e arraste sobre várias ruas.`
                      : 'Selecione uma microárea acima para começar.'}
                </Alert>
                {canPaint && (
                  <Button
                    fullWidth
                    variant={mapPanEnabled ? 'contained' : 'outlined'}
                    size="medium"
                    startIcon={<PanTool />}
                    onClick={() => setMapPanEnabled(!mapPanEnabled)}
                    sx={{ mt: 1.5 }}
                  >
                    {mapPanEnabled ? 'Mover mapa (ativo)' : 'Mover mapa'}
                  </Button>
                )}
              </>
            )}

            {paintedCount > 0 && (
              <Box sx={{ mt: 2 }}>
                <Button
                  fullWidth
                  size="small"
                  color="inherit"
                  onClick={() => setAdvancedOpen((open) => !open)}
                  endIcon={advancedOpen ? <ExpandLess /> : <ExpandMore />}
                  sx={{ justifyContent: 'space-between', fontWeight: 700 }}
                >
                  Limpar pinturas em lote (opcional)
                </Button>
                <Collapse in={advancedOpen}>
                  <Box
                    sx={{
                      mt: 1,
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: alpha(theme.palette.warning.main, 0.06),
                      border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`,
                    }}
                  >
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                      Use o modo <strong>Apagar</strong> para corrigir ruas individuais. As opções
                      abaixo removem várias ruas de uma vez.
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
                          Limpar {selectedMicroarea.name} ({selectedMicroareaPaintedCount} ruas)
                        </Button>
                      )}
                      <Button
                        fullWidth
                        variant="outlined"
                        color="error"
                        size="small"
                        startIcon={<DeleteSweep />}
                        disabled={clearingPaint}
                        onClick={() => setClearDialog('all')}
                        sx={{ justifyContent: 'flex-start', fontWeight: 600 }}
                      >
                        Limpar todas as pinturas ({paintedCount} ruas)
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
                          Remover círculos do mapa ({paintZoneCount})
                        </Button>
                      )}
                    </Box>
                  </Box>
                </Collapse>
              </Box>
            )}

            {lastAction && (
              <Typography
                variant="body2"
                color="success.main"
                sx={{ mt: 1.5, fontWeight: 600, textAlign: 'center' }}
              >
                {lastAction}
              </Typography>
            )}

            {streetCount > 0 && (
              <Typography
                variant="caption"
                color="text.disabled"
                sx={{ display: 'block', mt: 1.5, textAlign: 'center' }}
              >
                Atalhos: <strong>P</strong> pintar · <strong>E</strong> apagar · <strong>Esc</strong> parar
              </Typography>
            )}
          </Box>

          <Box
            sx={{
              px: 2,
              py: 1.25,
              flexShrink: 0,
              borderTop: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
              bgcolor: alpha(theme.palette.background.paper, 0.98),
              display: 'flex',
              gap: 1,
              flexWrap: 'wrap',
            }}
          >
            <Button
              fullWidth
              variant="contained"
              color="success"
              size="medium"
              onClick={() => handleMinimize()}
              sx={{ fontWeight: 800, flex: 1 }}
            >
              Guardar e ver mapa
            </Button>
            {selectedMicroareaId && (
              <Button
                variant="outlined"
                size="medium"
                onClick={() => {
                  setSelectedMicroarea(null);
                  setPaintMode(false);
                  setEraserMode(false);
                }}
                sx={{ fontWeight: 700 }}
              >
                Desmarcar microárea
              </Button>
            )}
          </Box>
          </>
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

function StepRow({
  number,
  done,
  icon,
  title,
  subtitle,
}: {
  number: number;
  done: boolean;
  icon: ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontWeight: 800,
          fontSize: 13,
          bgcolor: done ? 'success.main' : 'action.selected',
          color: done ? '#fff' : 'text.secondary',
        }}
      >
        {done ? '✓' : number}
      </Box>
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          {icon}
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary">
          {subtitle}
        </Typography>
      </Box>
    </Box>
  );
}
