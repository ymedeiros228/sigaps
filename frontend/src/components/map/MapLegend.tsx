import { Box, Paper, Typography, alpha, useTheme, IconButton, Collapse, LinearProgress } from '@mui/material';
import { ExpandLess, ExpandMore } from '@mui/icons-material';
import { useMemo, useState, useEffect } from 'react';
import type { Microarea, Street, Ubs, Place } from '../../services/api';
import { useMapStore } from '../../store';
import { familyHeatColor } from '../../utils/geo';
import { sortMicroareas } from '../../utils/sortMicroareas';
import { countPaintedStreets, streetBelongsToMicroarea, sumFamiliesForMicroarea } from '../../utils/streetPaintStats';

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
  const [open, setOpen] = useState(true);
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
    else if (!paintMode) setOpen(true);
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
    const paintedTotal = microareas.reduce(
      (sum, microarea) => sum + (microarea._count?.streets ?? 0),
      0,
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
        bottom: paintMode && !paintGuideCollapsed ? { xs: 240, sm: 220 } : { xs: 220, sm: 200 },
        left: { xs: 8, sm: 16 },
        zIndex: 1000,
        minWidth: { xs: 0, sm: 220 },
        maxWidth: { xs: 'calc(50% - 12px)', sm: 280 },
        bgcolor: glassBg,
        borderRadius: 3,
        overflow: 'hidden',
        opacity: paintMode && !paintGuideCollapsed ? 0.92 : 1,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1.5,
          py: 1,
          cursor: 'pointer',
        }}
        onClick={() => setOpen(!open)}
      >
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Legenda
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {loading
              ? 'Carregando…'
              : paintMode && stats.paintedTotal === 0
                ? `Nenhuma rua pintada ainda · ${streets.length} na tela (cinza = sem pintura)`
                : `${stats.paintedTotal} pintada(s) no município · ${stats.paintedViewport}/${streets.length} na tela`}
          </Typography>
        </Box>
        <IconButton size="small">{open ? <ExpandLess /> : <ExpandMore />}</IconButton>
      </Box>

      <Collapse in={open}>
        <Box sx={{ px: 1.5, pb: 1.5 }}>
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
              const count = m._count?.streets ?? stats.byMicroareaViewport.get(m.id) ?? 0;
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
                      boxShadow: `0 0 8px ${m.color}66`,
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
              <LegendRow color="#c4a35a" dashed label="Estrada de terra" />
              <LegendRow color="#888" dashed label="Sem microárea" />
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
