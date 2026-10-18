import { Box, Paper, Typography, alpha, useTheme, IconButton, Collapse, LinearProgress } from '@mui/material';
import { ExpandLess, ExpandMore } from '@mui/icons-material';
import { useMemo, useState, useEffect } from 'react';
import type { Microarea, Street, Ubs, Place } from '../../services/api';
import { useMapStore } from '../../store';
import { familyHeatColor } from '../../utils/geo';
import { sortMicroareas } from '../../utils/sortMicroareas';
import { countPaintedStreets, resolveMicroareaStreetCount, resolvePaintedStreetCount, streetBelongsToMicroarea, sumFamiliesForMicroarea } from '../../utils/streetPaintStats';

interface MapLegendProps {
  microareas: Microarea[];
  streets: Street[];
  ubsList?: Ubs[];
  placesList?: Place[];
  loading?: boolean;
  paintMode?: boolean;
  onClearMicroarea?: (microareaId: string) => void;
}

export function MapLegend({
  microareas,
  streets,
  ubsList = [],
  placesList = [],
  loading = false,
  paintMode = false,
  onClearMicroarea,
}: MapLegendProps) {
  const theme = useTheme();
  // Em tela pequena a legenda começa recolhida para não cobrir o mapa (um toque abre).
  const [open, setOpen] = useState(
    () => typeof window === 'undefined' || window.matchMedia('(min-width:600px)').matches,
  );
  const showHeatmap = useMapStore((s) => s.showHeatmap);
  const showUbs = useMapStore((s) => s.showUbsMarkers);
  const showPlaces = useMapStore((s) => s.showPlacesMarkers);
  const eraserMode = useMapStore((s) => s.eraserMode);
  const paintGuideCollapsed = useMapStore((s) => s.paintGuideCollapsed);
  const glassBg = theme.palette.mode === 'dark'
    ? alpha(theme.palette.background.paper, 0.88)
    : alpha('#fff', 0.92);

  useEffect(() => {
    if (paintMode && !paintGuideCollapsed) setOpen(false);
    else if (!paintMode) setOpen(window.matchMedia('(min-width:600px)').matches);
  }, [paintMode, paintGuideCollapsed]);

  const sortedMicroareas = useMemo(() => sortMicroareas(microareas), [microareas]);

  const stats = useMemo(() => {
    const byMicroareaViewport = new Map<string, number>();
    let totalFamilies = 0;
    let maxFamilies = 0;
    for (const s of streets) {
      const families = s.familyCount ?? 0;
      totalFamilies += families;
      if (families > maxFamilies) maxFamilies = families;
      for (const microarea of microareas) {
        if (streetBelongsToMicroarea(s, microarea.id)) {
          byMicroareaViewport.set(
            microarea.id,
            (byMicroareaViewport.get(microarea.id) ?? 0) + 1,
          );
        }
      }
    }
    const paintedViewport = countPaintedStreets(streets);
    const paintedTotal = resolvePaintedStreetCount(
      streets,
      microareas.reduce((sum, microarea) => sum + (microarea._count?.streets ?? 0), 0),
    );
    const coverage =
      streets.length > 0 ? Math.round((paintedViewport / streets.length) * 100) : 0;
    return {
      byMicroareaViewport,
      paintedViewport,
      paintedTotal,
      coverage,
      totalFamilies,
      maxFamilies,
    };
  }, [streets, microareas]);

  if (microareas.length === 0) return null;

  return (
    <Paper
      className="map-float-panel map-legend-panel"
      elevation={0}
      sx={{
        position: 'absolute',
        // Computador: logo abaixo da barra, à esquerda. Celular: embaixo, acima do painel de pintar.
        top: { xs: 'auto', sm: 'var(--map-toolbar-offset, 72px)' },
        bottom: {
          xs: paintMode && !paintGuideCollapsed ? 240 : 76,
          sm: 'auto',
        },
        left: { xs: 8, sm: 12 },
        zIndex: 1000,
        width: { xs: open ? 'min(260px, calc(100% - 16px))' : 'auto', sm: 240 },
        maxHeight: {
          xs: 'calc(100% - var(--map-toolbar-offset, 72px) - 96px)',
          sm: 'calc(100% - var(--map-toolbar-offset, 72px) - 96px)',
        },
        display: 'flex',
        flexDirection: 'column',
        bgcolor: glassBg,
        borderRadius: '18px',
        overflow: 'hidden',
        opacity: paintMode && !paintGuideCollapsed ? 0.92 : 1,
      }}
    >
      <Box
        role="button"
        aria-expanded={open}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          pl: 1.5,
          pr: 0.5,
          minHeight: 44,
          cursor: 'pointer',
          flexShrink: 0,
          '&:hover': { bgcolor: 'action.hover' },
        }}
        onClick={() => setOpen(!open)}
      >
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          Legenda
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap sx={{ flex: 1, minWidth: 0 }}>
          {loading
            ? 'carregando…'
            : stats.paintedTotal === 0
              ? 'nada pintado ainda'
              : `${stats.paintedTotal} rua${stats.paintedTotal > 1 ? 's' : ''} pintada${stats.paintedTotal > 1 ? 's' : ''}`}
        </Typography>
        <IconButton size="small" tabIndex={-1} aria-hidden>
          {open ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
        </IconButton>
      </Box>

      <Collapse in={open} unmountOnExit sx={{ minHeight: 0, overflow: 'auto' }}>
        <Box sx={{ px: 1.5, pb: 1.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
            {paintMode && stats.paintedTotal === 0
              ? `${streets.length} ruas na tela · tracejado = sem microárea`
              : `${stats.paintedViewport} de ${streets.length} ruas pintadas na tela`}
          </Typography>
          <LinearProgress
            variant={loading ? 'indeterminate' : 'determinate'}
            value={loading ? undefined : stats.coverage}
            sx={{
              mb: 1.5,
              height: 6,
              borderRadius: 3,
              bgcolor: alpha(theme.palette.primary.main, 0.12),
            }}
          />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {sortedMicroareas.map((m) => {
              const count = resolveMicroareaStreetCount(streets, m.id, m._count?.streets);
              const families = stats.totalFamilies > 0 ? sumFamiliesForMicroarea(streets, m.id) : 0;
              const canClear = (paintMode || eraserMode) && count > 0 && !!onClearMicroarea;
              return (
                <Box
                  key={m.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    borderRadius: 1,
                    px: canClear ? 0.5 : 0,
                    py: canClear ? 0.25 : 0,
                    cursor: canClear ? 'pointer' : 'default',
                    '&:hover': canClear
                      ? { bgcolor: alpha(theme.palette.error.main, 0.08) }
                      : undefined,
                  }}
                  onClick={
                    canClear
                      ? (event) => {
                          event.stopPropagation();
                          onClearMicroarea?.(m.id);
                        }
                      : undefined
                  }
                  title={canClear ? `Clique para despintar ${m.name}` : undefined}
                >
                  <Box
                    sx={{
                      width: 22,
                      height: 5,
                      bgcolor: m.color,
                      borderRadius: 1,
                      flexShrink: 0,
                    }}
                  />
                  <Typography variant="caption" sx={{ fontWeight: 600, flex: 1 }} noWrap>
                    {m.name}
                  </Typography>
                  <Typography
                    variant="caption"
                    color={canClear ? 'error.main' : 'text.secondary'}
                    sx={{ fontWeight: 700, textAlign: 'right' }}
                  >
                    {count}
                    {families > 0 && (
                      <Typography component="span" variant="caption" color="text.disabled" sx={{ display: 'block', fontSize: '0.65rem', fontWeight: 600 }}>
                        {families} fam.
                      </Typography>
                    )}
                  </Typography>
                </Box>
              );
            })}
            <Box sx={{ pt: 0.5, borderTop: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {/* Fora do modo pintar essas ruas não ganham linha (o mapa de fundo já mostra). */}
              {paintMode && (
                <>
                  <LegendRow color="#c4a35a" dashed label="Estrada de terra" />
                  <LegendRow color="#888" dashed label="Sem microárea" />
                </>
              )}
              {showUbs && ubsList.length > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      width: 14,
                      height: 14,
                      bgcolor: '#1565C0',
                      borderRadius: '50% 50% 50% 0',
                      transform: 'rotate(-45deg)',
                      border: '2px solid #fff',
                      boxShadow: 1,
                      flexShrink: 0,
                    }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    UBS ({ubsList.length})
                  </Typography>
                </Box>
              )}
              {showPlaces && placesList.length > 0 && (
                <>
                  {placesList.some((p) => p.kind === 'POVOADO' || p.kind === 'DISTRITO') && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box
                        sx={{
                          width: 14,
                          height: 14,
                          bgcolor: '#6D4C41',
                          borderRadius: '50%',
                          border: '2px solid #fff',
                          boxShadow: 1,
                          flexShrink: 0,
                        }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        Povoados ({placesList.filter((p) => p.kind !== 'LOCALIDADE').length})
                      </Typography>
                    </Box>
                  )}
                  {placesList.some((p) => p.kind === 'LOCALIDADE') && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box
                        sx={{
                          width: 14,
                          height: 14,
                          bgcolor: '#546E7A',
                          borderRadius: '50%',
                          border: '2px solid #fff',
                          boxShadow: 1,
                          flexShrink: 0,
                        }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        Fazendas/localidades ({placesList.filter((p) => p.kind === 'LOCALIDADE').length})
                      </Typography>
                    </Box>
                  )}
                </>
              )}
              {showHeatmap && (
                <Box sx={{ mt: 0.5 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    Calor sobre a pintura — {stats.totalFamilies} famílias na tela
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.25, height: 6, borderRadius: 1, overflow: 'hidden' }}>
                    {[0.1, 0.35, 0.6, 1].map((t) => (
                      <Box
                        key={t}
                        sx={{
                          flex: 1,
                          bgcolor: familyHeatColor(
                            Math.max(1, Math.round(stats.maxFamilies * t)),
                            Math.max(1, stats.maxFamilies),
                          ),
                        }}
                      />
                    ))}
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.25 }}>
                    <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem' }}>
                      poucas
                    </Typography>
                    <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem' }}>
                      muitas
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      </Collapse>
    </Paper>
  );
}

function LegendRow({
  color,
  dashed,
  label,
}: {
  color: string;
  dashed?: boolean;
  label: string;
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Box
        sx={{
          width: 22,
          height: 5,
          bgcolor: color,
          borderRadius: 1,
          border: dashed ? '1px dashed' : undefined,
          borderColor: dashed ? 'text.disabled' : undefined,
          flexShrink: 0,
        }}
      />
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}
