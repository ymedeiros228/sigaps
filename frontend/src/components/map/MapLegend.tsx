import { Box, Paper, Typography, alpha, useTheme } from '@mui/material';
import type { Microarea } from '../../services/api';

export function MapLegend({ microareas }: { microareas: Microarea[] }) {
  const theme = useTheme();
  const glassBg = theme.palette.mode === 'dark'
    ? alpha(theme.palette.background.paper, 0.88)
    : alpha('#fff', 0.92);

  return (
    <Paper
      className="map-float-panel"
      elevation={0}
      sx={{
        position: 'absolute',
        bottom: { xs: 220, sm: 200 },
        left: { xs: 8, sm: 16 },
        zIndex: 1000,
        p: { xs: 1.25, sm: 2 },
        minWidth: { xs: 0, sm: 200 },
        maxWidth: { xs: 'calc(50% - 12px)', sm: 260 },
        bgcolor: glassBg,
        borderRadius: 3,
      }}
    >
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
        Legenda
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {microareas.map((m) => (
          <Box key={m.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box
              sx={{
                width: 20,
                height: 5,
                bgcolor: m.color,
                borderRadius: 1,
                boxShadow: `0 0 8px ${m.color}66`,
              }}
            />
            <Typography variant="caption" sx={{ fontWeight: 500 }}>
              {m.name}
            </Typography>
          </Box>
        ))}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, pt: 0.5, borderTop: '1px solid', borderColor: 'divider' }}>
          <Box
            sx={{
              width: 20,
              height: 5,
              bgcolor: '#888',
              borderRadius: 1,
              border: '1px dashed',
              borderColor: 'text.disabled',
            }}
          />
          <Typography variant="caption" color="text.secondary">
            Sem microárea
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
}
