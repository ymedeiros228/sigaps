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
} from '@mui/icons-material';
import { useState } from 'react';
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

interface PaintGuidePanelProps {
  microareas: Microarea[];
  streets: Street[];
  streetCount: number;
  municipalityId: string;
  onPaintStreets: (streetIds: string[]) => void;
  onClearAllPaint: () => void;
  onClearMicroareaPaint: (microareaId: string) => void;
  clearingPaint: boolean;
  importing: boolean;
  lastAction?: string | null;
  onMicroareaCreated?: (id: string) => void;
}

export function PaintGuidePanel({
  microareas,
  streets,
  streetCount,
  municipalityId,
  onPaintStreets,
  onClearAllPaint,
  onClearMicroareaPaint,
  clearingPaint,
  importing,
  lastAction,
  onMicroareaCreated,
}: PaintGuidePanelProps) {
  const theme = useTheme();
  const user = useAuthStore((s) => s.user);
  const canAddMicroarea = canCreateMicroarea(user?.role);
  const [addOpen, setAddOpen] = useState(false);
  const [clearDialog, setClearDialog] = useState<'all' | 'microarea' | null>(null);
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

  const selectedMicroarea = microareas.find((m) => m.id === selectedMicroareaId);
  const paintedCount = streets.filter((s) => s.microareaId).length;
  const selectedMicroareaPaintedCount = selectedMicroareaId
    ? streets.filter((s) => s.microareaId === selectedMicroareaId).length
    : 0;

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
    if (
      window.confirm(
        `Isso pinta ${ids.length} ruas do bairro "${neighborhoodName}" de uma vez. ` +
          'Recomendamos pintar rua por rua para maior precisão. Continuar mesmo assim?',
      )
    ) {
      onPaintStreets(ids);
    }
  };

  const handleStartPaint = () => {
    if (!selectedMicroareaId && microareas.length > 0) {
      setSelectedMicroarea(microareas[0].id);
    }
    setEraserMode(false);
    setPaintMode(true);
  };

  const handleStartEraser = () => {
    setPaintMode(true);
    setEraserMode(true);
  };

  return (
    <>
      <Paper
        className="map-float-panel"
        elevation={0}
        sx={{
          position: 'absolute',
          bottom: { xs: 16, sm: 24 },
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1001,
          width: { xs: 'calc(100% - 16px)', sm: 520, md: 600 },
          maxHeight: { xs: 'min(62vh, 480px)', sm: 'none' },
          bgcolor: glassBg,
          borderRadius: 3,
          overflow: 'hidden',
          border: paintMode ? `2px solid ${accentColor}` : undefined,
          boxShadow: paintMode
            ? `0 8px 32px ${alpha(accentColor, 0.25)}`
            : undefined,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 1.25,
            bgcolor: paintMode
              ? alpha(accentColor, 0.12)
              : alpha(theme.palette.primary.main, 0.06),
            cursor: 'pointer',
          }}
          onClick={() => setPaintGuideCollapsed(!collapsed)}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            {eraserMode ? <AutoFixOff color="error" /> : <Brush color={paintMode ? 'primary' : 'action'} />}
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {eraserMode ? 'Modo apagar ativo' : paintMode ? 'Modo pintar ativo' : 'Pintar microáreas'}
            </Typography>
            {paintMode && selectedMicroarea && !eraserMode && (
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
                label={`${paintedCount} pintada${paintedCount > 1 ? 's' : ''}`}
                sx={{ fontWeight: 600 }}
              />
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {paintMode && (
              <Button
                size="small"
                color="inherit"
                onClick={(e) => {
                  e.stopPropagation();
                  setPaintMode(false);
                }}
              >
                Parar
              </Button>
            )}
            <IconButton size="small">
              {collapsed ? <ExpandMore /> : <ExpandLess />}
            </IconButton>
          </Box>
        </Box>

        <Collapse in={!collapsed}>
          <Box sx={{ p: 2, pt: 1.5, overflow: 'auto', maxHeight: { xs: 'calc(62vh - 56px)', sm: 'none' } }}>
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
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2 }}>
                <StepRow
                  number={1}
                  done={!!selectedMicroareaId}
                  icon={<Palette fontSize="small" />}
                  title="Escolha a cor da microárea"
                  subtitle="Toque na microárea que você quer pintar"
                />
                <StepRow
                  number={2}
                  done={paintMode && !eraserMode}
                  icon={<TouchApp fontSize="small" />}
                  title="Ative o modo pintar"
                  subtitle="Clique ou arraste sobre as ruas no mapa"
                />
                <StepRow
                  number={3}
                  done={eraserMode}
                  icon={<AutoFixOff fontSize="small" />}
                  title="Corrija com o modo apagar"
                  subtitle="Clique nas ruas pintadas para remover o vínculo"
                />
              </Box>
            )}

            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 1, display: 'block' }}>
              MICROÁREAS — {streetCount > 0 ? `${streetCount} ruas no mapa` : 'nenhuma rua carregada'}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2, alignItems: 'center' }}>
              {microareas.map((m) => {
                const selected = m.id === selectedMicroareaId;
                const count = streets.filter((s) => s.microareaId === m.id).length;
                return (
                  <Button
                    key={m.id}
                    variant={selected && !eraserMode ? 'contained' : 'outlined'}
                    size="medium"
                    onClick={() => {
                      setSelectedMicroarea(m.id);
                      setEraserMode(false);
                      if (streetCount > 0) setPaintMode(true);
                    }}
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
                if (streetCount > 0) setPaintMode(true);
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

            {paintMode && (
              <>
                <Alert
                  severity={eraserMode ? 'warning' : canPaint ? 'success' : 'info'}
                  icon={eraserMode ? <AutoFixOff /> : <CheckCircle />}
                  sx={{ borderRadius: 2 }}
                >
                  {eraserMode
                    ? 'Clique ou arraste sobre ruas pintadas para remover o vínculo. Ruas sem cor não são afetadas.'
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
              <Box
                sx={{
                  mt: 2.5,
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.warning.main, 0.06),
                  border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`,
                }}
              >
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
                  CORRIGIR PINTURA
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>
                  Use o modo <strong>Apagar</strong> para corrigir ruas individuais, ou remova em lote abaixo.
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
                </Box>
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
          </Box>
        </Collapse>
      </Paper>

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
