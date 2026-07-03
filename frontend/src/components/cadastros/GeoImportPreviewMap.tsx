import { useEffect } from 'react';
import { Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Box, Typography } from '@mui/material';
import { LeafletMap } from '../map/LeafletMap';
import { MAP_TILE_LAYERS } from '../../constants/mapTiles';

const SATELLITE_TILE = MAP_TILE_LAYERS.satellite;

export type GeoImportPoint = {
  name: string;
  latitude: number;
  longitude: number;
  subtitle?: string;
  markerColor?: string;
};

function createPreviewIcon(color: string) {
  return L.divIcon({
    className: 'geo-import-preview-marker',
    html: `<div style="
      width: 24px;
      height: 24px;
      background: ${color};
      border: 2px solid #fff;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(0,0,0,0.35);
    "></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
}

function FitPreviewBounds({ points }: { points: GeoImportPoint[] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].latitude, points[0].longitude], 14, { animate: false });
      return;
    }
    const bounds = L.latLngBounds(
      points.map((point) => [point.latitude, point.longitude] as [number, number]),
    );
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 15, animate: false });
  }, [points, map]);

  return null;
}

type GeoImportPreviewMapProps = {
  points: GeoImportPoint[];
  center: { lat: number; lng: number };
  height?: number;
  caption?: string;
  defaultMarkerColor?: string;
};

export function GeoImportPreviewMap({
  points,
  center,
  height = 280,
  caption = 'Pré-visualização no mapa satélite — confira nomes e coordenadas antes de importar.',
  defaultMarkerColor = '#1565C0',
}: GeoImportPreviewMapProps) {
  if (points.length === 0) return null;

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        {caption}
      </Typography>
      <Box
        sx={{
          height,
          borderRadius: 2,
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <LeafletMap
          center={[center.lat, center.lng]}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom
          zoomControl
        >
          <TileLayer
            url={SATELLITE_TILE.url}
            attribution={SATELLITE_TILE.attribution}
            maxZoom={SATELLITE_TILE.maxZoom}
            maxNativeZoom={SATELLITE_TILE.maxNativeZoom}
            detectRetina={SATELLITE_TILE.detectRetina}
          />
          <FitPreviewBounds points={points} />
          {points.map((point, index) => {
            const color = point.markerColor ?? defaultMarkerColor;
            return (
              <Marker
                key={`${point.name}-${index}`}
                position={[point.latitude, point.longitude]}
                icon={createPreviewIcon(color)}
              >
                <Popup>
                  <strong>{point.name}</strong>
                  <br />
                  {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}
                  {point.subtitle && (
                    <>
                      <br />
                      {point.subtitle}
                    </>
                  )}
                </Popup>
              </Marker>
            );
          })}
        </LeafletMap>
      </Box>
    </Box>
  );
}
