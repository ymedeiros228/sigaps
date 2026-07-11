import { Box, Paper, Typography, alpha, useTheme } from '@mui/material';
import type { ReactNode } from 'react';
import TouchAppIcon from '@mui/icons-material/TouchApp';
import AutoFixOffIcon from '@mui/icons-material/AutoFixOff';
import PanToolIcon from '@mui/icons-material/PanTool';
import type { Microarea } from '../../services/api';
import { useMapStore } from '../../store';

interface MapPaintBannerProps {
  microarea: Microarea | undefined;
}

export function MapPaintBanner({ microarea }: MapPaintBannerProps) {
  const theme = useTheme();
  const paintMode = useMapStore((s) => s.paintMode);
  const eraserMode = useMapStore((s) => s.eraserMode);
  const mapPanEnabled = useMapStore((s) => s.mapPanEnabled);

  if (!paintMode) return null;

  const accent = eraserMode
    ? theme.palette.error.main
    : microarea?.color ?? theme.palette.primary.main;

  const glassBg =
    theme.palette.mode === 'dark'
      ? alpha(theme.palette.background.paper, 0.94)
      : alpha('#fff', 0.97);

  let icon = <TouchAppIcon sx={{ fontSize: 28 }} />;
  let message: ReactNode = (
    <>
      Toque nas <strong>ruas do mapa</strong> para colorir
      {microarea ? (
        <>
          {' '}
          com <strong style={{ color: accent }}>{microarea.name}</strong>
        </>
      ) : (
        ' — escolha uma cor abaixo primeiro'
      )}
    </>
  );

  if (eraserMode) {
    icon = <AutoFixOffIcon sx={{ fontSize: 28, color: 'error.main' }} />;
    message = (
      <>
        Toque na parte <strong>colorida</strong> da rua para apagar a pintura
      </>
    );
  } else if (mapPanEnabled) {
    icon = <PanToolIcon sx={{ fontSize: 28 }} />;
    message = <>Arraste o mapa para mover. Depois toque em <strong>Pintar ruas</strong> abaixo.</>;
  }

  return (
    <Paper
      className="map-paint-banner"
      elevation={0}
      sx={{
        position: 'absolute',
        top: 'calc(var(--map-toolbar-offset, 120px) + 8px)',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1001,
        width: { xs: 'calc(100% - 16px)', sm: 'auto' },
        maxWidth: 560,
        px: { xs: 2, sm: 2.5 },
        py: { xs: 1.25, sm: 1.5 },
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        bgcolor: glassBg,
        borderRadius: 3,
        border: `2px solid ${alpha(accent, 0.55)}`,
        boxShadow: `0 6px 24px ${alpha(accent, 0.2)}`,
        pointerEvents: 'none',
      }}
    >
      <Box
        sx={{
          width: 44,
          height: 44,
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: alpha(accent, 0.12),
          color: accent,
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Typography variant="body1" sx={{ fontWeight: 600, lineHeight: 1.35, fontSize: { xs: '0.95rem', sm: '1rem' } }}>
        {message}
      </Typography>
    </Paper>
  );
}
