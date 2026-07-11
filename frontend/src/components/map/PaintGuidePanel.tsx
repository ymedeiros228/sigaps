import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  alpha,
  useTheme,
  Collapse,
} from '@mui/material';
import {
  CheckCircle,
  PanTool,
  Add,
  FormatPaint,
  AutoFixOff,
  DeleteSweep,
  ExpandLess,
  ExpandMore,
  PlayArrow,
} from '@mui/icons-material';
import { useState, useMemo, useEffect } from 'react';
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
import { countStreetsForMicroarea } from '../../utils/streetPaintStats';
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
  const paintStreetSide = useMapStore((s) => s.paintStreetSide);
  const setPaintStreetSide = useMapStore((s) => s.setPaintStreetSide);
  const collapsed = useMapStore((s) => s.paintGuideCollapsed);
  const setPaintGuideCollapsed = useMapStore((s) => s.setPaintGuideCollapsed);

  const sortedMicroareas = useMemo(() => sortMicroareas(microareas), [microareas]);
  const selectedMicroarea = microareas.find((m) => m.id === selectedMicroareaId);
  const paintedCount = microareas.reduce((sum, m) => sum + (m._count?.streets ?? 0), 0);
  const selectedMicroareaPaintedCount = selectedMicroareaId
    ? (microareas.find((m) => m.id === selectedMicroareaId)?._count?.streets ??
      countStreetsForMicroarea(streets, selectedMicroareaId))
    : 0;
  const unpaintedDirtRoadIds = streets
    .filter((s) => !streetHasPaint(s) && (s.streetType ?? '').toLowerCase().includes('terra'))
    .map((s) => s.id);

  const glassBg =
    theme.palette.mode === 'dark' ? alpha(theme.palette.background.paper, 0.96) : alpha('#fff', 0.98);
  const accentColor = eraserMode
    ? theme.palette.error.main
    : selectedMicroarea?.color ?? theme.palette.primary.main;

  const { data: neighborhoods = [] } = useQuery({
    queryKey: queryKeys.neighborhoods(municipalityId),
    queryFn: () => neighborhoodsApi.list(municipalityId).then((r) => r.data),
    enabled: !!municipalityId,
    staleTime: CACHE.neighborhoods,
  });

  useEffect(() => {
    if (!selectedMicroareaId && microareas.length > 0 && !collapsed) {
      setSelectedMicroarea(microareas[0].id);
    }
  }, [selectedMicroareaId, microareas, collapsed, setSelectedMicroarea]);

  const handleSelectColor = (microareaId: string) => {
    setSelectedMicroarea(microareaId);
    setEraserMode(false);
  };

  const handleStartPainting = () => {
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

  const handleBackToPaint = () => {
    setEraserMode(false);
  };

  const handleFinish = () => {
    setPaintGuideCollapsed(true);
    setPaintMode(false);
    setEraserMode(false);
    setMapPanEnabled(false);
    onMinimized?.();
  };

  const handleOpenPanel = () => {
    setPaintGuideCollapsed(false);
  };

  if (collapsed) {
    return (
      <Paper
        className="map-float-panel"
        elevation={0}
        onClick={handleOpenPanel}
        sx={{
          position: 'absolute',
          bottom: { xs: 12, sm: 20 },
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1001,
          px: 2.5,
          py: 1.25,
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          bgcolor: alpha(theme.palette.success.main, 0.12),
          borderRadius: 999,
          border: `2px solid ${alpha(theme.palette.success.main, 0.35)}`,
          cursor: 'pointer',
        }}
      >
        <CheckCircle color="success" />
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 800 }}>
            Mapa pronto
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Toque aqui para colorir mais ruas
          </Typography>
        </Box>
        <FormatPaint color="primary" />
      </Paper>
    );
  }

  return (
    <>
      <Paper
        className="map-float-panel map-paint-panel"
        elevation={0}
        sx={{
          position: 'absolute',
          bottom: { xs: 12, sm: 20 },
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1001,
          width: { xs: 'calc(100% - 16px)', sm: 420 },
          maxWidth: 420,
          bgcolor: glassBg,
          borderRadius: 3,
          overflow: 'hidden',
          border: paintMode ? `2px solid ${accentColor}` : '1px solid',
          borderColor: paintMode ? accentColor : alpha(theme.palette.divider, 0.15),
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        }}
      >
        {/* Cabeçalho simples */}
        <Box
          sx={{
            px: 2,
            py: 1.5,
            bgcolor: paintMode ? alpha(accentColor, 0.1) : alpha(theme.palette.primary.main, 0.06),
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
            {paintMode
              ? eraserMode
                ? 'Apagar pintura'
                : 'Colorir ruas'
              : 'Como colorir o mapa'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {paintMode
              ? eraserMode
                ? 'Passo único: toque na rua colorida'
                : 'Passo 2: toque nas ruas acima ↑'
              : 'Passo 1: escolha a cor do ACS'}
          </Typography>
        </Box>

        <Box sx={{ p: 2 }}>
          {microareas.length === 0 ? (
            <Alert severity="warning" sx={{ borderRadius: 2 }}>
              Cadastre as microáreas (cores do ACS) antes de pintar.
              {canAddMicroarea ? (
                <Button size="small" variant="contained" startIcon={<Add />} onClick={() => setAddOpen(true)} sx={{ mt: 1, display: 'block' }}>
                  Adicionar microárea
                </Button>
              ) : (
                <Button component={RouterLink} to="/cadastros" size="small" sx={{ mt: 1, display: 'block' }}>
                  Ir para Cadastros
                </Button>
              )}
            </Alert>
          ) : streetCount === 0 ? (
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              Carregando ruas… aguarde alguns segundos.
            </Alert>
          ) : (
            <>
              {/* Passo 1 — escolher cor (sempre visível, compacto no modo pintura) */}
              <Typography variant="overline" sx={{ fontWeight: 800, letterSpacing: 0.5, color: 'text.secondary' }}>
                {paintMode ? 'Cor selecionada' : '1 · Escolha a cor'}
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                  gap: 1,
                  mt: 1,
                  mb: paintMode ? 1.5 : 2,
                }}
              >
                {sortedMicroareas.map((m) => {
                  const selected = m.id === selectedMicroareaId && !eraserMode;
                  return (
                    <Button
                      key={m.id}
                      variant={selected ? 'contained' : 'outlined'}
                      onClick={() => handleSelectColor(m.id)}
                      disabled={eraserMode}
                      sx={{
                        py: 1.25,
                        px: 1,
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        textAlign: 'left',
                        borderWidth: 2,
                        borderColor: m.color,
                        borderRadius: 2,
                        minHeight: 56,
                        ...(selected && {
                          bgcolor: m.color,
                          color: '#fff',
                          '&:hover': { bgcolor: m.color, filter: 'brightness(0.95)' },
                        }),
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, width: '100%' }}>
                        <Box
                          sx={{
                            width: 16,
                            height: 16,
                            borderRadius: '50%',
                            bgcolor: selected ? '#fff' : m.color,
                            border: selected ? 'none' : `2px solid ${m.color}`,
                            flexShrink: 0,
                          }}
                        />
                        <Typography variant="body2" sx={{ fontWeight: 800, lineHeight: 1.2 }} noWrap>
                          {m.name}
                        </Typography>
                      </Box>
                      {m.acs?.name && (
                        <Typography
                          variant="caption"
                          sx={{ opacity: selected ? 0.9 : 0.7, mt: 0.25, pl: 2.75 }}
                          noWrap
                        >
                          ACS {m.acs.name}
                        </Typography>
                      )}
                    </Button>
                  );
                })}
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

              {/* Ações principais — grandes e claras */}
              {!paintMode ? (
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  startIcon={<PlayArrow />}
                  disabled={!selectedMicroareaId || importing}
                  onClick={handleStartPainting}
                  sx={{ py: 1.5, fontWeight: 800, fontSize: '1rem', borderRadius: 2, mb: 1 }}
                >
                  Começar a pintar
                </Button>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {eraserMode ? (
                    <Button
                      fullWidth
                      variant="contained"
                      size="large"
                      startIcon={<FormatPaint />}
                      onClick={handleBackToPaint}
                      sx={{ py: 1.35, fontWeight: 800, borderRadius: 2 }}
                    >
                      Voltar a pintar
                    </Button>
                  ) : (
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                      <Button
                        variant="outlined"
                        color="error"
                        size="large"
                        startIcon={<AutoFixOff />}
                        onClick={handleStartEraser}
                        disabled={paintedCount === 0}
                        sx={{ py: 1.2, fontWeight: 700, borderRadius: 2, borderWidth: 2 }}
                      >
                        Apagar
                      </Button>
                      <Button
                        variant="contained"
                        color="success"
                        size="large"
                        startIcon={<CheckCircle />}
                        onClick={handleFinish}
                        sx={{ py: 1.2, fontWeight: 800, borderRadius: 2 }}
                      >
                        Terminar
                      </Button>
                    </Box>
                  )}

                  {!eraserMode && (
                    <Button
                      fullWidth
                      variant={mapPanEnabled ? 'contained' : 'text'}
                      size="medium"
                      startIcon={<PanTool />}
                      onClick={() => setMapPanEnabled(!mapPanEnabled)}
                      sx={{ fontWeight: 600 }}
                    >
                      {mapPanEnabled ? '✓ Movendo mapa — toque para pintar' : 'Mover o mapa (arrastar)'}
                    </Button>
                  )}
                </Box>
              )}

              {/* Opções avançadas — escondidas por padrão */}
              <Button
                fullWidth
                size="small"
                color="inherit"
                onClick={() => setAdvancedOpen((v) => !v)}
                endIcon={advancedOpen ? <ExpandLess /> : <ExpandMore />}
                sx={{ mt: 1.5, fontWeight: 600, justifyContent: 'space-between' }}
              >
                Opções avançadas
              </Button>
              <Collapse in={advancedOpen}>
                <Box sx={{ mt: 1, p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.action.hover, 0.4) }}>
                  {!eraserMode && paintMode && (
                    <Box sx={{ mb: 1.5 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.75 }}>
                        Tipo de pintura (avenidas)
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                        {[
                          { value: 'FULL' as const, label: 'Rua inteira ou trecho' },
                          { value: 'RIGHT' as const, label: 'Só lado direito' },
                          { value: 'LEFT' as const, label: 'Só lado esquerdo' },
                        ].map((opt) => (
                          <Button
                            key={opt.value}
                            size="small"
                            variant={paintStreetSide === opt.value ? 'contained' : 'outlined'}
                            onClick={() => setPaintStreetSide(opt.value)}
                            sx={{ justifyContent: 'flex-start', fontWeight: 600 }}
                          >
                            {opt.label}
                          </Button>
                        ))}
                      </Box>
                    </Box>
                  )}

                  {paintMode && selectedMicroareaId && neighborhoods.length > 0 && (
                    <Box sx={{ mb: 1.5 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.75 }}>
                        Pintar bairro inteiro
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {neighborhoods.map((n) => {
                          const count = streets.filter((s) => s.neighborhood?.id === n.id).length;
                          if (count === 0) return null;
                          return (
                            <Button
                              key={n.id}
                              size="small"
                              variant="outlined"
                              onClick={() =>
                                setNeighborhoodConfirm({ id: n.id, name: n.name, count })
                              }
                            >
                              {n.name}
                            </Button>
                          );
                        })}
                      </Box>
                    </Box>
                  )}

                  {unpaintedDirtRoadIds.length > 0 && paintMode && selectedMicroareaId && (
                    <Button
                      fullWidth
                      size="small"
                      variant="outlined"
                      color="warning"
                      sx={{ mb: 1.5 }}
                      onClick={() => setDirtRoadConfirm({ count: unpaintedDirtRoadIds.length })}
                    >
                      Marcar estradas de terra ({unpaintedDirtRoadIds.length})
                    </Button>
                  )}

                  {paintedCount > 0 && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                      {selectedMicroarea && selectedMicroareaPaintedCount > 0 && (
                        <Button
                          size="small"
                          variant="outlined"
                          color="warning"
                          startIcon={<DeleteSweep />}
                          disabled={clearingPaint}
                          onClick={() => setClearDialog('microarea')}
                        >
                          Limpar {selectedMicroarea.name}
                        </Button>
                      )}
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        startIcon={<DeleteSweep />}
                        disabled={clearingPaint}
                        onClick={() => setClearDialog('all')}
                      >
                        Limpar todo o mapa
                      </Button>
                      {paintZoneCount > 0 && onClearPaintZones && (
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={clearingPaintZones}
                          onClick={onClearPaintZones}
                        >
                          Remover círculos ({paintZoneCount})
                        </Button>
                      )}
                    </Box>
                  )}
                </Box>
              </Collapse>

              {lastAction && (
                <Alert severity="success" icon={<CheckCircle fontSize="small" />} sx={{ mt: 1.5, borderRadius: 2 }}>
                  {lastAction}
                </Alert>
              )}

              {!paintMode && (
                <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1.5, textAlign: 'center' }}>
                  Dica: uma mesma rua pode ter várias cores (trechos diferentes).
                </Typography>
              )}
            </>
          )}
        </Box>
      </Paper>

      <ConfirmDialog
        open={!!neighborhoodConfirm}
        title={`Pintar bairro ${neighborhoodConfirm?.name ?? ''}?`}
        message={
          neighborhoodConfirm
            ? `Isso colorirá ${neighborhoodConfirm.count} ruas de uma vez. Para mais precisão, pinte rua por rua. Continuar?`
            : ''
        }
        confirmLabel="Sim, pintar bairro"
        confirmColor="primary"
        onClose={() => setNeighborhoodConfirm(null)}
        onConfirm={() => {
          if (!neighborhoodConfirm) return;
          onPaintStreets(
            streets.filter((s) => s.neighborhood?.id === neighborhoodConfirm.id).map((s) => s.id),
          );
          setNeighborhoodConfirm(null);
        }}
      />
      <ConfirmDialog
        open={!!dirtRoadConfirm}
        title="Marcar estradas de terra?"
        message={
          dirtRoadConfirm
            ? `Vincular ${dirtRoadConfirm.count} estrada(s) de terra à ${selectedMicroarea?.name ?? 'cor selecionada'}?`
            : ''
        }
        confirmLabel="Sim, marcar"
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
