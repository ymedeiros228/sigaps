import { Box, Paper, Typography } from '@mui/material';
import type { Microarea } from '../../services/api';

export function MapLegend({ microareas }: { microareas: Microarea[] }) {
  return (
    <Paper
      sx={{
        position: 'absolute',
        bottom: 24,
        left: 16,
        zIndex: 1000,
        p: 1.5,
        minWidth: 180,
      }}
      elevation={4}
    >
      <Typography variant="subtitle2" gutterBottom>
        Legenda
      </Typography>
      {microareas.map((m) => (
        <Box key={m.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.25 }}>
          <Box
            sx={{
              width: 16,
              height: 4,
              bgcolor: m.color,
              borderRadius: 1,
            }}
          />
          <Typography variant="caption">{m.name}</Typography>
        </Box>
      ))}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.25, mt: 0.5 }}>
        <Box sx={{ width: 16, height: 4, bgcolor: '#888', borderRadius: 1 }} />
        <Typography variant="caption">Sem microárea</Typography>
      </Box>
    </Paper>
  );
}
