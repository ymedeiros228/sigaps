import { useEffect, useState } from 'react';
import { Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Box, Typography } from '@mui/material';
import { MyLocation } from '@mui/icons-material';
import { LeafletMap } from '../map/LeafletMap';
import { MapTileLayerController } from '../map/MapTileLayerController';

function formatCoord(value: number) {
  return value.toFixed(5);
}

const pickerIcon = L.divIcon({
  className: 'place-picker-marker',
  html: `<div style="
    width: 28px;
    height: 28px;
    background: #1565C0;
    border: 3px solid #fff;
    border-radius: 50%;
    box-shadow: 0 2px 10px rgba(0,0,0,0.45);
  "></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function MapClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapCursorTracker({ onMove }: { onMove: (lat: number | null, lng: number | null) => void }) {
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

function MapViewController({
  latitude,
  longitude,
  center,
}: {
  latitude: number | null;
  longitude: number | null;
  center: { lat: number; lng: number };
}) {
  const map = useMap();

  useEffect(() => {
    if (latitude != null && longitude != null && Number.isFinite(latitude) && Number.isFinite(longitude)) {
      map.setView([latitude, longitude], Math.max(map.getZoom(), 14), { animate: false });
      return;
    }
    map.setView([center.lat, center.lng], 13, { animate: false });
  }, [latitude, longitude, center.lat, center.lng, map]);

  return null;
}

type PlaceCoordinatePickerProps = {
  latitude: number | null;
  longitude: number | null;
  center: { lat: number; lng: number };
  onChange: (lat: number, lng: number) => void;
  height?: number;
  pickHint?: string;
};

export function PlaceCoordinatePicker({
  latitude,
  longitude,
  center,
  onChange,
  height = 260,
  pickHint = 'Passe o mouse no mapa para ver as coordenadas. Clique para marcar o local ou arraste o pino para ajustar.',
}: PlaceCoordinatePickerProps) {
  const [cursor, setCursor] = useState<{ lat: number; lng: number } | null>(null);
  const hasPoint =
    latitude != null && longitude != null && Number.isFinite(latitude) && Number.isFinite(longitude);

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        {pickHint}
      </Typography>
      <Box
        sx={{
          position: 'relative',
          height,
          borderRadius: 2,
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
          '& .leaflet-container': { cursor: 'crosshair' },
        }}
      >
        <LeafletMap
          center={[center.lat, center.lng]}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom
          zoomControl
        >
          <MapTileLayerController layerId="satellite" />
          <MapClickHandler onPick={onChange} />
          <MapCursorTracker onMove={(lat, lng) => setCursor(lat != null && lng != null ? { lat, lng } : null)} />
          <MapViewController latitude={latitude} longitude={longitude} center={center} />
          {hasPoint && (
            <Marker
              position={[latitude!, longitude!]}
              icon={pickerIcon}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const pos = e.target.getLatLng();
                  onChange(pos.lat, pos.lng);
                },
              }}
            />
          )}
        </LeafletMap>
        {cursor && (
          <Box
            sx={{
              position: 'absolute',
              left: 8,
              bottom: 8,
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
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              lineHeight: 1.3,
              boxShadow: 2,
            }}
          >
            <MyLocation sx={{ fontSize: 16, opacity: 0.9 }} />
            <Box>
              <Typography component="span" variant="caption" sx={{ display: 'block', color: 'rgba(255,255,255,0.75)' }}>
                Cursor no mapa
              </Typography>
              <Typography component="span" variant="caption" sx={{ fontFamily: 'inherit', fontWeight: 700 }}>
                {formatCoord(cursor.lat)}, {formatCoord(cursor.lng)}
              </Typography>
            </Box>
          </Box>
        )}
      </Box>
      <Box
        sx={{
          mt: 1,
          px: 1.25,
          py: 1,
          borderRadius: 1.5,
          bgcolor: 'action.hover',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
          Coordenadas do cursor
        </Typography>
        <Typography
          variant="body2"
          sx={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: 0.2 }}
        >
          {cursor
            ? `${formatCoord(cursor.lat)}, ${formatCoord(cursor.lng)}`
            : 'Passe o mouse no mapa satélite acima'}
        </Typography>
      </Box>
      {hasPoint && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
          Marcado em {formatCoord(latitude!)}, {formatCoord(longitude!)}
        </Typography>
      )}
    </Box>
  );
}
