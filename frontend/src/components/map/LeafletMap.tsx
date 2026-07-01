import { useEffect, useState, type ReactNode } from 'react';
import { MapContainer, type MapContainerProps } from 'react-leaflet';
import { Box, CircularProgress, Typography } from '@mui/material';

type LeafletMapProps = MapContainerProps & {
  children: ReactNode;
};

/**
 * Monta o Leaflet só no cliente e desmonta no cleanup — evita tela branca com React StrictMode.
 */
export function LeafletMap({ children, ...mapProps }: LeafletMapProps) {
  const [mounted, setMounted] = useState(false);
  const [mapKey, setMapKey] = useState(0);

  useEffect(() => {
    setMounted(true);
    return () => {
      setMounted(false);
      setMapKey((k) => k + 1);
    };
  }, []);

  if (!mounted) {
    return (
      <Box
        sx={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1.5,
          bgcolor: 'background.default',
        }}
      >
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">
          Abrindo mapa...
        </Typography>
      </Box>
    );
  }

  return (
    <MapContainer key={mapKey} {...mapProps}>
      {children}
    </MapContainer>
  );
}
