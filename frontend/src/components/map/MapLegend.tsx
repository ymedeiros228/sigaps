import { Box, Paper, Typography, alpha, useTheme, IconButton, Collapse, LinearProgress } from '@mui/material';
import { ExpandLess, ExpandMore } from '@mui/icons-material';
import { useMemo, useState } from 'react';
import type { Microarea, Street, Ubs } from '../../services/api';
import { useMapStore } from '../../store';
import { familyHeatColor } from '../../utils/geo';

interface MapLegendProps {
  microareas: Microarea[];
  streets: Street[];
  ubsList?: Ubs[];
  loading?: boolean;
}

export function MapLegend({ microareas, streets, ubsList = [], loading = false }: MapLegendProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(true);
  const showHeatmap = useMapStore((s) => s.showHeatmap);
  const showUbs = useMapStore((s) => s.showUbsMarkers);
  const glassBg = theme.palette.mode === 'dark'
    ? alpha(theme.palette.background.paper, 0.88)
    : alpha('#fff', 0.92);

  const stats = useMemo(() => {
    const byMicroarea = new Map<string, number>();
    let painted = 0;
    let totalFamilies = 0;
    let maxFamilies = 0;
    for (const s of streets) {
      const families = s.familyCount ?? 0;
      totalFamilies += families;
      if (families > maxFamilies) maxFamilies = families;
      if (s.microareaId) {
        painted++;
        byMicroarea.set(s.microareaId, (byMicroarea.get(s.microareaId) ?? 0) + 1);
      }
    }
    const coverage = streets.length > 0 ? Math.round((painted / streets.length) * 100) : 0;
    return { byMicroarea, painted, coverage, totalFamilies, maxFamilies };
  }, [streets]);

  if (microareas.length === 0) return null;

  return (
    <Paper
      className="map-float-panel"
      elevation={0}
      sx={{
        position: 'absolute',
        bottom: { xs: 220, sm: 200 },
        left: { xs: 8, sm: 16 },
        zIndex: 1000,
        minWidth: { xs: 0, sm: 220 },
        maxWidth: { xs: 'calc(50% - 12px)', sm: 280 },
        bgcolor: glassBg,
        borderRadius: 3,
        overflow: 'hidden',
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
            {loading ? 'Carregando…' : `${stats.painted}/${streets.length} ruas · ${stats.coverage}%`}
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
            {microareas.map((m) => {
              const count = stats.byMicroarea.get(m.id) ?? 0;
              return (
                <Box key={m.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                    {count}
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
              {showHeatmap && (
                <Box sx={{ mt: 0.5 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    Mapa de calor — famílias ({stats.totalFamilies} total)
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
