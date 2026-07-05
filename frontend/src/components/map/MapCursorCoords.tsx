import { Box, Typography } from '@mui/material';
import { MyLocation } from '@mui/icons-material';
import { useMapEvents } from 'react-leaflet';

function formatCoord(value: number) {
  return value.toFixed(5);
}

type MapCursorCoordsTrackerProps = {
  onMove: (latitude: number | null, longitude: number | null) => void;
};

export function MapCursorCoordsTracker({ onMove }: MapCursorCoordsTrackerProps) {
  useMapEvents({
    mousemove(e) {
      onMove(e.latlng.lat, e.latlng.lng);
    },
    mouseout() {
      onMove(null, null);
    },
  });
  return null;
}

type MapCursorCoordsBadgeProps = {
  latitude: number | null;
  longitude: number | null;
};

export function MapCursorCoordsBadge({ latitude, longitude }: MapCursorCoordsBadgeProps) {
  const hasCoords = latitude != null && longitude != null;

  return (
    <Box
      sx={{
        position: 'absolute',
        top: { xs: 68, sm: 72 },
        left: { xs: 8, sm: 12 },
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1.25,
        py: 0.75,
        borderRadius: 1.5,
        bgcolor: 'rgba(0, 0, 0, 0.72)',
        color: '#fff',
        pointerEvents: 'none',
        boxShadow: 2,
        maxWidth: { xs: 'calc(100% - 16px)', sm: 320 },
      }}
    >
      <MyLocation sx={{ fontSize: 16, opacity: 0.9, flexShrink: 0 }} />
      <Box sx={{ minWidth: 0 }}>
        <Typography
          component="span"
          variant="caption"
          sx={{ display: 'block', color: 'rgba(255,255,255,0.75)', lineHeight: 1.2 }}
        >
          Coordenadas do cursor
        </Typography>
        <Typography
          component="span"
          variant="caption"
          sx={{
            display: 'block',
            fontFamily: 'monospace',
            fontWeight: 700,
            letterSpacing: 0.2,
            lineHeight: 1.35,
            whiteSpace: 'nowrap',
          }}
        >
          {hasCoords
            ? `${formatCoord(latitude!)}, ${formatCoord(longitude!)}`
            : 'Passe o mouse no mapa'}
        </Typography>
      </Box>
    </Box>
  );
}
